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
 * ## 設計上の注意
 *
 * ### 変数命名規約（アンダースコア接頭辞）
 * すべての Python 変数名を _ で始める。marimo はアンダースコア接頭辞の変数を
 * セルローカルとして扱い、クロスセル依存解析の対象外とする。
 * セルが蓄積しても「redefines variables from other cells」エラーを回避できる。
 *
 * ### 進捗ファイルのリセット
 * skill_events.py はモジュールインポート時に .game_test.progress.json から
 * completed_skills を読み込む。このファイルが残っていると、前テストで発火した
 * スキルが次テスト開始時に broadcast_progress() 経由で再通知される。
 * SETUP_PREFIX でファイルを削除してクリーンな状態から開始する。
 *
 * ### beforeEach での resetGameProgress（知見 35b）
 * ページ再ナビゲート時にカーネルが既存セル出力を再送し、スキル発火が汚染される。
 * ensureConnected() 後に resetGameProgress() を呼んでフロントエンド atom をリセット。
 *
 * 関連 Issue: development_docs/issues/guard-validation-buy-sell-warning-not-implemented.md
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

/**
 * game_setup をクリーンな状態でインポートするための共通プレフィックスコード。
 *
 * - sys.modules から game_setup / skill_events / progress_manager を除去（再インポートで新鮮な bt インスタンス取得）
 * - .game_test.progress.json を削除（前テストの完了スキルをクリア）
 * - src-tauri/sample-notebooks をパスに追加
 * - game_setup を _gs としてインポート
 */
const SETUP_PREFIX = `
import sys as _sys
from pathlib import Path as _Path
# 前テストの bt 状態・スキル進捗をクリア
for _k in list(_sys.modules.keys()):
    if _k in ('game_setup', 'skill_events', 'progress_manager'):
        del _sys.modules[_k]
# 進捗 JSON を削除（前テストの保存済みスキルをリセット。削除後の再インポートで空の _triggered_skills になる）
_progress_file = _Path(__file__).resolve().parent / ".game_test.progress.json"
if _progress_file.exists():
    _progress_file.unlink()
# src-tauri/sample-notebooks をパスに追加
_sample_notebooks_dir = _Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
_sys.path.insert(0, str(_sample_notebooks_dir))
import game_setup as _gs
`.trim();

test.describe("buy()/sell() ガード処理", () => {
  test.beforeEach(async ({ page }) => {
    // 常にナビゲートして clean な接続を確保する
    await page.goto(getAppUrl(APP));
    await page.waitForLoadState("load");
    await ensureConnected(page);
    // 再接続時にカーネルが既存セル出力を再送してスキル発火が汚染される（知見 35b）
    await resetGameProgress(page);
    // resetGameProgress は suppressBroadcast=true を 1 秒間セットする（知見 35c）。
    // テストの runNewCellInGrid がその抑制窓内に実行されるとスキルイベントが破棄される。
    // 1.2 秒待機して suppress タイマー（1 秒）を確実に経過させてから各テストを開始する。
    await page.waitForTimeout(1_200);
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
${SETUP_PREFIX}
_gs.buy()
`.trim();
    await runNewCellInGrid(page, code);

    // 出力の DOM 反映を待つ
    await page.waitForTimeout(2_000);

    // 警告メッセージの確認（.first() で strict mode 回避）
    // ページ内の React Flow ノードや他セルに同テキストが複数存在する可能性があるため
    await expect(page.locator("text=/まず.*bt.chart/").first()).toBeVisible({
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
    // 1セルで完結させる: 2セルに分けると marimo の再実行や
    // セル間 bt インスタンス共有で bt.position.size が 0 にリセットされる不安定さを回避
    const code = `
${SETUP_PREFIX}
_gs.chart("7203")
_gs.buy()   # 1回目: 正常に購入（SANDBOX_001 + SANDBOX_002 発火）
_gs.buy()   # 2回目: ガードで弾かれる → "すでに株を保有中" 表示
`.trim();
    await runNewCellInGrid(page, code);

    // 出力の DOM 反映を待つ
    await page.waitForTimeout(2_000);

    // 警告メッセージの確認
    await expect(page.locator("text=/すでに株を保有中/").first()).toBeVisible({
      timeout: 5_000,
    });

    // スキル数が 2 のまま（SANDBOX_001 + SANDBOX_002 のみ、二重カウントなし）
    await openSkillTreePanel(page);
    const count = await getCompletedCount(page);
    expect(count).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 3. ポジションなしで sell() を呼び出す
  // -------------------------------------------------------------------------

  test("ポジションなしで sell() を呼ぶと警告メッセージが表示される", async ({
    page,
  }) => {
    const code = `
${SETUP_PREFIX}
_gs.chart("7203")
_gs.sell()
`.trim();
    await runNewCellInGrid(page, code);

    // 出力の DOM 反映を待つ
    await page.waitForTimeout(2_000);

    // 警告メッセージの確認
    await expect(
      page.locator("text=/保有中の株がありません/").first(),
    ).toBeVisible({
      timeout: 5_000,
    });

    // SANDBOX_004 が発火しないことを確認（SANDBOX_001 のみ）
    await openSkillTreePanel(page);
    const count = await getCompletedCount(page);
    expect(count).toBe(1);
  });
});
