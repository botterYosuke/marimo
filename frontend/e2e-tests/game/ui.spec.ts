/* Copyright 2026 Marimo. All rights reserved. */

/**
 * スキルツリー UI e2e テスト
 *
 * スキルツリーパネルの UI 動作を検証する:
 * - スキルノードのビジュアル状態
 * - トラック切り替え
 * - 報酬サマリーの展開/折り畳み
 * - 現金表示の更新
 * - マイルストーン到達時のバッジ
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import { getAppUrl } from "../../playwright.config";
import {
  ensureConnected,
  openSkillTreePanel,
  emitSkillEvent,
  emitSkillSequence,
  getSkillNodeLocator,
  getCompletedCount,
  resetGameProgress,
} from "./helpers";
import { TOTAL_SKILL_COUNT, FIRST_MILESTONE } from "./constants";

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

test.describe("スキルツリー UI", () => {
  let context: BrowserContext;

  test.beforeEach(async ({ page }, info) => {
    context = page.context();
    await page.goto(getAppUrl(APP));
    if (info.retry) {
      await page.reload();
    }
    await page.waitForLoadState("load");
    await ensureConnected(page);
    // 再接続時にカーネルが既存セル出力を再送してスキル発火が汚染される（知見 35b）
    await resetGameProgress(page);
    await openSkillTreePanel(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGameProgress(page);
  });

  // -------------------------------------------------------------------------
  // パネルの基本表示
  // -------------------------------------------------------------------------

  test("スキルツリーパネルが表示される", async ({ page }) => {
    // ヘッダーの「スキルツリー」テキスト
    await expect(page.getByText("スキルツリー").first()).toBeVisible();
  });

  test("進捗バッジに総スキル数 59 が表示される", async ({ page }) => {
    await expect(
      page.locator(`text=/\\d+\\/${TOTAL_SKILL_COUNT} スキル/`),
    ).toBeVisible();
  });

  test("初期の現金残高が ¥0 または初期値を表示する", async ({ page }) => {
    // フッターの CoinsIcon の隣に現金が表示されている
    const cashDisplay = page.locator("text=/¥[0-9,]+/").first();
    await expect(cashDisplay).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // スキルノードのビジュアル状態
  // -------------------------------------------------------------------------

  test("locked スキルノードは data-skill-status='locked' を持つ", async ({
    page,
  }) => {
    // SANDBOX_002 は最初 locked
    const node = getSkillNodeLocator(page, "SANDBOX_002");
    await expect(node).toBeVisible();
    await expect(node).toHaveAttribute("data-skill-status", "locked");
  });

  test("completed スキルノードは data-skill-status='completed' を持つ", async ({
    page,
  }) => {
    await emitSkillEvent(context, page, "SANDBOX_001");
    await page.waitForTimeout(500);

    const node = getSkillNodeLocator(page, "SANDBOX_001");
    await expect(node).toBeVisible();
    await expect(node).toHaveAttribute("data-skill-status", "completed");
  });

  test("スキルノードに難易度スターが表示される", async ({ page }) => {
    // SANDBOX_001 のノードを取得（data-skill-id 経由）
    const node = getSkillNodeLocator(page, "SANDBOX_001");
    await expect(node).toBeVisible();

    const starCount = await node.locator("svg").count();
    // StarIcon 5 個 + その他 SVG → 少なくとも 5 個以上
    expect(starCount).toBeGreaterThanOrEqual(5);
  });

  test("スキルノードに報酬バッジが表示される", async ({ page }) => {
    // Badge コンポーネントは <div> に Tailwind クラス (inline-flex rounded-full) を付与する。
    // "Badge" という文字列はクラスに含まれないため、
    // GiftIcon を含む報酬セクション内の rounded-full 要素で判定する。
    const rewardSection = page
      .locator('[data-skill-id="SANDBOX_001"] .border-t')
      .first();
    await expect(rewardSection).toBeVisible();

    // Badge（rounded-full の div）が報酬セクション内に存在する
    const badge = rewardSection.locator(".rounded-full").first();
    await expect(badge).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // トラック切り替え
  // -------------------------------------------------------------------------

  test.fixme("トラック切り替え: sandbox フィルターでサンドボックスノードのみ表示", async ({
    page,
  }) => {
    // トラックフィルター UI 未実装のため fixme
    // 実装されたら test() に昇格し、以下のアサーションを有効化
    const sandboxTab = page
      .getByRole("button", { name: /sandbox|サンドボックス/i })
      .first();
    await expect(sandboxTab).toBeVisible({ timeout: 3_000 });
    await sandboxTab.click();

    const sandboxNode = getSkillNodeLocator(page, "SANDBOX_001");
    await expect(sandboxNode).toBeVisible();

    const bridgeNode = getSkillNodeLocator(page, "BRIDGE_001");
    await expect(bridgeNode).toBeHidden({ timeout: 3_000 });
  });

  test.fixme("トラック切り替え: all でサンドボックスと全スキルが表示される", async ({
    page,
  }) => {
    // トラックフィルター UI 未実装のため fixme
    // 実装されたら test() に昇格
    const allTab = page
      .getByRole("button", { name: /all|すべて/i })
      .first();
    await expect(allTab).toBeVisible({ timeout: 3_000 });
    await allTab.click();
    const nodes = page.locator("[data-skill-id]");
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(59);
  });

  // -------------------------------------------------------------------------
  // 報酬サマリー
  // -------------------------------------------------------------------------

  test.fixme("フッターボタンをクリックで報酬サマリーが展開する", async ({
    page,
  }) => {
    // 報酬サマリー展開 UI 未実装のため fixme
    // 実装されたら test() に昇格
    const footerToggle = page
      .locator("button")
      .filter({ hasText: /¥/ })
      .first();
    await expect(footerToggle).toBeVisible({ timeout: 3_000 });
    await footerToggle.click();

    await expect(
      page.locator("[class*='overflow-y-auto']").first(),
    ).toBeVisible({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // 現金表示の更新
  // -------------------------------------------------------------------------

  test("スキル完了後に現金残高が増える", async ({ page }) => {
    // 初期の現金値を取得
    const initialCashText = await page
      .locator("text=/¥[0-9,]+/")
      .first()
      .textContent();
    const initialCash = Number(
      (initialCashText ?? "¥0").replace(/[¥,]/g, ""),
    );

    // SANDBOX_001 完了（報酬付き）
    await emitSkillEvent(context, page, "SANDBOX_001");
    await page.waitForTimeout(500);

    await expect(async () => {
      const cashText = await page
        .locator("text=/¥[0-9,]+/")
        .first()
        .textContent();
      const cash = Number((cashText ?? "¥0").replace(/[¥,]/g, ""));
      expect(cash).toBeGreaterThan(initialCash);
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // マイルストーン（10 スキルで最初のマイルストーン）
  // -------------------------------------------------------------------------

  test("10 スキル完了でマイルストーン報酬が加算される", async ({ page }) => {
    // サンドボックス 6 スキル + bridge 3 スキル + 1 = 10 スキルで第1マイルストーン
    const first10Skills = [
      "SANDBOX_001", "SANDBOX_002", "SANDBOX_003",
      "SANDBOX_004", "SANDBOX_005", "SANDBOX_006",
      "BRIDGE_001", "BRIDGE_002", "BRIDGE_003",
      "SETUP_001",
    ];

    await emitSkillSequence(context, page, first10Skills);

    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(10);
    }).toPass({ timeout: 10_000 });

    // マイルストーン報酬 50,000 円 + 各スキル報酬が加算されているはず
    await expect(async () => {
      const cashText = await page
        .locator("text=/¥[0-9,]+/")
        .first()
        .textContent();
      const cash = Number((cashText ?? "¥0").replace(/[¥,]/g, ""));
      expect(cash).toBeGreaterThan(FIRST_MILESTONE.bonus);
    }).toPass({ timeout: 5_000 });
  });
});
