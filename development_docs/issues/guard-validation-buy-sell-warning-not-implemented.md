# Issue: buy()/sell() ガード警告が実装されておらず guard-validation.spec.ts 全 3 件が依然失敗する

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: スキル発火 / UI
**ステータス**: Open

---

## 概要

`guard-validation.spec.ts` の全 3 テストがフルラン（2026-02-21 PM）でも引き続き失敗している。

`guard-validation-warning-not-visible.md` では `waitForLoadState("networkidle")` の修正が実施され `✅ 修正済み` とされたが、networkidle の問題が解消された後も、**ガード警告テキスト自体がセル出力に現れない**という根本問題が未解決のまま残っている。

つまり networkidle 修正は必要条件ではあったが、テストを通過させるには不十分だった。

## 再現手順

1. `npx playwright test e2e-tests/game/guard-validation.spec.ts --headed` を実行する
2. 全 3 テストが失敗する:
   - `guard-validation.spec.ts:50` — `text=/まず.*bt.chart/` が 5 秒以内に現れない
   - `guard-validation.spec.ts:82` — `.cm-content` クリックタイムアウト（セルが正常に追加されない）
   - `guard-validation.spec.ts:126` — `text=/保有中の株がありません/` が 5 秒以内に現れない

## 期待される動作

- データなしで `gs.buy()` を呼んだとき、セル出力に `mo.callout(mo.md("まず `bt.chart('7203')` でチャートを表示してください"), kind="warn")` が表示される
- ポジションなしで `gs.sell()` を呼んだとき、セル出力に `mo.callout(mo.md("保有中の株がありません。まず `bt.buy()` で株を購入してください"), kind="warn")` が表示される

## 実際の動作

- ガード警告テキストがセル出力に表示されない
- またはセル自体が正常に追加・実行されない（`.cm-content` クリックタイムアウト）

## 根本原因の仮説

### 仮説 1: `sys.path` 設定によるインポート失敗

`guard-validation.spec.ts` は以下のように Python コードを注入している:

```python
from pathlib import Path
import sys
sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
sys.path.insert(0, str(sample_notebooks_dir))
import game_setup as gs
```

`__file__` は実行中のノートブック（`game_test.py`）を指す。`game_test.py` の実際のパスが `C:\Users\sasac\AppData\Roaming\marimo\notebooks\game_test.py` であれば、`.parents[3]` はパスを 4 階層上に上ったディレクトリを指し、`src-tauri/sample-notebooks` が存在しない場所になる可能性がある。

この場合 `ImportError` が発生し、ガード警告テキストではなくエラー出力が表示される（または何も表示されない）。

### 仮説 2: `mo.output.append()` の出力が Playwright で検索できない位置に表示される

`game_setup.py` の `buy()` は `mo.output.append(mo.callout(...))` を使って警告を出力する。marimo の `output.append()` は現在のセルの出力エリアに追加されるが、Playwright の `page.getByText(...)` がそのセル出力エリアを検索できていない可能性がある。

### 仮説 3: `bt` インスタンスのスコープ問題

テストがセルを複数追加する際、各セルが別の `bt` インスタンスを参照している可能性がある。Python のモジュールキャッシュ（`sys.modules`）が正しく機能していれば同一インスタンスだが、`game_setup.py` のパスが変わると別のモジュールとしてロードされる。

### 仮説 4: `game_test.py` の PYTHONPATH が `sample-notebooks` を含まない

E2E テストは `PYTHONPATH=C:\Users\sasac\AppData\Roaming\marimo\notebooks` でサーバーを起動しているが、`game_setup.py` は `C:\Users\...\marimo\src-tauri\sample-notebooks\` にある。PYTHONPATH に含まれていない場合、`import game_setup as gs` が失敗する。

## 調査手順

1. `guard-validation.spec.ts` を `--headed` で実行し、ブラウザのコンソールと出力エリアを直接確認する
2. セルが正常に追加・実行されているか確認する（実行後にエラーが表示されていないか）
3. Python エラー出力（`ImportError` 等）がセル出力エリアに表示されていないか確認する
4. `game_test.py` に手動で `import game_setup as gs; gs.buy()` を実行するセルを追加し、ガード警告が表示されるか確認する

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/guard-validation.spec.ts` | 全 3 テスト — 失敗している |
| `src-tauri/sample-notebooks/game_setup.py` | `buy()` (83–90行目)、`sell()` (108–114行目) — `mo.callout()` 警告実装 |
| `frontend/e2e-tests/game/helpers.ts` | `runNewCellInGrid()` — セル追加・実行ヘルパー |
| `C:\Users\sasac\AppData\Roaming\marimo\notebooks\game_test.py` | テスト対象ノートブック |

## 調査メモ

### 既存 Issue との関係

`guard-validation-warning-not-visible.md` は networkidle タイムアウトを修正対象として `✅ 修正済み` になっているが、本 Issue は networkidle が解消された後も残る「ガード機能警告テキストの未表示」を別問題として記録している。

2026-02-21 フルランの結果（`guard-validation.spec.ts:50,82,126` 全 3 件失敗）はこの根本問題が未解決であることを示している。

### 修正方針

1. `guard-validation.spec.ts` の `sys.path` 設定を PYTHONPATH ベースに変更する（`Path(__file__)` 依存を排除）
2. テスト内で `import game_setup as gs` が成功することを前提条件として検証するアサーションを追加する
3. `mo.output.append()` の出力が Playwright で検索可能な DOM 要素として現れることを確認する

## フルランでの失敗数推移

| 日時 | 失敗件数 | 備考 |
|------|---------|------|
| 2026-02-21 AM（ベースライン） | 0 | ベースライン記録時はスイート自体なかった可能性 |
| 2026-02-21 PM（フルラン） | 3 | 全 3 件失敗（ガード機能テストとして新規追加） |
