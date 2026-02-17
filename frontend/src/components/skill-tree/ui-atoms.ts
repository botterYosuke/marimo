/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";
import type { RewardResult } from "./rewards/reward-system";
import type { Milestone } from "./types";

// ========================================
// UI状態
// ========================================

/**
 * Skill Tree ダイアログ表示状態
 */
export const skillTreeDialogAtom = atom(false);

// ========================================
// 報酬通知システム
// ========================================

/**
 * 報酬通知データ
 */
export interface RewardNotificationData {
  skillId: string;
  skillTitle: string;
  reward: RewardResult;
  milestone: Milestone | null;
  timestamp: number;
}

/**
 * 報酬通知atom（表示中の通知）
 */
export const rewardNotificationAtom = atom<RewardNotificationData | null>(null);

/**
 * 報酬通知をクリア
 */
export const clearRewardNotificationAtom = atom(null, (_get, set) => {
  set(rewardNotificationAtom, null);
});
