# chart.py 双方向通信（ACK待ち）

**ステータス**: 完了

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
        if content.get('type') == 'render_ack':
            self._ack_event.set()

    def update_and_wait(self, bar: dict, timeout: float = 5.0) -> bool:
        self._ack_event.clear()
        self.update_bar_fast(bar)
        return self._ack_event.wait(timeout=timeout)
```

### 3. 関数の置き換え (chart.py)

`update_all_backtest_charts()` を ACK 待ち版に置き換え（同期関数のまま）。

### 4. game_setup.py

**変更不要** - `step()`, `buy()`, `sell()` は同期関数のまま。

---

## 修正ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src-tauri/sample-notebooks/chart.py` | JavaScript ACK 送信、Python threading.Event 待機、`update_and_wait()` 追加 |

## タイムアウト処理

- デフォルト: 5秒
- タイムアウト時: `False` を返す（エラーは投げない）
- `update_all_backtest_charts` はタイムアウトしても次のウィジェットに進む
- タブがバックグラウンドの場合など、RAF が停止するケースに対応
