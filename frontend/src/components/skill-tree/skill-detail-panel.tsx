/* Copyright 2026 Marimo. All rights reserved. */

import { useMemo } from "react";
import {
  CheckCircle2Icon,
  CircleIcon,
  LockIcon,
  StarIcon,
  GiftIcon,
  BookOpenIcon,
  LinkIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import Markdown from "react-markdown";
import type { Skill } from "./types";
import { categoryColors } from "./skill-node";

interface SkillDetailPanelProps {
  skill: Skill | null;
  allSkills?: Skill[]; // 前提スキルのtitle表示用
  onInsertHelp?: (content: string) => void;
}

// ステータスアイコンとラベル
const statusConfig = {
  locked: {
    icon: <LockIcon className="w-4 h-4 text-muted-foreground" />,
    label: "ロック中",
    labelClass: "text-muted-foreground",
  },
  unlocked: {
    icon: <CircleIcon className="w-4 h-4 text-blue-500" />,
    label: "挑戦可能",
    labelClass: "text-blue-500",
  },
  completed: {
    icon: <CheckCircle2Icon className="w-4 h-4 text-green-500" />,
    label: "達成済み",
    labelClass: "text-green-500",
  },
};

// 難易度スター表示
function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i < level
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// 報酬タイプのバッジカラー
const rewardTypeColors: Record<string, string> = {
  cash: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  item: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  unlock: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  title: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function SkillDetailPanel({
  skill,
  allSkills,
  onInsertHelp,
}: SkillDetailPanelProps) {
  // 前提スキルIDからtitleを取得するヘルパー
  const skillMap = useMemo(
    () => new Map(allSkills?.map((s) => [s.id, s]) ?? []),
    [allSkills]
  );
  if (!skill) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-muted-foreground">
        <BookOpenIcon className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">スキルを選択してください</p>
      </div>
    );
  }

  const status = statusConfig[skill.status];
  const categoryColor = categoryColors[skill.category];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="p-4 border-b"
        style={{ borderLeftWidth: 4, borderLeftColor: categoryColor }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold leading-tight">
              {skill.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {skill.description}
            </p>
          </div>
        </div>

        {/* Status and Difficulty */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            {status.icon}
            <span className={cn("text-sm font-medium", status.labelClass)}>
              {status.label}
            </span>
          </div>
          <div className="flex-1" />
          <DifficultyStars level={skill.difficulty} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Rewards */}
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
            <GiftIcon className="w-4 h-4 text-amber-500" />
            報酬
          </h4>
          <div className="space-y-1.5">
            {skill.reward.map((reward, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2"
              >
                <Badge
                  className={cn(
                    "text-xs px-1.5 py-0",
                    rewardTypeColors[reward.type] ?? "bg-gray-100 text-gray-800"
                  )}
                >
                  {reward.type}
                </Badge>
                <span className="flex-1">{reward.description}</span>
                {reward.value !== undefined && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {reward.value.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisites */}
        {skill.prerequisites.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <LinkIcon className="w-4 h-4" />
              前提スキル
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {skill.prerequisites.map((prereqId) => {
                const prereqSkill = skillMap.get(prereqId);
                const isCompleted = prereqSkill?.status === "completed";
                return (
                  <Badge
                    key={prereqId}
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      isCompleted
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    {isCompleted && (
                      <CheckCircle2Icon className="w-3 h-3 mr-1 inline" />
                    )}
                    {prereqSkill?.title ?? prereqId}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Help Content */}
        {skill.helpContent && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <BookOpenIcon className="w-4 h-4" />
              ヘルプ
            </h4>
            <div className="text-sm bg-muted/30 rounded-md p-3 max-h-64 overflow-y-auto prose prose-sm dark:prose-invert prose-pre:bg-muted prose-pre:text-xs prose-code:text-xs max-w-none">
              <Markdown>{skill.helpContent}</Markdown>
            </div>
            {onInsertHelp && skill.status === "unlocked" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => onInsertHelp(skill.helpContent!)}
              >
                ノートブックに挿入
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>ID: {skill.id}</span>
          <Badge variant="outline" className="text-xs">
            {skill.category}
          </Badge>
        </div>
      </div>
    </div>
  );
}
