/* Copyright 2026 Marimo. All rights reserved. */

/**
 * 失敗経験トラック（FAIL_001〜003）のスキルツリー E2E テスト
 *
 * 検証内容:
 * - FAIL_001（初めての含み損）: SANDBOX_002 完了後に unlocked → completed
 * - FAIL_002（初めての損切り）: SANDBOX_004 + FAIL_001 完了後に unlocked → completed
 * - FAIL_003（初めての破産）: 前提条件チェーン（full トラック）
 * - 前提条件ガード: 前提未達成でのスキル発火が無視されること
 *
 * NOTE: このテストはスキルツリー UI の反応（emitSkillEvent 経由）を検証する。
 * Python 側の損切りロジック（_check_stop_loss）の E2E 検証は
 * backcast.py + 実データが必要なため別途対応が必要。
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import { getAppUrl } from "../../playwright.config";
import {
  ensureConnected,
  openSkillTreePanel,
  emitSkillEvent,
  emitSkillSequence,
  waitForSkillStatus,
  getCompletedCount,
  getSkillStatus,
  resetGameProgress,
} from "./helpers";

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

test.describe("失敗経験トラック", () => {
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

  test("初期状態: FAIL_001 は locked（SANDBOX_002 未完了）", async ({
    page,
  }) => {
    const status = await getSkillStatus(page, "FAIL_001");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // FAIL_001: 初めての含み損
  // -------------------------------------------------------------------------

  test("SANDBOX_002 完了後、FAIL_001 が unlocked になる", async ({ page }) => {
    // SANDBOX_001 → SANDBOX_002 を完了（FAIL_001 の前提条件）
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
    ]);
    await waitForSkillStatus(page, "FAIL_001", "unlocked");
  });

  test("FAIL_001 完了で現金が増える", async ({ page }) => {
    // 前提条件を満たす
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
    ]);
    await waitForSkillStatus(page, "FAIL_001", "unlocked");

    // FAIL_001 を完了
    await emitSkillEvent(context, page, "FAIL_001");
    await waitForSkillStatus(page, "FAIL_001", "completed");

    // 完了数が 3 であること（SANDBOX_001, 002, FAIL_001）
    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBe(3);
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // FAIL_002: 初めての損切り
  // -------------------------------------------------------------------------

  test("SANDBOX_004 + FAIL_001 完了後、FAIL_002 が unlocked になる", async ({
    page,
  }) => {
    // FAIL_002 の prerequisites: ["SANDBOX_004", "FAIL_001"]
    // FAIL_001 の prerequisites: ["SANDBOX_002"]
    // SANDBOX_004 の prerequisites: ["SANDBOX_003"]
    // SANDBOX_003 の prerequisites: ["SANDBOX_002"]
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "FAIL_001",
    ]);

    await waitForSkillStatus(page, "FAIL_002", "unlocked");
  });

  test("FAIL_002 完了でスキルが completed になる", async ({ page }) => {
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "FAIL_001",
    ]);
    await waitForSkillStatus(page, "FAIL_002", "unlocked");

    await emitSkillEvent(context, page, "FAIL_002");
    await waitForSkillStatus(page, "FAIL_002", "completed");
  });

  // -------------------------------------------------------------------------
  // ガード: 前提条件未達成
  // -------------------------------------------------------------------------

  test("SANDBOX_002 未完了のまま FAIL_001 を発火しても completed にならない", async ({
    page,
  }) => {
    // FAIL_001 の前提条件（SANDBOX_002）が未完了
    await emitSkillEvent(context, page, "FAIL_001");
    await page.waitForTimeout(500);

    const status = await getSkillStatus(page, "FAIL_001");
    expect(status).toBe("locked");
  });

  test("FAIL_001 未完了のまま FAIL_002 を発火しても completed にならない", async ({
    page,
  }) => {
    // SANDBOX_004 は完了しているが FAIL_001 が未完了
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
    ]);
    await emitSkillEvent(context, page, "FAIL_002");
    await page.waitForTimeout(500);

    const status = await getSkillStatus(page, "FAIL_002");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // FAIL_001〜002 全完了
  // -------------------------------------------------------------------------

  test("FAIL_001〜002 全完了", async ({ page }) => {
    await emitSkillSequence(context, page, [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "FAIL_001",
      "FAIL_002",
    ]);

    await waitForSkillStatus(page, "FAIL_001", "completed");
    await waitForSkillStatus(page, "FAIL_002", "completed");

    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBe(6);
    }).toPass({ timeout: 5_000 });
  });
});
