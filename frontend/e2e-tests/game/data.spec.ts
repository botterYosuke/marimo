/* Copyright 2026 Marimo. All rights reserved. */

/**
 * データ取得トラック e2e テスト
 *
 * DATA_001 〜 DATA_006 の進行を検証する。
 * データ取得トラックは SETUP_002 完了後に解放される。
 *
 * 前提条件チェーン:
 *   BRIDGE_003 → SETUP_001 → SETUP_002 → DATA_001 ─┬→ DATA_002 → DATA_003
 *                                                    ├→ DATA_004 → DATA_005
 *                                                    └→ DATA_006
 *
 * スキルタイトル（参考）:
 *   DATA_001: "get_stock_dailyを使う"
 *   DATA_002: "株価データを確認する"
 *   DATA_003: "OHLCV列を理解する"
 *   DATA_004: "別の銘柄を取得する"
 *   DATA_005: "複数銘柄を取得する"
 *   DATA_006: "日付範囲を指定する"
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import { getAppUrl } from "../../playwright.config";
import {
  ensureConnected,
  openSkillTreePanel,
  emitSkillEvent,
  emitSkillSequence,
  getSkillStatus,
  waitForSkillStatus,
  getCompletedCount,
  resetGameProgress,
} from "./helpers";

/** スキルステータス待機の統一タイムアウト */
const SKILL_STATUS_TIMEOUT = 10_000;

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

/** DATA_001 解放まで必要なチェーン全体 */
const PRE_DATA_CHAIN = [
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
  "SETUP_002",
] as const;

test.describe("データ取得トラック", () => {
  let context: BrowserContext;

  test.beforeEach(async ({ page }, info) => {
    context = page.context();

    const needsNavigation =
      !page.url().includes("game_test.py") || info.retry;

    if (needsNavigation) {
      await page.goto(getAppUrl(APP));
      await page.waitForLoadState("load");
    }

    await ensureConnected(page);
    await resetGameProgress(page);
    await openSkillTreePanel(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGameProgress(page);
  });

  // -------------------------------------------------------------------------
  // 初期状態
  // -------------------------------------------------------------------------

  test("初期状態: DATA_001 は locked（SETUP_002 未完了）", async ({
    page,
  }) => {
    const status = await getSkillStatus(page, "DATA_001");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // DATA_001 の解放条件
  // -------------------------------------------------------------------------

  test("SETUP_002 完了後、DATA_001 が unlocked になる", async ({ page }) => {
    await emitSkillSequence(context, page, [...PRE_DATA_CHAIN]);

    await waitForSkillStatus(
      page,
      "SETUP_002",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "DATA_001",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
  });

  test("SETUP_001 のみ完了では DATA_001 は locked のまま", async ({ page }) => {
    await emitSkillSequence(context, page, [
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
    ]);
    await waitForSkillStatus(
      page,
      "SETUP_001",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    const status = await getSkillStatus(page, "DATA_001");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // DATA_001 の完了フロー（3 方向並列解放）
  // -------------------------------------------------------------------------

  test("DATA_001 完了で DATA_002・DATA_004・DATA_006 が並列解放される", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, [...PRE_DATA_CHAIN, "DATA_001"]);

    await waitForSkillStatus(
      page,
      "DATA_001",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // 3 方向の並列解放を確認
    await waitForSkillStatus(
      page,
      "DATA_002",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "DATA_004",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "DATA_006",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
  });

  test("DATA_001 完了後に現金が増える", async ({ page }) => {
    await emitSkillSequence(context, page, [...PRE_DATA_CHAIN]);
    await waitForSkillStatus(
      page,
      "SETUP_002",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    const cashBefore = await page
      .locator("text=/¥[0-9,]+/")
      .first()
      .textContent();
    const cashBeforeNum = Number((cashBefore ?? "¥0").replace(/[¥,]/g, ""));

    await emitSkillEvent(context, page, "DATA_001");
    await waitForSkillStatus(page, "DATA_001", "completed", 5_000);

    await expect(async () => {
      const cashText = await page
        .locator("text=/¥[0-9,]+/")
        .first()
        .textContent();
      const cash = Number((cashText ?? "¥0").replace(/[¥,]/g, ""));
      expect(cash).toBeGreaterThan(cashBeforeNum);
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // DATA_002 → DATA_003 チェーン
  // -------------------------------------------------------------------------

  test("DATA_002 完了で DATA_003 が unlocked になる", async ({ page }) => {
    await emitSkillSequence(context, page, [
      ...PRE_DATA_CHAIN,
      "DATA_001",
      "DATA_002",
    ]);

    await waitForSkillStatus(
      page,
      "DATA_002",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "DATA_003",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
  });

  // -------------------------------------------------------------------------
  // DATA_004 → DATA_005 チェーン
  // -------------------------------------------------------------------------

  test("DATA_004 完了で DATA_005 が unlocked になる", async ({ page }) => {
    await emitSkillSequence(context, page, [
      ...PRE_DATA_CHAIN,
      "DATA_001",
      "DATA_004",
    ]);

    await waitForSkillStatus(
      page,
      "DATA_004",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "DATA_005",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
  });

  // -------------------------------------------------------------------------
  // DATA 全スキル完了
  // -------------------------------------------------------------------------

  test("DATA_001〜006 全完了", async ({ page }) => {
    await emitSkillSequence(context, page, [
      ...PRE_DATA_CHAIN,
      "DATA_001",
      "DATA_002",
      "DATA_003",
      "DATA_004",
      "DATA_005",
      "DATA_006",
    ]);

    await waitForSkillStatus(
      page,
      "DATA_003",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "DATA_005",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "DATA_006",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // 9 (SANDBOX+BRIDGE) + 2 (SETUP) + 6 (DATA) = 17 スキル以上
    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(17);
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 前提条件ガード
  // -------------------------------------------------------------------------

  test("SETUP_002 未完了のまま DATA_001 を発火しても completed にならない", async ({
    page,
  }) => {
    // SETUP_001 まで完了（SETUP_002 は飛ばす）
    await emitSkillSequence(context, page, [
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
    ]);

    await emitSkillEvent(context, page, "DATA_001");

    await expect(async () => {
      expect(await getSkillStatus(page, "DATA_001")).toBe("locked");
    }).toPass({ timeout: 3_000 });
  });

  test("DATA_001 未完了のまま DATA_002 を発火しても completed にならない", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, [...PRE_DATA_CHAIN]);
    await waitForSkillStatus(
      page,
      "SETUP_002",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // DATA_001 を飛ばして DATA_002 を発火
    await emitSkillEvent(context, page, "DATA_002");

    await expect(async () => {
      expect(await getSkillStatus(page, "DATA_002")).toBe("locked");
    }).toPass({ timeout: 3_000 });
  });

  test("DATA_001 未完了のまま DATA_004 を発火しても completed にならない", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, [...PRE_DATA_CHAIN]);
    await waitForSkillStatus(
      page,
      "SETUP_002",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // DATA_001 を飛ばして DATA_004 を発火
    await emitSkillEvent(context, page, "DATA_004");

    await expect(async () => {
      expect(await getSkillStatus(page, "DATA_004")).toBe("locked");
    }).toPass({ timeout: 3_000 });
  });
});
