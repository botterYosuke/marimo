/* Copyright 2026 Marimo. All rights reserved. */

/**
 * サンドボックストラック e2e テスト
 *
 * SANDBOX_001 〜 SANDBOX_006 の進行を検証する。
 * スキルイベントは BroadcastChannel 経由で送信し、
 * UI の状態変化（ノードのステータス・バッジ・現金表示）を確認する。
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
  getProgressText,
  resetGameProgress,
} from "./helpers";

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

test.describe("サンドボックストラック", () => {
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
  // 初期状態
  // -------------------------------------------------------------------------

  test("初期状態: SANDBOX_001 は unlocked", async ({ page }) => {
    // SANDBOX_001 は前提条件なし → 最初から unlocked
    const status = await getSkillStatus(page, "SANDBOX_001");
    expect(status).toBe("unlocked");
  });

  test("初期状態: SANDBOX_002 は locked（SANDBOX_001 未完了）", async ({
    page,
  }) => {
    const status = await getSkillStatus(page, "SANDBOX_002");
    expect(status).toBe("locked");
  });

  test("初期状態: 進捗バッジが 0/59 スキルを表示", async ({ page }) => {
    const text = await getProgressText(page);
    expect(text).toMatch(/^0\/\d+\s*スキル/);
  });

  // -------------------------------------------------------------------------
  // スキル完了フロー
  // -------------------------------------------------------------------------

  test("SANDBOX_001 完了後、SANDBOX_002 が unlocked になる", async ({
    page,
  }) => {
    await emitSkillEvent(context, page, "SANDBOX_001");

    await waitForSkillStatus(page, "SANDBOX_001", "completed");
    await waitForSkillStatus(page, "SANDBOX_002", "unlocked");
  });

  test("SANDBOX_002 完了後、進捗バッジが 2 に増える", async ({ page }) => {
    await emitSkillSequence(context, page, ["SANDBOX_001", "SANDBOX_002"]);

    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5_000 });
  });

  test("SANDBOX_002 完了後、SANDBOX_002 ノードが completed になる", async ({
    page,
  }) => {
    await emitSkillSequence(context, page, ["SANDBOX_001", "SANDBOX_002"]);
    await waitForSkillStatus(page, "SANDBOX_002", "completed");
  });

  test("前提条件なしで SANDBOX_002 を単独発火しても completed にならない", async ({
    page,
  }) => {
    // SANDBOX_001 未完了のまま SANDBOX_002 を送信
    await emitSkillEvent(context, page, "SANDBOX_002");

    // completeSkillAtom が prerequisites チェックで弾く
    await page.waitForTimeout(500);
    const status = await getSkillStatus(page, "SANDBOX_002");
    expect(status).toBe("locked");
  });

  // -------------------------------------------------------------------------
  // サンドボックス完了（SANDBOX_006）
  // -------------------------------------------------------------------------

  test("SANDBOX_006 完了でサンドボックス卒業フラグが立つ", async ({
    page,
  }) => {
    // サンドボックストラック全スキルを順番に完了
    const sandboxSkills = [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
      "SANDBOX_006",
    ];
    await emitSkillSequence(context, page, sandboxSkills);

    // SANDBOX_006 完了 → サンドボックス卒業
    await waitForSkillStatus(page, "SANDBOX_006", "completed", 8_000);

    // BRIDGE_001 が unlocked になっているはず
    await waitForSkillStatus(page, "BRIDGE_001", "unlocked", 5_000);
  });

  test("SANDBOX_006 完了後に現金残高が増えている", async ({ page }) => {
    const sandboxSkills = [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
      "SANDBOX_006",
    ];
    await emitSkillSequence(context, page, sandboxSkills);

    // フッターの現金表示が ¥0 より大きい値になっていること
    await expect(async () => {
      const cashText = await page
        .locator("text=/¥[1-9][0-9,]*/")
        .first()
        .textContent();
      expect(cashText).toBeTruthy();
    }).toPass({ timeout: 8_000 });
  });

  // -------------------------------------------------------------------------
  // 重複発火の防止
  // -------------------------------------------------------------------------

  test("同一スキルを 2 回発火しても completeSkills が重複しない", async ({
    page,
  }) => {
    await emitSkillEvent(context, page, "SANDBOX_001");
    await waitForSkillStatus(page, "SANDBOX_001", "completed");
    const countBefore = await getCompletedCount(page);

    // 同じイベントを再送
    await emitSkillEvent(context, page, "SANDBOX_001");
    await page.waitForTimeout(300);
    const countAfter = await getCompletedCount(page);

    expect(countAfter).toBe(countBefore);
  });
});
