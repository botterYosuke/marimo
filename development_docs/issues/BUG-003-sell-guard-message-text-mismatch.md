# BUG-003: sell() ガード警告メッセージのテキストが見つからない

**優先度**: Medium
**発見元**: play-log-2026-02-21.md
**テスト**: frontend/e2e-tests/game/guard-validation.spec.ts:151
**ステータス**: 修正試行中（ブロッカー: guard-validation テスト環境不安定）

## 再現手順
1. `npx playwright test e2e-tests/game/guard-validation.spec.ts --headed` を実行する
2. テスト "ポジションなしで sell() を呼ぶと警告メッセージが表示される" を確認する
3. テスト内で以下の Python コードが実行される:
   ```python
   _gs.chart("7203")
   _gs.sell()
   ```
4. `page.locator("text=/保有中の株がありません/")` で警告メッセージを検索する

## 期待動作
- ポジションなしで `sell()` を呼ぶと、セル出力に「保有中の株がありません。まず `bt.buy()` で株を購入してください」という `mo.callout()` 警告が表示される
- Playwright の `text=/保有中の株がありません/` ロケーターがマッチする

## 実際の動作
- `locator "text=/保有中の株がありません/" not found`
- 警告メッセージがセル出力に表示されていない、またはテキスト内容が変更されている

## 原因推定
1. **警告テキストが変更された**: `game_setup.py` の `sell()` ガード処理のメッセージテキストが更新され、テストの正規表現 `/保有中の株がありません/` にマッチしなくなった
2. **ガード処理が未実装/削除された**: `sell()` のガード条件 (`bt.position.size == 0`) が変更され、警告が表示されなくなった
3. **`mo.output.append()` の出力が DOM に反映されない**: `mo.callout()` の出力が Playwright で検索可能な DOM 要素として現れていない（`mo.output.append` と `page.locator("text=...")` の不整合）
4. **`import game_setup` の失敗**: PYTHONPATH 問題で `game_setup` モジュールのインポート自体が失敗し、`sell()` が呼べていない（既存 Issue の仮説と同様）

## 影響範囲
- guard-validation.spec.ts のテスト 3（1件）
- ユーザーがポジションなしで `sell()` を呼んだ際の UX（警告なしでエラーが発生する可能性）

## 関連 Issue
- `guard-validation-buy-sell-warning-not-implemented.md` — 同テストスイートの全体的な失敗を扱う既存 Issue。既存 Issue はテスト行番号 `:50, :82, :126` を対象としており、本 Issue は `:151` の失敗を対象。原因が PYTHONPATH 問題の場合は既存 Issue と同一の根本原因
- `guard-validation-warning-not-visible.md` (修正済み) — networkidle タイムアウトの修正は完了しているが、テキスト不一致は別問題

## 調査手順
1. `game_setup.py` の `sell()` 関数の現在のガードメッセージテキストを確認する
2. テストを `--headed` で実行し、セル出力に何が表示されているか目視確認する
3. ブラウザコンソールで `ImportError` や `ModuleNotFoundError` が出ていないか確認する
4. `mo.output.append(mo.callout(...))` の出力が DOM のどこに現れるか確認する

## 関連ファイル
| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/guard-validation.spec.ts` | L151-169 — 失敗テスト |
| `src-tauri/sample-notebooks/game_setup.py` | `sell()` L108-114 — ガード警告実装 |
| `frontend/e2e-tests/game/helpers.ts` | `runNewCellInGrid()` — セル追加・実行 |
