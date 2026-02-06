/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { PlayerProgress, Skill, SkillId, SkillTrack, Milestone } from "./types";
import { skillDefinitions, milestones } from "./skill-data";
import { adaptForLocalStorage } from "@/utils/storage/jotai";
import {
  calculateSkillReward,
  checkMilestone,
  type RewardResult,
} from "./rewards/reward-system";
import { showSkillRewardToast } from "./rewards/skill-reward-toast";

// 初期状態
const initialProgress: PlayerProgress = {
  completedSkills: [],
  currentCash: 0,
  earnedTitles: [],
  earnedBadges: [],
  rank: "bronze",
  stats: {
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winRate: 0,
  },
  sandboxCompleted: false,
  bridgeCompleted: false,
  hiddenBadgesFound: [],
};

// 永続化されたプレイヤー進捗
export const playerProgressAtom = atomWithStorage<PlayerProgress>(
  "backcast:player-progress:v1",
  initialProgress,
  adaptForLocalStorage({
    toSerializable: (value) => value,
    fromSerializable: (value) => ({
      ...initialProgress,
      ...value,
    }),
  })
);

// スキル定義（読み取り専用）
export const skillDefinitionsAtom = atom<Skill[]>(skillDefinitions);

// 計算されたスキル状態（進捗を反映）
export const skillsWithStatusAtom = atom((get) => {
  const progress = get(playerProgressAtom);
  const definitions = get(skillDefinitionsAtom);

  return definitions.map((skill) => {
    let status: Skill["status"] = "locked";

    if (progress.completedSkills.includes(skill.id)) {
      status = "completed";
    } else if (
      skill.prerequisites.length === 0 ||
      skill.prerequisites.every((prereq) =>
        progress.completedSkills.includes(prereq)
      )
    ) {
      status = "unlocked";
    }

    return { ...skill, status };
  });
});

// スキル完了アクション
export const completeSkillAtom = atom(null, (get, set, skillId: SkillId) => {
  const progress = get(playerProgressAtom);
  const definitions = get(skillDefinitionsAtom);
  const skill = definitions.find((s) => s.id === skillId);

  if (!skill || progress.completedSkills.includes(skillId)) {
    return;
  }

  // prerequisites 未完了ならスキップ
  if (!skill.prerequisites.every(p => progress.completedSkills.includes(p))) {
    return;
  }

  // 報酬を計算
  let cashReward = 0;
  const newTitles: string[] = [];

  for (const reward of skill.reward) {
    if (reward.type === "cash" && reward.value) {
      cashReward += reward.value;
    }
    if (reward.type === "title") {
      newTitles.push(reward.description);
    }
  }

  // マイルストーン報酬をチェック
  const newSkillCount = progress.completedSkills.length + 1;
  const reachedMilestone = milestones.find(
    (m) => m.skillCount === newSkillCount
  );

  if (reachedMilestone) {
    cashReward += reachedMilestone.bonus;
    if (reachedMilestone.title) {
      newTitles.push(reachedMilestone.title);
    }
  }

  // 進捗を更新
  set(playerProgressAtom, {
    ...progress,
    completedSkills: [...progress.completedSkills, skillId],
    currentCash: progress.currentCash + cashReward,
    earnedTitles: [...progress.earnedTitles, ...newTitles],
    sandboxCompleted: skillId === "SANDBOX_006" || progress.sandboxCompleted,
    bridgeCompleted: skillId === "BRIDGE_003" || progress.bridgeCompleted,
  });
});

// 現在のトラック
export const currentTrackAtom = atom<SkillTrack>((get) => {
  const progress = get(playerProgressAtom);

  if (progress.bridgeCompleted) return "full";
  if (progress.sandboxCompleted) return "bridge";
  return "sandbox";
});

// 進捗リセット（デバッグ用）
export const resetProgressAtom = atom(null, (_get, set) => {
  set(playerProgressAtom, initialProgress);
});

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

/**
 * スキル完了アクション（報酬通知付き）
 *
 * スキルを完了し、報酬を計算して通知を設定します。
 */
export const completeSkillWithRewardAtom = atom(
  null,
  (get, set, skillId: SkillId) => {
    const progress = get(playerProgressAtom);
    const definitions = get(skillDefinitionsAtom);
    const skill = definitions.find((s) => s.id === skillId);

    // 既に完了済みまたはスキルが見つからない場合はスキップ
    if (!skill || progress.completedSkills.includes(skillId)) {
      return;
    }

    // prerequisites 未完了ならスキップ
    if (!skill.prerequisites.every(p => progress.completedSkills.includes(p))) {
      return;
    }

    const previousCount = progress.completedSkills.length;

    // 報酬を計算
    const reward = calculateSkillReward(skillId);

    // マイルストーンをチェック
    const milestone = checkMilestone(previousCount + 1, previousCount);

    // マイルストーンボーナスを追加
    let totalCashReward = reward.cashEarned;
    const newTitles = [...reward.titlesEarned];

    if (milestone) {
      totalCashReward += milestone.bonus;
      if (milestone.title) {
        newTitles.push(milestone.title);
      }
    }

    // 進捗を更新
    set(playerProgressAtom, {
      ...progress,
      completedSkills: [...progress.completedSkills, skillId],
      currentCash: progress.currentCash + totalCashReward,
      earnedTitles: [...progress.earnedTitles, ...newTitles],
      sandboxCompleted: skillId === "SANDBOX_006" || progress.sandboxCompleted,
      bridgeCompleted: skillId === "BRIDGE_003" || progress.bridgeCompleted,
    });

    // 報酬通知を設定
    const notificationData: RewardNotificationData = {
      skillId,
      skillTitle: skill.title,
      reward,
      milestone,
      timestamp: Date.now(),
    };
    set(rewardNotificationAtom, notificationData);

    // marimo 標準トーストで通知（パネル非表示でも見える）
    showSkillRewardToast(notificationData);
  }
);
