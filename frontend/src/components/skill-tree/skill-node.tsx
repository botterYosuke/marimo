/* Copyright 2026 Marimo. All rights reserved. */

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  LockIcon,
  CheckCircle2Icon,
  CircleIcon,
  GiftIcon,
  StarIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/badge";
import {
  INPUTS_HANDLE_ID,
  OUTPUTS_HANDLE_ID,
} from "@/components/graph-common";
import type { SkillNodeData, SkillStatus, SkillCategory } from "./types";
import { SKILL_NODE_HEIGHT, SKILL_NODE_WIDTH } from "./elements";

export type SkillNodeProps = NodeProps<SkillNodeData>;

// カテゴリカラー（左ボーダー色）
export const categoryColors: Record<SkillCategory, string> = {
  sandbox: "#4ade80", // green-400
  bridge: "#60a5fa", // blue-400
  fail: "#f87171", // red-400
  setup: "#a78bfa", // violet-400
  data: "#fbbf24", // amber-400
  set: "#fb923c", // orange-400
  trade: "#22d3ee", // cyan-400
  chart: "#e879f9", // fuchsia-400
  indicator: "#818cf8", // indigo-400
  risk: "#f472b6", // pink-400
};

// 難易度スター表示
function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={cn(
            "w-2 h-2",
            i < level
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

const statusConfig: Record<
  SkillStatus,
  { icon: React.ReactNode; className: string; handleColor: string }
> = {
  locked: {
    icon: <LockIcon className="w-3 h-3" />,
    className: "opacity-50 bg-muted border-muted-foreground/30",
    handleColor: "var(--gray-5)",
  },
  unlocked: {
    icon: <CircleIcon className="w-3 h-3" />,
    className: "bg-card border-primary/50 shadow-md",
    handleColor: "var(--gray-5)",
  },
  completed: {
    icon: <CheckCircle2Icon className="w-3 h-3 text-green-500" />,
    className: "bg-card border-green-500/50",
    handleColor: "var(--green-9)",
  },
};

export const SkillNode = memo((props: SkillNodeProps) => {
  const { data, selected } = props;
  const { skill } = data;
  const config = statusConfig[skill.status];
  const categoryColor = categoryColors[skill.category];

  return (
    <div>
      {/* Input handle (from prerequisites) */}
      <Handle
        type="target"
        id={INPUTS_HANDLE_ID}
        position={Position.Top}
        style={{ background: config.handleColor }}
      />

      {/* Skill card */}
      <div
        className={cn(
          "flex flex-col border rounded-lg overflow-hidden transition-all",
          config.className,
          selected && "ring-2 ring-primary",
        )}
        style={{
          width: SKILL_NODE_WIDTH,
          minHeight: SKILL_NODE_HEIGHT,
          borderLeftWidth: 3,
          borderLeftColor: categoryColor,
        }}
      >
        {/* Header with status icon and difficulty */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 border-b">
          {config.icon}
          <span className="font-semibold text-xs truncate flex-1">
            {skill.title}
          </span>
          <DifficultyStars level={skill.difficulty} />
        </div>

        {/* Description */}
        <div className="px-2 py-1 flex-1">
          <p className="text-[10px] text-muted-foreground line-clamp-2">
            {skill.description}
          </p>
        </div>

        {/* Reward section */}
        <div className="px-2 py-1 border-t bg-muted/30 flex items-center gap-1.5">
          <GiftIcon className="w-2.5 h-2.5 text-amber-500" />
          {skill.reward.length > 0 && (
            <Badge
              variant={skill.status === "completed" ? "success" : "outline"}
              className="text-[10px] px-1 py-0"
            >
              {skill.reward[0].description}
              {skill.reward.length > 1 && (
                <span className="ml-1 text-muted-foreground">
                  +{skill.reward.length - 1}
                </span>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Output handle (to dependent skills) */}
      <Handle
        type="source"
        id={OUTPUTS_HANDLE_ID}
        position={Position.Bottom}
        style={{ background: config.handleColor }}
      />
    </div>
  );
});

SkillNode.displayName = "SkillNode";

export const skillNodeTypes = {
  skill: SkillNode,
};
