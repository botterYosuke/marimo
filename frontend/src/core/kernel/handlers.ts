/* Copyright 2026 Marimo. All rights reserved. */
import { deserializeLayout } from "@/components/editor/renderers/plugins";
import type { LayoutType } from "@/components/editor/renderers/types";
import { sendBroadcastMessage } from "@/utils/broadcastChannel";
import { Logger } from "@/utils/Logger";
import { Objects } from "@/utils/objects";
import type { CellId, UIElementId } from "../cells/ids";
import { type CellData, createCell } from "../cells/types";
import { type AppConfig, AppConfigSchema } from "../config/config-schema";
import { UI_ELEMENT_REGISTRY } from "../dom/uiregistry";
import {
  addCellToGridLayout,
  initialLayoutState,
  isCellInGrid,
  type LayoutData,
  type LayoutState,
  layoutStateAtom,
} from "../layout/layout";
import { isVisualOutput } from "../layout/visual-output-detector";
import { getRequestClient } from "../network/requests";
import { store } from "../state/jotai";
import { VirtualFileTracker } from "../static/virtual-file-tracker";
import type {
  Capabilities,
  CellMessage,
  NotificationMessageData,
} from "./messages";
import type { KernelState } from "./state";

type KernelReadyData = NotificationMessageData<"kernel-ready">;

/**
 * Build cells from kernel-ready data.
 */
export function buildCellData(data: KernelReadyData): CellData[] {
  const {
    codes,
    names,
    configs,
    cell_ids,
    last_executed_code,
    last_execution_time,
  } = data;

  const lastExecutedCode = last_executed_code || {};
  const lastExecutionTime = last_execution_time || {};

  return codes.map((code, i) => {
    const cellId = cell_ids[i];
    const lastCodeRun = lastExecutedCode[cellId];

    // A cell is edited if the code has changed since the last time it was run
    const edited = lastCodeRun ? lastCodeRun !== code : false;

    return createCell({
      id: cellId as CellId,
      code,
      edited,
      name: names[i],
      lastCodeRun: lastExecutedCode[cellId] ?? null,
      lastExecutionTime: lastExecutionTime[cellId] ?? null,
      config: configs[i],
    });
  });
}

/**
 * Build layout state from kernel-ready data.
 */
export function buildLayoutState(
  data: KernelReadyData,
  cells: CellData[],
  setLayoutData: (payload: {
    layoutView: LayoutType;
    data: LayoutData;
  }) => void,
): LayoutState {
  const layoutState = initialLayoutState();
  const { layout } = data;

  if (layout) {
    const layoutType = layout.type as LayoutType;
    const layoutData = deserializeLayout({
      type: layoutType,
      data: layout.data,
      cells,
    });
    layoutState.selectedLayout = layoutType;
    layoutState.layoutData[layoutType] = layoutData;
    setLayoutData({ layoutView: layoutType, data: layoutData });
  }

  return layoutState;
}

/**
 * Collect current UI element values from the registry.
 */
function collectUIElementValues() {
  const objectIds: UIElementId[] = [];
  const values: unknown[] = [];
  UI_ELEMENT_REGISTRY.entries.forEach((entry, objectId) => {
    objectIds.push(objectId);
    values.push(entry.value);
  });
  return { objectIds, values };
}

export function handleKernelReady(
  data: KernelReadyData,
  opts: {
    autoInstantiate: boolean;
    setCells: (cells: CellData[], layout: LayoutState) => void;
    setLayoutData: (payload: {
      layoutView: LayoutType;
      data: LayoutData;
    }) => void;
    setCapabilities: (capabilities: Capabilities) => void;
    setKernelState: (state: KernelState) => void;
    setAppConfig: (config: AppConfig) => void;
    onError: (error: Error) => void;
    /**
     * If provided, these cells will be used instead of the cells from
     * kernel-ready. This allows preserving local edits made before connecting.
     */
    existingCells?: CellData[];
  },
) {
  const {
    existingCells,
    autoInstantiate,
    setCells,
    setLayoutData,
    setAppConfig,
    setCapabilities,
    setKernelState,
    onError,
  } = opts;
  const { resumed, ui_values, app_config, capabilities, auto_instantiated } =
    data;

  // Use existing cells if provided (local pre-connect edits), otherwise build from kernel-ready
  // If the kernel was resumed, we don't want to use the existing cells because they may be stale.
  const hasExistingCells = existingCells && existingCells.length > 0;
  const cells =
    hasExistingCells && !resumed ? existingCells : buildCellData(data);

  // Set up layout and cells
  const layoutState = buildLayoutState(data, cells, setLayoutData);
  setCells(cells, layoutState);

  // Set app config and capabilities
  const parsedAppConfig = AppConfigSchema.safeParse(app_config);
  if (parsedAppConfig.success) {
    setAppConfig(parsedAppConfig.data);
  } else {
    Logger.error("Failed to parse app config", parsedAppConfig.error);
  }
  setCapabilities(capabilities);

  // If the kernel was already instantiated server-side (e.g. run mode), we're done
  if (auto_instantiated) {
    return;
  }

  // If resumed, restore UI element values from kernel and we're done
  if (resumed) {
    for (const [objectId, value] of Objects.entries(ui_values || {})) {
      UI_ELEMENT_REGISTRY.set(objectId as UIElementId, value);
    }
    return;
  }

  // If we already have values for some objects, we should
  // send them to the kernel. This may happen after re-connecting
  // to the kernel after the computer wakes from sleep.
  const { objectIds, values } = collectUIElementValues();
  const codesToSend = hasExistingCells
    ? Object.fromEntries(existingCells.map((c) => [c.id, c.code]))
    : undefined;

  // Send instantiate request to kernel
  void getRequestClient()
    .sendInstantiate({
      objectIds,
      values,
      autoRun: autoInstantiate,
      codes: codesToSend,
    })
    .then(() => {
      setKernelState({ isInstantiated: true, error: null });
    })
    .catch((error) => {
      setKernelState({ isInstantiated: false, error: error });
      onError(new Error("Failed to instantiate", { cause: error }));
    });
}

export function handleRemoveUIElements(
  data: NotificationMessageData<"remove-ui-elements">,
) {
  // This removes the element from the registry to (1) clean-up
  // memory and (2) make sure that the old value doesn't get re-used
  // if the same cell-id is later reused for another element.
  const cellId = data.cell_id as CellId;
  UI_ELEMENT_REGISTRY.removeElementsByCell(cellId);
  VirtualFileTracker.INSTANCE.removeForCellId(cellId);
}

/**
 * Extract and send marimo-broadcast messages from HTML output.
 * This is called at WebSocket receive time to ensure all messages are processed,
 * even when React batches state updates and only renders the final state.
 */
function extractAndSendBroadcastMessages(html: string): void {
  // Quick check before running regex
  if (!html.includes("marimo-broadcast")) {
    return;
  }

  // Pattern 1: Match <marimo-broadcast> tag and extract attributes (any order)
  const tagRegex = /<marimo-broadcast([^>]*)>/gi;
  let match = tagRegex.exec(html);
  while (match) {
    const attrString = match[1];
    const channelMatch = /channel="([^"]+)"/.exec(attrString);
    const typeMatch = /type="([^"]+)"/.exec(attrString);
    const payloadMatch = /payload="([^"]+)"/.exec(attrString);

    if (channelMatch && typeMatch && payloadMatch) {
      sendBroadcastMessage(channelMatch[1], typeMatch[1], payloadMatch[1]);
    }
    match = tagRegex.exec(html);
  }

  // Pattern 2: Match data-marimo-broadcast attribute (any order)
  const divRegex = /<[^>]+data-marimo-broadcast="([^"]+)"[^>]*>/gi;
  match = divRegex.exec(html);
  while (match) {
    const fullMatch = match[0];
    const channel = match[1];
    const typeMatch = /data-marimo-type="([^"]+)"/.exec(fullMatch);
    const payloadMatch = /data-marimo-payload="([^"]+)"/.exec(fullMatch);

    if (typeMatch && payloadMatch) {
      sendBroadcastMessage(channel, typeMatch[1], payloadMatch[1]);
    }
    match = divRegex.exec(html);
  }
}

export function handleCellNotificationeration(
  data: NotificationMessageData<"cell-op">,
  handleCellMessage: (message: CellMessage) => void,
) {
  /* Register a state transition for a cell.
   *
   * The cell may have a new output, a new console output,
   * it may have been queued, it may have started running, or
   * it may have stopped running. Each of these things
   * affects how the cell should be rendered.
   */

  // Extract broadcast messages from HTML output BEFORE React processes it.
  // This ensures all messages are sent even when React batches state updates.
  const output = data.output;
  if (output?.mimetype === "text/html" && typeof output.data === "string") {
    extractAndSendBroadcastMessages(output.data);
  }

  handleCellMessage(data);
  VirtualFileTracker.INSTANCE.track(data);

  // Auto-place visual outputs in grid layout
  autoPlaceVisualOutput(data);
}

/**
 * Auto-place a cell in the grid layout if it has visual output
 * and auto-layout is enabled.
 */
function autoPlaceVisualOutput(data: NotificationMessageData<"cell-op">) {
  const cellId = data.cell_id as CellId;
  const output = data.output;

  // Skip if no output
  if (!output) {
    return;
  }

  // Check layout state
  const layoutState = store.get(layoutStateAtom);

  // Only auto-place in grid layout mode
  if (layoutState.selectedLayout !== "grid") {
    return;
  }

  // Only auto-place if auto-layout is enabled
  if (!layoutState.autoLayoutEnabled) {
    Logger.log(`[autoPlace] Cell ${cellId}: autoLayout disabled, skipping`);
    return;
  }

  // Skip if cell is already in the grid
  if (isCellInGrid(cellId)) {
    return;
  }

  // Check if output is visual
  const visual = isVisualOutput(output);
  Logger.log(
    `[autoPlace] Cell ${cellId}: isVisual=${visual}, mimetype=${output.mimetype}`,
  );
  if (!visual) {
    return;
  }

  // Add cell to grid layout
  Logger.log(`[autoPlace] Cell ${cellId}: adding to grid layout`);
  addCellToGridLayout(cellId);
}
