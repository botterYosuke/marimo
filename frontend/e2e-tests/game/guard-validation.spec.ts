/* Copyright 2026 Marimo. All rights reserved. */

/**
 * buy()/sell() ガード処理の異常系テスト
 *
 * game_setup.py の buy() と sell() に実装されたガード処理が、
 * 以下の異常系で正しく動作することを検証する：
 *
 * 1. データなしで buy() を呼び出す → 警告表示 & スキル非発火
 * 2. ポジション保有中に buy() を再度呼び出す → 警告表示 & 二重カウントなし
 * 3. ポジションなしで sell() を呼び出す → 警告表示 & スキル非発火
 *
 * 関連 Issue: development_docs/issues/sell-buy-no-guard-crash.md
 */

import { expect, test } from "@playwright/test";
import {
  ensureConnected,
  getCompletedCount,
  openSkillTreePanel,
  resetGameProgress,
  runNewCellInGrid,
} from "./helpers";
import { getAppUrl } from "../../playwright.config";

const APP: import("../../playwright.config").ApplicationNames = "game_test.py";

test.describe("buy()/sell() ガード処理", () => {
  test.beforeEach(async ({ page }, info) => {
    // z-python-e2e.spec.ts と同じパターン
    const needsNavigation =
      !page.url().includes("game_test.py") || info.retry;

    if (needsNavigation) {
      await page.goto(getAppUrl(APP));
      await page.waitForLoadState("networkidle");
    }

    await ensureConnected(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGameProgress(page);
  });

  // -------------------------------------------------------------------------
  // 1. データなしで buy() を呼び出す
  // -------------------------------------------------------------------------

  test("データなしで buy() を呼ぶと警告メッセージが表示される", async ({
    page,
  }) => {
    const code = `
import sys
from pathlib import Path
# src-tauri/sample-notebooks をパスに追加
sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
sys.path.insert(0, str(sample_notebooks_dir))
import game_setup as gs
gs.buy()
`.trim();
    await runNewCellInGrid(page, code);

    // 出力の DOM 反映を待つ
    await page.waitForTimeout(2_000);

    // 警告メッセージの確認（ページ全体から検索）
    await expect(page.locator("text=/まず.*bt.chart/")).toBeVisible({
      timeout: 5_000,
    });

    // スキルが発火しないことを確認
    await openSkillTreePanel(page);
    const count = await getCompletedCount(page);
    expect(count).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. ポジション保有中に buy() を再度呼び出す（二重買い）
  // -------------------------------------------------------------------------

  test("ポジション保有中に buy() を再度呼ぶと警告メッセージが表示される", async ({
    page,
  }) => {
    // 1回目: 正常な buy()
    await runNewCellInGrid(
      page,
      `
import sys
from pathlib import Path
# src-tauri/sample-notebooks をパスに追加
sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
sys.path.insert(0, str(sample_notebooks_dir))
import game_setup as gs
gs.chart("7203")
`.trim(),
    );
    await runNewCellInGrid(page, "gs.buy()");

    // スキルツリーで SANDBOX_001, SANDBOX_002 が完了していることを確認
    await openSkillTreePanel(page);
    const countAfterFirstBuy = await getCompletedCount(page);
    expect(countAfterFirstBuy).toBe(2);

    // ダイアログを閉じる
    await page.keyboard.press("Escape");

    // 2回目: 二重買い（ガードで弾かれる）
    await runNewCellInGrid(page, "gs.buy()");

    // 警告メッセージの確認
    await expect(page.locator("text=/すでに株を保有中/")).toBeVisible({
      timeout: 5_000,
    });

    // スキル数が増えていないことを確認
    await openSkillTreePanel(page);
    const countAfterSecondBuy = await getCompletedCount(page);
    expect(countAfterSecondBuy).toBe(2); // 2 のまま
  });

  // -------------------------------------------------------------------------
  // 3. ポジションなしで sell() を呼び出す
  // -------------------------------------------------------------------------

  test("ポジションなしで sell() を呼ぶと警告メッセージが表示される", async ({
    page,
  }) => {
    await runNewCellInGrid(
      page,
      `
import sys
from pathlib import Path
# src-tauri/sample-notebooks をパスに追加
sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
sys.path.insert(0, str(sample_notebooks_dir))
import game_setup as gs
gs.chart("7203")
gs.sell()
`.trim(),
    );

    // 警告メッセージの確認
    await expect(page.locator("text=/保有中の株がありません/")).toBeVisible({
      timeout: 5_000,
    });

    // SANDBOX_004 が発火しないことを確認
    await openSkillTreePanel(page);
    const count = await getCompletedCount(page);
    expect(count).toBe(1); // SANDBOX_001 のみ
  });
});
