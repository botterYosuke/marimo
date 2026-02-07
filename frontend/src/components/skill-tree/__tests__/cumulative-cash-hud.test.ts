/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { skillDefinitions } from "../skill-data";
import {
  playerProgressAtom,
  completeSkillWithRewardAtom,
} from "../atoms";
import { calculateTotalRewards } from "../rewards/reward-system";

/**
 * 累積 currentCash の HUD 表示テスト
 *
 * マイルストーンを含む累積報酬が主要チェックポイントで正しいか検証。
 */
describe("cumulative-cash-hud", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    const mockStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => mockStorage[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
      delete mockStorage[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 依存関係順にスキルを並べ替える
   */
  function getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const skillMap = new Map(skillDefinitions.map((s) => [s.id, s]));

    function visit(id: string) {
      if (visited.has(id)) return;
      visited.add(id);
      const skill = skillMap.get(id);
      if (skill) {
        for (const prereq of skill.prerequisites) {
          visit(prereq);
        }
        order.push(id);
      }
    }

    for (const skill of skillDefinitions) {
      visit(skill.id);
    }
    return order;
  }

  // ========================================
  // 主要チェックポイント
  // ========================================
  describe("主要チェックポイント", () => {
    it("SANDBOX_001 完了後: ¥30,000", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");

      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(30000);
    });

    it("SANDBOX 全完了後 (6スキル): ¥150,000", () => {
      const sandboxSkills = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
      ];
      for (const id of sandboxSkills) {
        store.set(completeSkillWithRewardAtom, id);
      }

      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(150000);
    });

    it("SANDBOX + BRIDGE 完了後 (9スキル): ¥210,000", () => {
      const skills = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
        "BRIDGE_001",
        "BRIDGE_002",
        "BRIDGE_003",
      ];
      for (const id of skills) {
        store.set(completeSkillWithRewardAtom, id);
      }

      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(210000);
    });

    it("10スキル完了 (マイルストーン): ¥270,000 (基本220,000 + ボーナス50,000)", () => {
      const skills = [
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
      for (const id of skills) {
        store.set(completeSkillWithRewardAtom, id);
      }

      const progress = store.get(playerProgressAtom);
      // 基本報酬: 150,000 + 60,000 + 10,000 = 220,000
      // マイルストーン: +50,000
      expect(progress.currentCash).toBe(270000);
    });
  });

  // ========================================
  // calculateTotalRewards との整合性
  // ========================================
  describe("calculateTotalRewards との整合性", () => {
    it("SANDBOX のみ: calculateTotalRewards と atom が一致", () => {
      const ids = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
      ];
      for (const id of ids) {
        store.set(completeSkillWithRewardAtom, id);
      }

      const expected = calculateTotalRewards(ids);
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(expected.totalCash);
    });

    it("10スキル: calculateTotalRewards と atom が一致", () => {
      const ids = [
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
      for (const id of ids) {
        store.set(completeSkillWithRewardAtom, id);
      }

      const expected = calculateTotalRewards(ids);
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(expected.totalCash);
    });
  });

  // ========================================
  // 全スキル完了時の最終チェック
  // ========================================
  describe("全スキル完了", () => {
    it("全59スキル完了で総計 ¥2,760,000", () => {
      const order = getTopologicalOrder();
      for (const id of order) {
        store.set(completeSkillWithRewardAtom, id);
      }

      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(2760000);
    });

    it("全スキル完了後に calculateTotalRewards と一致", () => {
      const order = getTopologicalOrder();
      for (const id of order) {
        store.set(completeSkillWithRewardAtom, id);
      }

      const allIds = skillDefinitions.map((s) => s.id);
      const expected = calculateTotalRewards(allIds);
      const progress = store.get(playerProgressAtom);
      expect(progress.currentCash).toBe(expected.totalCash);
    });

    it("59番目のスキル完了で追加マイルストーンなし（最終マイルストーンは58）", () => {
      const order = getTopologicalOrder();

      // 58番目まで完了
      for (let i = 0; i < 58; i++) {
        store.set(completeSkillWithRewardAtom, order[i]);
      }
      const cashAt58 = store.get(playerProgressAtom).currentCash;

      // 59番目を完了
      store.set(completeSkillWithRewardAtom, order[58]);
      const cashAt59 = store.get(playerProgressAtom).currentCash;

      // 差額は59番目のスキルの基本報酬のみ（マイルストーンボーナスなし）
      const skill59 = skillDefinitions.find((s) => s.id === order[58]);
      const skill59Cash = skill59?.reward
        .filter((r) => r.type === "cash")
        .reduce((sum, r) => sum + (r.value ?? 0), 0) ?? 0;

      expect(cashAt59 - cashAt58).toBe(skill59Cash);
    });
  });

  // ========================================
  // マイルストーン境界の検証
  // ========================================
  describe("マイルストーン境界", () => {
    it("9スキル完了ではマイルストーンボーナスなし", () => {
      const order = getTopologicalOrder();
      for (let i = 0; i < 9; i++) {
        store.set(completeSkillWithRewardAtom, order[i]);
      }

      const progress = store.get(playerProgressAtom);
      const ids = order.slice(0, 9);
      const skillCashOnly = skillDefinitions
        .filter((s) => ids.includes(s.id))
        .reduce(
          (sum, s) =>
            sum +
            s.reward
              .filter((r) => r.type === "cash")
              .reduce((ss, r) => ss + (r.value ?? 0), 0),
          0,
        );

      // マイルストーンなし: 基本報酬のみ
      expect(progress.currentCash).toBe(skillCashOnly);
    });

    it("10スキル完了で +¥50,000 マイルストーンボーナス", () => {
      const order = getTopologicalOrder();

      // 9スキル完了
      for (let i = 0; i < 9; i++) {
        store.set(completeSkillWithRewardAtom, order[i]);
      }
      const cashBefore = store.get(playerProgressAtom).currentCash;

      // 10スキル目
      store.set(completeSkillWithRewardAtom, order[9]);
      const cashAfter = store.get(playerProgressAtom).currentCash;

      const skill10 = skillDefinitions.find((s) => s.id === order[9]);
      const skill10Cash = skill10?.reward
        .filter((r) => r.type === "cash")
        .reduce((sum, r) => sum + (r.value ?? 0), 0) ?? 0;

      // 差額 = 10番目のスキル報酬 + マイルストーン50,000円
      expect(cashAfter - cashBefore).toBe(skill10Cash + 50000);
    });
  });
});
