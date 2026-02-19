/* Copyright 2026 Marimo. All rights reserved. */

/**
 * ブリッジトラック e2e テスト
 *
 * BRIDGE_001 〜 BRIDGE_003 の進行を検証する。
 * ブリッジトラックは SANDBOX_006 完了後に解放される。
 *
 * 前提条件チェーン:
 *   SANDBOX_001 → 002 → 003
 *                  └→ 004 → 005 → 006 → BRIDGE_001 → BRIDGE_002 → BRIDGE_003
 *
 * スキルタイトル（参考）:
 *   BRIDGE_001: "データの正体"
 *   BRIDGE_002: "自分でデータを取得"
 *   BRIDGE_003: "フルモードへ"
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import { getAppUrl } from "../../playwright.config";
import {
  openSkillTreePanel,
  emitSkillEvent,
  emitSkillSequence,
  getSkillStatus,
  waitForSkillStatus,
  getCompletedCount,
  resetGameProgress,
} from "./helpers";
import {
  SANDBOX_SKILL_IDS,
  BRIDGE_SKILL_IDS,
  getTotalCashAfterSkills,
} from "./constants";

/** スキルステータス待機の統一タイムアウト */
const SKILL_STATUS_TIMEOUT = 10_000;

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

/** SANDBOX_006 まで完了させる共通手順 */
const SANDBOX_ALL = [
  "SANDBOX_001",
  "SANDBOX_002",
  "SANDBOX_003",
  "SANDBOX_004",
  "SANDBOX_005",
  "SANDBOX_006",
] as const;

test.describe("ブリッジトラック", () => {
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
  // BRIDGE_001 の解放条件
  // -------------------------------------------------------------------------

  test("初期状態: BRIDGE_001 は locked（SANDBOX_006 未完了）", async ({
    page,
  }) => {
    const status = await getSkillStatus(page, "BRIDGE_001");
    expect(status).toBe("locked");
  });

  test("SANDBOX_006 完了後、BRIDGE_001 が unlocked になる", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, [...SANDBOX_ALL]);

    // SANDBOX_006 完了を確認してから BRIDGE_001 の状態を検証
    await waitForSkillStatus(page, "SANDBOX_006", "completed", SKILL_STATUS_TIMEOUT);
    await waitForSkillStatus(page, "BRIDGE_001", "unlocked", SKILL_STATUS_TIMEOUT);
  });

  test("SANDBOX_005 のみ完了しても BRIDGE_001 は locked のまま", async ({
    page,
  }) => {
    // SANDBOX_006 抜き
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
    ]);
    await waitForSkillStatus(page, "SANDBOX_005", "completed", SKILL_STATUS_TIMEOUT);

    const status = await getSkillStatus(page, "BRIDGE_001");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // BRIDGE_001 の完了フロー
  // -------------------------------------------------------------------------

  test("BRIDGE_001 完了で BRIDGE_002 が unlocked になる", async ({ page }) => {
    // サンドボックス全完了 → BRIDGE_001 完了
    await emitSkillSequence(context, page, [...SANDBOX_ALL, "BRIDGE_001"]);

    await waitForSkillStatus(page, "BRIDGE_001", "completed", SKILL_STATUS_TIMEOUT);
    await waitForSkillStatus(page, "BRIDGE_002", "unlocked", SKILL_STATUS_TIMEOUT);
  });

  test("BRIDGE_001 完了後に現金が増える", async ({ page }) => {
    await emitSkillSequence(context, page, [...SANDBOX_ALL]);
    await waitForSkillStatus(page, "SANDBOX_006", "completed", SKILL_STATUS_TIMEOUT);

    // SANDBOX 完了後の現金を記録
    const cashBefore = await page
      .locator("text=/¥[0-9,]+/")
      .first()
      .textContent();
    const cashBeforeNum = Number((cashBefore ?? "¥0").replace(/[¥,]/g, ""));

    // BRIDGE_001 完了
    await emitSkillEvent(context, page, "BRIDGE_001");
    await waitForSkillStatus(page, "BRIDGE_001", "completed", 5_000);

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
  // BRIDGE_002 の完了フロー
  // -------------------------------------------------------------------------

  test("BRIDGE_002 完了で BRIDGE_003 が unlocked になる", async ({ page }) => {
    await emitSkillSequence(context, page, [
      ...SANDBOX_ALL,
      "BRIDGE_001",
      "BRIDGE_002",
    ]);

    await waitForSkillStatus(page, "BRIDGE_002", "completed", SKILL_STATUS_TIMEOUT);
    await waitForSkillStatus(page, "BRIDGE_003", "unlocked", SKILL_STATUS_TIMEOUT);
  });

  // -------------------------------------------------------------------------
  // BRIDGE_003 の完了フロー（ブリッジ全完了）
  // -------------------------------------------------------------------------

  test("BRIDGE_003 完了でブリッジトラック全完了", async ({ page }) => {
    await emitSkillSequence(context, page, [
      ...SANDBOX_ALL,
      "BRIDGE_001",
      "BRIDGE_002",
      "BRIDGE_003",
    ]);

    await waitForSkillStatus(page, "BRIDGE_003", "completed", SKILL_STATUS_TIMEOUT);

    // ブリッジ 3 スキル + サンドボックス 6 スキル = 9 スキル以上完了
    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(9);
    }).toPass({ timeout: 5_000 });
  });

  test("BRIDGE_003 完了後の現金は全スキル報酬の合計以上", async ({ page }) => {
    // SANDBOX合計: 30k+20k+10k+20k+20k+50k = 150,000
    // BRIDGE合計: 15k+20k+25k = 60,000
    // 合計: 210,000円以上
    await emitSkillSequence(context, page, [
      ...SANDBOX_ALL,
      "BRIDGE_001",
      "BRIDGE_002",
      "BRIDGE_003",
    ]);

    await waitForSkillStatus(page, "BRIDGE_003", "completed", SKILL_STATUS_TIMEOUT);

    await expect(async () => {
      const cashText = await page
        .locator("text=/¥[0-9,]+/")
        .first()
        .textContent();
      const cash = Number((cashText ?? "¥0").replace(/[¥,]/g, ""));
      expect(cash).toBeGreaterThanOrEqual(
        getTotalCashAfterSkills([...SANDBOX_SKILL_IDS, ...BRIDGE_SKILL_IDS]),
      );
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 前提条件ガード
  // -------------------------------------------------------------------------

  test("SANDBOX_006 未完了のまま BRIDGE_001 を発火しても completed にならない", async ({
    page,
  }) => {
    // SANDBOX_005 までしか完了しない
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
    ]);

    await emitSkillEvent(context, page, "BRIDGE_001");

    await expect(async () => {
      expect(await getSkillStatus(page, "BRIDGE_001")).toBe("locked");
    }).toPass({ timeout: 3_000 });
  });

  test("BRIDGE_001 未完了のまま BRIDGE_002 を発火しても completed にならない", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, [...SANDBOX_ALL]);
    await waitForSkillStatus(page, "SANDBOX_006", "completed", SKILL_STATUS_TIMEOUT);

    // BRIDGE_001 を飛ばして BRIDGE_002 を発火
    await emitSkillEvent(context, page, "BRIDGE_002");

    await expect(async () => {
      expect(await getSkillStatus(page, "BRIDGE_002")).toBe("locked");
    }).toPass({ timeout: 3_000 });
  });
});
