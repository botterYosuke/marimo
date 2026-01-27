# Publisher配置問題の解決計画

## 問題の理解

### 現状
- `bt.state_publisher()` と `bt.trade_event_publisher()` は **AnyWidget** を返す
- AnyWidgetはセルに配置されて**レンダリングされないと**、JavaScript（BroadcastChannel）が実行されない
- `with app.setup`は出力を表示しない設計のため、ここに配置してもウィジェットが機能しない

### ユーザーの要望
パブリッシャーを「ユーザーがさわれない領域」に配置したい → **ヘッドレスAPI**を選択

---

## 採用方針: ヘッドレスパブリッシャーAPI

### 技術的アプローチ
marimoの `mo.iframe()` を使用して、不可視のiframe内でBroadcastChannelにメッセージを送信する。

### 仕組み
1. `mo.iframe()` はスクリプトタグを含むHTMLを実行できる
2. `height="0px"` の不可視iframeでJavaScriptを実行
3. AnyWidgetのレンダリングが不要になる

---

## 修正ファイル

### 1. BackcastPro: `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\backtest.py`

新しいヘッドレスAPIを追加（2つのメソッド）:

```python
def publish_state_headless(self):
    """
    バックテスト状態をBroadcastChannelで公開（ヘッドレス版）

    ウィジェットレンダリング不要。app.setup内でも動作可能。
    """
    import marimo as mo
    import json

    # 状態データを準備
    positions = {}
    if self._broker_instance and self._broker_instance.trades:
        for trade in self._broker_instance.trades:
            positions[trade.code] = positions.get(trade.code, 0) + trade.size

    state = {
        "current_time": str(self.current_time) if self.current_time else "-",
        "progress": float(self.progress),
        "equity": float(self.equity),
        "cash": float(self.cash),
        "position": self.position,
        "positions": positions,
        "closed_trades": len(self.closed_trades),
        "step_index": self._step_index,
        "total_steps": len(self.index) if hasattr(self, "index") else 0,
    }

    script = f'''
    <div style="display:none;">
        <script>
            const channel = new BroadcastChannel('backtest_channel');
            channel.postMessage({{
                type: 'backtest_update',
                data: {json.dumps(state)}
            }});
        </script>
    </div>
    '''
    return mo.iframe(script, height="0px")


def publish_trade_event_headless(self, event_type: str, code: str, size: int, price: float, tag: str = None):
    """
    取引イベントをBroadcastChannelで公開（ヘッドレス版）
    """
    import marimo as mo
    import json

    event = {
        "event_type": event_type,
        "code": code,
        "size": abs(size),
        "price": price,
        "tag": tag,
    }

    script = f'''
    <div style="display:none;">
        <script>
            const channel = new BroadcastChannel('trade_event_channel');
            channel.postMessage({{
                type: 'trade_event',
                data: {json.dumps(event)}
            }});
        </script>
    </div>
    '''
    return mo.iframe(script, height="0px")
```

### 2. ノートブック: `C:\Users\sasai\AppData\Local\Temp\fintech1.py`

`_game_loop` 内でヘッドレスAPIを呼び出すよう修正:

**変更前（38-40行目）:**
```python
# 状態公開（BroadcastChannel経由で外部iframeに配信）
bt.state_publisher()
# 取引イベント公開（BroadcastChannel経由でThree.jsにエフェクトをトリガー）
bt.trade_event_publisher()
```

**変更後:**
```python
# ヘッドレス版で状態公開
bt.publish_state_headless()
# 取引イベントはbrokerコールバックで処理（後述）
```

---

## 実装ステップ

1. **BackcastPro修正** (`backtest.py`)
   - `publish_state_headless()` メソッドを追加
   - `publish_trade_event_headless()` メソッドを追加
   - 取引発生時に自動呼び出しするコールバック機構を追加

2. **ノートブック修正** (`fintech1.py`)
   - `_game_loop()` 内の呼び出しを新APIに変更
   - `bt.state_publisher()` / `bt.trade_event_publisher()` の呼び出しを削除

---

## 検証方法

1. ノートブックを開いて実行
2. `run()` でバックテストを開始
3. ブラウザのDevTools > Application > BroadcastChannelでメッセージを確認
4. 外部iframe（Three.js等）でエフェクトが動作することを確認

---

## 注意点

- `mo.iframe()` は各呼び出しごとに新しいiframeを生成する
- 高頻度呼び出し時のパフォーマンスを観察する必要がある
- 問題がある場合は、シングルトンiframe + WebSocket/postMessageパターンへの変更を検討

---

## 2025-01-27 検証結果（重要な発見）

### 検証内容
`mo.Thread` 内から `mo.output.append()` / `mo.output.replace()` が動作するかテスト。

### 検証用ノートブック
`C:\Users\sasai\AppData\Local\Temp\claude\c--Users-sasai-Documents-marimo\0d3fd329-c2a5-43ec-b7cd-7dc9efd31863\scratchpad\test_thread_output.py`

### 結果: 全テスト成功！

| テスト | 結果 | 詳細 |
|--------|------|------|
| Test 1 (append in Thread) | ✅ 成功 | BroadcastChannel にメッセージ送信成功 |
| Test 2 (replace in Thread) | ✅ 成功 | **予想外** - replace も動作 |
| Test 3 (append loop) | ✅ 成功 | ループ内で複数回成功 |
| Test 4 (direct baseline) | ✅ 成功 | ベースライン正常 |

### ログ抜粋（実証）
```
[Test1] mo.output.append() succeeded!
[Test1] Script executed in iframe from Thread!
[BroadcastChannel:test_channel] {type: 'test1_append', source: 'thread', ...}

[Test2] mo.output.replace() succeeded!
[Test2] Script executed in iframe from Thread!
[BroadcastChannel:test_channel] {type: 'test2_replace', source: 'thread', ...}
```

### 結論
**`mo.output.append()` も `mo.output.replace()` も Thread 内から正常に動作する！**

既存の `publish_state_headless()` は動作するはず。以前の例外は別の原因だった可能性あり。

---

## 次のステップ

1. **既存ヘッドレスAPIを fintech1.py で実際にテスト**
   - `_game_loop` 内で `bt.publish_state_headless()` を呼び出し
   - BroadcastChannel でメッセージが配信されるか確認

2. **動作しない場合は例外の原因を特定**
   - 実際のエラーメッセージを確認
   - backtest.py の実装を確認

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `BackcastPro/src/BackcastPro/backtest.py` | ヘッドレスAPI実装済み（822行目〜） |
| `docs/plans/fintech1.py` | テスト対象ノートブック |
| `scratchpad/test_thread_output.py` | Thread内output検証用 |
| `docs/plans/test_thread_output-BrowserDevToolConsole.log` | 検証ログ |

---

## 引き継ぎプロンプト

```
marimo notebookで、BackcastProの`bt.state_publisher()`と`bt.trade_event_publisher()`を
ユーザーが編集できない領域（`with app.setup`等）に配置したい。

詳細は以下のファイルを参照:
C:\Users\sasai\Documents\marimo\docs\plans\distributed-riding-flame.md

【重要な発見】
mo.Thread内から mo.output.append() / mo.output.replace() は正常動作することを検証済み。
（検証ログ: docs/plans/test_thread_output-BrowserDevToolConsole.log）

【次のタスク】
1. fintech1.py の _game_loop 内で bt.publish_state_headless() を呼び出してテスト
2. BroadcastChannel でメッセージが配信されるか確認
3. 動作しない場合は例外の原因を特定
```
