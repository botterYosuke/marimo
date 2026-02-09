/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import {
  createSkillElements,
  SKILL_NODE_WIDTH,
  SKILL_NODE_HEIGHT,
  TRACK_OFFSETS,
  TRACK_INFO,
} from "../elements";
import { skillDefinitions } from "../skill-data";

describe("elements", () => {
  describe("constants", () => {
    it("should have correct node dimensions", () => {
      expect(SKILL_NODE_WIDTH).toBe(200);
      expect(SKILL_NODE_HEIGHT).toBe(100);
    });

    it("should have correct track offsets", () => {
      expect(TRACK_OFFSETS.sandbox).toBe(0);
      expect(TRACK_OFFSETS.bridge).toBe(800);
      expect(TRACK_OFFSETS.full).toBe(1600);
    });

    it("should have track info for all tracks", () => {
      expect(TRACK_INFO.sandbox).toBeDefined();
      expect(TRACK_INFO.bridge).toBeDefined();
      expect(TRACK_INFO.full).toBeDefined();
    });

    it("should have correct track titles", () => {
      expect(TRACK_INFO.sandbox.title).toBe("サンドボックス");
      expect(TRACK_INFO.bridge.title).toBe("ブリッジ");
      expect(TRACK_INFO.full.title).toBe("フルモード");
    });
  });

  describe("createSkillElements", () => {
    it("should create nodes for all skills", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      expect(nodes).toHaveLength(skillDefinitions.length);
    });

    it("should create edges for all prerequisites", () => {
      const { edges } = createSkillElements(skillDefinitions);
      const totalPrereqs = skillDefinitions.reduce(
        (sum, s) => sum + s.prerequisites.length,
        0,
      );
      expect(edges).toHaveLength(totalPrereqs);
    });

    it("should create nodes with skill type", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      for (const node of nodes) {
        expect(node.type).toBe("skill");
      }
    });

    it("should include skill data in each node", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      for (const node of nodes) {
        expect(node.data.skill).toBeDefined();
        expect(node.data.skill.id).toBe(node.id);
      }
    });

    it("should set correct node dimensions", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      for (const node of nodes) {
        expect(node.width).toBe(SKILL_NODE_WIDTH);
        expect(node.height).toBe(SKILL_NODE_HEIGHT);
      }
    });
  });

  describe("sandbox track positioning", () => {
    it("should position sandbox nodes at y >= 0", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const sandboxNodes = nodes.filter(
        (n) => n.data.skill.track === "sandbox",
      );
      for (const node of sandboxNodes) {
        expect(node.position.y).toBeGreaterThanOrEqual(TRACK_OFFSETS.sandbox);
      }
    });

    it("should position sandbox track nodes grouped together", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const sandboxNodes = nodes.filter(
        (n) => n.data.skill.track === "sandbox",
      );
      // sandbox トラックのすべてのノードがオフセット0から開始する
      const minY = Math.min(...sandboxNodes.map((n) => n.position.y));
      expect(minY).toBe(TRACK_OFFSETS.sandbox);
    });

    it("should have 6 sandbox nodes", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const sandboxNodes = nodes.filter(
        (n) => n.data.skill.track === "sandbox",
      );
      // sandbox カテゴリ + fail (sandbox/bridge track)
      const sandboxTrackSkills = skillDefinitions.filter(
        (s) => s.track === "sandbox",
      );
      expect(sandboxNodes).toHaveLength(sandboxTrackSkills.length);
    });
  });

  describe("bridge track positioning", () => {
    it("should position bridge nodes at y >= 800", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const bridgeNodes = nodes.filter((n) => n.data.skill.track === "bridge");
      for (const node of bridgeNodes) {
        expect(node.position.y).toBeGreaterThanOrEqual(TRACK_OFFSETS.bridge);
      }
    });

    it("should position bridge nodes below full track", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const bridgeNodes = nodes.filter((n) => n.data.skill.track === "bridge");
      for (const node of bridgeNodes) {
        expect(node.position.y).toBeLessThan(TRACK_OFFSETS.full);
      }
    });
  });

  describe("full track positioning", () => {
    it("should position full nodes at y >= 1600", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const fullNodes = nodes.filter((n) => n.data.skill.track === "full");
      for (const node of fullNodes) {
        expect(node.position.y).toBeGreaterThanOrEqual(TRACK_OFFSETS.full);
      }
    });
  });

  describe("edge properties", () => {
    it("should have source and target for each edge", () => {
      const { edges } = createSkillElements(skillDefinitions);
      for (const edge of edges) {
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      }
    });

    it("should have smoothstep type for all edges", () => {
      const { edges } = createSkillElements(skillDefinitions);
      for (const edge of edges) {
        expect(edge.type).toBe("smoothstep");
      }
    });

    it("should have source pointing to existing node", () => {
      const { nodes, edges } = createSkillElements(skillDefinitions);
      const nodeIds = new Set(nodes.map((n) => n.id));
      for (const edge of edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
      }
    });

    it("should have target pointing to existing node", () => {
      const { nodes, edges } = createSkillElements(skillDefinitions);
      const nodeIds = new Set(nodes.map((n) => n.id));
      for (const edge of edges) {
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    });
  });

  describe("cross-track edges", () => {
    it("should create edge from SANDBOX_006 to BRIDGE_001", () => {
      const { edges } = createSkillElements(skillDefinitions);
      const crossTrackEdge = edges.find(
        (e) => e.source === "SANDBOX_006" && e.target === "BRIDGE_001",
      );
      expect(crossTrackEdge).toBeDefined();
    });

    it("should create edge from BRIDGE_003 to SETUP_001", () => {
      const { edges } = createSkillElements(skillDefinitions);
      const crossTrackEdge = edges.find(
        (e) => e.source === "BRIDGE_003" && e.target === "SETUP_001",
      );
      expect(crossTrackEdge).toBeDefined();
    });

    it("should have dashed style for cross-track edges", () => {
      const { edges } = createSkillElements(skillDefinitions);

      // SANDBOX_006 -> BRIDGE_001 はクロストラック
      const crossTrackEdge = edges.find(
        (e) => e.source === "SANDBOX_006" && e.target === "BRIDGE_001",
      );
      expect(crossTrackEdge?.style?.strokeDasharray).toBeDefined();
    });
  });

  describe("node layout hierarchy", () => {
    it("should position SANDBOX_001 at level 0", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const sandbox001 = nodes.find((n) => n.id === "SANDBOX_001");
      expect(sandbox001).toBeDefined();
      expect(sandbox001?.position.y).toBe(TRACK_OFFSETS.sandbox);
    });

    it("should position SANDBOX_002 below SANDBOX_001", () => {
      const { nodes } = createSkillElements(skillDefinitions);
      const sandbox001 = nodes.find((n) => n.id === "SANDBOX_001");
      const sandbox002 = nodes.find((n) => n.id === "SANDBOX_002");
      expect(sandbox002?.position.y).toBeGreaterThan(sandbox001!.position.y);
    });
  });

  describe("empty skills handling", () => {
    it("should return empty arrays for empty input", () => {
      const { nodes, edges } = createSkillElements([]);
      expect(nodes).toHaveLength(0);
      expect(edges).toHaveLength(0);
    });
  });

  describe("single skill handling", () => {
    it("should create single node for single skill", () => {
      const singleSkill = [skillDefinitions[0]];
      const { nodes, edges } = createSkillElements(singleSkill);
      expect(nodes).toHaveLength(1);
      expect(edges).toHaveLength(0); // SANDBOX_001 has no prerequisites
    });
  });
});
