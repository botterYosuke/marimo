# BUG-002: ポジション保有中の buy() 再呼び出しでスキル完了数が期待値と不一致

**優先度**: Medium
**発見元**: play-log-2026-02-21.md
**テスト**: frontend/e2e-tests/game/guard-validation.spec.ts:120
**ステータス**: 修正試行中（ブロッカー: guard-validation テスト環境不安定）

## 再現手順
1. `npx playwright test e2e-tests/game/guard-validation.spec.ts --headed` を実行する
2. テスト "ポジション保有中に buy() を再度呼ぶと警告メッセージが表示される" を確認する
3. テスト内で以下の Python コードが 1 セルで実行される:
   ```python
   _gs.chart("7203")
   _gs.buy()   # 1回目: 正常に購入（SANDBOX_001 + SANDBOX_002 発火）
   _gs.buy()   # 2回目: ガードで弾かれる → "すでに株を保有中" 表示
   ```
4. スキルツリーパネルを開き、完了スキル数を確認する

## 期待動作
- 1回目の `buy()` で SANDBOX_001 と SANDBOX_002 が発火し、完了スキル数が **2** になる
- 2回目の `buy()` はガードで弾かれ、「すでに株を保有中」の警告が表示される
- `getCompletedCount(page)` が `2` を返す

## 実際の動作
- `Expected count 2 but received 1`
- スキル完了数が 1 しかカウントされていない（SANDBOX_001 のみ、または SANDBOX_002 のみ）

## 原因推定
1. **`buy()` 内のスキル発火が 1 つしか成功していない**: `chart("7203")` で SANDBOX_001 が発火し、`buy()` で SANDBOX_002 が発火するはずだが、`buy()` 実行時に SANDBOX_002 の前提条件（SANDBOX_001 完了）がまだ反映されていない可能性
2. **1セル内の同期実行でイベントが結合される**: `chart()` と `buy()` が同一セル内で同期的に実行されるため、SANDBOX_001 の完了イベントが SANDBOX_002 の前提条件チェック前にフロントエンドに到達していない
3. **`getCompletedCount` のタイミング**: スキルツリーパネルを開いた時点でまだ 2 つ目のスキル完了が反映されていない

## 影響範囲
- guard-validation.spec.ts のテスト 2（1件）
- ゲーム内で `chart()` → `buy()` を連続実行した際のスキル発火信頼性

## 関連 Issue
- `guard-validation-buy-sell-warning-not-implemented.md` — 同じテストスイートだが、既存 Issue はテスト行番号 `:50, :82, :126` での失敗を扱っており、本 Issue は行番号 `:120` で異なるエラー（テキスト未表示ではなくカウント不一致）を扱う

## 関連ファイル
| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/guard-validation.spec.ts` | L120-144 — 失敗テスト |
| `src-tauri/sample-notebooks/game_setup.py` | `buy()` — ガード処理 + スキル発火 |
| `src-tauri/sample-notebooks/game_setup.py` | `chart()` — SANDBOX_001 発火 |
| フロントエンドのスキルツリー atom | 前提条件チェーンの非同期処理 |
