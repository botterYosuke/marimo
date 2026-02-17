/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { CheckCircle2Icon, ArrowRightIcon, BookOpenIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { playerProgressAtom, translatedSkillsAtom } from "./atoms";

/**
 * ブリッジモードの進捗表示コンポーネント
 * - サンドボックス未完了時は非表示
 * - 3スキルの完了状況を表示
 * - 完了時はフルモード解禁メッセージを表示
 */
export function BridgeIndicator() {
  const progress = useAtomValue(playerProgressAtom);
  const skills = useAtomValue(translatedSkillsAtom);

  // サンドボックス未完了なら表示しない
  if (!progress.sandboxCompleted) {
    return null;
  }

  // ブリッジスキルを抽出
  const bridgeSkills = skills.filter((s) => s.track === "bridge");
  const completedCount = bridgeSkills.filter(
    (s) => s.status === "completed"
  ).length;
  const totalCount = bridgeSkills.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // 完了時
  if (progress.bridgeCompleted) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <CheckCircle2Icon className="w-5 h-5 text-blue-500 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            ブリッジ完了！
          </span>
        </div>
        <Badge variant="default" className="bg-violet-500 hover:bg-violet-600">
          フルモード解禁
        </Badge>
      </div>
    );
  }

  // 進行中
  const currentSkill = bridgeSkills.find((s) => s.status === "unlocked");
  const progressMessages: Record<number, string> = {
    0: "サンドボックスの裏側を解明しよう",
    1: "自分でデータを取得してみよう",
    2: "フルモードへの準備を完了しよう",
  };

  return (
    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-2">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpenIcon className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">ブリッジモード</span>
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
          <span className="ml-1 text-blue-600 dark:text-blue-400">
            → {currentSkill.title}
          </span>
        )}
      </p>

      {/* フルモードへの案内 */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowRightIcon className="w-3 h-3" />
        <span>完了後、フルモードで本格的なバックテストが可能に</span>
      </div>
    </div>
  );
}
