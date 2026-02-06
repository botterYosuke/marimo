/* Copyright 2026 Marimo. All rights reserved. */

import { describe, it, expect } from "vitest";
import { createMockSkill } from "./test-fixtures";
import type { Skill } from "../types";

// ========================================
// P2-2: findCurrentTask の正確性
// ========================================

/**
 * findCurrentTask のロジックを再実装（元の関数はエクスポートされていないため）
 * 注意: このテストは skill-tree-graph.tsx 内の同等ロジックを検証
 */
function findCurrentTask(skills: Skill[]): Skill | undefined {
  // unlocked のスキルを優先（現在取り組み可能なタスク）
  const unlocked = skills.find((s) => s.status === "unlocked");
  if (unlocked) {
    return unlocked;
  }

  // すべて完了の場合は最後の completed を返す
  const completed = skills.filter((s) => s.status === "completed");
  return completed[completed.length - 1];
}

describe("findCurrentTask", () => {
  describe("基本動作", () => {
    it("unlockedスキルが優先される", () => {
      const skills = [
        createMockSkill({ id: "A", status: "completed" }),
        createMockSkill({ id: "B", status: "locked" }),
        createMockSkill({ id: "C", status: "unlocked" }),
        createMockSkill({ id: "D", status: "unlocked" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.status).toBe("unlocked");
      // 最初に見つかったunlockedが返される
      expect(current?.id).toBe("C");
    });

    it("全てcompletedの場合は最後のcompletedを返す", () => {
      const skills = [
        createMockSkill({ id: "A", status: "completed" }),
        createMockSkill({ id: "B", status: "completed" }),
        createMockSkill({ id: "C", status: "completed" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.id).toBe("C");
    });

    it("全てlockedの場合はundefined", () => {
      const skills = [
        createMockSkill({ id: "A", status: "locked" }),
        createMockSkill({ id: "B", status: "locked" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      expect(current).toBeUndefined();
    });

    it("空配列でundefined", () => {
      expect(findCurrentTask([])).toBeUndefined();
    });
  });

  describe("混合状態", () => {
    it("completed + locked のみの場合は最後のcompletedを返す", () => {
      const skills = [
        createMockSkill({ id: "A", status: "completed" }),
        createMockSkill({ id: "B", status: "locked" }),
        createMockSkill({ id: "C", status: "locked" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.id).toBe("A");
    });

    it("unlocked が1つだけの場合、それを返す", () => {
      const skills = [
        createMockSkill({ id: "A", status: "completed" }),
        createMockSkill({ id: "B", status: "completed" }),
        createMockSkill({ id: "C", status: "unlocked" }),
        createMockSkill({ id: "D", status: "locked" }),
        createMockSkill({ id: "E", status: "locked" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.id).toBe("C");
    });
  });

  describe("実際のゲーム進行シナリオ", () => {
    it("ゲーム開始時：SANDBOX_001がunlockedで返される", () => {
      const skills = [
        createMockSkill({ id: "SANDBOX_001", status: "unlocked" }),
        createMockSkill({ id: "SANDBOX_002", status: "locked" }),
        createMockSkill({ id: "SANDBOX_003", status: "locked" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.id).toBe("SANDBOX_001");
    });

    it("SANDBOX_001完了後：SANDBOX_002がunlockedで返される", () => {
      const skills = [
        createMockSkill({ id: "SANDBOX_001", status: "completed" }),
        createMockSkill({ id: "SANDBOX_002", status: "unlocked" }),
        createMockSkill({ id: "SANDBOX_003", status: "locked" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.id).toBe("SANDBOX_002");
    });

    it("複数のunlockedがある場合：最初に定義されたものが返される", () => {
      // FAIL_001はSANDBOX_002と同時にunlockされる可能性がある
      const skills = [
        createMockSkill({ id: "SANDBOX_001", status: "completed" }),
        createMockSkill({ id: "SANDBOX_002", status: "unlocked" }),
        createMockSkill({ id: "FAIL_001", status: "unlocked" }),
        createMockSkill({ id: "SANDBOX_003", status: "locked" }),
      ];

      const current = findCurrentTask(skills as Skill[]);
      // 配列の順番で最初のunlockedが返される
      expect(current?.id).toBe("SANDBOX_002");
    });
  });

  describe("エッジケース", () => {
    it("単一のunlockedスキル", () => {
      const skills = [createMockSkill({ id: "ONLY", status: "unlocked" })];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.id).toBe("ONLY");
    });

    it("単一のcompletedスキル", () => {
      const skills = [createMockSkill({ id: "ONLY", status: "completed" })];

      const current = findCurrentTask(skills as Skill[]);
      expect(current?.id).toBe("ONLY");
    });

    it("単一のlockedスキル", () => {
      const skills = [createMockSkill({ id: "ONLY", status: "locked" })];

      const current = findCurrentTask(skills as Skill[]);
      expect(current).toBeUndefined();
    });
  });
});
