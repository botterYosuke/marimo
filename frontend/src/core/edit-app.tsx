/* Copyright 2026 Marimo. All rights reserved. */

import { usePrevious } from "@dnd-kit/utilities";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
// import { NotStartedConnectionAlert } from "@/components/editor/alerts/connecting-alert";
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
import { Cell3DRenderer } from "../components/editor/renderers/cell-3d-renderer";
import { GridLayoutPlugin } from "../components/editor/renderers/grid-layout/plugin";
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
import { is3DModeAtom, viewStateAtom } from "./mode";
import { useRequestClient } from "./network/requests";
import { useFilename } from "./saving/filename";
import { lastSavedNotebookAtom } from "./saving/state";
import { useJotaiEffect } from "./state/jotai";
import { GridCSS2DService } from "./three/grid-css2d-service";
import { CellCSS2DService } from "./three/cell-css2d-service";
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
  
  // Gridレイアウト用の状態管理（3Dモードの時のみ使用）
  const notebook = useNotebook();
  const layoutState = useLayoutState();
  const { setCurrentLayoutData } = useLayoutActions();
  const cells = flattenTopLevelNotebookCells(notebook);

  // 3Dモード用の状態管理
  const is3DModeFromAtom = useAtomValue(is3DModeAtom);
  // Editモードの時のみatomの値に従って3D表示を制御
  const is3DMode = is3DModeFromAtom && viewState.mode === "edit";
  const threeDContainerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const css2DServiceRef = useRef<GridCSS2DService | null>(null);
  const cellCSS2DServiceRef = useRef<CellCSS2DService | null>(null);
  const [is3DInitialized, setIs3DInitialized] = useState(false);
  const [containerReady, setContainerReady] = useState(false);

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
  }, [sendComponentValues]);
  
  // 3Dモードの初期化
  useEffect(() => {
    if (!is3DMode) {
      // 3Dモードが無効な場合はクリーンアップ
      if (cellCSS2DServiceRef.current) {
        cellCSS2DServiceRef.current.dispose();
        cellCSS2DServiceRef.current = null;
      }
      if (css2DServiceRef.current) {
        css2DServiceRef.current.dispose();
        css2DServiceRef.current = null;
      }
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
      setIs3DInitialized(false);
      setContainerReady(false);
      return;
    }

    // refが設定されるまで待つ
    if (!containerReady || !threeDContainerRef.current) {
      return;
    }

    // 初期化順序を明確化:
    // 1. SceneManagerのインスタンス作成
    // 2. GridCSS2DServiceのインスタンス作成
    // 3. CellCSS2DServiceのインスタンス作成
    // 4. SceneManager.initialize()を呼び出し（サービス参照を渡す）
    // 5. GridCSS2DService.initializeRenderer()を呼び出し（エラーハンドリング追加）
    // 6. CellCSS2DService.initializeRenderer()を呼び出し（エラーハンドリング追加）
    // 7. シーンにコンテナをアタッチ
    // 注意: CSS2DレンダリングはSceneManagerのアニメーションループ内で直接実行される

    if (!sceneManagerRef.current) {
      sceneManagerRef.current = new SceneManager();
    }
    if (!css2DServiceRef.current) {
      css2DServiceRef.current = new GridCSS2DService();
    }
    if (!cellCSS2DServiceRef.current) {
      cellCSS2DServiceRef.current = new CellCSS2DService();
    }

    const container = threeDContainerRef.current;
    const sceneManager = sceneManagerRef.current;
    const css2DService = css2DServiceRef.current;
    const cellCSS2DService = cellCSS2DServiceRef.current;

    // SceneManager.initialize()を呼び出し（サービス参照を渡す）
    sceneManager.initialize(
      container,
      css2DService,
      cellCSS2DService,
    );
    const width = container.clientWidth;
    const height = container.clientHeight;

    // GridCSS2DService.initializeRenderer()を呼び出し（エラーハンドリング追加）
    try {
      css2DService.initializeRenderer(container, width, height);
    } catch (error) {
      console.error("Failed to initialize GridCSS2DService:", error);
      // エラー時はロールバック（既存のインスタンスをクリーンアップ）
      if (css2DServiceRef.current) {
        css2DServiceRef.current.dispose();
        css2DServiceRef.current = null;
      }
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
      setIs3DInitialized(false);
      return;
    }

    // CellCSS2DService.initializeRenderer()を呼び出し（エラーハンドリング追加）
    try {
      const cellCSS2DService = cellCSS2DServiceRef.current;
      cellCSS2DService.initializeRenderer(container, width, height);
    } catch (error) {
      console.error("Failed to initialize CellCSS2DService:", error);
      // エラー時はロールバック（CellCSS2DService、GridCSS2DService、SceneManagerをクリーンアップ）
      if (cellCSS2DServiceRef.current) {
        cellCSS2DServiceRef.current.dispose();
        cellCSS2DServiceRef.current = null;
      }
      if (css2DServiceRef.current) {
        css2DServiceRef.current.dispose();
        css2DServiceRef.current = null;
      }
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
      setIs3DInitialized(false);
      return;
    }

    // シーンにコンテナをアタッチ（GridCSS2DServiceとCellCSS2DService）
    const scene = sceneManager.getScene();
    if (scene) {
      // GridCSS2DServiceのコンテナをシーンにアタッチ
      if (css2DServiceRef.current && !css2DServiceRef.current.getCSS2DObject()) {
        css2DServiceRef.current.attachContainerToScene(
          scene,
          new THREE.Vector3(0, 0, 0),
        );
      }
      // CellCSS2DServiceのコンテナをシーンにアタッチ
      if (cellCSS2DServiceRef.current && !cellCSS2DServiceRef.current.getCSS2DObject()) {
        cellCSS2DServiceRef.current.attachCellContainerToScene(
          scene,
          new THREE.Vector3(0, 600, 0),
        );
      }
    }

    // リサイズハンドラー: SceneManagerは内部でWebGLRendererとカメラのリサイズを処理（80-97行目）
    // SceneManagerのリサイズハンドラーはprivateなので、外部から制御できない
    // そのため、edit-app.tsxで別のリサイズハンドラーを追加する実装で動作する
    // 同じresizeイベントで処理することで効率的
    // 注意: SceneManagerのリサイズハンドラーと重複しないよう注意
    // 両方のCSS2DRendererのリサイズを確実に実行する
    const handleResize = () => {
      // refから直接参照することで、常に最新の値を取得
      const currentContainer = threeDContainerRef.current;
      const currentSceneManager = sceneManagerRef.current;
      const currentCss2DService = css2DServiceRef.current;
      const currentCellCSS2DService = cellCSS2DServiceRef.current;

      if (!currentContainer || !currentSceneManager || !currentCss2DService || !currentCellCSS2DService) {
        return;
      }
      const width = currentContainer.clientWidth || window.innerWidth;
      const height = currentContainer.clientHeight || window.innerHeight;
      
      // SceneManagerが内部でカメラとWebGLRendererのリサイズを処理（既存のリサイズハンドラー）
      // ここでCSS2DRendererのリサイズを追加
      currentCss2DService.setSize(width, height);
      currentCellCSS2DService.setSize(width, height);
      
      // シーンを再レンダリング
      const scene = currentSceneManager.getScene();
      if (scene) {
        currentSceneManager.markNeedsRender();
      }
    };
    window.addEventListener("resize", handleResize);

    setIs3DInitialized(true);

    return () => {
      // リサイズハンドラーを削除（確実に削除する必要がある）
      window.removeEventListener("resize", handleResize);
      
      // クリーンアップ順序: 初期化の逆順で実行
      // 1. CellCSS2DServiceのクリーンアップ（最後に初期化したものから）
      if (cellCSS2DServiceRef.current) {
        cellCSS2DServiceRef.current.dispose();
        cellCSS2DServiceRef.current = null;
      }
      
      // 2. GridCSS2DServiceのクリーンアップ
      if (css2DServiceRef.current) {
        css2DServiceRef.current.dispose();
        css2DServiceRef.current = null;
      }
      
      // 3. SceneManagerのクリーンアップ（最初に初期化したものから）
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
      
      // 状態をリセット
      setIs3DInitialized(false);
      setContainerReady(false);
    };
  }, [is3DMode, containerReady]);

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
  }, [appConfig.width, previousWidth, mergeAllColumns]);

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
            "pointer-events-none",
          )}
        >
          {isEditing && !is3DMode && (
            <div className="flex items-center justify-center container">
              <FilenameForm filename={filename} />
            </div>
          )}
        </AppHeader>

        {/* 3D表示モード */}
        {is3DMode ? (
          <>
          {/* 3Dモードの場合（gridレイアウトのみ） */}
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
            className="w-full h-full relative"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}
          />
          {is3DInitialized && hasCells && sceneManagerRef.current && css2DServiceRef.current && cellCSS2DServiceRef.current ? (
            <>
              <Grid3DRenderer
                mode={viewState.mode}
                appConfig={appConfig}
                sceneManager={sceneManagerRef.current}
                css2DService={css2DServiceRef.current}
                layout={(layoutState.layoutData.grid as GridLayout) || GridLayoutPlugin.getInitialLayout(cells)}
                setLayout={setGridLayout}
                cells={cells}
              />
              <Cell3DRenderer
                mode={viewState.mode}
                userConfig={userConfig}
                appConfig={appConfig}
                sceneManager={sceneManagerRef.current}
                css2DService={cellCSS2DServiceRef.current}
              />
            </>
          ) : null}
          </>
        ) : ( 
          /* Don't render until we have a single cell */
          hasCells && (          
            <CellsRenderer appConfig={appConfig} mode={viewState.mode}>
              {editableCellsArray}
            </CellsRenderer>
          )
        )}
        {/* {!hasCells && <NotStartedConnectionAlert />} */}
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
