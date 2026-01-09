/* Copyright 2026 Marimo. All rights reserved. */

import { usePrevious } from "@dnd-kit/utilities";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { Controls } from "@/components/editor/controls/Controls";
import { AppHeader } from "@/components/editor/header/app-header";
import { FilenameForm } from "@/components/editor/header/filename-form";
import { MultiCellActionToolbar } from "@/components/editor/navigation/multi-cell-action-toolbar";
import { cn } from "@/utils/cn";
import { Paths } from "@/utils/paths";
import { AppContainer } from "../components/editor/app-container";
import {
  useRunAllCells,
  useRunStaleCells,
} from "../components/editor/cell/useRunCells";
import { CellArray } from "../components/editor/renderers/cell-array";
import { CellsRenderer } from "../components/editor/renderers/cells-renderer";
import { Grid3DRenderer } from "../components/editor/renderers/grid-3d-renderer";
import { useHotkey } from "../hooks/useHotkey";
import {
  cellIdsAtom,
  hasCellsAtom,
  notebookIsRunningAtom,
  numColumnsAtom,
  useCellActions,
  useNotebook,
  flattenTopLevelNotebookCells,
} from "./cells/cells";
import { CellEffects } from "./cells/effects";
import type { AppConfig, UserConfig } from "./config/config-schema";
import { RuntimeState } from "./kernel/RuntimeState";
import { getSessionId } from "./kernel/session";
import { useTogglePresenting } from "./layout/useTogglePresenting";
import { useLayoutState, useLayoutActions } from "./layout/layout";
import { viewStateAtom } from "./mode";
import { useRequestClient } from "./network/requests";
import { useFilename } from "./saving/filename";
import { lastSavedNotebookAtom } from "./saving/state";
import { useJotaiEffect } from "./state/jotai";
import { GridCSS2DService } from "./three/grid-css2d-service";
import { SceneManager } from "./three/scene-manager";
import { useMarimoKernelConnection } from "./websocket/useMarimoKernelConnection";
import type { GridLayout } from "../components/editor/renderers/grid-layout/types";

interface AppProps {
  /**
   * The user config.
   */
  userConfig: UserConfig;
  /**
   * The app config.
   */
  appConfig: AppConfig;
  /**
   * If true, the floating controls will be hidden.
   */
  hideControls?: boolean;
}

export const EditApp: React.FC<AppProps> = ({
  userConfig,
  appConfig,
  hideControls = false,
}) => {
  useJotaiEffect(cellIdsAtom, CellEffects.onCellIdsChange);

  const { setCells, mergeAllColumns, collapseAllCells, expandAllCells } =
    useCellActions();
  const viewState = useAtomValue(viewStateAtom);
  const numColumns = useAtomValue(numColumnsAtom);
  const hasCells = useAtomValue(hasCellsAtom);
  const filename = useFilename();
  const setLastSavedNotebook = useSetAtom(lastSavedNotebookAtom);
  const { sendComponentValues, sendInterrupt } = useRequestClient();

  const isEditing = viewState.mode === "edit";
  const isPresenting = viewState.mode === "present";
  const isRunning = useAtomValue(notebookIsRunningAtom);
  
  // 3Dモード用の状態管理
  const threeDContainerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const css2DServiceRef = useRef<GridCSS2DService | null>(null);
  const [is3DInitialized, setIs3DInitialized] = useState(false);
  const [containerReady, setContainerReady] = useState(false);

  // Gridレイアウト用の状態管理（3Dモードの時のみ使用）
  const notebook = useNotebook();
  const layoutState = useLayoutState();
  const { setCurrentLayoutData } = useLayoutActions();
  const cells = flattenTopLevelNotebookCells(notebook);

  // GridLayoutRenderer用のsetLayoutラッパー
  const setGridLayout = (layout: GridLayout) => {
    setCurrentLayoutData(layout);
  };

  // Initialize RuntimeState event-listeners
  useEffect(() => {
    RuntimeState.INSTANCE.start(sendComponentValues);
    return () => {
      RuntimeState.INSTANCE.stop();
    };
  }, []);
  
  // 3Dモードの初期化
  useEffect(() => {
    if (!isEditing) {
      // 3Dモードが無効な場合はクリーンアップ
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
      if (css2DServiceRef.current) {
        css2DServiceRef.current.dispose();
        css2DServiceRef.current = null;
      }
      setIs3DInitialized(false);
      setContainerReady(false);
      return;
    }

    // refが設定されるまで待つ
    if (!containerReady || !threeDContainerRef.current) {
      return;
    }

    // SceneManagerとGridCSS2DServiceのインスタンスを作成
    if (!sceneManagerRef.current) {
      sceneManagerRef.current = new SceneManager();
    }
    if (!css2DServiceRef.current) {
      css2DServiceRef.current = new GridCSS2DService();
    }

    const container = threeDContainerRef.current;
    const sceneManager = sceneManagerRef.current;
    const css2DService = css2DServiceRef.current;

    // 初期化順序: SceneManager.initialize() → GridCSS2DService.initializeRenderer() → setCSS2DRenderCallback()
    sceneManager.initialize(container);
    const width = container.clientWidth;
    const height = container.clientHeight;
    css2DService.initializeRenderer(container, width, height);

    // CSS2DRendererのレンダリングループをSceneManagerに統合
    sceneManager.setCSS2DRenderCallback((scene, camera) => {
      css2DService.render(scene, camera);
    });

    setIs3DInitialized(true);

    return () => {
      // クリーンアップ
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
      if (css2DServiceRef.current) {
        css2DServiceRef.current.dispose();
        css2DServiceRef.current = null;
      }
      setIs3DInitialized(false);
      setContainerReady(false);
    };
  }, [isEditing, containerReady]);

  const { connection } = useMarimoKernelConnection({
    autoInstantiate: userConfig.runtime.auto_instantiate,
    setCells: (cells, layout) => {
      setCells(cells);
      const names = cells.map((cell) => cell.name);
      const codes = cells.map((cell) => cell.code);
      const configs = cells.map((cell) => cell.config);
      setLastSavedNotebook({ names, codes, configs, layout });
    },
    sessionId: getSessionId(),
  });

  // Update document title whenever filename or app_title changes
  useEffect(() => {
    // Set document title: app_title takes precedence, then filename, then default
    document.title =
      appConfig.app_title ||
      Paths.basename(filename ?? "") ||
      "Untitled Notebook";
  }, [appConfig.app_title, filename]);

  // Delete column breakpoints if app width changes from "columns"
  const previousWidth = usePrevious(appConfig.width);
  useEffect(() => {
    if (previousWidth === "columns" && appConfig.width !== "columns") {
      mergeAllColumns();
    }
  }, [appConfig.width, previousWidth, mergeAllColumns, numColumns]);

  const runStaleCells = useRunStaleCells();
  const runAllCells = useRunAllCells();
  const togglePresenting = useTogglePresenting();

  // HOTKEYS
  useHotkey("global.runStale", () => {
    runStaleCells();
  });
  useHotkey("global.interrupt", () => {
    sendInterrupt();
  });
  useHotkey("global.hideCode", () => {
    togglePresenting();
  });
  useHotkey("global.runAll", () => {
    runAllCells();
  });
  useHotkey("global.collapseAllSections", () => {
    collapseAllCells();
  });
  useHotkey("global.expandAllSections", () => {
    expandAllCells();
  });

  const editableCellsArray = (
    <CellArray
      mode={viewState.mode}
      userConfig={userConfig}
      appConfig={appConfig}
    />
  );

  return (
    <>
      <AppContainer
        connection={connection}
        isRunning={isRunning}
        width={appConfig.width}
      >
        <AppHeader
          connection={connection}
          className={cn(
            "pt-4 sm:pt-12 pb-2 mb-4 print:hidden z-50",
            // Keep the header sticky when scrolling horizontally, for column mode
            "sticky left-0",
          )}
        >
          {isEditing && (
            <div className="flex items-center justify-center container">
              <FilenameForm filename={filename} />
            </div>
          )}
        </AppHeader>

        {/* Don't render until we have a single cell */}
        {hasCells && (
          <>
          {/* 3Dモードの場合 */}
          {isEditing && (
            <>
              <div
                ref={(el) => {
                  threeDContainerRef.current = el;
                  // refが設定されたらstateを更新してuseEffectをトリガー
                  if (el) {
                    setContainerReady(true);
                  } else {
                    setContainerReady(false);
                  }
                }}
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 0 }}
              />
              {is3DInitialized && sceneManagerRef.current && css2DServiceRef.current && layoutState.selectedLayout === "grid" && (
                <Grid3DRenderer
                  mode={viewState.mode}
                  userConfig={userConfig}
                  appConfig={appConfig}
                  sceneManager={sceneManagerRef.current}
                  css2DService={css2DServiceRef.current}
                  layout={(layoutState.layoutData.grid as GridLayout) || { cells: [], columns: 12, rowHeight: 50, scrollableCells: new Set(), cellSide: new Map() }}
                  setLayout={setGridLayout}
                  cells={cells}
                />
              )}
            </>
          )}
          {/* 通常モードの場合 */}
          {(!isEditing || !is3DInitialized || layoutState.selectedLayout !== "grid") && (
            <CellsRenderer appConfig={appConfig} mode={viewState.mode}>
              {editableCellsArray}
            </CellsRenderer>
          )}
        </>
        )}
      </AppContainer>
      <MultiCellActionToolbar />
      {!hideControls && (
        <TooltipProvider>
          <Controls
            presenting={isPresenting}
            onTogglePresenting={togglePresenting}
            onInterrupt={sendInterrupt}
            onRun={runStaleCells}
            connectionState={connection.state}
            running={isRunning}
            appConfig={appConfig}
          />
        </TooltipProvider>
      )}
    </>
  );
};
