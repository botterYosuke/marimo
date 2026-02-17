/* Copyright 2026 Marimo. All rights reserved. */

import type { Milestone } from "../types";
import { skillDefinitions, milestones } from "../skill-data";

/**
 * スキル報酬計算結果
 */
export interface RewardResult {
  cashEarned: number;
  titlesEarned: string[];
  itemsEarned: string[];
  unlocksEarned: string[];
}

/**
 * スキル完了時の報酬を計算
 */
export function calculateSkillReward(skillId: string): RewardResult {
  const skill = skillDefinitions.find((s) => s.id === skillId);

  if (!skill) {
    return {
      cashEarned: 0,
      titlesEarned: [],
      itemsEarned: [],
      unlocksEarned: [],
    };
  }

  const result: RewardResult = {
    cashEarned: 0,
    titlesEarned: [],
    itemsEarned: [],
    unlocksEarned: [],
  };

  for (const reward of skill.reward) {
    switch (reward.type) {
      case "cash":
        result.cashEarned += reward.value ?? 0;
        break;
      case "title":
        result.titlesEarned.push(reward.description);
        break;
      case "item":
        result.itemsEarned.push(reward.description);
        break;
      case "unlock":
        result.unlocksEarned.push(reward.description);
        break;
    }
  }

  return result;
}

/**
 * マイルストーン到達をチェック
 * @param completedCount 新しい完了スキル数
 * @param previousCount 以前の完了スキル数
 * @returns 到達したマイルストーン、または null
 */
export function checkMilestone(
  completedCount: number,
  previousCount: number
): Milestone | null {
  for (const milestone of milestones) {
    if (
      completedCount >= milestone.skillCount &&
      previousCount < milestone.skillCount
    ) {
      return milestone;
    }
  }
  return null;
}

/**
 * 累計報酬を計算
 */
export function calculateTotalRewards(completedSkills: string[]): {
  totalCash: number;
  milestoneCash: number;
  titles: string[];
  items: string[];
  unlocks: string[];
} {
  let totalCash = 0;
  let milestoneCash = 0;
  const titles: string[] = [];
  const items: string[] = [];
  const unlocks: string[] = [];

  // スキル報酬
  for (const skillId of completedSkills) {
    const result = calculateSkillReward(skillId);
    totalCash += result.cashEarned;
    titles.push(...result.titlesEarned);
    items.push(...result.itemsEarned);
    unlocks.push(...result.unlocksEarned);
  }

  // マイルストーン報酬
  for (const milestone of milestones) {
    if (completedSkills.length >= milestone.skillCount) {
      milestoneCash += milestone.bonus;
      if (milestone.title) {
        titles.push(milestone.title);
      }
      if (milestone.item) {
        items.push(milestone.item);
      }
      if (milestone.unlock) {
        unlocks.push(milestone.unlock);
      }
    }
  }

  return {
    totalCash: totalCash + milestoneCash,
    milestoneCash,
    titles,
    items,
    unlocks,
  };
}

/**
 * 次のマイルストーンを取得
 */
export function getNextMilestone(
  completedCount: number
): Milestone | null {
  return milestones.find((m) => m.skillCount > completedCount) ?? null;
}

/**
 * マイルストーン進捗率を計算
 */
export function getMilestoneProgress(completedCount: number): number {
  const nextMilestone = getNextMilestone(completedCount);
  if (!nextMilestone) return 100;

  // 前のマイルストーンを見つける
  const prevMilestone = [...milestones]
    .reverse()
    .find((m) => m.skillCount <= completedCount);

  const prevCount = prevMilestone?.skillCount ?? 0;
  const targetCount = nextMilestone.skillCount;
  const range = targetCount - prevCount;
  const progress = completedCount - prevCount;

  return Math.round((progress / range) * 100);
}
