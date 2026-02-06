/* Copyright 2026 Marimo. All rights reserved. */

import { createPortal } from "react-dom";
import type React from "react";
import { useEffect, useState } from "react";
import * as THREE from "three";
import type { GridCSS2DService } from "@/core/three/grid-css2d-service";
import type { SceneManager } from "@/core/three/scene-manager";
import { EditGridLayoutRenderer } from "./grid-layout/edit-grid-layout";
import type { GridLayout } from "./grid-layout/types";
import type { AppConfig } from "@/core/config/config-schema";
import type { AppMode } from "@/core/mode";
import type { CellData, CellRuntimeState } from "@/core/cells/types";

interface Grid3DRendererProps {
  mode: AppMode;
  appConfig: AppConfig;
  sceneManager: SceneManager;
  css2DService: GridCSS2DService;
  layout: GridLayout;
  setLayout: (layout: GridLayout) => void;
  cells: (CellRuntimeState & CellData)[];
}

/**
 * Grid3DRenderer
 *
 * Gridレイアウトを3D空間に配置するコンポーネント
 * - EditGridLayoutRendererをCSS2DRendererで表示
 * - 1つのCSS2DObjectとしてGrid全体を表示
 * - セルを追加するロジックは含めない（EditGridLayoutRendererが内部で処理）
 */
export const Grid3DRenderer: React.FC<Grid3DRendererProps> = ({
  mode,
  appConfig,
  sceneManager,
  css2DService,
  layout,
  setLayout,
  cells,
}) => {
  const [gridContainer, setGridContainer] = useState<HTMLDivElement | null>(null);

  // GridCSS2DServiceからグリッドコンテナを取得
  useEffect(() => {
    const container = css2DService.getContainer();
    if (container) {
      setGridContainer(container);
    } else {
      console.warn(
        "Grid container is not available. Make sure initializeRenderer() is called first.",
      );
    }
  }, [css2DService]);

  // グリッドコンテナをシーンにアタッチ
  useEffect(() => {
    if (!gridContainer) {
      return;
    }

    const scene = sceneManager.getScene();

    if (!scene) {
      return;
    }

    // 既にアタッチされている場合はスキップ
    if (!css2DService.getCSS2DObject()) {
      css2DService.attachContainerToScene(
        scene,
        new THREE.Vector3(0, 0, 0),
      );
    }
  }, [gridContainer, sceneManager, css2DService]);

  // Gridコンテナが準備できていない場合は何も表示しない
  if (!gridContainer) {
    return null;
  }

  // EditGridLayoutRendererをCSS2Dコンテナ内にレンダリング
  return createPortal(
    <EditGridLayoutRenderer
      appConfig={appConfig}
      mode={mode}
      cells={cells}
      layout={layout}
      setLayout={setLayout}
    />,
    gridContainer,
  );
};
