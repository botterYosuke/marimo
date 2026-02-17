/* Copyright 2026 Marimo. All rights reserved. */

import { CoinsIcon, TrophyIcon, GiftIcon, LockOpenIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { store } from "@/core/state/jotai";
import {
  type RewardNotificationData,
  skillTreeDialogAtom,
  rewardNotificationAtom,
} from "../ui-atoms";

/**
 * スキル達成時にmarimo標準トーストで報酬を通知する。
 * Toaster は MarimoApp.tsx でルートマウント済みのため、
 * スキルツリーパネルの開閉に関係なく常に表示される。
 */
export function showSkillRewardToast(data: RewardNotificationData): void {
  const { skillTitle, reward, milestone } = data;
  const isMilestone = milestone !== null;

  toast({
    title: isMilestone ? "マイルストーン達成!" : "スキル達成!",
    description: (
      <div className="space-y-1.5 mt-1">
        <p className="font-medium text-sm">{skillTitle}</p>
        {reward.cashEarned > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <CoinsIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>+{reward.cashEarned.toLocaleString()}円</span>
          </div>
        )}
        {milestone && (
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <TrophyIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>ボーナス +{milestone.bonus.toLocaleString()}円</span>
          </div>
        )}
        {reward.titlesEarned.map((title, i) => (
          <div key={`t-${i}`} className="flex items-center gap-1.5 text-sm">
            <GiftIcon className="w-3.5 h-3.5 text-purple-500" />
            <span>{title}</span>
          </div>
        ))}
        {milestone?.title && (
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <TrophyIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>称号「{milestone.title}」獲得!</span>
          </div>
        )}
        {reward.itemsEarned.map((item, i) => (
          <div key={`i-${i}`} className="flex items-center gap-1.5 text-sm">
            <GiftIcon className="w-3.5 h-3.5 text-green-500" />
            <span>{item}</span>
          </div>
        ))}
        {reward.unlocksEarned.map((unlock, i) => (
          <div key={`u-${i}`} className="flex items-center gap-1.5 text-sm">
            <LockOpenIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>{unlock}</span>
          </div>
        ))}
      </div>
    ),
    duration: 8000,
    onClick: () => {
      store.set(skillTreeDialogAtom, true);
      store.set(rewardNotificationAtom, null);
    },
  });
}
