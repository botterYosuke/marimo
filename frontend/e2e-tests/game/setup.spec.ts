/* Copyright 2026 Marimo. All rights reserved. */

/**
 * セットアップトラック e2e テスト
 *
 * SETUP_001 〜 SETUP_005 の進行を検証する。
 * セットアップトラックは BRIDGE_003 完了後に解放される。
 *
 * 前提条件チェーン:
 *   SANDBOX_001 → 002 → 003
 *                  └→ 004 → 005 → 006 → BRIDGE_001 → BRIDGE_002 → BRIDGE_003
 *                                                                      ↓
 *                                                                 SETUP_001 → SETUP_002 → SETUP_003 → SETUP_004
 *                                                                                                    → SETUP_005
 *
 * スキルタイトル（参考）:
 *   SETUP_001: "marimoを起動する"
 *   SETUP_002: "BackcastProをインポート"
 *   SETUP_003: "Backtestを初期化する"
 *   SETUP_004: "初期資金を設定する"
 *   SETUP_005: "手数料を設定する"
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
import { SETUP_SKILL_IDS, getTotalCashAfterSkills } from "./constants";

/** スキルステータス待機の統一タイムアウト */
const SKILL_STATUS_TIMEOUT = 10_000;

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

/** SANDBOX → BRIDGE 全完了チェーン */
const SANDBOX_AND_BRIDGE_ALL = [
  "SANDBOX_001",
  "SANDBOX_002",
  "SANDBOX_003",
  "SANDBOX_004",
  "SANDBOX_005",
  "SANDBOX_006",
  "BRIDGE_001",
  "BRIDGE_002",
  "BRIDGE_003",
] as const;

test.describe("セットアップトラック", () => {
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
  // 初期状態（BRIDGE_003 未完了）
  // -------------------------------------------------------------------------

  test("初期状態: SETUP_001 は locked（BRIDGE_003 未完了）", async ({
    page,
  }) => {
    const status = await getSkillStatus(page, "SETUP_001");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // SETUP_001 の解放条件
  // -------------------------------------------------------------------------

  test("BRIDGE_003 完了後、SETUP_001 が unlocked になる", async ({ page }) => {
    await emitSkillSequence(context, page, [...SANDBOX_AND_BRIDGE_ALL]);

    await waitForSkillStatus(
      page,
      "BRIDGE_003",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "SETUP_001",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
  });

  test("BRIDGE_002 完了のみでは SETUP_001 は locked のまま", async ({
    page,
  }) => {
    // BRIDGE_003 を飛ばす
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
      "SANDBOX_006",
      "BRIDGE_001",
      "BRIDGE_002",
    ]);
    await waitForSkillStatus(
      page,
      "BRIDGE_002",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    const status = await getSkillStatus(page, "SETUP_001");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // SETUP_001 の完了フロー
  // -------------------------------------------------------------------------

  test("SETUP_001 完了で SETUP_002 が unlocked になる", async ({ page }) => {
    await emitSkillSequence(context, page, [
      ...SANDBOX_AND_BRIDGE_ALL,
      "SETUP_001",
    ]);

    await waitForSkillStatus(
      page,
      "SETUP_001",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "SETUP_002",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
  });

  test("SETUP_001 完了後に現金が増える", async ({ page }) => {
    await emitSkillSequence(context, page, [...SANDBOX_AND_BRIDGE_ALL]);
    await waitForSkillStatus(
      page,
      "BRIDGE_003",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    const cashBefore = await page
      .locator("text=/¥[0-9,]+/")
      .first()
      .textContent();
    const cashBeforeNum = Number((cashBefore ?? "¥0").replace(/[¥,]/g, ""));

    await emitSkillEvent(context, page, "SETUP_001");
    await waitForSkillStatus(page, "SETUP_001", "completed", 5_000);

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
  // SETUP チェーン完了
  // -------------------------------------------------------------------------

  test("SETUP_001〜003 チェーン完了で SETUP_004・005 が並列解放される", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, [
      ...SANDBOX_AND_BRIDGE_ALL,
      "SETUP_001",
      "SETUP_002",
      "SETUP_003",
    ]);

    await waitForSkillStatus(
      page,
      "SETUP_003",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // SETUP_004・SETUP_005 が並列解放される
    await waitForSkillStatus(
      page,
      "SETUP_004",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "SETUP_005",
      "unlocked",
      SKILL_STATUS_TIMEOUT,
    );
  });

  test("SETUP トラック全完了で 10 スキルマイルストーン突破", async ({
    page,
  }) => {
    // SANDBOX(6) + BRIDGE(3) + SETUP_001 = 10 スキルでマイルストーン
    await emitSkillSequence(context, page, [
      ...SANDBOX_AND_BRIDGE_ALL,
      "SETUP_001",
    ]);

    await waitForSkillStatus(
      page,
      "SETUP_001",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // 完了スキル数が 10 以上になること
    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(10);
    }).toPass({ timeout: 5_000 });
  });

  test("SETUP_001〜005 全完了", async ({ page }) => {
    await emitSkillSequence(context, page, [
      ...SANDBOX_AND_BRIDGE_ALL,
      "SETUP_001",
      "SETUP_002",
      "SETUP_003",
      "SETUP_004",
      "SETUP_005",
    ]);

    await waitForSkillStatus(
      page,
      "SETUP_004",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );
    await waitForSkillStatus(
      page,
      "SETUP_005",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // 9 (SANDBOX+BRIDGE) + 5 (SETUP) = 14 スキル以上
    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(14);
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 前提条件ガード
  // -------------------------------------------------------------------------

  test("BRIDGE_003 未完了のまま SETUP_001 を発火しても completed にならない", async ({
    page,
  }) => {
    // BRIDGE_002 まで完了
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
      "SANDBOX_006",
      "BRIDGE_001",
      "BRIDGE_002",
    ]);

    await emitSkillEvent(context, page, "SETUP_001");

    await expect(async () => {
      expect(await getSkillStatus(page, "SETUP_001")).toBe("locked");
    }).toPass({ timeout: 3_000 });
  });

  test("SETUP_002 未完了のまま SETUP_003 を発火しても completed にならない", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, [
      ...SANDBOX_AND_BRIDGE_ALL,
      "SETUP_001",
    ]);
    await waitForSkillStatus(
      page,
      "SETUP_001",
      "completed",
      SKILL_STATUS_TIMEOUT,
    );

    // SETUP_002 を飛ばして SETUP_003 を発火
    await emitSkillEvent(context, page, "SETUP_003");

    await expect(async () => {
      expect(await getSkillStatus(page, "SETUP_003")).toBe("locked");
    }).toPass({ timeout: 3_000 });
  });
});
