/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";
import type { PlayerProgress, Skill, SkillId, SkillTrack } from "./types";
import { skillDefinitions, milestones } from "./skill-data";
import {
  calculateSkillReward,
  calculateTotalRewards,
  checkMilestone,
} from "./rewards/reward-system";
import { showSkillRewardToast } from "./rewards/skill-reward-toast";
import { rewardNotificationAtom, type RewardNotificationData } from "./ui-atoms";
import { localeAtom } from "@/core/config/config";
import { normalizeLocale, getTranslationMap } from "./i18n";

// Re-export from ui-atoms (循環参照回避のため分離)
export {
  skillTreeDialogAtom,
  rewardNotificationAtom,
  clearRewardNotificationAtom,
  type RewardNotificationData,
} from "./ui-atoms";

/**
 * completedSkills から PlayerProgress 全体を導出
 */
function deriveProgressFromSkills(completedSkills: SkillId[]): PlayerProgress {
  const rewards = calculateTotalRewards(completedSkills);
  return {
    completedSkills,
    currentCash: rewards.totalCash,
    earnedTitles: rewards.titles,
    earnedBadges: [],
    rank: "bronze",
    stats: {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      winRate: 0,
    },
    sandboxCompleted: completedSkills.includes("SANDBOX_006"),
    bridgeCompleted: completedSkills.includes("BRIDGE_003"),
    hiddenBadgesFound: [],
  };
}

// 初期状態
const initialProgress: PlayerProgress = deriveProgressFromSkills([]);

// プレイヤー進捗（Python 側からの初期化に依存）
export const playerProgressAtom = atom<PlayerProgress>(initialProgress);

// ファイルから読み込んだ進捗で初期化
export const initProgressFromFileAtom = atom(
  null,
  (_get, set, completedSkills: SkillId[]) => {
    set(playerProgressAtom, deriveProgressFromSkills(completedSkills));
  }
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

// ロケールに応じて title / description を翻訳したスキルリスト
export const translatedSkillsAtom = atom((get) => {
  const skills = get(skillsWithStatusAtom);
  const rawLocale = get(localeAtom);
  const locale = normalizeLocale(rawLocale);
  const translationMap = getTranslationMap(locale);
  if (!translationMap) {
    return skills;
  }
  return skills.map((skill) => {
    const t = translationMap.skills[skill.id];
    if (!t) {
      return skill;
    }
    return {
      ...skill,
      title: t.title || skill.title,
      description: t.description || skill.description,
    };
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

// prerequisites 未達で保留中のスキルIDキュー
const pendingSkillsAtom = atom<SkillId[]>([]);

// 進捗リセット（デバッグ用）
export const resetProgressAtom = atom(null, (_get, set) => {
  set(playerProgressAtom, initialProgress);
  set(pendingSkillsAtom, []);
});

/**
 * スキル完了アクション（報酬通知付き）
 *
 * スキルを完了し、報酬を計算して通知を設定します。
 * prerequisites 未達のスキルは保留キューに追加し、
 * 他スキル完了時に自動リトライします。
 */
export const completeSkillWithRewardAtom = atom(
  null,
  (get, set, skillId: SkillId) => {
    const doComplete = (sid: SkillId): boolean => {
      const progress = get(playerProgressAtom);
      const definitions = get(skillDefinitionsAtom);
      const skill = definitions.find((s) => s.id === sid);

      if (!skill || progress.completedSkills.includes(sid)) {
        return false;
      }

      const prereqsMet = skill.prerequisites.every(p => progress.completedSkills.includes(p));
      if (!prereqsMet) {
        return false;
      }

      const previousCount = progress.completedSkills.length;
      const reward = calculateSkillReward(sid);
      const milestone = checkMilestone(previousCount + 1, previousCount);

      let totalCashReward = reward.cashEarned;
      const newTitles = [...reward.titlesEarned];
      if (milestone) {
        totalCashReward += milestone.bonus;
        if (milestone.title) {
          newTitles.push(milestone.title);
        }
      }

      set(playerProgressAtom, {
        ...progress,
        completedSkills: [...progress.completedSkills, sid],
        currentCash: progress.currentCash + totalCashReward,
        earnedTitles: [...progress.earnedTitles, ...newTitles],
        sandboxCompleted: sid === "SANDBOX_006" || progress.sandboxCompleted,
        bridgeCompleted: sid === "BRIDGE_003" || progress.bridgeCompleted,
      });

      const rawLocale = get(localeAtom);
      const tMap = getTranslationMap(normalizeLocale(rawLocale));
      const translatedTitle = tMap?.skills[sid]?.title || skill.title;

      const notificationData: RewardNotificationData = {
        skillId: sid,
        skillTitle: translatedTitle,
        reward,
        milestone,
        timestamp: Date.now(),
      };
      set(rewardNotificationAtom, notificationData);
      showSkillRewardToast(notificationData);

      return true;
    };

    const progress = get(playerProgressAtom);
    if (progress.completedSkills.includes(skillId)) {
      return;
    }

    const completed = doComplete(skillId);

    if (!completed) {
      // prerequisites 未達 → 保留キューに追加（重複防止）
      const pending = get(pendingSkillsAtom);
      if (!pending.includes(skillId)) {
        set(pendingSkillsAtom, [...pending, skillId]);
      }
      return;
    }

    // 完了後、保留キューから解除可能なスキルを処理
    let changed = true;
    while (changed) {
      changed = false;
      const pending = get(pendingSkillsAtom);
      const remaining: SkillId[] = [];
      for (const pid of pending) {
        if (doComplete(pid)) {
          changed = true;
        } else {
          remaining.push(pid);
        }
      }
      set(pendingSkillsAtom, remaining);
    }
  }
);
