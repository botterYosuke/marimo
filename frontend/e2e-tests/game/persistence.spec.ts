/* Copyright 2026 Marimo. All rights reserved. */

/**
 * ゲーム進捗の永続化・初期化テスト
 *
 * playerProgressAtom は plain atom（atomWithStorage 未使用）のため、
 * ページリロード後は初期状態にリセットされる。
 *
 * このテストで検証すること:
 * 1. リロード後に進捗がリセットされること（Web モードの仕様）
 * 2. 初期状態から正しく始まること
 * 3. BroadcastChannel イベントが連続して正しく積み上がること
 *
 * NOTE: Electron（Tauri）モードでは progress_manager.py がファイルに保存するため
 *       リロード後も進捗が維持される。Web モードとの差異に注意。
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import { getAppUrl } from "../../playwright.config";
import {
  openSkillTreePanel,
  emitSkillEvent,
  emitSkillSequence,
  getSkillNodeLocator,
  waitForSkillStatus,
  getCompletedCount,
  resetGameProgress,
} from "./helpers";

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

test.describe("進捗の初期化・リセット", () => {
  let context: BrowserContext;

  test.beforeEach(async ({ page }, info) => {
    context = page.context();
    await page.goto(getAppUrl(APP));
    if (info.retry) {
      await page.reload();
    }
    await page.waitForLoadState("networkidle");
    await openSkillTreePanel(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGameProgress(page);
  });

  // -------------------------------------------------------------------------
  // 初期状態の確認
  // -------------------------------------------------------------------------

  test("ページ初回ロード時、完了スキル数は 0", async ({ page }) => {
    const count = await getCompletedCount(page);
    expect(count).toBe(0);
  });

  test("ページ初回ロード時、SANDBOX_001 は unlocked", async ({ page }) => {
    const node = getSkillNodeLocator(page, "SANDBOX_001");
    await expect(node).toBeVisible();
    // SANDBOX_001 は prerequisites なし → unlocked
    await expect(node).toHaveAttribute("data-skill-status", "unlocked");
  });

  // -------------------------------------------------------------------------
  // リロード後のリセット（Web モードの仕様）
  // -------------------------------------------------------------------------

  test("スキル完了後リロードすると進捗が 0 にリセットされる（Web モード仕様）", async ({
    page,
  }) => {
    // スキルを 3 つ完了
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
    ]);

    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 5_000 });

    // ページリロード
    await page.reload();
    await page.waitForLoadState("networkidle");
    await openSkillTreePanel(page);

    // Web モードでは plain atom のためリセットされる
    const countAfterReload = await getCompletedCount(page);
    expect(countAfterReload).toBe(0);
  });

  // -------------------------------------------------------------------------
  // イベント連続処理
  // -------------------------------------------------------------------------

  test("連続した BroadcastChannel イベントがすべて処理される", async ({
    page,
  }) => {
    const skills = [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
    ];
    await emitSkillSequence(context, page, skills);

    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBe(skills.length);
    }).toPass({ timeout: 10_000 });
  });

  test("前提条件チェーンが正しく解除される", async ({ page }) => {
    // SANDBOX_001 → 002 → 003 の前提条件チェーン
    await emitSkillEvent(context, page, "SANDBOX_001");
    await waitForSkillStatus(page, "SANDBOX_001", "completed");

    await emitSkillEvent(context, page, "SANDBOX_002");
    await waitForSkillStatus(page, "SANDBOX_002", "completed");

    await emitSkillEvent(context, page, "SANDBOX_003");
    await waitForSkillStatus(page, "SANDBOX_003", "completed");

    const count = await getCompletedCount(page);
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// BroadcastChannel の挙動検証
// ---------------------------------------------------------------------------

test.describe("BroadcastChannel イベント処理", () => {
  let context: BrowserContext;

  test.beforeEach(async ({ page }, info) => {
    context = page.context();
    await page.goto(getAppUrl(APP));
    if (info.retry) {
      await page.reload();
    }
    await page.waitForLoadState("networkidle");
    await openSkillTreePanel(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGameProgress(page);
  });

  test("不明なスキル ID を送信しても UI がクラッシュしない", async ({
    page,
  }) => {
    // 存在しないスキル ID を送信
    await emitSkillEvent(context, page, "UNKNOWN_SKILL_999");
    await page.waitForTimeout(500);

    // パネルが引き続き表示されていること
    await expect(page.getByText("スキルツリー").first()).toBeVisible();

    // 完了数は変わらないこと
    const count = await getCompletedCount(page);
    expect(count).toBe(0);
  });

  test("スキルイベントのあと RewardToast が表示される", async ({ page }) => {
    await emitSkillEvent(context, page, "SANDBOX_001");

    // showSkillRewardToast が呼ばれると marimo の toast が出る
    // toast は time-limited なので短いタイムアウトで確認
    const toast = page
      .locator("[role='status'], [class*='toast'], [class*='Toast']")
      .first();

    await expect(toast).toBeVisible({ timeout: 3_000 });
  });

  test("prerequisites 未完了のスキル ID を送信しても completed にならない", async ({
    page,
  }) => {
    // SANDBOX_003 の前提は SANDBOX_002（未完了）
    await emitSkillEvent(context, page, "SANDBOX_003");
    await page.waitForTimeout(500);

    const count = await getCompletedCount(page);
    expect(count).toBe(0);
  });
});
