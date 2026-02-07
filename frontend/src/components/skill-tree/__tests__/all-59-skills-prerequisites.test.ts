/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { skillDefinitions } from "../skill-data";
import {
  playerProgressAtom,
  skillsWithStatusAtom,
  completeSkillAtom,
} from "../atoms";

/**
 * 全59スキルの前提条件を包括的に検証するテスト
 *
 * - 前提条件未達のスキルは完了できない
 * - 前提条件達成後に完了できる
 */
describe("all-59-skills-prerequisites", () => {
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

  // ========================================
  // 前提条件のあるスキルは前提未達では完了不可
  // ========================================
  describe("前提条件未達のスキルはブロックされる", () => {
    const skillsWithPrereqs = skillDefinitions.filter(
      (s) => s.prerequisites.length > 0,
    );

    it.each(skillsWithPrereqs.map((s) => ({ id: s.id, prereqs: s.prerequisites })))(
      "$id は前提条件 $prereqs 未達では完了不可",
      ({ id }) => {
        // 前提条件を完了せずにスキルを完了しようとする
        store.set(completeSkillAtom, id);
        const progress = store.get(playerProgressAtom);
        expect(progress.completedSkills).not.toContain(id);
      },
    );
  });

  // ========================================
  // 前提条件達成後にスキルが完了できる
  // ========================================
  describe("前提条件達成後にスキルが完了できる", () => {
    /**
     * 依存関係順にスキルを並べ替えるヘルパー
     * トポロジカルソートで前提条件を満たす順序を取得
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

    it("全59スキルが依存関係順に全て完了できる", () => {
      const order = getTopologicalOrder();

      for (const id of order) {
        store.set(completeSkillAtom, id);
      }

      const progress = store.get(playerProgressAtom);
      expect(progress.completedSkills).toHaveLength(59);

      // 全スキルが completed ステータス
      const skills = store.get(skillsWithStatusAtom);
      const allCompleted = skills.every((s) => s.status === "completed");
      expect(allCompleted).toBe(true);
    });
  });

  // ========================================
  // 前提条件の整合性
  // ========================================
  describe("前提条件の整合性", () => {
    it("全ての前提条件が実在するスキルIDを参照", () => {
      const allIds = new Set(skillDefinitions.map((s) => s.id));
      for (const skill of skillDefinitions) {
        for (const prereq of skill.prerequisites) {
          expect(allIds.has(prereq)).toBe(true);
        }
      }
    });

    it("循環依存がない", () => {
      const skillMap = new Map(skillDefinitions.map((s) => [s.id, s]));

      function hasCycle(
        id: string,
        visiting: Set<string>,
        visited: Set<string>,
      ): boolean {
        if (visiting.has(id)) return true;
        if (visited.has(id)) return false;

        visiting.add(id);
        const skill = skillMap.get(id);
        if (skill) {
          for (const prereq of skill.prerequisites) {
            if (hasCycle(prereq, visiting, visited)) return true;
          }
        }
        visiting.delete(id);
        visited.add(id);
        return false;
      }

      const visited = new Set<string>();
      for (const skill of skillDefinitions) {
        expect(hasCycle(skill.id, new Set(), visited)).toBe(false);
      }
    });

    it("SANDBOX_001 は前提条件なし（エントリーポイント）", () => {
      const sandbox001 = skillDefinitions.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.prerequisites).toEqual([]);
    });

    it("SANDBOX_001 は初期状態で unlocked", () => {
      const sandbox001 = skillDefinitions.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.status).toBe("unlocked");
    });
  });
});
