/* Copyright 2026 Marimo. All rights reserved. */

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";

import { createSkillElements } from "./elements";
import { skillNodeTypes } from "./skill-node";
import type { Skill, SkillSelection, SkillTreeData } from "./types";

/**
 * カレントタスク（次に取り組むべきスキル）を見つける
 * unlocked のスキルを優先、なければ最後の completed を返す
 */
function findCurrentTask(skills: Skill[]): string | undefined {
  // unlocked のスキルを優先（現在取り組み可能なタスク）
  const unlocked = skills.find((s) => s.status === "unlocked");
  if (unlocked) {
    return unlocked.id;
  }

  // すべて完了の場合は最後の completed を表示
  const completed = skills.filter((s) => s.status === "completed");
  return completed[completed.length - 1]?.id;
}

interface Props {
  data: SkillTreeData;
  onSkillClick?: (skill: Skill) => void;
}

export const SkillTreeGraph = ({ data, onSkillClick }: Props) => {
  const { fitView } = useReactFlow();

  // elements.ts 内でトラック別レイアウトを行うため、直接使用
  const initial = useMemo(() => createSkillElements(data.skills), [data]);

  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selection, setSelection] = useState<SkillSelection>();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // カレントタスクのIDを取得
  const currentTaskId = useMemo(
    () => findCurrentTask(data.skills),
    [data.skills]
  );

  // 初期エッジスタイルを保持（ハイライト解除時に復元するため）
  const initialEdgeStyles = useMemo(
    () => new Map(initial.edges.map((e) => [e.id, e.style])),
    [initial.edges]
  );

  // ホバーまたは選択時にエッジスタイルを更新
  useEffect(() => {
    const highlightNodeId = hoveredNodeId || selection?.id;

    setEdges((eds) =>
      eds.map((edge) => {
        const originalStyle = initialEdgeStyles.get(edge.id) ?? {};

        // ハイライトなしの場合は元のスタイルに戻す
        if (!highlightNodeId) {
          return { ...edge, style: originalStyle };
        }

        const isConnected =
          edge.source === highlightNodeId || edge.target === highlightNodeId;

        return {
          ...edge,
          style: isConnected
            ? { ...originalStyle, strokeWidth: 3, stroke: "#f59e0b" }
            : { ...originalStyle, opacity: 0.3 },
        };
      })
    );
  }, [hoveredNodeId, selection, setEdges, initialEdgeStyles]);

  // ReactFlow 初期化時にカレントタスクへフォーカス
  const handleInit = useCallback(() => {
    if (currentTaskId) {
      // レイアウト完了後にフォーカス
      setTimeout(() => {
        fitView({
          nodes: [{ id: currentTaskId }],
          padding: 0.5,
          maxZoom: 1.0,
          duration: 0,
        });
      }, 50);
    }
  }, [fitView, currentTaskId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={skillNodeTypes}
      minZoom={0.2}
      fitViewOptions={{
        minZoom: 0.5,
        maxZoom: 1.5,
      }}
      onNodeClick={(_event, node) => {
        setSelection({ type: "skill", id: node.id });
        onSkillClick?.(node.data.skill);
      }}
      onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)}
      onNodeMouseLeave={() => setHoveredNodeId(null)}
      onInit={handleInit}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      zoomOnDoubleClick={false}
      nodesConnectable={false}
      style={{ width: "100%", height: "100%" }}
    >
      <Background color="#ccc" variant={BackgroundVariant.Dots} />
      <Controls position="bottom-right" showInteractive={false} />
    </ReactFlow>
  );
};
