/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import { skillDefinitions, milestones } from "../skill-data";
import { calculateSkillReward, calculateTotalRewards } from "../rewards/reward-system";
import type { SkillCategory } from "../types";

/**
 * 全59スキルの報酬額を包括的に検証するテスト
 */
describe("all-59-skills-rewards", () => {
  // ========================================
  // 全スキルの報酬を it.each で検証
  // ========================================
  describe("個別スキル報酬", () => {
    const allSkillRewardTests = skillDefinitions.map((skill) => ({
      id: skill.id,
      title: skill.title,
      category: skill.category,
      expectedCash: skill.reward
        .filter((r) => r.type === "cash")
        .reduce((sum, r) => sum + (r.value ?? 0), 0),
      expectedTitleCount: skill.reward.filter((r) => r.type === "title").length,
      expectedItemCount: skill.reward.filter((r) => r.type === "item").length,
      expectedUnlockCount: skill.reward.filter((r) => r.type === "unlock")
        .length,
    }));

    it.each(allSkillRewardTests)(
      "$id ($title): cash=¥$expectedCash",
      ({ id, expectedCash, expectedTitleCount, expectedItemCount, expectedUnlockCount }) => {
        const result = calculateSkillReward(id);
        expect(result.cashEarned).toBe(expectedCash);
        expect(result.titlesEarned).toHaveLength(expectedTitleCount);
        expect(result.itemsEarned).toHaveLength(expectedItemCount);
        expect(result.unlocksEarned).toHaveLength(expectedUnlockCount);
      },
    );
  });

  // ========================================
  // カテゴリ別合計
  // ========================================
  describe("カテゴリ別合計報酬", () => {
    const categoryTotals: Record<SkillCategory, { count: number; cash: number }> = {
      sandbox: { count: 6, cash: 150000 },
      bridge: { count: 3, cash: 60000 },
      fail: { count: 3, cash: 35000 },
      setup: { count: 5, cash: 50000 },
      data: { count: 6, cash: 100000 },
      set: { count: 3, cash: 70000 },
      trade: { count: 10, cash: 195000 },
      chart: { count: 4, cash: 65000 },
      indicator: { count: 9, cash: 290000 },
      risk: { count: 10, cash: 395000 },
    };

    for (const [category, expected] of Object.entries(categoryTotals)) {
      describe(`${category}`, () => {
        const categorySkills = skillDefinitions.filter(
          (s) => s.category === category,
        );

        it(`スキル数が ${expected.count} 件`, () => {
          expect(categorySkills).toHaveLength(expected.count);
        });

        it(`合計報酬が ¥${expected.cash.toLocaleString()}`, () => {
          const totalCash = categorySkills.reduce((sum, skill) => {
            const cashRewards = skill.reward
              .filter((r) => r.type === "cash")
              .reduce((s, r) => s + (r.value ?? 0), 0);
            return sum + cashRewards;
          }, 0);
          expect(totalCash).toBe(expected.cash);
        });
      });
    }
  });

  // ========================================
  // 全体合計
  // ========================================
  describe("全体合計", () => {
    it("全59スキルの合計報酬は ¥1,410,000", () => {
      const totalCash = skillDefinitions.reduce((sum, skill) => {
        const cashRewards = skill.reward
          .filter((r) => r.type === "cash")
          .reduce((s, r) => s + (r.value ?? 0), 0);
        return sum + cashRewards;
      }, 0);
      expect(totalCash).toBe(1410000);
    });

    it("マイルストーンボーナスの合計は ¥1,350,000", () => {
      const totalBonus = milestones.reduce((sum, m) => sum + m.bonus, 0);
      expect(totalBonus).toBe(1350000);
    });

    it("総計（スキル報酬 + マイルストーン）は ¥2,760,000", () => {
      const allSkillIds = skillDefinitions.map((s) => s.id);
      const result = calculateTotalRewards(allSkillIds);
      expect(result.totalCash).toBe(2760000);
    });

    it("マイルストーンは5段階", () => {
      expect(milestones).toHaveLength(5);
    });
  });

  // ========================================
  // 各スキルの報酬が正の値
  // ========================================
  describe("報酬の整合性", () => {
    it("全スキルがcash報酬を持つ", () => {
      for (const skill of skillDefinitions) {
        const cashReward = skill.reward.find((r) => r.type === "cash");
        expect(cashReward).toBeDefined();
        expect(cashReward?.value).toBeGreaterThan(0);
      }
    });

    it("全スキルの報酬配列が空でない", () => {
      for (const skill of skillDefinitions) {
        expect(skill.reward.length).toBeGreaterThan(0);
      }
    });
  });
});
