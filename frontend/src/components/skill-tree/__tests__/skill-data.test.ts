/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import { skillDefinitions, milestones } from "../skill-data";
import { allSkillIds, allSkillIdsFlat } from "./test-fixtures";

describe("skill-data", () => {
  describe("skillDefinitions", () => {
    it("should have 59 skills", () => {
      expect(skillDefinitions).toHaveLength(59);
    });

    it("should have unique IDs", () => {
      const ids = skillDefinitions.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have SANDBOX_001 as unlocked by default", () => {
      const sandbox001 = skillDefinitions.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.status).toBe("unlocked");
    });

    it("should have all other skills locked by default", () => {
      const lockedSkills = skillDefinitions.filter(
        (s) => s.id !== "SANDBOX_001" && s.status === "locked",
      );
      expect(lockedSkills).toHaveLength(58);
    });

    it("should have valid prerequisites (all referenced skills exist)", () => {
      const allIds = new Set(skillDefinitions.map((s) => s.id));
      for (const skill of skillDefinitions) {
        for (const prereq of skill.prerequisites) {
          expect(allIds.has(prereq)).toBe(true);
        }
      }
    });

    it("should have at least one reward for each skill", () => {
      for (const skill of skillDefinitions) {
        expect(skill.reward.length).toBeGreaterThan(0);
      }
    });

    it("should have valid difficulty values (1-5)", () => {
      for (const skill of skillDefinitions) {
        expect(skill.difficulty).toBeGreaterThanOrEqual(1);
        expect(skill.difficulty).toBeLessThanOrEqual(5);
      }
    });

    it("should have all expected skill IDs", () => {
      const actualIds = new Set(skillDefinitions.map((s) => s.id));
      for (const id of allSkillIdsFlat) {
        expect(actualIds.has(id)).toBe(true);
      }
    });
  });

  describe("sandbox skills", () => {
    it("should have 6 sandbox skills", () => {
      const sandboxSkills = skillDefinitions.filter(
        (s) => s.category === "sandbox",
      );
      expect(sandboxSkills).toHaveLength(6);
    });

    it("should have correct IDs for sandbox skills", () => {
      const sandboxSkills = skillDefinitions.filter(
        (s) => s.category === "sandbox",
      );
      const ids = sandboxSkills.map((s) => s.id);
      expect(ids).toEqual(expect.arrayContaining(allSkillIds.sandbox));
    });

    it("should have total reward of 150,000 for sandbox", () => {
      const sandboxSkills = skillDefinitions.filter(
        (s) => s.category === "sandbox",
      );
      const totalCash = sandboxSkills.reduce((sum, skill) => {
        const cashReward = skill.reward.find((r) => r.type === "cash");
        return sum + (cashReward?.value ?? 0);
      }, 0);
      expect(totalCash).toBe(150000);
    });
  });

  describe("bridge skills", () => {
    it("should have 3 bridge skills", () => {
      const bridgeSkills = skillDefinitions.filter(
        (s) => s.category === "bridge",
      );
      expect(bridgeSkills).toHaveLength(3);
    });

    it("should have correct IDs for bridge skills", () => {
      const bridgeSkills = skillDefinitions.filter(
        (s) => s.category === "bridge",
      );
      const ids = bridgeSkills.map((s) => s.id);
      expect(ids).toEqual(expect.arrayContaining(allSkillIds.bridge));
    });

    it("should have total reward of 60,000 for bridge", () => {
      const bridgeSkills = skillDefinitions.filter(
        (s) => s.category === "bridge",
      );
      const totalCash = bridgeSkills.reduce((sum, skill) => {
        const cashReward = skill.reward.find((r) => r.type === "cash");
        return sum + (cashReward?.value ?? 0);
      }, 0);
      expect(totalCash).toBe(60000);
    });
  });

  describe("fail skills", () => {
    it("should have 3 fail skills", () => {
      const failSkills = skillDefinitions.filter((s) => s.category === "fail");
      expect(failSkills).toHaveLength(3);
    });

    it("should have correct IDs for fail skills", () => {
      const failSkills = skillDefinitions.filter((s) => s.category === "fail");
      const ids = failSkills.map((s) => s.id);
      expect(ids).toEqual(expect.arrayContaining(allSkillIds.fail));
    });

    it("should have total reward of 35,000 for fail skills", () => {
      const failSkills = skillDefinitions.filter((s) => s.category === "fail");
      const totalCash = failSkills.reduce((sum, skill) => {
        const cashReward = skill.reward.find((r) => r.type === "cash");
        return sum + (cashReward?.value ?? 0);
      }, 0);
      expect(totalCash).toBe(35000);
    });
  });

  describe("category counts", () => {
    it("should have correct count for each category", () => {
      const counts = {
        sandbox: skillDefinitions.filter((s) => s.category === "sandbox")
          .length,
        bridge: skillDefinitions.filter((s) => s.category === "bridge").length,
        fail: skillDefinitions.filter((s) => s.category === "fail").length,
        setup: skillDefinitions.filter((s) => s.category === "setup").length,
        data: skillDefinitions.filter((s) => s.category === "data").length,
        set: skillDefinitions.filter((s) => s.category === "set").length,
        trade: skillDefinitions.filter((s) => s.category === "trade").length,
        chart: skillDefinitions.filter((s) => s.category === "chart").length,
        indicator: skillDefinitions.filter((s) => s.category === "indicator")
          .length,
        risk: skillDefinitions.filter((s) => s.category === "risk").length,
      };

      expect(counts.sandbox).toBe(6);
      expect(counts.bridge).toBe(3);
      expect(counts.fail).toBe(3);
      expect(counts.setup).toBe(5);
      expect(counts.data).toBe(6);
      expect(counts.set).toBe(3);
      expect(counts.trade).toBe(10);
      expect(counts.chart).toBe(4);
      expect(counts.indicator).toBe(9);
      expect(counts.risk).toBe(10);
    });
  });

  describe("track assignment", () => {
    it("should have sandbox track for sandbox category", () => {
      const sandboxSkills = skillDefinitions.filter(
        (s) => s.category === "sandbox",
      );
      for (const skill of sandboxSkills) {
        expect(skill.track).toBe("sandbox");
      }
    });

    it("should have bridge track for bridge category", () => {
      const bridgeSkills = skillDefinitions.filter(
        (s) => s.category === "bridge",
      );
      for (const skill of bridgeSkills) {
        expect(skill.track).toBe("bridge");
      }
    });

    it("should have full track for most categories", () => {
      const fullCategories = [
        "setup",
        "data",
        "set",
        "trade",
        "chart",
        "indicator",
        "risk",
      ];
      for (const category of fullCategories) {
        const skills = skillDefinitions.filter((s) => s.category === category);
        for (const skill of skills) {
          expect(skill.track).toBe("full");
        }
      }
    });
  });

  describe("prerequisite chains", () => {
    it("should have SANDBOX_001 with no prerequisites", () => {
      const sandbox001 = skillDefinitions.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.prerequisites).toEqual([]);
    });

    it("should have SANDBOX_002 depending on SANDBOX_001", () => {
      const sandbox002 = skillDefinitions.find((s) => s.id === "SANDBOX_002");
      expect(sandbox002?.prerequisites).toContain("SANDBOX_001");
    });

    it("should have BRIDGE_001 depending on SANDBOX_006", () => {
      const bridge001 = skillDefinitions.find((s) => s.id === "BRIDGE_001");
      expect(bridge001?.prerequisites).toContain("SANDBOX_006");
    });

    it("should have SETUP_001 depending on BRIDGE_003", () => {
      const setup001 = skillDefinitions.find((s) => s.id === "SETUP_001");
      expect(setup001?.prerequisites).toContain("BRIDGE_003");
    });

    it("should have no circular dependencies", () => {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (skillId: string): boolean => {
        if (recursionStack.has(skillId)) {
          return true;
        }
        if (visited.has(skillId)) {
          return false;
        }

        visited.add(skillId);
        recursionStack.add(skillId);

        const skill = skillDefinitions.find((s) => s.id === skillId);
        if (skill) {
          for (const prereq of skill.prerequisites) {
            if (hasCycle(prereq)) {
              return true;
            }
          }
        }

        recursionStack.delete(skillId);
        return false;
      };

      for (const skill of skillDefinitions) {
        expect(hasCycle(skill.id)).toBe(false);
      }
    });
  });

  describe("milestones", () => {
    it("should have 5 milestones", () => {
      expect(milestones).toHaveLength(5);
    });

    it("should be in ascending skillCount order", () => {
      for (let i = 1; i < milestones.length; i++) {
        expect(milestones[i].skillCount).toBeGreaterThan(
          milestones[i - 1].skillCount,
        );
      }
    });

    it("should have correct milestone skill counts", () => {
      const counts = milestones.map((m) => m.skillCount);
      expect(counts).toEqual([10, 20, 35, 50, 58]);
    });

    it("should have correct milestone bonuses", () => {
      const bonuses = milestones.map((m) => m.bonus);
      expect(bonuses).toEqual([50000, 100000, 200000, 400000, 600000]);
    });

    it("should have total milestone bonus of 1,350,000", () => {
      const totalBonus = milestones.reduce((sum, m) => sum + m.bonus, 0);
      expect(totalBonus).toBe(1350000);
    });
  });

  describe("help content", () => {
    it("should have helpContent for SANDBOX_001", () => {
      const sandbox001 = skillDefinitions.find((s) => s.id === "SANDBOX_001");
      expect(sandbox001?.helpContent).toBeDefined();
      expect(sandbox001?.helpContent?.length).toBeGreaterThan(0);
    });

    it("should have helpContent for all fail skills", () => {
      const failSkills = skillDefinitions.filter((s) => s.category === "fail");
      for (const skill of failSkills) {
        expect(skill.helpContent).toBeDefined();
      }
    });

    it("should have helpContent for bridge skills", () => {
      const bridgeSkills = skillDefinitions.filter(
        (s) => s.category === "bridge",
      );
      for (const skill of bridgeSkills) {
        expect(skill.helpContent).toBeDefined();
      }
    });
  });
});
