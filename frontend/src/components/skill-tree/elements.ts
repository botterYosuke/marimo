/* Copyright 2026 Marimo. All rights reserved. */

import type { Edge, Node } from "reactflow";
import {
  INPUTS_HANDLE_ID,
  OUTPUTS_HANDLE_ID,
} from "@/components/graph-common";
import type { Skill, SkillNodeData, SkillTrack } from "./types";

export const SKILL_NODE_WIDTH = 200;
export const SKILL_NODE_HEIGHT = 100;

// トラック別のY座標オフセット
export const TRACK_OFFSETS: Record<SkillTrack, number> = {
  sandbox: 0,
  bridge: 800,
  full: 1600,
};

// トラック別のラベル情報
export const TRACK_INFO: Record<
  SkillTrack,
  { title: string; description: string }
> = {
  sandbox: { title: "サンドボックス", description: "即座に楽しい" },
  bridge: { title: "ブリッジ", description: "段階的に理解" },
  full: { title: "フルモード", description: "マスタリー" },
};

function createSkillNode(
  skill: Skill,
  position: { x: number; y: number }
): Node<SkillNodeData> {
  return {
    id: skill.id,
    type: "skill",
    data: { skill },
    width: SKILL_NODE_WIDTH,
    height: SKILL_NODE_HEIGHT,
    position,
  };
}

function createSkillEdge(
  source: string,
  target: string,
  targetStatus: Skill["status"],
  isCrossTrack = false
): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: OUTPUTS_HANDLE_ID,
    targetHandle: INPUTS_HANDLE_ID,
    type: "smoothstep",
    animated: targetStatus === "unlocked",
    style: {
      stroke:
        targetStatus === "completed"
          ? "var(--green-9)"
          : targetStatus === "unlocked"
            ? "var(--blue-9)"
            : "var(--gray-5)",
      strokeWidth: isCrossTrack ? 3 : 2,
      strokeDasharray: isCrossTrack ? "8,4" : undefined,
    },
  };
}

/**
 * トラック内のスキルを簡易的にレイアウト
 * 前提条件に基づいて階層を計算し、同じ階層のスキルを横に並べる
 */
function layoutTrackSkills(
  skills: Skill[],
  yOffset: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const skillMap = new Map(skills.map((s) => [s.id, s]));

  // 各スキルの階層を計算（前提条件の最大深度）
  const levels = new Map<string, number>();

  function getLevel(skillId: string): number {
    if (levels.has(skillId)) {
      return levels.get(skillId)!;
    }

    const skill = skillMap.get(skillId);
    if (!skill) return 0;

    // 同じトラック内の前提条件のみを考慮
    const prereqsInTrack = skill.prerequisites.filter((p) => skillMap.has(p));
    if (prereqsInTrack.length === 0) {
      levels.set(skillId, 0);
      return 0;
    }

    const maxPrereqLevel = Math.max(...prereqsInTrack.map(getLevel));
    const level = maxPrereqLevel + 1;
    levels.set(skillId, level);
    return level;
  }

  // 全スキルの階層を計算
  for (const skill of skills) {
    getLevel(skill.id);
  }

  // 階層ごとにグループ化
  const levelGroups = new Map<number, Skill[]>();
  for (const skill of skills) {
    const level = levels.get(skill.id) ?? 0;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(skill);
  }

  // 各階層のスキルを配置
  const nodeGap = 40;
  const rankGap = 140;

  for (const [level, levelSkills] of levelGroups) {
    const totalWidth =
      levelSkills.length * SKILL_NODE_WIDTH +
      (levelSkills.length - 1) * nodeGap;
    const startX = -totalWidth / 2;

    levelSkills.forEach((skill, index) => {
      positions.set(skill.id, {
        x: startX + index * (SKILL_NODE_WIDTH + nodeGap),
        y: yOffset + level * (SKILL_NODE_HEIGHT + rankGap),
      });
    });
  }

  return positions;
}

export function createSkillElements(skills: Skill[]): {
  nodes: Node<SkillNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<SkillNodeData>[] = [];
  const edges: Edge[] = [];

  // トラック別にグループ化
  const skillsByTrack: Record<SkillTrack, Skill[]> = {
    sandbox: [],
    bridge: [],
    full: [],
  };

  for (const skill of skills) {
    skillsByTrack[skill.track].push(skill);
  }

  // 各トラックを個別にレイアウト
  for (const track of ["sandbox", "bridge", "full"] as SkillTrack[]) {
    const trackSkills = skillsByTrack[track];
    if (trackSkills.length === 0) continue;

    const positions = layoutTrackSkills(trackSkills, TRACK_OFFSETS[track]);

    // ノードを生成
    for (const skill of trackSkills) {
      const pos = positions.get(skill.id) ?? { x: 0, y: TRACK_OFFSETS[track] };
      nodes.push(createSkillNode(skill, pos));
    }

    // 同トラック内のエッジを生成
    for (const skill of trackSkills) {
      for (const prereqId of skill.prerequisites) {
        const prereqSkill = trackSkills.find((s) => s.id === prereqId);
        if (prereqSkill) {
          edges.push(createSkillEdge(prereqId, skill.id, skill.status, false));
        }
      }
    }
  }

  // クロストラックエッジを生成（トラック間の依存関係）
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  for (const skill of skills) {
    for (const prereqId of skill.prerequisites) {
      const prereqSkill = skillMap.get(prereqId);
      if (prereqSkill && prereqSkill.track !== skill.track) {
        edges.push(createSkillEdge(prereqId, skill.id, skill.status, true));
      }
    }
  }

  return { nodes, edges };
}
