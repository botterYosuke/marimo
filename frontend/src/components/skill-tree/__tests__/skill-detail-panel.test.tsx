/* Copyright 2026 Marimo. All rights reserved. */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillDetailPanel } from "../skill-detail-panel";
import { createMockSkill } from "./test-fixtures";

// ========================================
// P2-1: 詳細パネルの挿入ボタン
// ========================================
describe("SkillDetailPanel", () => {
  describe("スキル未選択時", () => {
    it("プレースホルダーが表示される", () => {
      render(<SkillDetailPanel skill={null} />);

      expect(screen.getByText("スキルを選択してください")).toBeInTheDocument();
    });
  });

  describe("基本表示", () => {
    it("スキルタイトルが表示される", () => {
      const skill = createMockSkill({ title: "テストタイトル" });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("テストタイトル")).toBeInTheDocument();
    });

    it("スキル説明が表示される", () => {
      const skill = createMockSkill({ description: "詳細な説明文" });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("詳細な説明文")).toBeInTheDocument();
    });

    it("スキルIDが表示される", () => {
      const skill = createMockSkill({ id: "SANDBOX_001" });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("ID: SANDBOX_001")).toBeInTheDocument();
    });

    it("カテゴリバッジが表示される", () => {
      const skill = createMockSkill({ category: "sandbox" });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("sandbox")).toBeInTheDocument();
    });
  });

  describe("ステータス表示", () => {
    it("locked状態でロック中が表示される", () => {
      const skill = createMockSkill({ status: "locked" });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("ロック中")).toBeInTheDocument();
    });

    it("unlocked状態で挑戦可能が表示される", () => {
      const skill = createMockSkill({ status: "unlocked" });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("挑戦可能")).toBeInTheDocument();
    });

    it("completed状態で達成済みが表示される", () => {
      const skill = createMockSkill({ status: "completed" });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("達成済み")).toBeInTheDocument();
    });
  });

  describe("報酬表示", () => {
    it("報酬が表示される", () => {
      const skill = createMockSkill({
        reward: [{ type: "cash", description: "+30,000円", value: 30000 }],
      });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("+30,000円")).toBeInTheDocument();
    });

    it("複数報酬が全て表示される", () => {
      const skill = createMockSkill({
        reward: [
          { type: "cash", description: "+30,000円", value: 30000 },
          { type: "title", description: "称号「初陣」" },
        ],
      });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("+30,000円")).toBeInTheDocument();
      expect(screen.getByText("称号「初陣」")).toBeInTheDocument();
    });

    it("報酬タイプバッジが表示される", () => {
      const skill = createMockSkill({
        reward: [
          { type: "cash", description: "+30,000円" },
          { type: "title", description: "称号" },
        ],
      });
      render(<SkillDetailPanel skill={skill} />);

      // バッジとしてcashとtitleが表示される
      const badges = screen.getAllByText(/^(cash|title)$/);
      expect(badges.length).toBe(2);
    });
  });

  describe("前提スキル表示", () => {
    it("前提スキルがバッジで表示される", () => {
      const allSkills = [
        createMockSkill({ id: "SANDBOX_001", title: "最初の一歩" }),
        createMockSkill({
          id: "SANDBOX_002",
          title: "次のステップ",
          prerequisites: ["SANDBOX_001"],
        }),
      ];

      render(
        <SkillDetailPanel skill={allSkills[1]} allSkills={allSkills} />
      );

      // 前提スキルのtitleが表示される
      expect(screen.getByText("最初の一歩")).toBeInTheDocument();
    });

    it("前提スキルがない場合は前提セクションが非表示", () => {
      const skill = createMockSkill({ prerequisites: [] });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.queryByText("前提スキル")).not.toBeInTheDocument();
    });

    it("前提スキルが見つからない場合はIDが表示される", () => {
      const skill = createMockSkill({ prerequisites: ["UNKNOWN_001"] });
      render(<SkillDetailPanel skill={skill} allSkills={[]} />);

      expect(screen.getByText("UNKNOWN_001")).toBeInTheDocument();
    });
  });

  describe("挿入ボタン", () => {
    it("unlocked状態でhelpContentがある場合、ボタンが表示される", () => {
      const skill = createMockSkill({
        status: "unlocked",
        helpContent: "# ヘルプコンテンツ",
      });
      const onInsertHelp = vi.fn();
      render(<SkillDetailPanel skill={skill} onInsertHelp={onInsertHelp} />);

      expect(
        screen.getByRole("button", { name: /ノートブックに挿入/ })
      ).toBeInTheDocument();
    });

    it("locked状態ではボタンが非表示", () => {
      const skill = createMockSkill({
        status: "locked",
        helpContent: "# ヘルプコンテンツ",
      });
      const onInsertHelp = vi.fn();
      render(<SkillDetailPanel skill={skill} onInsertHelp={onInsertHelp} />);

      expect(
        screen.queryByRole("button", { name: /ノートブックに挿入/ })
      ).not.toBeInTheDocument();
    });

    it("completed状態ではボタンが非表示", () => {
      const skill = createMockSkill({
        status: "completed",
        helpContent: "# ヘルプコンテンツ",
      });
      const onInsertHelp = vi.fn();
      render(<SkillDetailPanel skill={skill} onInsertHelp={onInsertHelp} />);

      expect(
        screen.queryByRole("button", { name: /ノートブックに挿入/ })
      ).not.toBeInTheDocument();
    });

    it("helpContentがない場合はボタンが非表示", () => {
      const skill = createMockSkill({
        status: "unlocked",
        helpContent: undefined,
      });
      const onInsertHelp = vi.fn();
      render(<SkillDetailPanel skill={skill} onInsertHelp={onInsertHelp} />);

      expect(
        screen.queryByRole("button", { name: /ノートブックに挿入/ })
      ).not.toBeInTheDocument();
    });

    it("onInsertHelpがない場合はボタンが非表示", () => {
      const skill = createMockSkill({
        status: "unlocked",
        helpContent: "# ヘルプコンテンツ",
      });
      render(<SkillDetailPanel skill={skill} />);

      expect(
        screen.queryByRole("button", { name: /ノートブックに挿入/ })
      ).not.toBeInTheDocument();
    });

    it("クリック時にonInsertHelpがhelpContentで呼ばれる", () => {
      const helpContent = "# ヘルプコンテンツ\n\nこれはテストです。";
      const skill = createMockSkill({
        status: "unlocked",
        helpContent,
      });
      const onInsertHelp = vi.fn();
      render(<SkillDetailPanel skill={skill} onInsertHelp={onInsertHelp} />);

      fireEvent.click(
        screen.getByRole("button", { name: /ノートブックに挿入/ })
      );

      expect(onInsertHelp).toHaveBeenCalledTimes(1);
      expect(onInsertHelp).toHaveBeenCalledWith(helpContent);
    });
  });

  describe("ヘルプコンテンツ表示", () => {
    it("helpContentがある場合、ヘルプセクションが表示される", () => {
      const skill = createMockSkill({
        helpContent: "これはヘルプです",
      });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.getByText("ヘルプ")).toBeInTheDocument();
      expect(screen.getByText("これはヘルプです")).toBeInTheDocument();
    });

    it("helpContentがない場合、ヘルプセクションが非表示", () => {
      const skill = createMockSkill({
        helpContent: undefined,
      });
      render(<SkillDetailPanel skill={skill} />);

      expect(screen.queryByText("ヘルプ")).not.toBeInTheDocument();
    });
  });
});
