# Issue: sell()/buy() にポジション確認ガードがなくクラッシュする

**作成日**: 2026-02-21
**重要度**: Medium
**カテゴリ**: Game / Error Handling
**ステータス**: ✅ 修正済み（2026-02-21 実装確認）

---

## 概要

`game_setup.py` の `sell()` および `buy()` 関数に、事前条件を検証するガードが存在しない。以下の状況で例外が発生し、スタックトレースがそのままユーザーに表示される：

1. `sell()`: ポジションを保有していない状態で呼び出した場合
2. `buy()`: すでにポジションを保有している状態で呼び出した場合（二重買いの意図せぬ実行）
3. `buy()`/`sell()`: データが読み込まれていない状態（`bt.chart()` を実行する前）で呼び出した場合

## 再現手順

### sell() のクラッシュ
1. ゲームを開始し、`bt.chart("7203")` を実行する
2. `bt.buy()` を実行せずに `bt.sell()` を呼び出す
3. BackcastPro の内部で例外が発生し、`order` が不正な値になる
4. `price = bt._broker_instance.last_price(order.code)` で `AttributeError` または `NoneType` エラーが発生する

### buy() のデータなし時のクラッシュ
1. ゲームを開始する
2. `bt.chart("7203")` を実行せずに直接 `bt.buy()` を呼び出す
3. データが設定されていないため BackcastPro 内部でクラッシュする
4. `price = bt._broker_instance.last_price(order.code)` が失敗する

## 根本原因

`buy()` と `sell()` の実装にはガードが一切ない：

```python
def buy():
    """トヨタ(7203)の株を買う"""
    order = bt.buy()  # ← データなし/すでにポジションありの場合に例外
    price = bt._broker_instance.last_price(order.code)  # ← order が None なら AttributeError
    emit_skill("SANDBOX_002")
    ...

def sell():
    """保有中の株を売る"""
    order = bt.sell()  # ← ポジションなしの場合に例外
    price = bt._broker_instance.last_price(order.code)  # ← order が None なら AttributeError
    emit_skill("SANDBOX_004")
    ...
```

`bt.step()` では `BankruptError` の例外処理が実装されているが、`buy()` と `sell()` には類似の例外処理が存在しない。エラー発生時にスキル発火や HUD 更新が中断され、ゲームが不整合な状態になる可能性がある。

## 影響範囲

- ゲーム初心者がチュートリアルを読まずに `bt.sell()` を最初に呼び出した場合にクラッシュする
- `bt.buy()` を2回呼ぶと二重ポジションになる可能性があり、スキル SANDBOX_002 が2回目以降は発火しないため動作に混乱が生じる
- クラッシュ時にスキル（SANDBOX_002 / SANDBOX_004）が発火しない可能性がある
- エラーメッセージがスタックトレースのままユーザーに表示され、ゲーム体験を損なう

## 修正案

`buy()` と `sell()` に事前条件チェックとユーザーフレンドリーなエラーメッセージを追加する：

```python
def buy():
    """トヨタ(7203)の株を買う"""
    if not bt._data:
        mo.output.append(mo.callout(
            mo.md("まず `bt.chart('7203')` でチャートを表示してください"),
            kind="warn",
        ))
        return None
    if bt.position.size != 0:
        mo.output.append(mo.callout(
            mo.md("すでにポジションを保有しています。`bt.sell()` で売却してください"),
            kind="warn",
        ))
        return None
    order = bt.buy()
    price = bt._broker_instance.last_price(order.code)
    emit_skill("SANDBOX_002")
    ...

def sell():
    """保有中の株を売る"""
    if bt.position.size == 0:
        mo.output.append(mo.callout(
            mo.md("保有中のポジションがありません。まず `bt.buy()` で株を購入してください"),
            kind="warn",
        ))
        return None
    order = bt.sell()
    price = bt._broker_instance.last_price(order.code)
    emit_skill("SANDBOX_004")
    ...
```

## 修正確認（2026-02-21）

`game_setup.py:85-95`（`buy()`）と `game_setup.py:109-114`（`sell()`）に以下が実装済みであることを確認:
- `buy()`: `bt._data` 空チェック → callout 表示 → `return None`
- `buy()`: ポジション保有チェック（`bt.position.size != 0`）→ callout 表示 → `return None`
- `sell()`: ポジションなしチェック（`bt.position.size == 0`）→ callout 表示 → `return None`

なお実装の警告文言は修正案と若干異なる（「ポジション」→「株」、文末表現）が、機能的には要件を満たしている。

## 補足

`reveal_data()` には同様のガード処理が実装されており（`if not bt._data:`）、これを参考にすることができる。`step()` の `BankruptError` 処理も設計パターンとして参照できる。

## 関連ファイル

| ファイル | 関連箇所 |
|---|---|
| `src-tauri/sample-notebooks/game_setup.py` | `buy()` 83-93行目、`sell()` 95-108行目 — 修正対象 |
| `src-tauri/sample-notebooks/game_setup.py` | `reveal_data()` 124-133行目 — ガード実装の参考 |
| `src-tauri/sample-notebooks/game_setup.py` | `step()` 110-122行目 — 例外処理の参考 |
