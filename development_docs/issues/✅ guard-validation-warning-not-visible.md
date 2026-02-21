# Issue: guard-validation.spec.ts の buy()/sell() ガード警告メッセージが表示されずテスト全 3 件が失敗する

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: テスト / UI / スキル発火
**ステータス**: ✅ 修正済み

---

## 概要

`guard-validation.spec.ts` の全 3 テストが失敗する。テストは `game_setup.py` の `buy()`/`sell()` ガード処理が `mo.callout()` 警告を表示することを検証しているが、警告テキストがページに現れない。原因は `Path(__file__).resolve().parents[3]` を使った `sys.path` 追加コードが、E2E テストで使用される `game_test.py` ノートブックのコンテキストでは正しいパスに解決されないこと、および `game_setup` モジュールの `bt` インスタンスが想定どおりに初期化されない可能性がある。

## 再現手順

1. `npx playwright test e2e-tests/game/guard-validation.spec.ts --headed` を実行する
2. 全 3 テストが失敗する:
   - `データなしで buy() を呼ぶと警告メッセージが表示される` → `text=/まず.*bt.chart/` が表示されない
   - `ポジション保有中に buy() を再度呼ぶと警告メッセージが表示される` → `.cm-content` クリックタイムアウト
   - `ポジションなしで sell() を呼ぶと警告メッセージが表示される` → `text=/保有中の株がありません/` が表示されない

## 期待される動作

- `gs.buy()` をデータなしで呼ぶと `mo.callout()` で「まず `bt.chart('7203')` でチャートを表示してください」が表示される
- `gs.sell()` をポジションなしで呼ぶと `mo.callout()` で「保有中の株がありません。まず `bt.buy()` で株を購入してください」が表示される

## 実際の動作

- テスト 1, 3: ガード警告テキストがセル出力に表示されない（5 秒タイムアウト）
- テスト 2: `runNewCellInGrid` 内の `.cm-content` クリックがタイムアウト

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/guard-validation.spec.ts` | 全体 — 3 テストすべて失敗 |
| `src-tauri/sample-notebooks/game_setup.py` | `buy()` 83–90行目、`sell()` 108–114行目 — `mo.callout()` 警告実装 |
| `frontend/e2e-tests/game/helpers.ts` | `runNewCellInGrid()` — セル追加・実行ヘルパー |

## 調査メモ

### 根本原因の仮説 1: `__file__` パス解決の失敗

`guard-validation.spec.ts` が注入する Python コードは以下を使って `sys.path` を設定する:

```python
sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
sys.path.insert(0, str(sample_notebooks_dir))
import game_setup as gs
```

`__file__` は実行中のノートブック（`game_test.py`）を指す。`game_test.py` の実際のパスが `frontend/e2e-tests/py/game_test.py` の場合、`.parents[3]` はリポジトリルートの 1 つ上のディレクトリを指してしまい、`src-tauri/sample-notebooks` が見つからず `ImportError` となる。

`game_test.py` の場所に依存したパス計算は脆弱であり、テスト実行環境によって異なる。

### 根本原因の仮説 2: `beforeEach` で `waitForLoadState("networkidle")` がタイムアウト

`guard-validation.spec.ts` の `beforeEach` にも `waitForLoadState("networkidle")` が存在する（36行目）。`beforeEach` が完了しないとテスト本体が実行されないため、ガード警告の検証自体に到達できない。

```typescript
// guard-validation.spec.ts の beforeEach（問題箇所）
await page.waitForLoadState("networkidle");  // 永遠に解決しない
```

この問題は `networkidle-timeout-websocket-persistent.md` とも重複する。

### 根本原因の仮説 3: モジュールの `bt` インスタンスがセル間で共有されない

`game_setup` をインポートすると新しい `Backtest_Wrapper` インスタンスが生成される（`game_setup.py` モジュールレベルの `bt = Backtest_Wrapper(...)`）。テストが `gs.buy()` を呼ぶ別セルで再インポートすると、`bt._data` が空の新しいインスタンスになる可能性がある。ただし Python のモジュールキャッシュ（`sys.modules`）が機能していれば同一インスタンスが再利用される。

### 修正方針

1. **即時**: `beforeEach` の `waitForLoadState("networkidle")` を `waitForLoadState("load")` + `ensureConnected()` に変更する
2. **根本**: `sys.path` の設定を絶対パスまたは `PYTHONPATH` 環境変数に依存する形に変更する。テスト環境では `game_test.py` の `PYTHONPATH` が `src-tauri/sample-notebooks` を含むように設定されているため、`Path(__file__)` に依存せず単純に `import game_setup as gs` できるはず
3. 既存 Issue `sell-buy-no-guard-crash.md` との関連: ガード処理の実装自体（`game_setup.py`）は正しいが、テストのセットアップコードに問題がある

### `game_setup.py` の実装（参考 — 正常に動作しているはず）

```python
def buy():
    """トヨタ(7203)の株を買う"""
    if not bt._data:
        mo.output.append(mo.callout(
            mo.md("まず `bt.chart('7203')` でチャートを表示してください"),
            kind="warn",
        ))
        return None
    ...

def sell():
    """保有中の株を売る"""
    if bt.position.size == 0:
        mo.output.append(mo.callout(
            mo.md("保有中の株がありません。まず `bt.buy()` で株を購入してください"),
            kind="warn",
        ))
        return None
    ...
```

`buy()` の警告テキストは `まず \`bt.chart('7203')\` で...` であり、テストが期待する正規表現 `/まず.*bt.chart/` と一致するはず。テキストは表示されているが、`mo.output.append()` の出力先（コンソール出力）が `text=` ロケーターで検索できる DOM 位置に現れていない可能性もある。
