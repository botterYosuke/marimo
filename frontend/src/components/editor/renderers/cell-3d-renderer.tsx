/* Copyright 2026 Marimo. All rights reserved. */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import ReactFlow, {
  type Edge,
  MarkerType,
  type Node,
  type NodeChange,
  type Viewport,
  applyNodeChanges,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import type { SceneManager } from "@/core/three/scene-manager";
import type { AppConfig, UserConfig } from "@/core/config/config-schema";
import type { AppMode } from "@/core/mode";
import { useCellIds } from "@/core/cells/cells";
import { SETUP_CELL_ID, type CellId } from "@/core/cells/ids";
import { useTheme } from "@/theme/useTheme";
import {
  cell3DPositionsAtom,
  type Cell3DPosition,
} from "@/core/three/cell-3d-positions";
import { cell3DViewAtom } from "@/core/three/cell-3d-view";
import { reactFlowViewportToCamera } from "@/core/three/viewport-sync";
import { CellFlowNode, type CellFlowNodeData } from "./cell-flow-node";
import { cellFocusAtom, useCellFocusActions } from "@/core/cells/focus";
import { variablesAtom } from "@/core/variables/state";
import {
  INPUTS_HANDLE_ID,
  OUTPUTS_HANDLE_ID,
} from "@/components/graph-common";
import { SortableCellsProvider } from "@/components/sort/SortableCellsProvider";

// React Flow カスタムノードタイプ
const nodeTypes = {
  cellFlowNode: CellFlowNode,
};

// スポーン時の衝突回避オフセット
const SPAWN_OFFSET = 30;

/**
 * 新規セルのスポーン位置を計算する。
 * ビューポート中央を基準とし、既存セルとの衝突を回避する。
 */
function calcSpawnPosition(
  rfScreenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
  screenW: number,
  screenH: number,
  existingPositions: Map<CellId, Cell3DPosition>,
): { x: number; z: number } {
  // RF座標系でのビューポート中央を計算
  const center = rfScreenToFlowPosition({
    x: screenW / 2,
    y: screenH / 2,
  });

  const baseX = center.x;
  const baseZ = center.y; // RF y → World z

  // 衝突回避
  let offset = 0;
  let hasCollision = true;
  while (hasCollision) {
    hasCollision = false;
    for (const [, existing] of existingPositions) {
      if (
        Math.abs(existing.x - (baseX + offset)) < 10 &&
        Math.abs(existing.z - (baseZ + offset)) < 10
      ) {
        offset += SPAWN_OFFSET;
        hasCollision = true;
        break;
      }
    }
  }

  return { x: baseX + offset, z: baseZ + offset };
}

interface Cell3DRendererProps {
  mode: AppMode;
  userConfig: UserConfig;
  appConfig: AppConfig;
  sceneManager: SceneManager;
  initialViewport?: Viewport;
}

/**
 * Cell3DRendererInner
 *
 * ReactFlow でセルをノードとして表示し、viewport 変更を Three.js カメラに同期する。
 * useReactFlow() を使うため ReactFlowProvider の内部に配置される。
 */
const Cell3DRendererInner: React.FC<Cell3DRendererProps> = ({
  mode,
  userConfig,
  appConfig,
  sceneManager,
  initialViewport,
}) => {
  const cellIds = useCellIds();
  const { theme } = useTheme();
  const cell3DPositions = useAtomValue(cell3DPositionsAtom);
  const setCell3DPositions = useSetAtom(cell3DPositionsAtom);
  const setCell3DView = useSetAtom(cell3DViewAtom);
  const { focusCell } = useCellFocusActions();
  const focusedCellId = useAtomValue(cellFocusAtom).focusedCellId;

  const rfInstance = useReactFlow();
  const cell3DPositionsRef = useRef(cell3DPositions);
  const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // atom が更新されたら ref も更新
  useEffect(() => {
    cell3DPositionsRef.current = cell3DPositions;
  }, [cell3DPositions]);

  // セルIDのリスト（SETUP_CELL_ID を除外）
  const allCellIds = useMemo(() => {
    return cellIds.inOrderIds.filter((id) => id !== SETUP_CELL_ID);
  }, [cellIds]);

  const hasOnlyOneCell = cellIds.hasOnlyOneId();

  // 依存関係エッジを variables から生成
  const variables = useAtomValue(variablesAtom);
  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    const visited = new Set<string>();
    const cellIdSet = new Set(allCellIds);

    for (const variable of Object.values(variables)) {
      if (variable.value === "marimo" && variable.name === "mo") {
        continue;
      }
      if (variable.dataType === "module") {
        continue;
      }

      const { declaredBy, usedBy } = variable;
      for (const fromId of declaredBy) {
        for (const toId of usedBy) {
          if (fromId === toId) {
            continue;
          }
          if (!cellIdSet.has(fromId)) {
            continue;
          }
          if (!cellIdSet.has(toId)) {
            continue;
          }

          const key = `${fromId}-${toId}`;
          if (visited.has(key)) {
            continue;
          }
          visited.add(key);

          result.push({
            id: key,
            source: fromId,
            target: toId,
            sourceHandle: OUTPUTS_HANDLE_ID,
            targetHandle: INPUTS_HANDLE_ID,
            type: "default",
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
            },
            style: {
              strokeWidth: 1.5,
              stroke: "var(--gray-8, #888)",
              opacity: 0.5,
            },
          });
        }
      }
    }

    return result;
  }, [variables, allCellIds]);

  // フォーカス中のセルに接続されたエッジをハイライト
  const styledEdges = useMemo(() => {
    if (!focusedCellId) {
      return edges;
    }
    return edges.map((edge) => {
      const isConnected =
        edge.source === focusedCellId || edge.target === focusedCellId;
      if (!isConnected) {
        return edge;
      }
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: 0.9,
          stroke: "var(--accent-color, #3b82f6)",
          strokeWidth: 2.5,
        },
      };
    });
  }, [edges, focusedCellId]);

  // RF ノード state
  const [nodes, setNodes] = useState<Node<CellFlowNodeData>[]>([]);

  // allCellIds / cell3DPositions が変わったらノードを再生成
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevNodeMap = new Map(prevNodes.map((n) => [n.id, n]));
      const newNodes: Node<CellFlowNodeData>[] = [];
      const positionsToSave = new Map<CellId, Cell3DPosition>();

      for (const cellId of allCellIds) {
        const column = cellIds.findWithId(cellId);
        const isCollapsed = column ? column.isCollapsed(cellId) : false;
        const collapseCount = column ? column.getCount(cellId) : 0;

        // 保存済み位置 or スポーン
        let savedPos = cell3DPositionsRef.current.get(cellId);
        if (!savedPos) {
          const container = sceneManager.getRenderer()?.domElement;
          const screenW = container?.clientWidth ?? 800;
          const screenH = container?.clientHeight ?? 600;
          const spawn = calcSpawnPosition(
            rfInstance.screenToFlowPosition,
            screenW,
            screenH,
            cell3DPositionsRef.current,
          );
          savedPos = { x: spawn.x, y: 600, z: spawn.z };
          positionsToSave.set(cellId, savedPos);
          // ref にも即座に保存（次のスポーンが衝突しないように）
          cell3DPositionsRef.current = new Map(cell3DPositionsRef.current).set(cellId, savedPos);
        }

        // 既存ノードの位置を維持（ドラッグ中に外部からリセットされないように）
        const prevNode = prevNodeMap.get(cellId);
        const position = prevNode
          ? prevNode.position
          : { x: savedPos.x, y: savedPos.z }; // World {x,z} → RF {x,y}

        newNodes.push({
          id: cellId,
          type: "cellFlowNode",
          position,
          dragHandle: ".window-titlebar",
          data: {
            cellId,
            mode,
            userConfig,
            appConfig,
            theme,
            showPlaceholder: hasOnlyOneCell,
            canDelete: !hasOnlyOneCell,
            isCollapsed,
            collapseCount,
            canMoveX: appConfig.width === "columns",
          },
        });
      }

      // 新規スポーン位置を atom に永続化
      if (positionsToSave.size > 0) {
        setCell3DPositions((prev) => {
          const next = new Map(prev);
          for (const [id, pos] of positionsToSave) {
            next.set(id, pos);
          }
          return next;
        });
      }

      // 削除されたセルを atom からクリーンアップ
      const currentIds = new Set(allCellIds);
      const deletedIds = [...cell3DPositionsRef.current.keys()].filter(
        (id) => !currentIds.has(id),
      );
      if (deletedIds.length > 0) {
        setCell3DPositions((prev) => {
          const next = new Map(prev);
          for (const id of deletedIds) {
            next.delete(id);
          }
          return next;
        });
      }

      return newNodes;
    });
  }, [
    allCellIds,
    cellIds,
    mode,
    userConfig,
    appConfig,
    theme,
    hasOnlyOneCell,
    sceneManager,
    rfInstance,
    setCell3DPositions,
  ]);

  // onNodesChange: RF controlled mode の中核
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // remove は marimo 側の削除フローで処理するため除外
      const filtered = changes.filter((c) => c.type !== "remove");
      setNodes((nds) => applyNodeChanges(filtered, nds));

      for (const change of changes) {
        // ドラッグ完了 → 位置を atom に永続化
        if (change.type === "position" && change.position && !change.dragging) {
          const pos = change.position;
          setCell3DPositions((prev) => {
            const next = new Map(prev);
            next.set(change.id as CellId, { x: pos.x, y: 600, z: pos.y });
            return next;
          });
        }

        // セル選択 → フォーカス連携
        if (change.type === "select" && change.selected) {
          focusCell({ cellId: change.id as CellId });
        }
      }
    },
    [setCell3DPositions, focusCell],
  );

  // ビューポート移動 → Three.js カメラ同期
  const handleViewportMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      const camera = sceneManager.getCamera();
      const renderer = sceneManager.getRenderer();
      if (!camera || !renderer) {
        return;
      }

      const screenW = renderer.domElement.clientWidth;
      const screenH = renderer.domElement.clientHeight;
      const { position, target } = reactFlowViewportToCamera(
        viewport,
        screenW,
        screenH,
        camera.fov,
      );
      sceneManager.setCameraFromViewport(position, target);

      // デバウンスしてカメラビューを保存（300ms）
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
      }
      viewportSaveTimerRef.current = setTimeout(() => {
        const cam = sceneManager.getCamera();
        if (cam) {
          setCell3DView({
            position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            target: { x: target.x, y: target.y, z: target.z },
          });
        }
      }, 300);
    },
    [sceneManager, setCell3DView],
  );

  // ノードの z-index を focusedCellId に応じて更新（変更のある2ノードのみ）
  const prevFocusedRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevFocusedRef.current;
    prevFocusedRef.current = focusedCellId;
    if (prev === focusedCellId) {
      return;
    }
    setNodes((nds) =>
      nds.map((n) => {
        const shouldBeFocused = focusedCellId === n.id;
        const wasFocused = prev === n.id;
        if (!shouldBeFocused && !wasFocused) {
          return n; // 変更なし — 同一参照を返して RF 再レンダリングを回避
        }
        return {
          ...n,
          style: {
            ...n.style,
            zIndex: shouldBeFocused ? 1000 : 20,
          },
        };
      }),
    );
  }, [focusedCellId]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
      }
    };
  }, []);

  return (
    <SortableCellsProvider multiColumn={appConfig.width === "columns"}>
      <div style={{ position: "absolute", inset: 0, zIndex: 20 }}>
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onMove={handleViewportMove}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          minZoom={0.01}
          maxZoom={10}
          defaultViewport={initialViewport}
          deleteKeyCode={null}
          selectionKeyCode={null}
          nodesConnectable={false}
          nodesDraggable={true}
          elementsSelectable={true}
          edgesFocusable={false}
          edgesUpdatable={false}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </SortableCellsProvider>
  );
};

/**
 * Cell3DRenderer
 *
 * ReactFlowProvider は edit-app.tsx 側でラップされる。
 * このコンポーネントは Provider 内で描画される想定。
 */
export const Cell3DRenderer: React.FC<Cell3DRendererProps> = (props) => {
  return <Cell3DRendererInner {...props} />;
};
