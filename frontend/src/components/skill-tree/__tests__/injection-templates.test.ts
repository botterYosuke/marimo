/* Copyright 2026 Marimo. All rights reserved. */

import { describe, it, expect } from "vitest";
import { skillDefinitions } from "../skill-data";
import {
  injectionTemplates,
  getInjectionTemplate,
  getInjectableSkillIds,
} from "../injection-templates";
import { allSkillIdsFlat } from "./test-fixtures";

// ========================================
// テンプレート不要なスキルを明示的に定義（理由付き）
// ========================================
/**
 * テンプレートが不要なスキルとその理由
 *
 * 設計方針:
 * - sandbox/bridge/fail/基本スキル: ヒントセルを注入する
 * - 上級スキル: ユーザーが自力で学ぶ段階なので注入不要
 */
const SKILLS_WITHOUT_TEMPLATE: Record<string, string> = {
  // ========================================
  // Sandbox スキル
  // ========================================
  SANDBOX_001: "最初のスキル、チュートリアル開始時に自動的にアンロック済み",

  // ========================================
  // Fail スキル
  // ========================================
  FAIL_003: "塩漬け体験、FAIL_001/002の教訓を活かす段階なのでヒント不要",

  // ========================================
  // Setup スキル（フルモードの準備段階）
  // ========================================
  SETUP_001: "Backtestインポート、BRIDGE_003で基礎は学習済み",
  // SETUP_002, SETUP_003: テンプレート追加済み
  SETUP_004: "データセット、SET_001で詳細に学ぶ",
  SETUP_005: "開始設定、基本操作なのでヒント不要",

  // ========================================
  // Data スキル
  // ========================================
  DATA_002: "複数銘柄取得、DATA_001の応用",
  DATA_003: "データ期間指定、上級操作",
  DATA_004: "データ確認、基本操作",
  DATA_005: "データ可視化、基本操作",
  DATA_006: "外部データ読み込み、上級操作",

  // ========================================
  // Set スキル
  // ========================================
  SET_002: "複数銘柄セット、SET_001の応用",
  SET_003: "データ更新、上級操作",

  // ========================================
  // Trade スキル（フルモードの上級操作）
  // ========================================
  TRADE_002: "株数指定買い、TRADE_001の応用",
  TRADE_003: "指値注文、上級操作",
  TRADE_004: "決済注文、基本操作",
  TRADE_005: "部分決済、上級操作",
  TRADE_006: "ショート売り、上級操作",
  TRADE_007: "ショート決済、上級操作",
  // TRADE_008, TRADE_010: テンプレート追加済み
  TRADE_009: "注文変更、上級操作",

  // ========================================
  // Chart スキル
  // ========================================
  CHART_001: "ローソク足チャート表示、基本操作",
  CHART_002: "インジケーター追加、基本操作",
  // CHART_003: テンプレート追加済み
  CHART_004: "チャートカスタマイズ、上級操作",

  // ========================================
  // Indicator スキル
  // ========================================
  // IND_002, IND_004, IND_007, IND_009: テンプレート追加済み
  IND_006: "MACD計算、上級インジケーター",
  IND_008: "ATR計算、上級インジケーター",

  // ========================================
  // Risk スキル
  // ========================================
  // RISK_002: テンプレート追加済み
  RISK_004: "ポジションサイズ計算、上級操作",
  RISK_005: "リスク/リワード計算、上級操作",
  RISK_006: "最大ドローダウン監視、上級操作",
  RISK_007: "日次損失制限、上級操作",
  RISK_008: "週次損失制限、上級操作",
  RISK_009: "ポートフォリオリスク管理、上級操作",
  RISK_010: "リスク分散、上級操作",
};

// ========================================
// P0-2: テンプレート未定義スキルの明示化
// ========================================
describe("injection-templates", () => {
  describe("テンプレート網羅性", () => {
    it("全てのスキルがテンプレートを持つか、明示的に不要とマークされている", () => {
      const unmappedSkills: string[] = [];

      for (const skillId of allSkillIdsFlat) {
        const template = getInjectionTemplate(skillId);
        const isExplicitlyExcluded = skillId in SKILLS_WITHOUT_TEMPLATE;

        if (!template && !isExplicitlyExcluded) {
          unmappedSkills.push(skillId);
        }
      }

      if (unmappedSkills.length > 0) {
        throw new Error(
          `以下のスキルにテンプレートがありません。\n` +
            `テンプレートを追加するか、SKILLS_WITHOUT_TEMPLATE に理由を記載してください:\n` +
            unmappedSkills.join(", ")
        );
      }

      expect(unmappedSkills).toHaveLength(0);
    });

    it("SKILLS_WITHOUT_TEMPLATE に無効なスキルIDがない", () => {
      const invalidIds = Object.keys(SKILLS_WITHOUT_TEMPLATE).filter(
        (id) => !allSkillIdsFlat.includes(id)
      );

      expect(invalidIds).toHaveLength(0);
    });

    it("テンプレート数 + 除外数 = 全スキル数", () => {
      const templateCount = getInjectableSkillIds().length;
      const excludedCount = Object.keys(SKILLS_WITHOUT_TEMPLATE).length;
      const totalSkills = allSkillIdsFlat.length;

      expect(templateCount + excludedCount).toBe(totalSkills);
    });
  });

  describe("テンプレート形式", () => {
    it.each(getInjectableSkillIds())(
      "スキル %s のテンプレートが正しい形式を持つ",
      (skillId) => {
        const template = getInjectionTemplate(skillId);
        expect(template).toBeDefined();

        // skillIdが一致
        expect(template!.skillId).toBe(skillId);

        // descriptionが存在
        expect(template!.description).toBeDefined();
        expect(typeof template!.description).toBe("string");
        expect(template!.description.length).toBeGreaterThan(0);

        // cells または setupUpdate が存在する
        const hasCells = template!.cells !== undefined && template!.cells.length > 0;
        const hasSetupUpdate = template!.setupUpdate !== undefined;

        expect(hasCells || hasSetupUpdate).toBe(true);
      }
    );

    it.each(getInjectableSkillIds())(
      "スキル %s のセルテンプレートが正しい形式を持つ",
      (skillId) => {
        const template = getInjectionTemplate(skillId);

        if (template?.cells) {
          for (const cell of template.cells) {
            // nameが存在
            expect(cell.name).toBeDefined();
            expect(typeof cell.name).toBe("string");
            expect(cell.name.length).toBeGreaterThan(0);

            // codeが存在
            expect(cell.code).toBeDefined();
            expect(typeof cell.code).toBe("string");
            expect(cell.code.length).toBeGreaterThan(0);

            // configがある場合は文字列
            if (cell.config !== undefined) {
              expect(typeof cell.config).toBe("string");
            }

            // afterCellがある場合は文字列
            if (cell.afterCell !== undefined) {
              expect(typeof cell.afterCell).toBe("string");
            }
          }
        }
      }
    );
  });

  describe("必須スキルのテンプレート", () => {
    const CRITICAL_SKILLS = [
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
      "SANDBOX_006",
      "BRIDGE_001",
      "BRIDGE_002",
      "BRIDGE_003",
    ];

    it.each(CRITICAL_SKILLS)(
      "クリティカルスキル %s にテンプレートが存在する",
      (skillId) => {
        const template = getInjectionTemplate(skillId);
        expect(template).toBeDefined();
        expect(template!.cells).toBeDefined();
        expect(template!.cells!.length).toBeGreaterThan(0);
      }
    );
  });

  describe("失敗スキルのテンプレート", () => {
    it("FAIL_001 に教育コンテンツのテンプレートがある", () => {
      const template = getInjectionTemplate("FAIL_001");
      expect(template).toBeDefined();
      expect(template!.description).toContain("含み損");
    });

    it("FAIL_002 に教育コンテンツのテンプレートがある", () => {
      const template = getInjectionTemplate("FAIL_002");
      expect(template).toBeDefined();
      expect(template!.description).toContain("損切り");
    });
  });

  describe("getInjectionTemplate", () => {
    it("存在するスキルIDでテンプレートを取得できる", () => {
      const template = getInjectionTemplate("SANDBOX_002");
      expect(template).toBeDefined();
      expect(template!.skillId).toBe("SANDBOX_002");
    });

    it("存在しないスキルIDでundefinedを返す", () => {
      const template = getInjectionTemplate("NONEXISTENT_SKILL");
      expect(template).toBeUndefined();
    });
  });

  describe("getInjectableSkillIds", () => {
    it("注入可能なスキルIDのリストを返す", () => {
      const ids = getInjectableSkillIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    it("返されるIDは全てテンプレートを持つ", () => {
      const ids = getInjectableSkillIds();
      for (const id of ids) {
        expect(getInjectionTemplate(id)).toBeDefined();
      }
    });

    it("injectionTemplatesの数と一致する", () => {
      const ids = getInjectableSkillIds();
      expect(ids.length).toBe(injectionTemplates.length);
    });
  });

  describe("テンプレート内容の整合性", () => {
    it("SANDBOX_006のテンプレートがブリッジモードへの案内を含む", () => {
      const template = getInjectionTemplate("SANDBOX_006");
      expect(template).toBeDefined();
      expect(template!.cells?.[0].code).toContain("ブリッジモード");
    });

    it("BRIDGE_003のテンプレートがフルモード解放を含む", () => {
      const template = getInjectionTemplate("BRIDGE_003");
      expect(template).toBeDefined();
      expect(template!.cells?.[0].code).toContain("フルモード");
    });

    it("各テンプレートのセル名がユニーク", () => {
      const allCellNames: string[] = [];

      for (const template of injectionTemplates) {
        if (template.cells) {
          for (const cell of template.cells) {
            // 同じテンプレート内での重複チェック
            const duplicateInSame = template.cells.filter(
              (c) => c.name === cell.name
            );
            expect(duplicateInSame.length).toBe(1);

            allCellNames.push(cell.name);
          }
        }
      }

      // 全体でのユニーク性（異なるスキル間でも重複しない）
      const uniqueNames = new Set(allCellNames);
      expect(uniqueNames.size).toBe(allCellNames.length);
    });
  });

  describe("SKILLS_WITHOUT_TEMPLATE の文書化", () => {
    it("全ての除外スキルに理由が記載されている", () => {
      for (const [skillId, reason] of Object.entries(SKILLS_WITHOUT_TEMPLATE)) {
        expect(reason.length).toBeGreaterThan(0);
        // 理由は意味のある文章であること
        expect(reason.length).toBeGreaterThan(5);
      }
    });

    it("除外理由にカテゴリが反映されている", () => {
      // 上級スキルは "上級" または "応用" の理由を含む
      const advancedSkills = [
        "TRADE_002",
        "TRADE_003",
        "RISK_004",
        "IND_006",
      ];

      for (const skillId of advancedSkills) {
        const reason = SKILLS_WITHOUT_TEMPLATE[skillId];
        expect(
          reason.includes("上級") || reason.includes("応用")
        ).toBe(true);
      }
    });
  });
});

// ========================================
// エクスポート: 他のテストで使用可能
// ========================================
export { SKILLS_WITHOUT_TEMPLATE };
