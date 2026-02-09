/* Copyright 2026 Marimo. All rights reserved. */

import { createPortal } from "react-dom";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import * as THREE from "three";
import { useAtomValue, useSetAtom } from "jotai";
import type { CellCSS2DService } from "@/core/three/cell-css2d-service";
import type { SceneManager } from "@/core/three/scene-manager";
import { CellDragManager } from "@/core/three/cell-drag-manager";
import { Cell3DWrapper } from "./cell-3d-wrapper";
import type { AppConfig, UserConfig } from "@/core/config/config-schema";
import type { AppMode } from "@/core/mode";
import { useCellIds } from "@/core/cells/cells";
import { SETUP_CELL_ID, type CellId } from "@/core/cells/ids";
import { useTheme } from "@/theme/useTheme";
import {
  cell3DPositionsAtom,
} from "@/core/three/cell-3d-positions";
import { SortableCellsProvider } from "@/components/sort/SortableCellsProvider";

/**
 * 新規セルのスポーン位置を計算する。
 * ビューポート中央（OrbitControls.target）を基準とし、
 * 既存セルとの衝突を回避するオフセットを適用する。
 *
 * 返り値は "hybrid座標" — containerPosition を基準にCSS変換で
 * スクリーン中央に表示される値。真のワールド座標ではない。
 */
function calcSpawnPosition(
  sceneManager: SceneManager,
  css2DService: CellCSS2DService,
  cellPositions: Map<string, THREE.Vector3>,
): THREE.Vector3 {
  const camera = sceneManager.getCamera();
  const controls = sceneManager.getControls();
  const containerPosition =
    css2DService.getContainerPosition() || new THREE.Vector3(0, 600, 0);
  const scale = css2DService.getContainerScale();
  const renderer = sceneManager.getRenderer();

  let baseX = containerPosition.x;
  let baseZ = containerPosition.z;

  if (camera && controls && renderer) {
    // コンテナの3D位置をスクリーンNDCに投影
    const containerNDC = containerPosition.clone().project(camera);
    const screenWidth = renderer.domElement.clientWidth;
    const screenHeight = renderer.domElement.clientHeight;

    // スクリーン中央とコンテナ投影位置の差分をCSSオフセットに変換
    // NDC (0,0) = スクリーン中央なので、コンテナのNDC値がそのままオフセット
    const cssLeft = (-containerNDC.x * screenWidth) / (2 * scale);
    const cssTop = (containerNDC.y * screenHeight) / (2 * scale);

    // hybrid position（containerPos + cssOffset）として格納
    baseX = containerPosition.x + cssLeft;
    baseZ = containerPosition.z + cssTop;
  }

  // 衝突回避: offset増加後に既にスキップしたセルと重なるケースがあるため
  // 衝突が見つかるたびにループを最初からやり直す
  const OFFSET = 30;
  let offset = 0;
  let hasCollision = true;
  while (hasCollision) {
    hasCollision = false;
    for (const [, existing] of cellPositions) {
      if (
        Math.abs(existing.x - (baseX + offset)) < 10 &&
        Math.abs(existing.z - (baseZ + offset)) < 10
      ) {
        offset += OFFSET;
        hasCollision = true;
        break;
      }
    }
  }
  return new THREE.Vector3(baseX + offset, 600, baseZ + offset);
}

interface Cell3DRendererProps {
  mode: AppMode;
  userConfig: UserConfig;
  appConfig: AppConfig;
  sceneManager: SceneManager;
  css2DService: CellCSS2DService;
}

/**
 * Cell3DRenderer
 *
 * セルを3D空間に配置するコンポーネント
 * - コンテナ全体を1つのCSS2DObjectとして3D空間に配置
 * - 個別セルはコンテナ内にCSS座標で配置
 * - ビューポート中央配置（初期配置のみ）
 * - セルの追加/削除時の位置更新
 * - ドラッグ機能の統合
 */
export const Cell3DRenderer: React.FC<Cell3DRendererProps> = ({
  mode,
  userConfig,
  appConfig,
  sceneManager,
  css2DService,
}) => {
  const [cellContainer, setCellContainer] = useState<HTMLDivElement | null>(null);
  const cellIds = useCellIds();
  const { theme } = useTheme();
  const cellWrapperElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const dragManagerRef = useRef<CellDragManager | null>(null);
  const cellPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const cell3DPositions = useAtomValue(cell3DPositionsAtom);
  const cell3DPositionsRef = useRef(cell3DPositions);
  const setCell3DPositions = useSetAtom(cell3DPositionsAtom);

  // atomが更新されたらrefも更新
  useEffect(() => {
    cell3DPositionsRef.current = cell3DPositions;
  }, [cell3DPositions]);

  // セルIDのリストを取得（フラット化、SETUP_CELL_IDを除外）
  const allCellIds = useMemo(() => {
    return cellIds.inOrderIds.filter((id) => id !== SETUP_CELL_ID);
  }, [cellIds]);

  // CellDragManagerの初期化
  useEffect(() => {
    const dragManager = new CellDragManager();
    dragManager.setPositionUpdateCallback((cellId, position) => {
      // 位置を保存
      cellPositionsRef.current.set(cellId, position);

      // atomにも保存
      setCell3DPositions((prev) => {
        const next = new Map(prev);
        next.set(cellId as CellId, {
          x: position.x,
          y: position.y,
          z: position.z,
        });
        return next;
      });

      // セル要素のCSSスタイルを更新
      const wrapperElement = cellWrapperElementsRef.current.get(cellId);
      if (wrapperElement) {
        const containerPosition =
          css2DService.getContainerPosition() ||
          new THREE.Vector3(0, 600, 0);
        const relativePosition = new THREE.Vector3(
          position.x - containerPosition.x,
          position.y - containerPosition.y,
          position.z - containerPosition.z,
        );
        wrapperElement.style.left = `${relativePosition.x}px`;
        wrapperElement.style.top = `${relativePosition.z}px`;
      }

      // レンダリングをマーク
      sceneManager.markNeedsRender();
      css2DService.markNeedsRender();
    });
    dragManager.setCSS2DService(css2DService);
    dragManagerRef.current = dragManager;

    return () => {
      dragManager.dispose();
    };
  }, [css2DService, sceneManager, setCell3DPositions]);

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

  // コンテナをシーンにアタッチ
  useEffect(() => {
    if (!cellContainer) {
      return;
    }

    const scene = sceneManager.getScene();
    if (!scene) {
      return;
    }

    // 既にアタッチされている場合はスキップ
    if (!css2DService.getCSS2DObject()) {
      css2DService.attachCellContainerToScene(scene, new THREE.Vector3(0, 600, 0));
    }
  }, [cellContainer, sceneManager, css2DService]);

  // セルを3D空間に配置
  useEffect(() => {
    if (!cellContainer) {
      return;
    }

    const scene = sceneManager.getScene();
    if (!scene) {
      return;
    }

    const dragManager = dragManagerRef.current;
    if (!dragManager) {
      return;
    }

    // コンテナの3D位置を取得
    const containerPosition =
      css2DService.getContainerPosition() || new THREE.Vector3(0, 600, 0);

    // 各セルのラッパー要素を取得してCSS座標で配置
    const updatePositions = () => {
      allCellIds.forEach((cellId) => {
        // ラッパー要素を検索
        const wrapperElement = cellContainer.querySelector(
          `[data-cell-wrapper-id="${cellId}"]`,
        ) as HTMLElement;

        if (!wrapperElement) {
          return; // ラッパー要素が見つからない場合はスキップ
        }

        // 既存の位置を取得、またはatomから復元、またはビューポート中央に配置
        let position = cellPositionsRef.current.get(cellId);
        if (!position) {
          // atomから位置情報を復元を試みる（最新値を参照）
          const savedPosition = cell3DPositionsRef.current.get(cellId);
          if (savedPosition) {
            // atomに位置があれば、THREE.Vector3に変換して使用
            position = new THREE.Vector3(
              savedPosition.x,
              savedPosition.y,
              savedPosition.z,
            );
            cellPositionsRef.current.set(cellId, position);
          } else {
            // 初期配置：ビューポート中央に配置
            position = calcSpawnPosition(sceneManager, css2DService, cellPositionsRef.current);
            cellPositionsRef.current.set(cellId, position);
            // スポーン位置をatomにも保存（再配置防止）
            const spawnedPos = position;
            setCell3DPositions((prev) => {
              const next = new Map(prev);
              next.set(cellId, { x: spawnedPos.x, y: spawnedPos.y, z: spawnedPos.z });
              return next;
            });
          }
        } else {
          // 既存の位置のY座標を600に設定（atomから復元した場合は変更しない）
          position.y = 600;
        }

        // コンテナ位置を基準に相対位置を計算
        const relativePosition = new THREE.Vector3(
          position.x - containerPosition.x,
          position.y - containerPosition.y,
          position.z - containerPosition.z,
        );

        // CSS座標で位置を設定
        wrapperElement.style.left = `${relativePosition.x}px`;
        wrapperElement.style.top = `${relativePosition.z}px`;

        cellWrapperElementsRef.current.set(cellId, wrapperElement);
      });

      // 削除されたセルの位置情報をクリーンアップ
      const currentCellIds = new Set(allCellIds);
      const deletedCellIds: CellId[] = [];
      cellPositionsRef.current.forEach((_, cellId) => {
        if (!currentCellIds.has(cellId as CellId)) {
          cellPositionsRef.current.delete(cellId);
          cellWrapperElementsRef.current.delete(cellId);
          deletedCellIds.push(cellId as CellId);
        }
      });
      // atomからも削除
      if (deletedCellIds.length > 0) {
        setCell3DPositions((prev) => {
          const next = new Map(prev);
          deletedCellIds.forEach((cellId) => {
            next.delete(cellId);
          });
          return next;
        });
      }

      // レンダリングをマーク
      sceneManager.markNeedsRender();
      css2DService.markNeedsRender();
    };

    // 初期配置
    updatePositions();

    // MutationObserverを使用してセル要素の変更を監視
    const observer = new MutationObserver(() => {
      // 少し遅延させてDOMの更新を待つ
      setTimeout(updatePositions, 0);
    });

    observer.observe(cellContainer, {
      childList: true,
      subtree: true,
    });

    // クリーンアップ
    return () => {
      observer.disconnect();
      cellPositionsRef.current.clear();
      cellWrapperElementsRef.current.clear();
    };
  }, [allCellIds, cellContainer, sceneManager, css2DService, setCell3DPositions]);

  // セルラッパー要素が準備できたときのコールバック
  const handleCellElementReady = useCallback(
    (cellId: CellId, element: HTMLElement) => {
      // 要素が準備できたことを記録
      cellWrapperElementsRef.current.set(cellId, element);

      // 位置が設定されていない場合は、atomから復元を試みる、またはビューポート中央に配置
      if (!cellPositionsRef.current.has(cellId)) {
        // atomから位置情報を復元を試みる
        const savedPosition = cell3DPositions.get(cellId);
        let position: THREE.Vector3;

        if (savedPosition) {
          // atomに位置があれば、THREE.Vector3に変換して使用
          position = new THREE.Vector3(
            savedPosition.x,
            savedPosition.y,
            savedPosition.z,
          );
          cellPositionsRef.current.set(cellId, position);
        } else {
          // 初期配置：ビューポート中央に配置
          position = calcSpawnPosition(sceneManager, css2DService, cellPositionsRef.current);
          cellPositionsRef.current.set(cellId, position);
          // スポーン位置をatomにも保存（再配置防止）
          const spawnedPos = position;
          setCell3DPositions((prev) => {
            const next = new Map(prev);
            next.set(cellId, { x: spawnedPos.x, y: spawnedPos.y, z: spawnedPos.z });
            return next;
          });
        }

        // コンテナ位置を基準に相対位置を計算
        const containerPosition =
          css2DService.getContainerPosition() || new THREE.Vector3(0, 600, 0);
        const relativePosition = new THREE.Vector3(
          position.x - containerPosition.x,
          position.y - containerPosition.y,
          position.z - containerPosition.z,
        );

        // CSS座標で位置を設定
        element.style.left = `${relativePosition.x}px`;
        element.style.top = `${relativePosition.z}px`;

        sceneManager.markNeedsRender();
        css2DService.markNeedsRender();
      }
    },
    [cell3DPositions, css2DService, sceneManager, setCell3DPositions],
  );

  // セルをCSS2Dコンテナ内にレンダリング
  if (!cellContainer) {
    return null;
  }

  const dragManager = dragManagerRef.current;
  if (!dragManager) {
    return null;
  }

  // セルの列情報を取得
  const hasOnlyOneCell = cellIds.hasOnlyOneId();

  return createPortal(
    <SortableCellsProvider multiColumn={appConfig.width === "columns"}>
      <div className="cells-3d-container-inner">
        {allCellIds.map((cellId) => {
          const column = cellIds.findWithId(cellId);
          const isCollapsed = column ? column.isCollapsed(cellId) : false;
          const collapseCount = column ? column.getCount(cellId) : 0;

          return (
            <Cell3DWrapper
              key={cellId}
              cellId={cellId}
              mode={mode}
              userConfig={userConfig}
              appConfig={appConfig}
              theme={theme}
              dragManager={dragManager}
              css2DService={css2DService}
              showPlaceholder={hasOnlyOneCell}
              canDelete={!hasOnlyOneCell}
              isCollapsed={isCollapsed}
              collapseCount={collapseCount}
              canMoveX={appConfig.width === "columns"}
              onCellElementReady={handleCellElementReady}
            />
          );
        })}
      </div>
    </SortableCellsProvider>,
    cellContainer,
  );
};
