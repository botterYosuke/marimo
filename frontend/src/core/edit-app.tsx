/* Copyright 2026 Marimo. All rights reserved. */

import { usePrevious } from "@dnd-kit/utilities";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { AddCellButtons, CellArray } from "../components/editor/renderers/cell-array";
import { CellsRenderer } from "../components/editor/renderers/cells-renderer";
import { Grid3DRenderer } from "../components/editor/renderers/grid-3d-renderer";
import { Cell3DRenderer } from "../components/editor/renderers/cell-3d-renderer";
import { GridLayoutPlugin } from "../components/editor/renderers/grid-layout/plugin";
import { PackageAlert } from "../components/editor/package-alert";
import { StartupLogsAlert } from "../components/editor/alerts/startup-logs-alert";
import { StdinBlockingAlert } from "../components/editor/stdin-blocking-alert";
import { ConnectingAlert } from "../components/editor/alerts/connecting-alert";
import { NotebookBanner } from "../components/editor/notebook-banner";
import { useHotkey } from "../hooks/useHotkey";
import {
  cellIdsAtom,
  columnIdsAtom,
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
import { cell3DViewAtom } from "./three/cell-3d-view";
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
  useAtomValue(numColumnsAtom); // Used for reactivity when columns change
  const hasCells = useAtomValue(hasCellsAtom);
  const columnIds = useAtomValue(columnIdsAtom);
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
  const containerReadyRef = useRef(false);
  const cell3DView = useAtomValue(cell3DViewAtom);
  const setCell3DView = useSetAtom(cell3DViewAtom);
  const hasRestoredViewRef = useRef(false);

  // GridLayoutRenderer用のsetLayoutラッパー
  const setGridLayout = (layout: GridLayout) => {
    setCurrentLayoutData(layout);
  };

  // cellsのID配列をメモ化して、cells配列の変更を検知する
  const cellIds = useMemo(() => cells.map(c => c.id).join(','), [cells]);

  // layoutState.layoutData.gridの内容を比較するためのキーを生成
  const gridLayoutData = layoutState.layoutData.grid;
  const gridLayoutKey = useMemo(() => {
    if (!gridLayoutData) return 'none';
    // gridLayoutDataの内容を比較するためのキーを生成
    const cellsKey = gridLayoutData.cells.map(c => `${c.i}-${c.x}-${c.y}-${c.w}-${c.h}`).join('|');
    return `${gridLayoutData.columns}-${gridLayoutData.rowHeight}-${cellsKey}`;
  }, [gridLayoutData]);

  // layoutプロップをメモ化して無限ループを防ぐ
  // gridLayoutKeyとcellIdsで実際の変更を検知し、gridLayoutDataとcellsの参照が変わっても
  // 内容が同じなら再計算されないようにする
  // 注意: gridLayoutKeyとcellIdsはuseMemo内で直接使用されていないが、
  // 実際の変更を検知するために依存配列に含めている
  const gridLayout = useMemo(() => {
    return (gridLayoutData as GridLayout) || GridLayoutPlugin.getInitialLayout(cells);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridLayoutKey, cellIds, gridLayoutData, cells]);

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
    // 4. SceneManager.initialize()を呼び出し（サービス参照を渡す、CSS2DRendererを作成）
    // 5. SceneManagerからCSS2DRendererを取得
    // 6. GridCSS2DService.initializeRenderer()を呼び出し（CSS2DRendererを渡す）
    // 7. CellCSS2DService.initializeRenderer()を呼び出し（同じCSS2DRendererを渡す）
    // 8. シーンにコンテナをアタッチ
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

    // SceneManager.initialize()を呼び出し（サービス参照を渡す、CSS2DRendererを作成）
    sceneManager.initialize(
      container,
      css2DService,
      cellCSS2DService,
    );

    // SceneManagerからCSS2DRendererを取得
    const css2DRenderer = sceneManager.getCSS2DRenderer();
    if (!css2DRenderer) {
      console.error("Failed to get CSS2DRenderer from SceneManager");
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
      setIs3DInitialized(false);
      return;
    }

    // GridCSS2DService.initializeRenderer()を呼び出し（CSS2DRendererを渡す）
    try {
      css2DService.initializeRenderer(css2DRenderer);
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

    // CellCSS2DService.initializeRenderer()を呼び出し（同じCSS2DRendererを渡す）
    try {
      cellCSS2DService.initializeRenderer(css2DRenderer);
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
      // SceneManagerが内部でカメラ、WebGLRenderer、CSS2DRendererのリサイズを処理
      // シーンを再レンダリング
      const scene = currentSceneManager.getScene();
      if (scene) {
        currentSceneManager.markNeedsRender();
      }
    };
    window.addEventListener("resize", handleResize);

    setIs3DInitialized(true);

    // OrbitControlsのendイベントで視点情報を保存
    const controls = sceneManager.getControls();
    let handleEnd: (() => void) | undefined;
    if (controls) {
      const camera = sceneManager.getCamera();
      handleEnd = () => {
        if (camera && controls) {
          setCell3DView({
            position: {
              x: camera.position.x,
              y: camera.position.y,
              z: camera.position.z,
            },
            target: {
              x: controls.target.x,
              y: controls.target.y,
              z: controls.target.z,
            },
          });
        }
      };
      controls.addEventListener("end", handleEnd);
    }

    return () => {
      // OrbitControlsのendイベントリスナーを削除
      if (handleEnd && sceneManagerRef.current) {
        const currentControls = sceneManagerRef.current.getControls();
        if (currentControls) {
          currentControls.removeEventListener("end", handleEnd);
        }
      }

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
      hasRestoredViewRef.current = false;
    };
  }, [is3DMode, containerReady, setCell3DView]);

  // 視点情報の復元（初回のみ）
  useEffect(() => {
    if (!is3DInitialized || !sceneManagerRef.current || hasRestoredViewRef.current) {
      return;
    }

    const savedView = cell3DView;
    if (savedView) {
      try {
        sceneManagerRef.current.setCameraView(
          new THREE.Vector3(
            savedView.position.x,
            savedView.position.y,
            savedView.position.z,
          ),
          new THREE.Vector3(
            savedView.target.x,
            savedView.target.y,
            savedView.target.z,
          ),
        );
        hasRestoredViewRef.current = true;
      } catch (error) {
        // エラーが発生した場合も、エラーを投げずに処理を続行
        console.warn("Failed to restore camera view:", error);
      }
    }
  }, [is3DInitialized, cell3DView]);

  // 3Dモードが切れたら復元フラグをリセット
  useEffect(() => {
    if (!is3DMode) {
      hasRestoredViewRef.current = false;
    }
  }, [is3DMode]);

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
  const { selectedLayout } = useLayoutState();
  const { setLayoutView } = useLayoutActions();
  const setIs3DMode = useSetAtom(is3DModeAtom);

  // presentモードからeditモードに切り替える際に、selectedLayoutに基づいてis3DModeAtomを更新
  // editモードでは"slides"は使用できないため、"vertical"に変換する
  useEffect(() => {
    if (viewState.mode === "edit") {
      // editモードでは"slides"は使用できないため、"vertical"に変換
      if (selectedLayout === "slides") {
        setLayoutView("vertical");
        setIs3DMode(false);
      } else {
        setIs3DMode(selectedLayout === "grid");
      }
    }
  }, [viewState.mode, selectedLayout, setIs3DMode, setLayoutView]);

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
            {/* アラートとバナーは通常の2D表示として表示 */}
            <div className="m-auto pb-24 sm:pb-12 max-w-(--content-width) min-w-[400px] pr-4 relative z-50 pointer-events-none">
              <div className="pointer-events-auto">
                <PackageAlert />
                <StartupLogsAlert />
                <StdinBlockingAlert />
                <ConnectingAlert />
                <NotebookBanner width={appConfig.width} />
              </div>
            </div>
            {/* AddCellButtonsを3Dモードでも表示 */}
            {columnIds[0] && (
              <div className="relative z-50 flex justify-center pointer-events-none">
                <AddCellButtons columnId={columnIds[0]} />
              </div>
            )}
            {/* 3Dモードの場合（gridレイアウトのみ） */}
            <div
              ref={(el) => {
                // refが変更された場合のみ状態を更新（無限ループを防ぐ）
                if (threeDContainerRef.current !== el) {
                  threeDContainerRef.current = el;
                  // 前の値と比較して変更があった場合のみsetStateを呼び出す
                  const isReady = !!el;
                  if (containerReadyRef.current !== isReady) {
                    containerReadyRef.current = isReady;
                    setContainerReady(isReady);
                  }
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
                  layout={gridLayout}
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
