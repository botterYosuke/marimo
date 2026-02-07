/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import {
  calculateSkillReward,
  checkMilestone,
  calculateTotalRewards,
  getNextMilestone,
  getMilestoneProgress,
} from "../rewards/reward-system";

describe("reward-system", () => {
  // ========================================
  // calculateSkillReward
  // ========================================
  describe("calculateSkillReward", () => {
    it("存在するスキルIDで正しい報酬を返す", () => {
      const result = calculateSkillReward("SANDBOX_001");
      expect(result.cashEarned).toBe(30000);
      expect(result.titlesEarned).toContain("称号「初陣」");
    });

    it("存在しないスキルIDで空の報酬を返す", () => {
      const result = calculateSkillReward("INVALID_SKILL");
      expect(result.cashEarned).toBe(0);
      expect(result.titlesEarned).toEqual([]);
      expect(result.itemsEarned).toEqual([]);
      expect(result.unlocksEarned).toEqual([]);
    });

    it("cashタイプの報酬を正しく計算", () => {
      const result = calculateSkillReward("SANDBOX_002");
      expect(result.cashEarned).toBe(20000);
    });

    it("titleタイプの報酬を正しく抽出", () => {
      const result = calculateSkillReward("SANDBOX_001");
      expect(result.titlesEarned).toContain("称号「初陣」");
    });

    it("SANDBOX_003は10000円の報酬", () => {
      const result = calculateSkillReward("SANDBOX_003");
      expect(result.cashEarned).toBe(10000);
    });

    it("SANDBOX_006は50000円の報酬", () => {
      const result = calculateSkillReward("SANDBOX_006");
      expect(result.cashEarned).toBe(50000);
    });

    it("FAIL_001は称号「授業料」を含む", () => {
      const result = calculateSkillReward("FAIL_001");
      expect(result.titlesEarned).toContain("称号「授業料」");
    });

    it("複合報酬（cash + title）を正しく処理", () => {
      const result = calculateSkillReward("SANDBOX_001");
      expect(result.cashEarned).toBeGreaterThan(0);
      expect(result.titlesEarned.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // checkMilestone
  // ========================================
  describe("checkMilestone", () => {
    it("10スキル達成でマイルストーン返却", () => {
      const milestone = checkMilestone(10, 9);
      expect(milestone).not.toBeNull();
      expect(milestone?.skillCount).toBe(10);
      expect(milestone?.bonus).toBe(50000);
      expect(milestone?.title).toBe("見習い投資家");
    });

    it("20スキル達成でマイルストーン返却", () => {
      const milestone = checkMilestone(20, 19);
      expect(milestone).not.toBeNull();
      expect(milestone?.skillCount).toBe(20);
      expect(milestone?.bonus).toBe(100000);
      expect(milestone?.title).toBe("新進トレーダー");
    });

    it("35スキル達成でマイルストーン返却（アイテム報酬）", () => {
      const milestone = checkMilestone(35, 34);
      expect(milestone).not.toBeNull();
      expect(milestone?.skillCount).toBe(35);
      expect(milestone?.bonus).toBe(200000);
      expect(milestone?.item).toBe("米国株ETF");
    });

    it("50スキル達成でマイルストーン返却", () => {
      const milestone = checkMilestone(50, 49);
      expect(milestone).not.toBeNull();
      expect(milestone?.skillCount).toBe(50);
      expect(milestone?.bonus).toBe(400000);
      expect(milestone?.title).toBe("Backcastエキスパート");
    });

    it("58スキル達成でマイルストーン返却（最終）", () => {
      const milestone = checkMilestone(58, 57);
      expect(milestone).not.toBeNull();
      expect(milestone?.skillCount).toBe(58);
      expect(milestone?.bonus).toBe(600000);
      expect(milestone?.title).toBe("マスター投資家");
      expect(milestone?.unlock).toBe("strategy_templates");
    });

    it("マイルストーン未達成でnull", () => {
      const milestone = checkMilestone(5, 4);
      expect(milestone).toBeNull();
    });

    it("既に達成済みのマイルストーンでnull（9→11では10のみ返す）", () => {
      // 9→10ではマイルストーン達成
      const milestone1 = checkMilestone(10, 9);
      expect(milestone1).not.toBeNull();

      // 10→11ではマイルストーン達成なし
      const milestone2 = checkMilestone(11, 10);
      expect(milestone2).toBeNull();
    });

    it("境界値テスト（8→9はマイルストーンなし）", () => {
      const milestone = checkMilestone(9, 8);
      expect(milestone).toBeNull();
    });

    it("境界値テスト（18→19はマイルストーンなし）", () => {
      const milestone = checkMilestone(19, 18);
      expect(milestone).toBeNull();
    });

    it("一度に複数マイルストーンを跨ぐ場合は最初のマイルストーンを返す", () => {
      // 9→11では10のマイルストーンを返す
      const milestone = checkMilestone(11, 9);
      expect(milestone?.skillCount).toBe(10);
    });
  });

  // ========================================
  // calculateTotalRewards
  // ========================================
  describe("calculateTotalRewards", () => {
    it("空配列で初期値を返す", () => {
      const result = calculateTotalRewards([]);
      expect(result.totalCash).toBe(0);
      expect(result.milestoneCash).toBe(0);
      expect(result.titles).toEqual([]);
      expect(result.items).toEqual([]);
      expect(result.unlocks).toEqual([]);
    });

    it("単一スキルの報酬を計算", () => {
      const result = calculateTotalRewards(["SANDBOX_001"]);
      expect(result.totalCash).toBe(30000);
      expect(result.titles).toContain("称号「初陣」");
    });

    it("複数スキルの報酬を合算", () => {
      const result = calculateTotalRewards(["SANDBOX_001", "SANDBOX_002"]);
      expect(result.totalCash).toBe(50000); // 30000 + 20000
    });

    it("サンドボックス完了で150,000円", () => {
      const sandboxSkills = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
      ];
      const result = calculateTotalRewards(sandboxSkills);
      expect(result.totalCash).toBe(150000);
    });

    it("10スキル達成でマイルストーンボーナス含む", () => {
      const tenSkills = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
        "BRIDGE_001",
        "BRIDGE_002",
        "BRIDGE_003",
        "SETUP_001",
      ];
      const result = calculateTotalRewards(tenSkills);
      expect(result.milestoneCash).toBe(50000);
      expect(result.titles).toContain("見習い投資家");
    });

    it("マイルストーンの称号を含む", () => {
      const tenSkills = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
        "BRIDGE_001",
        "BRIDGE_002",
        "BRIDGE_003",
        "SETUP_001",
      ];
      const result = calculateTotalRewards(tenSkills);
      expect(result.titles).toContain("見習い投資家");
    });
  });

  // ========================================
  // getNextMilestone
  // ========================================
  describe("getNextMilestone", () => {
    it("0スキル時は最初のマイルストーン（10）", () => {
      const next = getNextMilestone(0);
      expect(next?.skillCount).toBe(10);
    });

    it("5スキル時は10スキルマイルストーン", () => {
      const next = getNextMilestone(5);
      expect(next?.skillCount).toBe(10);
    });

    it("10スキル達成後は20スキルマイルストーン", () => {
      const next = getNextMilestone(10);
      expect(next?.skillCount).toBe(20);
    });

    it("20スキル達成後は35スキルマイルストーン", () => {
      const next = getNextMilestone(20);
      expect(next?.skillCount).toBe(35);
    });

    it("50スキル達成後は58スキルマイルストーン", () => {
      const next = getNextMilestone(50);
      expect(next?.skillCount).toBe(58);
    });

    it("全達成後（58スキル）はnull", () => {
      const next = getNextMilestone(58);
      expect(next).toBeNull();
    });

    it("58スキル以上でもnull", () => {
      const next = getNextMilestone(100);
      expect(next).toBeNull();
    });
  });

  // ========================================
  // getMilestoneProgress
  // ========================================
  describe("getMilestoneProgress", () => {
    it("0スキルで0%", () => {
      const progress = getMilestoneProgress(0);
      expect(progress).toBe(0);
    });

    it("5スキルで50%（0→10の中間）", () => {
      const progress = getMilestoneProgress(5);
      expect(progress).toBe(50);
    });

    it("10スキルで0%（10→20の開始）", () => {
      const progress = getMilestoneProgress(10);
      expect(progress).toBe(0);
    });

    it("15スキルで50%（10→20の中間）", () => {
      const progress = getMilestoneProgress(15);
      expect(progress).toBe(50);
    });

    it("全達成後（58スキル）は100%", () => {
      const progress = getMilestoneProgress(58);
      expect(progress).toBe(100);
    });

    it("58スキル以上でも100%", () => {
      const progress = getMilestoneProgress(100);
      expect(progress).toBe(100);
    });

    it("境界値テスト（9スキルで90%）", () => {
      const progress = getMilestoneProgress(9);
      expect(progress).toBe(90);
    });

    it("マイルストーン間の進捗率を正しく計算（25/35で50%）", () => {
      // 20→35は15スキル、25は中間点(5/15=33%)
      const progress = getMilestoneProgress(25);
      expect(progress).toBe(33);
    });
  });
});
