/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import {
  playerProgressAtom,
  skillsWithStatusAtom,
  completeSkillAtom,
  currentTrackAtom,
  resetProgressAtom,
  completeSkillWithRewardAtom,
  rewardNotificationAtom,
  clearRewardNotificationAtom,
} from "../atoms";
import {
  mockProgressGameStart,
  mockProgressAfterFirstSkill,
  mockProgressBridgeMode,
  mockProgressFullMode,
} from "./test-fixtures";

describe("skill-tree atoms", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe("playerProgressAtom", () => {
    it("should have correct initial state for game start", () => {
      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toEqual(
        mockProgressGameStart.completedSkills,
      );
      expect(progress.currentCash).toBe(mockProgressGameStart.currentCash);
      expect(progress.earnedTitles).toEqual(
        mockProgressGameStart.earnedTitles,
      );
      expect(progress.rank).toBe(mockProgressGameStart.rank);
      expect(progress.sandboxCompleted).toBe(
        mockProgressGameStart.sandboxCompleted,
      );
      expect(progress.bridgeCompleted).toBe(
        mockProgressGameStart.bridgeCompleted,
      );
    });

    it("should have empty completedSkills at start", () => {
      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toHaveLength(0);
    });

    it("should have currentCash of 0 at start", () => {
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(0);
    });
  });

  describe("skillsWithStatusAtom", () => {
    it("should have SANDBOX_001 unlocked at game start", () => {
      const skills = store.get(skillsWithStatusAtom);
      const sandbox001 = skills.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.status).toBe("unlocked");
    });

    it("should have SANDBOX_002 locked at game start", () => {
      const skills = store.get(skillsWithStatusAtom);
      const sandbox002 = skills.find((s) => s.id === "SANDBOX_002");
      expect(sandbox002?.status).toBe("locked");
    });

    it("should have all other skills locked at game start", () => {
      const skills = store.get(skillsWithStatusAtom);
      const lockedSkills = skills.filter(
        (s) => s.id !== "SANDBOX_001" && s.status === "locked",
      );
      // SANDBOX_001 以外の58スキルが locked（全59スキル - 1）
      expect(lockedSkills).toHaveLength(58);
    });

    it("should unlock SANDBOX_002 after completing SANDBOX_001", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      const skills = store.get(skillsWithStatusAtom);
      const sandbox002 = skills.find((s) => s.id === "SANDBOX_002");
      expect(sandbox002?.status).toBe("unlocked");
    });

    it("should mark SANDBOX_001 as completed after completion", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      const skills = store.get(skillsWithStatusAtom);
      const sandbox001 = skills.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.status).toBe("completed");
    });

    it("should unlock FAIL_001 after completing SANDBOX_002", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      const skills = store.get(skillsWithStatusAtom);
      const fail001 = skills.find((s) => s.id === "FAIL_001");
      expect(fail001?.status).toBe("unlocked");
    });
  });

  describe("completeSkillAtom", () => {
    it("should add skill to completedSkills", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toContain("SANDBOX_001");
    });

    it("should add cash reward for SANDBOX_001", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(
        mockProgressAfterFirstSkill.currentCash,
      );
    });

    it("should add title reward for SANDBOX_001", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);
      expect(progress.earnedTitles).toContain("称号「初陣」");
    });

    it("should not complete same skill twice", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);
      expect(
        progress.completedSkills.filter((s) => s === "SANDBOX_001"),
      ).toHaveLength(1);
      expect(progress.currentCash).toBe(30000); // 二重加算されない
    });

    it("should accumulate cash rewards", () => {
      store.set(completeSkillAtom, "SANDBOX_001"); // +30,000
      store.set(completeSkillAtom, "SANDBOX_002"); // +20,000
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(50000);
    });

    it("should set sandboxCompleted when SANDBOX_006 is completed", () => {
      // 前提スキルを順番に完了
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");
      const progress = store.get(playerProgressAtom);
      expect(progress.sandboxCompleted).toBe(true);
    });

    it("should set bridgeCompleted when BRIDGE_003 is completed", () => {
      // サンドボックス完了
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");
      // ブリッジ完了
      store.set(completeSkillAtom, "BRIDGE_001");
      store.set(completeSkillAtom, "BRIDGE_002");
      store.set(completeSkillAtom, "BRIDGE_003");
      const progress = store.get(playerProgressAtom);
      expect(progress.bridgeCompleted).toBe(true);
    });

    it("should have correct total cash after sandbox completion", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(mockProgressBridgeMode.currentCash);
    });

    it("should have correct total cash after full mode reach", () => {
      // サンドボックス完了
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");
      // ブリッジ完了
      store.set(completeSkillAtom, "BRIDGE_001");
      store.set(completeSkillAtom, "BRIDGE_002");
      store.set(completeSkillAtom, "BRIDGE_003");
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(mockProgressFullMode.currentCash);
    });
  });

  describe("currentTrackAtom", () => {
    it("should return sandbox at game start", () => {
      const track = store.get(currentTrackAtom);
      expect(track).toBe("sandbox");
    });

    it("should return sandbox before SANDBOX_006 completion", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      const track = store.get(currentTrackAtom);
      expect(track).toBe("sandbox");
    });

    it("should return bridge after sandbox completion", () => {
      store.set(playerProgressAtom, {
        ...store.get(playerProgressAtom),
        sandboxCompleted: true,
      });
      const track = store.get(currentTrackAtom);
      expect(track).toBe("bridge");
    });

    it("should return full after bridge completion", () => {
      store.set(playerProgressAtom, {
        ...store.get(playerProgressAtom),
        sandboxCompleted: true,
        bridgeCompleted: true,
      });
      const track = store.get(currentTrackAtom);
      expect(track).toBe("full");
    });
  });

  describe("resetProgressAtom", () => {
    it("should reset completedSkills to empty", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(resetProgressAtom);
      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toEqual([]);
    });

    it("should reset currentCash to 0", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(resetProgressAtom);
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(0);
    });

    it("should reset earnedTitles to empty", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(resetProgressAtom);
      const progress = store.get(playerProgressAtom);
      expect(progress.earnedTitles).toEqual([]);
    });

    it("should reset sandboxCompleted to false", () => {
      store.set(playerProgressAtom, {
        ...store.get(playerProgressAtom),
        sandboxCompleted: true,
      });
      store.set(resetProgressAtom);
      const progress = store.get(playerProgressAtom);
      expect(progress.sandboxCompleted).toBe(false);
    });

    it("should reset bridgeCompleted to false", () => {
      store.set(playerProgressAtom, {
        ...store.get(playerProgressAtom),
        bridgeCompleted: true,
      });
      store.set(resetProgressAtom);
      const progress = store.get(playerProgressAtom);
      expect(progress.bridgeCompleted).toBe(false);
    });

    it("should unlock SANDBOX_001 after reset", () => {
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(resetProgressAtom);
      const skills = store.get(skillsWithStatusAtom);
      const sandbox001 = skills.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.status).toBe("unlocked");
    });
  });

  // ========================================
  // P1-1: トラック遷移条件（詳細テスト）
  // ========================================
  describe("トラック遷移（P1-1）", () => {
    it("SANDBOX_006未完了ではBRIDGE_001がロック", () => {
      // SANDBOX_001〜005を完了（006は未完了）
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");

      const skills = store.get(skillsWithStatusAtom);
      const bridge001 = skills.find((s) => s.id === "BRIDGE_001");
      expect(bridge001?.status).toBe("locked");
    });

    it("SANDBOX_006完了後、BRIDGE_001がアンロック", () => {
      // サンドボックス完了
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");

      const skills = store.get(skillsWithStatusAtom);
      const bridge001 = skills.find((s) => s.id === "BRIDGE_001");
      expect(bridge001?.status).toBe("unlocked");
    });

    it("BRIDGE_003未完了ではSETUP_001がロック", () => {
      // サンドボックス完了 + BRIDGE_001, 002完了
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");
      store.set(completeSkillAtom, "BRIDGE_001");
      store.set(completeSkillAtom, "BRIDGE_002");

      const skills = store.get(skillsWithStatusAtom);
      const setup001 = skills.find((s) => s.id === "SETUP_001");
      expect(setup001?.status).toBe("locked");
    });

    it("BRIDGE_003完了後、SETUP_001がアンロック", () => {
      // サンドボックス完了 + ブリッジ完了
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");
      store.set(completeSkillAtom, "BRIDGE_001");
      store.set(completeSkillAtom, "BRIDGE_002");
      store.set(completeSkillAtom, "BRIDGE_003");

      const skills = store.get(skillsWithStatusAtom);
      const setup001 = skills.find((s) => s.id === "SETUP_001");
      expect(setup001?.status).toBe("unlocked");
    });

    it("FAIL_001はSANDBOX_002完了後にアンロック", () => {
      store.set(completeSkillAtom, "SANDBOX_001");

      let skills = store.get(skillsWithStatusAtom);
      let fail001 = skills.find((s) => s.id === "FAIL_001");
      expect(fail001?.status).toBe("locked");

      store.set(completeSkillAtom, "SANDBOX_002");

      skills = store.get(skillsWithStatusAtom);
      fail001 = skills.find((s) => s.id === "FAIL_001");
      expect(fail001?.status).toBe("unlocked");
    });
  });

  // ========================================
  // P1-2: マイルストーン報酬
  // 注意: 現在の実装ではマイルストーン報酬は自動付与されない
  // これは実装課題として記録
  // ========================================
  describe("マイルストーン報酬（P1-2）", () => {
    it("マイルストーン定義が存在する", async () => {
      const { milestones } = await import("../skill-data");
      expect(milestones).toBeDefined();
      expect(milestones.length).toBe(5);
    });

    it("マイルストーンは昇順に定義されている", async () => {
      const { milestones } = await import("../skill-data");
      for (let i = 1; i < milestones.length; i++) {
        expect(milestones[i].skillCount).toBeGreaterThan(
          milestones[i - 1].skillCount
        );
      }
    });

    it("マイルストーン報酬額が正しく定義されている", async () => {
      const { milestones } = await import("../skill-data");
      expect(milestones[0]).toEqual({
        skillCount: 10,
        bonus: 50000,
        title: "見習い投資家",
      });
      expect(milestones[1]).toEqual({
        skillCount: 20,
        bonus: 100000,
        title: "新進トレーダー",
      });
    });

    it("10スキル完了で50,000円のボーナス報酬", () => {
      // 10スキル完了: SANDBOX(6) + BRIDGE(3) + SETUP_001(1)
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_002");
      store.set(completeSkillAtom, "SANDBOX_003");
      store.set(completeSkillAtom, "SANDBOX_004");
      store.set(completeSkillAtom, "SANDBOX_005");
      store.set(completeSkillAtom, "SANDBOX_006");
      store.set(completeSkillAtom, "BRIDGE_001");
      store.set(completeSkillAtom, "BRIDGE_002");
      store.set(completeSkillAtom, "BRIDGE_003");
      store.set(completeSkillAtom, "SETUP_001"); // 10スキル目でマイルストーン達成

      const progress = store.get(playerProgressAtom);

      // 基本報酬220,000円 + マイルストーン50,000円 = 270,000円
      expect(progress.currentCash).toBe(270000);
      expect(progress.earnedTitles).toContain("見習い投資家");
    });
  });

  // ========================================
  // 報酬通知システム（Phase 7）
  // ========================================
  describe("rewardNotificationAtom", () => {
    it("初期状態はnull", () => {
      const notification = store.get(rewardNotificationAtom);
      expect(notification).toBeNull();
    });
  });

  describe("clearRewardNotificationAtom", () => {
    it("通知をクリアする", () => {
      // まずスキル完了で通知を設定
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      expect(store.get(rewardNotificationAtom)).not.toBeNull();

      // クリア
      store.set(clearRewardNotificationAtom);
      expect(store.get(rewardNotificationAtom)).toBeNull();
    });

    it("既にnullの場合もエラーにならない", () => {
      expect(store.get(rewardNotificationAtom)).toBeNull();
      expect(() => store.set(clearRewardNotificationAtom)).not.toThrow();
      expect(store.get(rewardNotificationAtom)).toBeNull();
    });
  });

  describe("completeSkillWithRewardAtom", () => {
    it("スキル完了時に報酬が計算される", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toContain("SANDBOX_001");
      expect(progress.currentCash).toBe(30000);
    });

    it("通知atomに報酬データがセットされる", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const notification = store.get(rewardNotificationAtom);

      expect(notification).not.toBeNull();
      expect(notification?.skillId).toBe("SANDBOX_001");
      expect(notification?.skillTitle).toBe("マーケットへようこそ");
      expect(notification?.reward.cashEarned).toBe(30000);
    });

    it("通知データにskillIdとskillTitleが含まれる", () => {
      // SANDBOX_002 の prerequisites は SANDBOX_001
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      store.set(clearRewardNotificationAtom);
      store.set(completeSkillWithRewardAtom, "SANDBOX_002");
      const notification = store.get(rewardNotificationAtom);

      expect(notification?.skillId).toBe("SANDBOX_002");
      expect(notification?.skillTitle).toBeDefined();
      expect(notification?.timestamp).toBeGreaterThan(0);
    });

    it("既完了スキルは無視される", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const progress1 = store.get(playerProgressAtom);
      const notification1 = store.get(rewardNotificationAtom);

      // クリアして再度完了を試みる
      store.set(clearRewardNotificationAtom);
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const progress2 = store.get(playerProgressAtom);
      const notification2 = store.get(rewardNotificationAtom);

      // 進捗は変わらない
      expect(progress2.completedSkills.filter((s) => s === "SANDBOX_001")).toHaveLength(1);
      expect(progress2.currentCash).toBe(30000); // 二重加算されない
      // 通知も設定されない（nullのまま）
      expect(notification2).toBeNull();
    });

    it("存在しないスキルIDは無視される", () => {
      const progressBefore = store.get(playerProgressAtom);
      store.set(completeSkillWithRewardAtom, "INVALID_SKILL_ID" as any);
      const progressAfter = store.get(playerProgressAtom);

      expect(progressAfter).toEqual(progressBefore);
      expect(store.get(rewardNotificationAtom)).toBeNull();
    });

    it("マイルストーン達成時にボーナスが加算される", () => {
      // 10スキル完了でマイルストーン達成
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      store.set(completeSkillWithRewardAtom, "SANDBOX_002");
      store.set(completeSkillWithRewardAtom, "SANDBOX_003");
      store.set(completeSkillWithRewardAtom, "SANDBOX_004");
      store.set(completeSkillWithRewardAtom, "SANDBOX_005");
      store.set(completeSkillWithRewardAtom, "SANDBOX_006");
      store.set(completeSkillWithRewardAtom, "BRIDGE_001");
      store.set(completeSkillWithRewardAtom, "BRIDGE_002");
      store.set(completeSkillWithRewardAtom, "BRIDGE_003");
      store.set(completeSkillWithRewardAtom, "SETUP_001"); // 10スキル目

      const progress = store.get(playerProgressAtom);
      // 基本報酬220,000円 + マイルストーン50,000円 = 270,000円
      expect(progress.currentCash).toBe(270000);
    });

    it("マイルストーン達成時にtitleが付与される", () => {
      // 10スキル完了
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      store.set(completeSkillWithRewardAtom, "SANDBOX_002");
      store.set(completeSkillWithRewardAtom, "SANDBOX_003");
      store.set(completeSkillWithRewardAtom, "SANDBOX_004");
      store.set(completeSkillWithRewardAtom, "SANDBOX_005");
      store.set(completeSkillWithRewardAtom, "SANDBOX_006");
      store.set(completeSkillWithRewardAtom, "BRIDGE_001");
      store.set(completeSkillWithRewardAtom, "BRIDGE_002");
      store.set(completeSkillWithRewardAtom, "BRIDGE_003");
      store.set(completeSkillWithRewardAtom, "SETUP_001"); // 10スキル目

      const progress = store.get(playerProgressAtom);
      expect(progress.earnedTitles).toContain("見習い投資家");
    });

    it("マイルストーン達成時に通知にマイルストーン情報が含まれる", () => {
      // 10スキル完了
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      store.set(completeSkillWithRewardAtom, "SANDBOX_002");
      store.set(completeSkillWithRewardAtom, "SANDBOX_003");
      store.set(completeSkillWithRewardAtom, "SANDBOX_004");
      store.set(completeSkillWithRewardAtom, "SANDBOX_005");
      store.set(completeSkillWithRewardAtom, "SANDBOX_006");
      store.set(completeSkillWithRewardAtom, "BRIDGE_001");
      store.set(completeSkillWithRewardAtom, "BRIDGE_002");
      store.set(completeSkillWithRewardAtom, "BRIDGE_003");
      store.set(completeSkillWithRewardAtom, "SETUP_001"); // 10スキル目

      const notification = store.get(rewardNotificationAtom);
      expect(notification?.milestone).not.toBeNull();
      expect(notification?.milestone?.skillCount).toBe(10);
      expect(notification?.milestone?.bonus).toBe(50000);
      expect(notification?.milestone?.title).toBe("見習い投資家");
    });

    it("マイルストーン未達成時は通知にマイルストーンがnull", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const notification = store.get(rewardNotificationAtom);
      expect(notification?.milestone).toBeNull();
    });
  });

  // ========================================
  // エッジケーステスト（Phase 9追加）
  // ========================================
  describe("エッジケース", () => {
    it("同じスキルを連続で完了しようとしても重複しない", () => {
      // 連続で同じスキルを完了
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_001");
      store.set(completeSkillAtom, "SANDBOX_001");

      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toHaveLength(1);
      expect(progress.currentCash).toBe(30000); // 一度だけ加算
    });

    it("前提条件を満たさないスキルは完了できない（前提あり）", () => {
      // SANDBOX_003はSANDBOX_002が必要だが、いきなり完了を試みる
      store.set(completeSkillAtom, "SANDBOX_003");
      const progress = store.get(playerProgressAtom);
      // prerequisites ガードにより、前提条件未完了のスキルはブロックされる
      expect(progress.completedSkills).not.toContain("SANDBOX_003");
    });

    it("全スキル完了後のステータスが正しい", () => {
      // 全スキルを依存関係順に完了（繰り返しで依存解決）
      const skills = store.get(skillsWithStatusAtom);
      for (let i = 0; i < 10; i++) {
        for (const skill of skills) {
          store.set(completeSkillAtom, skill.id);
        }
      }

      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toHaveLength(skills.length);

      // 全スキルがcompletedステータス
      const finalSkills = store.get(skillsWithStatusAtom);
      const allCompleted = finalSkills.every((s) => s.status === "completed");
      expect(allCompleted).toBe(true);
    });

    it("空の進捗状態でスキルステータスが正しく計算される", () => {
      // 初期状態（空の進捗）
      const skills = store.get(skillsWithStatusAtom);

      // SANDBOX_001のみunlocked（前提条件なし）
      const sandbox001 = skills.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.status).toBe("unlocked");

      // 前提条件のある他のスキルはlocked
      const lockedSkills = skills.filter(
        (s) => s.id !== "SANDBOX_001" && s.status === "locked"
      );
      expect(lockedSkills.length).toBeGreaterThan(0);
    });

    it("progressのstatsフィールドがデフォルト値を持つ", () => {
      const progress = store.get(playerProgressAtom);
      expect(progress.stats).toEqual({
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        winRate: 0,
      });
    });

    it("earnedBadgesとhiddenBadgesFoundが初期化される", () => {
      const progress = store.get(playerProgressAtom);
      expect(progress.earnedBadges).toEqual([]);
      expect(progress.hiddenBadgesFound).toEqual([]);
    });

    it("completeSkillWithRewardAtomで連続スキル完了時に通知が更新される", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const notification1 = store.get(rewardNotificationAtom);
      expect(notification1?.skillId).toBe("SANDBOX_001");

      store.set(completeSkillWithRewardAtom, "SANDBOX_002");
      const notification2 = store.get(rewardNotificationAtom);
      expect(notification2?.skillId).toBe("SANDBOX_002");
      // 前の通知は上書きされる
      expect(notification2?.skillTitle).not.toBe(notification1?.skillTitle);
    });

    it("リセット後に再度スキル完了が可能", () => {
      // スキル完了
      store.set(completeSkillAtom, "SANDBOX_001");
      expect(store.get(playerProgressAtom).completedSkills).toContain("SANDBOX_001");

      // リセット
      store.set(resetProgressAtom);
      expect(store.get(playerProgressAtom).completedSkills).toEqual([]);

      // 再度完了
      store.set(completeSkillAtom, "SANDBOX_001");
      expect(store.get(playerProgressAtom).completedSkills).toContain("SANDBOX_001");
      expect(store.get(playerProgressAtom).currentCash).toBe(30000);
    });
  });
});
