# Fix: ステータスバーが Progress: 0.0% のまま更新されない

## Context

ゲーム (backcast.py) で `bt.step()` 実行後もステータスバー (BacktestHud) の Progress が 0.0%、Time が "-" のまま更新されない。

**原因**: `game_setup.step()` / `buy()` / `sell()` が値を `return` するため、セルの最終出力がその戻り値 (True/Order) に置き換わり、`publish_state_headless()` が埋め込んだ `<marimo-broadcast>` HTML がフロントエンドに届かない。

さらに `publish_state_headless()` が `mo.output.replace()` を使っているため、直前に `mo.output.append()` で追加した callout や `emit_skill()` の skill イベント HTML も全て上書きされている。

## 修正方針

2つの変更で修正:

1. **`headless_broadcast.py`**: `mo.output.replace()` → `mo.output.append()` に変更
2. **`game_setup.py`**: `step()` / `buy()` / `sell()` から `return` を削除し、callout を末尾に移動

## 修正対象ファイル

### 1. `src-tauri/sample-notebooks/headless_broadcast.py` (1箇所)

**L60**: `mo.output.replace` → `mo.output.append`

```python
# Before
mo.output.replace(Html(html))

# After
mo.output.append(Html(html))
```

### 2. `src-tauri/sample-notebooks/game_setup.py` (3箇所)

#### `buy()` (L83-94): callout を末尾に移動、return 削除

```python
# Before
def buy():
    order = bt.buy()
    price = bt._broker_instance.last_price(order.code)
    mo.output.append(mo.callout(...))     # ← emit_skill + publish_state で上書きされる
    emit_skill("SANDBOX_002")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, ...)       # ← mo.output.replace で callout 消滅
    return order                          # ← セル出力が Order オブジェクトに

# After
def buy():
    order = bt.buy()
    price = bt._broker_instance.last_price(order.code)
    emit_skill("SANDBOX_002")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="Trading", status_variant="default")
    mo.output.append(mo.callout(
        mo.md(f"**買い注文を出しました** — {order.code} @ ¥{price:,.0f}"),
        kind="success",
    ))
    # return なし → セル出力 = [skill_html, state_html, callout]
```

#### `sell()` (L96-110): 同パターン

```python
# After
def sell():
    order = bt.sell()
    price = bt._broker_instance.last_price(order.code)
    emit_skill("SANDBOX_004")
    if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.closed_trades):
        emit_skill("FAIL_002")
    update_all_backtest_charts(bt)
    publish_state_headless(bt, status_label="Trading", status_variant="default")
    mo.output.append(mo.callout(
        mo.md(f"**売り注文を出しました** — {order.code} @ ¥{price:,.0f}"),
        kind="success",
    ))
    # return なし
```

#### `step()` (L112-125): return 削除のみ

```python
# Before
def step():
    ...
    publish_state_headless(bt, status_label="Trading", status_variant="default")
    _format_step_summary(result)
    return result               # ← セル出力が True/False に

# After: return result の行を削除するだけ
def step():
    ...
    publish_state_headless(bt, status_label="Trading", status_variant="default")
    _format_step_summary(result)
    # return なし → セル出力 = [state_html, summary_callout]
```

#### L31-32 コメント更新

```python
# Before
publish_state_headless(bt, status_label="Ready", status_variant="secondary")  # mo.output.replace()
broadcast_progress()  # mo.output.append() — replace の後に append する順序が重要

# After
publish_state_headless(bt, status_label="Ready", status_variant="secondary")  # mo.output.append()
broadcast_progress()  # mo.output.append()
```

## 修正後のデータフロー

```
Cell: bt.step()
  ├─ emit_skill()       → mo.output.append(skill_html)      [hidden]
  ├─ publish_state()    → mo.output.append(broadcast_html)   [hidden]
  └─ _format_summary()  → mo.output.append(callout)          [visible]

Cell returns None → accumulated_output preserved
  ↓
Frontend: cell-op (text/html)
  ├─ extractAndSendBroadcastMessages() → skill_event_channel
  ├─ extractAndSendBroadcastMessages() → backtest_channel
  └─ Render: callout のみ表示 (broadcast は display:none)
  ↓
BroadcastChannel: backtest_channel
  → useBroadcastChannel() hook → BacktestHud 更新
  → Progress: 0.4%, Time: 2024-01-15, Equity: ¥100,000
```

## 検証方法

1. `pnpm exec playwright test tests/e2e/sandbox.spec.ts` (game e2e テスト)
2. 手動検証:
   - `marimo edit src-tauri/sample-notebooks/backcast.py` で起動
   - `bt.chart("7203")` → `bt.buy()` → `bt.step()` を順に実行
   - 各操作後にステータスバーの Progress / Time が更新されることを確認
   - `bt.buy()` で「買い注文を出しました」callout が表示されることを確認
   - `bt.step()` で日付・株価・含み損益のサマリーが表示されることを確認
