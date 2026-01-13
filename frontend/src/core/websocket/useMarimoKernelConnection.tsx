/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useSetAtom } from "jotai";
import { useRef } from "react";
import { useErrorBoundary } from "react-error-boundary";
import { toast } from "@/components/ui/use-toast";
import { getNotebook, useCellActions } from "@/core/cells/cells";
import { AUTOCOMPLETER } from "@/core/codemirror/completion/Autocompleter";
import type {
  NotificationMessage,
  NotificationPayload,
} from "@/core/kernel/messages";
import { useConnectionTransport } from "@/core/websocket/useWebSocket";
import { renderHTML } from "@/plugins/core/RenderHTML";
import {
  handleWidgetMessage,
  isMessageWidgetState,
  MODEL_MANAGER,
} from "@/plugins/impl/anywidget/model";
import { logNever } from "@/utils/assertNever";
import { prettyError } from "@/utils/errors";
import {
  type JsonString,
  safeExtractSetUIElementMessageBuffers,
} from "@/utils/json/base64";
import { jsonParseWithSpecialChar } from "@/utils/json/json-parser";
import { Logger } from "@/utils/Logger";
import { reloadSafe } from "@/utils/reload-safe";
import { useAlertActions } from "../alerts/state";
import { cacheInfoAtom } from "../cache/requests";
import { type CellId, SCRATCH_CELL_ID, type UIElementId } from "../cells/ids";
import { useRunsActions } from "../cells/runs";
import { focusAndScrollCellOutputIntoView } from "../cells/scrollCellIntoView";
import type { CellData } from "../cells/types";
import { capabilitiesAtom } from "../config/capabilities";
import { useSetAppConfig } from "../config/config";
import { useDataSourceActions } from "../datasets/data-source-connections";
import type { ConnectionName } from "../datasets/engines";
import {
  PreviewSQLTable,
  PreviewSQLTableList,
  ValidateSQL,
} from "../datasets/request-registry";
import { useDatasetsActions } from "../datasets/state";
import { UI_ELEMENT_REGISTRY } from "../dom/uiregistry";
import { kernelStartupErrorAtom, useBannersActions } from "../errors/state";
import { FUNCTIONS_REGISTRY } from "../functions/FunctionRegistry";
import {
  handleCellNotificationeration,
  handleKernelReady,
  handleRemoveUIElements,
} from "../kernel/handlers";
import { queryParamHandlers } from "../kernel/queryParamHandlers";
import type { SessionId } from "../kernel/session";
import { kernelStateAtom } from "../kernel/state";
import { type LayoutState, useLayoutActions } from "../layout/layout";
import { kioskModeAtom } from "../mode";
import { connectionAtom } from "../network/connection";
import type { RequestId } from "../network/DeferredRequestRegistry";
import { useRuntimeManager } from "../runtime/config";
import { SECRETS_REGISTRY } from "../secrets/request-registry";
import { isStaticNotebook } from "../static/static-state";
import { useVariablesActions } from "../variables/state";
import type { VariableName } from "../variables/types";
import { isWasm } from "../wasm/utils";
import { WebSocketClosedReason, WebSocketState } from "./types";

const SUPPORTS_LAZY_KERNELS = true;

function getExistingCells(): CellData[] | undefined {
  if (!SUPPORTS_LAZY_KERNELS) {
    return undefined;
  }

  // Remove scratch pad
  return Object.values(getNotebook().cellData).filter(
    (cell) => cell.id !== SCRATCH_CELL_ID,
  );
}

/**
 * Creates a connection to the Marimo kernel and handles incoming messages.
 */
export function useMarimoKernelConnection(opts: {
  sessionId: SessionId;
  autoInstantiate: boolean;
  setCells: (cells: CellData[], layout: LayoutState) => void;
}) {
  // Track whether we want to try reconnecting.
  const shouldTryReconnecting = useRef<boolean>(true);
  const { autoInstantiate, sessionId, setCells } = opts;
  const { showBoundary } = useErrorBoundary();

  const { handleCellMessage, setCellCodes, setCellIds } = useCellActions();
  const { addCellNotification } = useRunsActions();
  const setKernelState = useSetAtom(kernelStateAtom);
  const setAppConfig = useSetAppConfig();
  const { setVariables, setMetadata } = useVariablesActions();
  const { addColumnPreview } = useDatasetsActions();
  const { addDatasets, filterDatasetsFromVariables } = useDatasetsActions();
  const { addDataSourceConnection, filterDataSourcesFromVariables } =
    useDataSourceActions();
  const { setLayoutData } = useLayoutActions();
  const [connection, setConnection] = useAtom(connectionAtom);
  const { addBanner } = useBannersActions();
  const { addPackageAlert, addStartupLog } = useAlertActions();
  const setKioskMode = useSetAtom(kioskModeAtom);
  const setCapabilities = useSetAtom(capabilitiesAtom);
  const runtimeManager = useRuntimeManager();
  const setCacheInfo = useSetAtom(cacheInfoAtom);
  const setKernelStartupError = useSetAtom(kernelStartupErrorAtom);

  const handleMessage = (e: MessageEvent<JsonString<NotificationPayload>>) => {
    const msg = jsonParseWithSpecialChar(e.data);
    
    // 後方互換性のため、msg.op と msg.data.op の両方に対応
    // Pyodide環境では op がトップレベルにある可能性がある
    const msgWithOp = msg as NotificationPayload & { op?: string };
    const op = msgWithOp.op ?? msg.data?.op;
    
    if (!op) {
      Logger.warn("Received message without op field", msg);
      return;
    }
    
    // msg.dataの型をopに基づいて絞り込む
    // Pyodide環境ではopがトップレベルにあるが、msg.dataは依然としてNotificationMessage型
    // 型アサーションを使用して、各ケースで適切な型に推論されるようにする
    const data = msg.data as NotificationMessage;
    
    switch (op) {
      case "reload":
        reloadSafe();
        return;
      case "kernel-ready": {
        const existingCells = getExistingCells();

        handleKernelReady(msg.data, {
          autoInstantiate,
          setCells,
          setLayoutData,
          setAppConfig,
          setCapabilities,
          setKernelState,
          onError: showBoundary,
          existingCells,
        });
        setKioskMode(data.kiosk);
        return;
      }

      case "completed-run":
        return;
      case "interrupted":
        return;

      case "kernel-startup-error":
        // Full error received via message before websocket close
        setKernelStartupError(msg.data.error);
        return;

      case "send-ui-element-message": {
        const modelId = msg.data.model_id;
        const uiElement = msg.data.ui_element;
        const message = msg.data.message;
        const buffers = safeExtractSetUIElementMessageBuffers(msg.data);

        if (modelId && isMessageWidgetState(message)) {
          handleWidgetMessage({
            modelId,
            msg: message,
            buffers,
            modelManager: MODEL_MANAGER,
          });
        }

        if (uiElement) {
          UI_ELEMENT_REGISTRY.broadcastMessage(
            uiElement as UIElementId,
            data.message,
            buffers,
          );
        }

        return;
      }

      case "remove-ui-elements":
        handleRemoveUIElements(data);
        return;

      case "completion-result":
        AUTOCOMPLETER.resolve(data.completion_id as RequestId, data);
        return;
      case "function-call-result":
        FUNCTIONS_REGISTRY.resolve(
          data.function_call_id as RequestId,
          data,
        );
        return;
      case "cell-op": {
        handleCellNotificationeration(data, handleCellMessage);
        const cellData = getNotebook().cellData[data.cell_id as CellId];
        if (!cellData) {
          return;
        }
        addCellNotification({
          cellNotification: data,
          code: cellData.code,
        });
        return;
      }

      case "variables":
        setVariables(
          data.variables.map((v) => ({
            name: v.name as VariableName,
            declaredBy: v.declared_by as CellId[],
            usedBy: v.used_by as CellId[],
          })),
        );
        filterDatasetsFromVariables(
          data.variables.map((v) => v.name as VariableName),
        );
        filterDataSourcesFromVariables(
          data.variables.map((v) => v.name as VariableName),
        );
        return;
      case "variable-values":
        setMetadata(
          data.variables.map((v) => ({
            name: v.name as VariableName,
            dataType: v.datatype,
            value: v.value,
          })),
        );
        return;
      case "alert":
        toast({
          title: data.title,
          description: renderHTML({
            html: data.description,
          }),
          variant: data.variant,
        });
        return;
      case "banner":
        addBanner(data);
        return;
      case "missing-package-alert":
        addPackageAlert({
          ...data,
          kind: "missing",
        });
        return;
      case "installing-package-alert":
        addPackageAlert({
          ...data,
          kind: "installing",
        });
        return;
      case "startup-logs":
        addStartupLog({
          content: data.content,
          status: data.status,
        });
        return;
      case "query-params-append":
        queryParamHandlers.append(data);
        return;

      case "query-params-set":
        queryParamHandlers.set(data);
        return;

      case "query-params-delete":
        queryParamHandlers.delete(data);
        return;

      case "query-params-clear":
        queryParamHandlers.clear();
        return;

      case "datasets":
        addDatasets(data);
        return;
      case "data-column-preview":
        addColumnPreview(data);
        return;
      case "sql-table-preview":
        PreviewSQLTable.resolve(data.request_id as RequestId, data);
        return;
      case "sql-table-list-preview":
        PreviewSQLTableList.resolve(data.request_id as RequestId, data);
        return;
      case "validate-sql-result":
        ValidateSQL.resolve(data.request_id as RequestId, data);
        return;
      case "secret-keys-result":
        SECRETS_REGISTRY.resolve(data.request_id as RequestId, data);
        return;
      case "cache-info":
        setCacheInfo(data);
        return;
      case "cache-cleared":
        // Cache cleared, could refresh cache info if needed
        return;
      case "data-source-connections":
        addDataSourceConnection({
          connections: data.connections.map((conn) => ({
            ...conn,
            name: conn.name as ConnectionName,
          })),
        });
        return;

      case "reconnected":
        return;

      case "focus-cell":
        focusAndScrollCellOutputIntoView(data.cell_id as CellId);
        return;
      case "update-cell-codes":
        setCellCodes({
          codes: data.codes,
          ids: data.cell_ids as CellId[],
          codeIsStale: data.code_is_stale,
        });
        return;
      case "update-cell-ids":
        setCellIds({ cellIds: data.cell_ids as CellId[] });
        return;
      default:
        logNever(data);
    }
  };

  const tryReconnecting = (code?: number, reason?: string) => {
    // If not properly gated, we could try reconnecting forever if the
    // issue is not transient. So we want to try reconnecting only once after an
    // open connection is closed.
    if (shouldTryReconnecting.current) {
      shouldTryReconnecting.current = false;
      ws.reconnect(code, reason);
    }
  };

  const ws = useConnectionTransport({
    static: isStaticNotebook(),
    /**
     * Unique URL for this session.
     */
    url: () => runtimeManager.getWsURL(sessionId).toString(),

    /**
     * Open callback. Set the connection status to open.
     */
    onOpen: async () => {
      // If we are open, we can reset our reconnecting flag.
      shouldTryReconnecting.current = true;

      // DO NOT COMMIT THIS UNCOMMENTED
      // Uncomment to emulate a slow connection
      // await new Promise((resolve) => setTimeout(resolve, 10_000));

      setConnection({ state: WebSocketState.OPEN });
    },

    /**
     * Wait to connect, in case the remote kernel still starting up.
     */
    waitToConnect: async () => {
      if (isStaticNotebook()) {
        return;
      }
      if (isWasm()) {
        return;
      }

      if (runtimeManager.isSameOrigin) {
        return;
      }
      await runtimeManager.waitForHealthy();
    },

    /**
     * Handle messages sent by the kernel.
     */
    onMessage: (e) => {
      try {
        handleMessage(e);
      } catch (error) {
        Logger.error("Failed to handle message", e.data, error);
        toast({
          title: "Failed to handle message",
          description: prettyError(error),
          variant: "danger",
        });
      }
    },

    /**
     * Handle a close event. We may want to reconnect.
     */
    onClose: (e) => {
      Logger.warn("WebSocket closed", e.code, e.reason);
      switch (e.reason) {
        case "MARIMO_ALREADY_CONNECTED":
          setConnection({
            state: WebSocketState.CLOSED,
            code: WebSocketClosedReason.ALREADY_RUNNING,
            reason: "another browser tab is already connected to the kernel",
            canTakeover: true,
          });
          ws.close(); // close to prevent reconnecting
          return;

        case "MARIMO_WRONG_KERNEL_ID":
        case "MARIMO_NO_FILE_KEY":
        case "MARIMO_NO_SESSION_ID":
        case "MARIMO_NO_SESSION":
        case "MARIMO_SHUTDOWN":
          setConnection({
            state: WebSocketState.CLOSED,
            code: WebSocketClosedReason.KERNEL_DISCONNECTED,
            reason: "kernel not found",
          });
          ws.close(); // close to prevent reconnecting
          return;

        case "MARIMO_MALFORMED_QUERY":
          setConnection({
            state: WebSocketState.CLOSED,
            code: WebSocketClosedReason.MALFORMED_QUERY,
            reason:
              "the kernel did not recognize a request; please file a bug with marimo",
          });
          return;

        default:
          // Check for kernel startup error (full error already received via message)
          if (e.reason === "MARIMO_KERNEL_STARTUP_ERROR") {
            setConnection({
              state: WebSocketState.CLOSED,
              code: WebSocketClosedReason.KERNEL_STARTUP_ERROR,
              reason: "Failed to start kernel sandbox",
            });
            ws.close(); // prevent reconnecting
            return;
          }

          // Session should be valid
          // - browser tab might have been closed or re-opened
          // - computer might have just woken from sleep
          //
          // so try reconnecting.
          setConnection({ state: WebSocketState.CONNECTING });
          tryReconnecting(e.code, e.reason);
      }
    },

    /**
     * When we encounter an error, we should close the connection.
     */
    onError: (e) => {
      Logger.warn("WebSocket error", e);
      setConnection({
        state: WebSocketState.CLOSED,
        code: WebSocketClosedReason.KERNEL_DISCONNECTED,
        reason: "kernel not found",
      });
      tryReconnecting();
    },
  });

  return { connection };
}
