/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { CheckCircle2Icon, PlayCircleIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { playerProgressAtom, translatedSkillsAtom } from "./atoms";

/**
 * サンドボックスモードの進捗表示コンポーネント
 * - 6スキルの完了状況を表示
 * - プログレスバーで進捗を可視化
 * - 完了時はブリッジモード解禁メッセージを表示
 */
export function SandboxIndicator() {
  const progress = useAtomValue(playerProgressAtom);
  const skills = useAtomValue(translatedSkillsAtom);

  // サンドボックススキルを抽出（FAILスキルは除く）
  const sandboxSkills = skills.filter(
    (s) => s.track === "sandbox" && s.category === "sandbox"
  );
  const completedCount = sandboxSkills.filter(
    (s) => s.status === "completed"
  ).length;
  const totalCount = sandboxSkills.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // 完了時
  if (progress.sandboxCompleted) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <CheckCircle2Icon className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            サンドボックス完了！
          </span>
        </div>
        <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
          ブリッジモード解禁
        </Badge>
      </div>
    );
  }

  // 進行中
  const currentSkill = sandboxSkills.find((s) => s.status === "unlocked");
  const progressMessages: Record<number, string> = {
    0: "ゲームを起動してスタート！",
    1: "株を買ってみよう",
    2: "買値を確認しよう",
    3: "株を売ってみよう",
    4: "チャートで振り返ろう",
    5: "卒業まであと少し！",
  };

  return (
    <div className="p-3 bg-muted/50 border rounded-lg space-y-2">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayCircleIcon className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">サンドボックスモード</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {completedCount}/{totalCount}
        </Badge>
      </div>

      {/* プログレスバー */}
      <Progress value={progressPercent} className="h-2" />

      {/* 進捗メッセージ */}
      <p className="text-xs text-muted-foreground">
        {progressMessages[completedCount] || "進行中..."}
        {currentSkill && (
          <span className="ml-1 text-primary">
            → {currentSkill.title}
          </span>
        )}
      </p>
    </div>
  );
}
