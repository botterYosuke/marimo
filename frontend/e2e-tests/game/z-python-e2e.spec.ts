/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Python セル実行 E2E テスト — レイヤー①→⑦ 全経路検証
 *
 * ファイル名が "z-" で始まる理由:
 * このテストは実際に Python セルを作成するため、セルがカーネルに永続する。
 * セル出力の <marimo-broadcast> HTML が後続テストの初期状態を汚染するのを防ぐため、
 * アルファベット順で最後に実行させる（bridge → integration → ... → ui → z-python-e2e）。
 *
 * 既存テストとの違い:
 * - sandbox.spec.ts 等: __testCompleteSkill で ⑥→⑦ のみ
 * - integration.spec.ts: __testInjectBroadcastHTML で ③→⑦
 * - **このファイル**: Python セル実行で ①→⑦ 全経路
 *
 * フロントエンド側のフック（__testCompleteSkill, __testInjectBroadcastHTML）を
 * 一切使わず、実際に Python セルを実行してセルのメイン出力として
 * <marimo-broadcast> HTML をフロントエンドに届ける。
 *
 * progress_manager への依存を避けるため、emit_skill() のインライン版を使用する。
 *
 * 注意点:
 * - marimo はセル間で同じ変数名を禁止するため、全 import をアンダースコア接頭辞にする
 * - セルのメイン出力（最終式）として Html を返す（mo.output.append はコンソール出力で
 *   extractAndSendBroadcastMessages の処理対象外）
 * - スキルツリーダイアログが全画面を覆うため、セル実行時はダイアログを閉じ、
 *   UI 検証時に再度開く
 */

import { test, expect } from "@playwright/test";
import { getAppUrl } from "../../playwright.config";
import {
  ensureConnected,
  openSkillTreePanel,
  emitSkillViaPython,
  waitForSkillStatus,
  getCompletedCount,
  resetGameProgress,
  runNewCellInGrid,
} from "./helpers";

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

/**
 * スキルツリーダイアログを閉じる。
 * セル実行前にダイアログが開いていると UI 要素が遮られるため。
 */
async function closeSkillTreeDialog(page: import("@playwright/test").Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await dialog
      .waitFor({ state: "hidden", timeout: 3_000 })
      .catch(() => {});
  }
}

test.describe("Python セル実行 E2E: レイヤー①→⑦", () => {
  test.beforeEach(async ({ page }, info) => {
    const needsNavigation =
      !page.url().includes("game_test.py") || info.retry;

    if (needsNavigation) {
      await page.goto(getAppUrl(APP));
      await page.waitForLoadState("networkidle");
    }

    await ensureConnected(page);
  });

  test.afterEach(async ({ page }) => {
    await closeSkillTreeDialog(page);
    await resetGameProgress(page);
  });

  // -------------------------------------------------------------------------
  // 1. Python セル実行で SANDBOX_001 が完了する
  // -------------------------------------------------------------------------

  test("Python セル実行で SANDBOX_001 が完了する", async ({ page }) => {
    await emitSkillViaPython(page, "SANDBOX_001");

    await openSkillTreePanel(page);
    await waitForSkillStatus(page, "SANDBOX_001", "completed", 10_000);
  });

  // -------------------------------------------------------------------------
  // 2. 2つのセルで前提条件チェーンが動作する
  // -------------------------------------------------------------------------

  test("2つのセルで前提条件チェーンが動作する", async ({ page }) => {
    await emitSkillViaPython(page, "SANDBOX_001");

    // SANDBOX_001 が完了してからでないと SANDBOX_002 の前提条件チェックが通らない。
    // Python セル出力の WebSocket 伝播→BroadcastChannel→atom 更新のラグを確実に待つため、
    // スキルツリーを開いて completed 確認後にダイアログを閉じてから SANDBOX_002 を発火する。
    await openSkillTreePanel(page);
    await waitForSkillStatus(page, "SANDBOX_001", "completed", 10_000);
    await closeSkillTreeDialog(page);

    await emitSkillViaPython(page, "SANDBOX_002");

    await openSkillTreePanel(page);
    await waitForSkillStatus(page, "SANDBOX_001", "completed", 10_000);
    await waitForSkillStatus(page, "SANDBOX_002", "completed", 10_000);
  });

  // -------------------------------------------------------------------------
  // 3. 不正な payload でも UI がクラッシュしない
  // -------------------------------------------------------------------------

  test("不正な payload の Python セルでも UI がクラッシュしない", async ({
    page,
  }) => {
    const code = `
from marimo._output.hypertext import Html as _Html
_Html('<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="!!!invalid!!!" style="display:none;"></marimo-broadcast>')
`.trim();
    await runNewCellInGrid(page, code);

    // ダイアログを開いて UI がクラッシュしていないことを確認
    await openSkillTreePanel(page);
    await expect(page.getByText("スキルツリー").first()).toBeVisible();
    // 不正 payload ではスキルが完了しないことを確認
    // （前のテストの進捗が残っている可能性があるため、増加しないことで検証）
    const countBefore = await getCompletedCount(page);
    await page.waitForTimeout(1_000);
    const countAfter = await getCompletedCount(page);
    expect(countAfter).toBe(countBefore);
  });

  // -------------------------------------------------------------------------
  // 4. 進捗バッジが Python 経由でも更新される
  // -------------------------------------------------------------------------

  test("進捗バッジが Python 経由でも更新される", async ({ page }) => {
    // SANDBOX_001 を実行（前提条件なし、重複でも問題ない）
    await emitSkillViaPython(page, "SANDBOX_001");

    // ダイアログを開いてスキル完了を確認
    await openSkillTreePanel(page);
    await waitForSkillStatus(page, "SANDBOX_001", "completed", 10_000);

    // 進捗バッジ（"X/59 スキル"）が 0 より大きいことを確認
    // テスト 1 がスキルノード自体を検証するのに対し、
    // このテストは進捗バッジ（別 DOM 要素）の更新を検証する
    await expect(async () => {
      const count = await getCompletedCount(page);
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });
  });
});
