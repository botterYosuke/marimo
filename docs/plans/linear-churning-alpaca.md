# chart.py 双方向通信（ACK待ち）実装プラン

## 問題
`update_all_backtest_charts()` を while ループで呼ぶと、JavaScript が処理を完了する前に次の更新が来てフリーズする。

**原因**: 現在の設計は fire-and-forget（送りっぱなし）で、Python は JavaScript の応答を待たない。

## 解決策
JavaScript の描画完了後に ACK メッセージを Python に送信し、Python 側で ACK を待ってから次の更新を送る。

---

## 実装内容

### 1. JavaScript 側の変更 (chart.py `_esm`)

`flushPendingBar()` の finally ブロックで ACK 送信:

```javascript
finally {
    const hadBar = pendingBar !== null;
    pendingBar = null;
    rafId = null;

    // ACK 送信（描画完了通知）
    if (hadBar) {
        model.send({ type: 'render_ack' });
    }
}
```

### 2. Python 側の変更 (chart.py `LightweightChartWidget`)

新規追加:
- `_ack_event: threading.Event` - ACK 待機用
- `_handle_ack()` - on_msg コールバック
- `update_and_wait(bar, timeout=5.0)` - 同期 API（内部で Event.wait）

```python
import threading

class LightweightChartWidget(anywidget.AnyWidget):
    def __init__(self):
        super().__init__()
        self._ack_event = threading.Event()
        self.on_msg(self._handle_ack)

    def _handle_ack(self, widget, content, buffers):
        """JavaScript からの ACK を受信"""
        if content.get('type') == 'render_ack':
            self._ack_event.set()

    def update_and_wait(self, bar: dict, timeout: float = 5.0) -> bool:
        """バーを更新し、JavaScript の描画完了を待機（同期）"""
        self._ack_event.clear()
        self.update_bar_fast(bar)
        return self._ack_event.wait(timeout=timeout)
```

### 3. 関数の置き換え (chart.py)

`update_all_backtest_charts()` を ACK 待ち版に置き換え（同期関数のまま）:

```python
def update_all_backtest_charts(bt, timeout: float = 5.0) -> None:
    """すべてのチャートを更新し描画完了を待機"""
    for code, widget in bt._chart_state.widgets.items():
        # ... データ更新 ...
        bar = get_last_bar(df)
        # タイムアウトしても次のウィジェットに進む（ループ継続）
        widget.update_and_wait(bar, timeout)
```

### 4. game_setup.py の更新

**変更不要** - `step()`, `buy()`, `sell()` は同期関数のまま:

```python
def step():
    """次の日に進む"""
    result = bt.step()
    update_all_backtest_charts(bt)  # 内部で ACK 待機
    return result
```

---

## 修正ファイル

| ファイル | 変更内容 |
|---------|---------|
| [chart.py](frontend/public/files/chart.py) | JavaScript ACK 送信、Python threading.Event 待機、`update_and_wait()` 追加 |
| [game_setup.py](frontend/public/files/game_setup.py) | 変更不要（同期 API のまま） |

---

## 使用例

```python
# while ループでの安全な使用（async 不要）
while bt.current_time < end_date:
    step()  # 内部で JavaScript の描画完了を待つ
```

---

## タイムアウト処理

- デフォルト: 5秒
- タイムアウト時: `False` を返す（エラーは投げない）
- `update_all_backtest_charts` はタイムアウトしても次のウィジェットに進む
- タブがバックグラウンドの場合など、RAF が停止するケースに対応

---

## 検証方法

1. `step()` を while ループで100回呼び出し、フリーズしないことを確認
2. タイムアウト時の動作確認（タブをバックグラウンドにして実行）
