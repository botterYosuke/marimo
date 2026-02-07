/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  CoinsIcon,
  TrophyIcon,
  GiftIcon,
  LockOpenIcon,
  TargetIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { playerProgressAtom } from "../atoms";
import {
  calculateTotalRewards,
  getNextMilestone,
  getMilestoneProgress,
} from "./reward-system";
import { skillDefinitions } from "../skill-data";

export function RewardSummary() {
  const progress = useAtomValue(playerProgressAtom);
  const completedCount = progress.completedSkills.length;
  const totalSkills = skillDefinitions.length;

  const { totalCash, milestoneCash, titles, items, unlocks } =
    calculateTotalRewards(progress.completedSkills);

  const nextMilestone = getNextMilestone(completedCount);
  const milestoneProgress = getMilestoneProgress(completedCount);

  return (
    <div className="p-4 space-y-5">
      {/* 総報酬 */}
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CoinsIcon className="w-5 h-5 text-amber-500" />
          <span className="font-medium text-sm">総報酬</span>
        </div>
        <p className="text-2xl font-bold">
          ¥{totalCash.toLocaleString()}
        </p>
        {milestoneCash > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            (マイルストーン ¥{milestoneCash.toLocaleString()} 含む)
          </p>
        )}
      </div>

      {/* スキル進捗 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">スキル達成</span>
          <span className="font-medium">
            {completedCount}/{totalSkills}
          </span>
        </div>
        <Progress value={(completedCount / totalSkills) * 100} className="h-2" />
      </div>

      {/* 次のマイルストーン */}
      {nextMilestone && (
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TargetIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">次のマイルストーン</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">
              {nextMilestone.skillCount}スキル達成
            </span>
            <Badge variant="secondary" className="text-xs">
              +¥{nextMilestone.bonus.toLocaleString()}
            </Badge>
          </div>
          <Progress value={milestoneProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1.5">
            あと{nextMilestone.skillCount - completedCount}スキル
          </p>
        </div>
      )}

      {/* マスター達成 */}
      {!nextMilestone && completedCount >= totalSkills && (
        <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg p-3 text-center">
          <TrophyIcon className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="font-bold text-amber-600">全スキル達成!</p>
          <p className="text-xs text-muted-foreground mt-1">
            マスター投資家の称号を獲得
          </p>
        </div>
      )}

      {/* 獲得した称号 */}
      {titles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">称号</span>
            <Badge variant="outline" className="text-xs ml-auto">
              {titles.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {titles.slice(0, 6).map((title, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {title}
              </Badge>
            ))}
            {titles.length > 6 && (
              <Badge variant="secondary" className="text-xs">
                +{titles.length - 6}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* 獲得したアイテム */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GiftIcon className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">アイテム</span>
            <Badge variant="outline" className="text-xs ml-auto">
              {items.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.slice(0, 6).map((item, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
            {items.length > 6 && (
              <Badge variant="secondary" className="text-xs">
                +{items.length - 6}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* アンロック済み機能 */}
      {unlocks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LockOpenIcon className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">解禁済み</span>
            <Badge variant="outline" className="text-xs ml-auto">
              {unlocks.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unlocks.map((unlock, i) => (
              <Badge key={i} variant="success" className="text-xs">
                {unlock}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 空の状態 */}
      {titles.length === 0 && items.length === 0 && unlocks.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <p>まだ報酬を獲得していません</p>
          <p className="text-xs mt-1">スキルを達成して報酬を集めましょう!</p>
        </div>
      )}
    </div>
  );
}
