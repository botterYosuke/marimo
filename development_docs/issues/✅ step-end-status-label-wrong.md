# Issue: step() がゲーム終了を返した後もステータスが "Trading" のまま

**作成日**: 2026-02-21
**重要度**: Low
**カテゴリ**: Game / UI
**ステータス**: ✅ 修正済み（2026-02-21 実装確認）

---

## 概要

`game_setup.py` の `step()` 関数において、`bt.step()` がゲーム終了（データの末尾到達）を示す `False` を返した場合でも、`publish_state_headless()` が `status_label="Trading"` で呼び出される。ゲームが終了しているにもかかわらず HUD のステータス表示が "Trading" のままになる。

## 再現手順

1. `bt.chart("7203")` でチャートを表示する
2. `bt.step()` を繰り返し呼び出して株価データの末尾まで進める
3. `bt.step()` が `False` を返すと `_format_step_summary()` が最終サマリーを表示するが、HUD のステータスラベルは依然 "Trading" と表示されている

## 根本原因

`step()` 関数のステータス送信が `result` の値に関わらず固定の `"Trading"` を使用している：

```python
def step():
    """次の日に進む"""
    try:
        result = bt.step()
    except BankruptError:
        emit_skill("FAIL_003")
        update_all_backtest_charts(bt)
        publish_state_headless(bt, status_label="Bankrupt", status_variant="danger")
        raise
    _check_unrealized_loss()
    update_all_backtest_charts(bt)
    # ↓ バグ: result=False（ゲーム終了）の場合でも "Trading" を送信している
    publish_state_headless(bt, status_label="Trading", status_variant="default")
    _format_step_summary(result)
```

`BankruptError` の場合は正しく `status_label="Bankrupt"` が設定されるが、データ終端による自然なゲーム終了（`result=False`）に対応するステータスが存在しない。

## 影響範囲

- HUD の Status フィールドがゲーム終了後も "Trading" と表示され続ける
- ユーザーはステータスバーを見てもゲームが終了したかどうかを判断できない
- `_format_step_summary(False)` が最終サマリーを `mo.output.append()` で出力するため、ゲーム終了自体はユーザーに伝わるが、HUD の状態と不整合がある

## 修正案

`result` の値に基づいてステータスを条件分岐する：

```python
def step():
    """次の日に進む"""
    try:
        result = bt.step()
    except BankruptError:
        emit_skill("FAIL_003")
        update_all_backtest_charts(bt)
        publish_state_headless(bt, status_label="Bankrupt", status_variant="danger")
        raise
    _check_unrealized_loss()
    update_all_backtest_charts(bt)
    if result:
        publish_state_headless(bt, status_label="Trading", status_variant="default")
    else:
        publish_state_headless(bt, status_label="Finished", status_variant="success")
    _format_step_summary(result)
```

## 修正確認（2026-02-21）

`game_setup.py:141-145` に `result` による条件分岐が実装済みであることを確認:

```python
if result:
    publish_state_headless(bt, status_label="Trading", ...)
else:
    publish_state_headless(bt, status_label="Finished", ...)
```

なお `status_variant` は修正案の `"success"` ではなく `"secondary"` が使われているが、機能的な条件分岐は実装されている。

## 関連ファイル

| ファイル | 関連箇所 |
|---|---|
| `src-tauri/sample-notebooks/game_setup.py` | `step()` 110-122行目 — 修正対象 |
| `src-tauri/sample-notebooks/headless_broadcast.py` | `publish_state_headless()` — ステータス送信関数 |
