/* Copyright 2026 Marimo. All rights reserved. */

/**
 * 統合テスト — HTML パイプライン（レイヤー③→⑦）経由のスキル完了検証
 *
 * 既存テスト（sandbox.spec.ts 等）は __testCompleteSkill でレイヤー⑥→⑦のみテストする。
 * このファイルは __testInjectBroadcastHTML を使い、以下の経路を通す:
 *   ③ HTML パース → ④ BroadcastChannel 送信 → ⑤ リスナー受信 → ⑥ atom 更新 → ⑦ UI 反映
 *
 * テスト 1 が通れば BroadcastChannel の同一コンテキスト配信が動作する証拠。
 * 通らない場合はフォールバック（BC bypass）を適用する。
 */

import { test, expect } from "@playwright/test";
import { getAppUrl } from "../../playwright.config";
import {
  ensureConnected,
  openSkillTreePanel,
  emitSkillEventViaHTML,
  emitSkillSequenceViaHTML,
  waitForSkillStatus,
  getCompletedCount,
  resetGameProgress,
} from "./helpers";

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

test.describe("統合テスト: HTML パイプライン経由", () => {
  test.beforeEach(async ({ page }, info) => {

    const needsNavigation =
      !page.url().includes("game_test.py") || info.retry;

    if (needsNavigation) {
      await page.goto(getAppUrl(APP));
      await page.waitForLoadState("load");
    }

    await ensureConnected(page);
    await openSkillTreePanel(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGameProgress(page);
  });

  // -------------------------------------------------------------------------
  // 1. HTML 注入でスキルが完了する（③→⑦ 全経路）
  // -------------------------------------------------------------------------

  test("HTML 注入でスキルが完了する", async ({ page }) => {
    await emitSkillEventViaHTML(page, "SANDBOX_001");
    await waitForSkillStatus(page, "SANDBOX_001", "completed");
  });

  // -------------------------------------------------------------------------
  // 2. 前提条件チェーンが HTML 経由でも動作する
  // -------------------------------------------------------------------------

  test("前提条件チェーンが HTML 経由でも動作する", async ({ page }) => {
    await emitSkillEventViaHTML(page, "SANDBOX_001");
    await waitForSkillStatus(page, "SANDBOX_001", "completed");

    await emitSkillEventViaHTML(page, "SANDBOX_002");
    await waitForSkillStatus(page, "SANDBOX_002", "completed");
  });

  // -------------------------------------------------------------------------
  // 3. 進捗バッジが HTML 経由でも更新される
  // -------------------------------------------------------------------------

  test("進捗バッジが HTML 経由でも更新される", async ({ page }) => {
    await emitSkillSequenceViaHTML(page, ["SANDBOX_001", "SANDBOX_002"]);

    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 4. 現金報酬が HTML 経由でも加算される
  // -------------------------------------------------------------------------

  test("現金報酬が HTML 経由でも加算される", async ({ page }) => {
    await emitSkillEventViaHTML(page, "SANDBOX_001");

    await expect(async () => {
      const cashText = await page
        .locator("text=/¥[1-9][0-9,]*/")
        .first()
        .textContent();
      expect(cashText).toBeTruthy();
    }).toPass({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // 5. 重複発火が防止される
  // -------------------------------------------------------------------------

  test("重複発火が防止される", async ({ page }) => {
    await emitSkillEventViaHTML(page, "SANDBOX_001");
    await waitForSkillStatus(page, "SANDBOX_001", "completed");
    const countBefore = await getCompletedCount(page);

    // 同一 HTML を再注入
    await emitSkillEventViaHTML(page, "SANDBOX_001");

    await expect(async () => {
      expect(await getCompletedCount(page)).toBe(countBefore);
    }).toPass({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // 6. 前提条件未達でスキップされる
  // -------------------------------------------------------------------------

  test("前提条件未達の HTML 注入では変化なし", async ({ page }) => {
    // SANDBOX_001 未完了のまま SANDBOX_002 を HTML 注入
    await emitSkillEventViaHTML(page, "SANDBOX_002");

    await expect(async () => {
      expect(await getCompletedCount(page)).toBe(0);
    }).toPass({ timeout: 3_000 });
  });

  // -------------------------------------------------------------------------
  // 7. 不正な base64 で UI がクラッシュしない
  // -------------------------------------------------------------------------

  test("不正な base64 payload で UI がクラッシュしない", async ({ page }) => {
    // 不正な base64 を直接注入
    await page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>)
        .__testInjectBroadcastHTML;
      if (typeof fn !== "function") {
        throw new Error("__testInjectBroadcastHTML not found");
      }
      const html = `<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="!!!invalid-base64!!!" style="display:none;"></marimo-broadcast>`;
      (fn as (html: string) => void)(html);
    });
    await page.waitForTimeout(300);

    // UI がクラッシュせずパネルが表示されていること
    await expect(page.getByText("スキルツリー").first()).toBeVisible();
    const count = await getCompletedCount(page);
    expect(count).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 8. payload 属性欠落で無視される
  // -------------------------------------------------------------------------

  test("payload 属性欠落の HTML は無視される", async ({ page }) => {
    // payload 属性なしの不完全な HTML を注入
    await page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>)
        .__testInjectBroadcastHTML;
      if (typeof fn !== "function") {
        throw new Error("__testInjectBroadcastHTML not found");
      }
      // channel と type はあるが payload がない
      const html = `<marimo-broadcast channel="skill_event_channel" type="skill_complete" style="display:none;"></marimo-broadcast>`;
      (fn as (html: string) => void)(html);
    });
    await page.waitForTimeout(300);

    await expect(page.getByText("スキルツリー").first()).toBeVisible();
    const count = await getCompletedCount(page);
    expect(count).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 9. サンドボックス全完了 → ブリッジ解放（HTML 経由）
  // -------------------------------------------------------------------------

  test("HTML 経由の 6 スキル連続完了でブリッジトラックが解放される", async ({
    page,
  }) => {
    const sandboxSkills = [
      "SANDBOX_001",
      "SANDBOX_002",
      "SANDBOX_003",
      "SANDBOX_004",
      "SANDBOX_005",
      "SANDBOX_006",
    ];
    await emitSkillSequenceViaHTML(page, sandboxSkills);

    await waitForSkillStatus(page, "SANDBOX_006", "completed", 8_000);
    await waitForSkillStatus(page, "BRIDGE_001", "unlocked", 5_000);
  });
});
