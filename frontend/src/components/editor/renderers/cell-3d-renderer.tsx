/* Copyright 2026 Marimo. All rights reserved. */

import { createPortal } from "react-dom";
import type React from "react";
import { useEffect, useState } from "react";
import * as THREE from "three";
import type { CellCSS2DService } from "@/core/three/cell-css2d-service";
import type { SceneManager } from "@/core/three/scene-manager";
import type { AppConfig, UserConfig } from "@/core/config/config-schema";
import type { AppMode } from "@/core/mode";

interface Cell3DRendererProps {
  mode: AppMode;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userConfig: UserConfig; // CellArrayに渡すために必要（将来の拡張用）
  appConfig: AppConfig;
  sceneManager: SceneManager;
  css2DService: CellCSS2DService;
  children: React.ReactNode; // gridレイアウトのセル（editableCellsArray）
}

/**
 * Cell3DRenderer
 *
 * gridレイアウトのセルを3D空間に配置するコンポーネント
 * - gridレイアウトのセルをCSS2DRendererで表示（cell-3d-container）
 * - 1つのCSS2DObjectとしてセル全体を表示
 * - 3D配置ロジックは不要（gridレイアウトのセルをそのまま配置）
 */
export const Cell3DRenderer: React.FC<Cell3DRendererProps> = ({
  mode,
  userConfig,
  appConfig,
  sceneManager,
  css2DService,
  children,
}) => {
  const [cellContainer, setCellContainer] = useState<HTMLDivElement | null>(null);

  // CellCSS2DServiceからセルコンテナを取得
  useEffect(() => {
    const container = css2DService.getCellContainer();
    if (container) {
      setCellContainer(container);
    } else {
      console.warn(
        "Cell container is not available. Make sure initializeRenderer() is called first.",
      );
    }
  }, [css2DService]);

  // セルコンテナをシーンにアタッチ
  useEffect(() => {
    if (!cellContainer) {
      return;
    }

    const scene = sceneManager.getScene();

    if (!scene) {
      console.warn(
        "Scene is not available. Make sure SceneManager.initialize() is called first.",
      );
      return;
    }

    // 既にアタッチされている場合はスキップ
    if (!css2DService.getCSS2DObject()) {
      // 初期位置: (0, 600, 0) - gridContainerより前方（Y軸正方向）に配置
      // デフォルト値: (0, 600, 0)を使用（カメラ位置(0, 1200, 0)との関係を考慮）
      // 3D物体をgridとcellの間に表示するため、セルをより前方（カメラに近い位置）に配置
      css2DService.attachCellContainerToScene(
        scene,
        new THREE.Vector3(0, 600, 0),
      );
    }
  }, [cellContainer, sceneManager, css2DService]);

  // セルコンテナが準備できていない場合は何も表示しない
  if (!cellContainer) {
    return null;
  }

  // gridレイアウトのセルをCSS2Dコンテナ内にレンダリング
  return createPortal(children, cellContainer);
};
