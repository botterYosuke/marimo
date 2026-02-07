/* Copyright 2026 Marimo. All rights reserved. */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "reactflow";
import { SkillNode, categoryColors } from "../skill-node";
import { createMockSkill } from "./test-fixtures";
import type { SkillNodeData } from "../types";

// ========================================
// P2-4: SkillNode ステータス表示
// ========================================

// ReactFlowコンテキストが必要なためラッパーを作成
function renderSkillNode(skill: ReturnType<typeof createMockSkill>) {
  const nodeProps = {
    id: skill.id,
    data: { skill } as SkillNodeData,
    type: "skill",
    selected: false,
    xPos: 0,
    yPos: 0,
    isConnectable: true,
    zIndex: 0,
    dragging: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };

  return render(
    <ReactFlowProvider>
      <SkillNode {...nodeProps} />
    </ReactFlowProvider>
  );
}

describe("SkillNode", () => {
  describe("基本表示", () => {
    it("スキルタイトルが表示される", () => {
      const skill = createMockSkill({ title: "テストスキル" });
      renderSkillNode(skill);

      expect(screen.getByText("テストスキル")).toBeInTheDocument();
    });

    it("スキル説明が表示される", () => {
      const skill = createMockSkill({ description: "スキルの説明" });
      renderSkillNode(skill);

      expect(screen.getByText("スキルの説明")).toBeInTheDocument();
    });

    it("最初の報酬が表示される", () => {
      const skill = createMockSkill({
        reward: [
          { type: "cash", description: "+30,000円" },
          { type: "title", description: "称号" },
        ],
      });
      renderSkillNode(skill);

      // 最初の報酬が表示
      expect(screen.getByText("+30,000円")).toBeInTheDocument();
      // 追加報酬の数が表示
      expect(screen.getByText("+1")).toBeInTheDocument();
    });
  });

  describe("ステータス別表示", () => {
    it("locked状態で適切なクラスが適用される", () => {
      const skill = createMockSkill({ status: "locked" });
      const { container } = renderSkillNode(skill);

      // opacity-50 クラスが適用されていることを確認
      const card = container.querySelector(".opacity-50");
      expect(card).not.toBeNull();
    });

    it("unlocked状態で適切なクラスが適用される", () => {
      const skill = createMockSkill({ status: "unlocked" });
      const { container } = renderSkillNode(skill);

      // shadow-md クラスが適用されていることを確認
      const card = container.querySelector(".shadow-md");
      expect(card).not.toBeNull();
    });

    it("completed状態で緑のチェックアイコンが表示される", () => {
      const skill = createMockSkill({ status: "completed" });
      const { container } = renderSkillNode(skill);

      // text-green-500 クラスを持つアイコンが存在
      const greenIcon = container.querySelector(".text-green-500");
      expect(greenIcon).not.toBeNull();
    });
  });

  describe("難易度スター", () => {
    it("難易度1で1つの星が塗りつぶされる", () => {
      const skill = createMockSkill({ difficulty: 1 });
      const { container } = renderSkillNode(skill);

      const filledStars = container.querySelectorAll(".fill-amber-400");
      expect(filledStars.length).toBe(1);
    });

    it("難易度3で3つの星が塗りつぶされる", () => {
      const skill = createMockSkill({ difficulty: 3 });
      const { container } = renderSkillNode(skill);

      const filledStars = container.querySelectorAll(".fill-amber-400");
      expect(filledStars.length).toBe(3);
    });

    it("難易度5で5つの星が塗りつぶされる", () => {
      const skill = createMockSkill({ difficulty: 5 });
      const { container } = renderSkillNode(skill);

      const filledStars = container.querySelectorAll(".fill-amber-400");
      expect(filledStars.length).toBe(5);
    });
  });

  describe("カテゴリカラー", () => {
    it("sandboxカテゴリでボーダーが適用される", () => {
      const skill = createMockSkill({ category: "sandbox" });
      const { container } = renderSkillNode(skill);

      // border-left-widthが設定されていることを確認
      const card = container.querySelector('[style*="border-left"]');
      expect(card).not.toBeNull();
      const style = card?.getAttribute("style") || "";
      // border-left-width: 3px が設定されている
      expect(style).toContain("border-left-width: 3px");
    });

    it("bridgeカテゴリでボーダーが適用される", () => {
      const skill = createMockSkill({ category: "bridge" });
      const { container } = renderSkillNode(skill);

      const card = container.querySelector('[style*="border-left"]');
      expect(card).not.toBeNull();
    });

    it("failカテゴリでボーダーが適用される", () => {
      const skill = createMockSkill({ category: "fail" });
      const { container } = renderSkillNode(skill);

      const card = container.querySelector('[style*="border-left"]');
      expect(card).not.toBeNull();
    });
  });

  describe("categoryColors定数", () => {
    it("全10カテゴリの色が定義されている", () => {
      const categories = [
        "sandbox",
        "bridge",
        "fail",
        "setup",
        "data",
        "set",
        "trade",
        "chart",
        "indicator",
        "risk",
      ];

      for (const category of categories) {
        expect(categoryColors[category as keyof typeof categoryColors]).toBeDefined();
      }
    });

    it("各カテゴリ色がHEXフォーマット", () => {
      for (const color of Object.values(categoryColors)) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe("選択状態", () => {
    it("selected=trueでリングが表示される", () => {
      const skill = createMockSkill();
      const nodeProps = {
        id: skill.id,
        data: { skill },
        type: "skill",
        selected: true,
        xPos: 0,
        yPos: 0,
        isConnectable: true,
        zIndex: 0,
        dragging: false,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
      };

      const { container } = render(
        <ReactFlowProvider>
          <SkillNode {...nodeProps} />
        </ReactFlowProvider>
      );

      const selectedCard = container.querySelector(".ring-2");
      expect(selectedCard).not.toBeNull();
    });
  });
});
