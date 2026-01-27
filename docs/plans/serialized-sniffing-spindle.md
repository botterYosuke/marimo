# 引継ぎ資料: Pyodide版ゲームループ実装

## 目的

`C:\Users\sasai\AppData\Local\Temp\fintech1.py` （`mo.Thread` 使用）を Pyodide 環境で動作するように `mo.ui.refresh` に置き換えた `C:\Users\sasai\AppData\Local\Temp\pyodide1.py` を作成したが、ゲームループが正しく動作しない。

## 設計要件（ユーザー指定）

1. **refresher の生成やステップ実行ロジックは `with app.setup` 節に集約**
   - プレイヤーに見せたくない処理を隠す
2. **Play/Pause, Reset は UI操作ではなく `run()`, `reset()` 関数の実行により切り替える**
   - セルを実行することで制御

## mo.Thread vs mo.ui.refresh の根本的な違い

| 項目 | mo.Thread | mo.ui.refresh |
|------|-----------|---------------|
| 実行場所 | バックグラウンドスレッド | セル再実行 |
| トリガー | while ループ内で継続 | フロントエンドの setInterval |
| レンダリング | 不要 | **必須**（セルに表示が必要） |
| 停止方法 | フラグで break | refresher を None に設定 or unmount |

**重要な発見**: `mo.ui.refresh` はセルにレンダリング（表示）されないと interval が発火しない。フロントエンド側で `setInterval` を使っているため。

## 試したアプローチ

### アプローチ: 動的に refresher を生成して state に保存

```python
with app.setup:
    get_refresher, set_refresher = mo.state(None)
    get_playing, set_playing = mo.state(False)

    def run():
        if get_playing():
            set_playing(False)
            set_refresher(None)  # 停止
        else:
            refresher = mo.ui.refresh(options=["400ms", "1s", "2s"], default_interval="400ms")
            set_refresher(refresher)  # 開始
            set_playing(True)

    def do_step():
        if not get_playing() or bt.is_finished:
            return False
        bt.step()
        bt.publish_state_headless()
        return True

@app.cell
def _():
    refresher = get_refresher()
    if refresher is not None:
        _ = refresher.value  # 依存関係トリガー
        do_step()
    return (refresher,)  # refresher を表示
```

## 現在の症状

1. **`run()` を実行するとエラーは出ない**
2. **1ステップだけ進んで止まる**
3. **refresh UI は表示されない**

## 問題の推測

1. **refresher が state 経由で渡されても、セル再実行時に新しいインスタンスとして認識されない可能性**
   - `run()` 内で `mo.ui.refresh()` を生成 → `set_refresher()` で保存
   - しかしセルが再実行されたとき、refresher が「新規」として扱われ、フロントエンドに正しく接続されないかもしれない

2. **`refresher.value` の参照が依存関係を正しく作らない**
   - `_ = refresher.value` で依存関係を作ろうとしているが、marimo の依存関係解析が静的なため効かない可能性

3. **refresher のライフサイクル問題**
   - `run()` が呼ばれるたびに新しい `mo.ui.refresh` インスタンスを作成
   - 既存の refresher が破棄され、新しいものが作られるが、フロントエンドとの同期が取れていない

## 参考: mo.ui.refresh の実装詳細

- **Python**: `marimo/_plugins/ui/_impl/refresh.py`
- **React**: `frontend/src/plugins/impl/RefreshPlugin.tsx`
- interval は React 側の `useEffect` + `setInterval` で実装
- value は `"interval (count)"` 形式の文字列として送信される

## 未検証のアプローチ

1. **refresher を常に存在させて、`mo.stop()` で条件付き停止**
   ```python
   @app.cell
   def _():
       refresher = mo.ui.refresh(...)
       return (refresher,)

   @app.cell
   def _(refresher):
       mo.stop(not get_playing())  # playing でなければ停止
       _ = refresher.value
       do_step()
   ```

2. **refresher を直接セルで定義し、run/reset は playing フラグのみ操作**
   - refresher は常に表示・動作
   - `do_step()` 内で `get_playing()` をチェック

3. **`mo.ui.refresh` を使わず、別のアプローチ**
   - `mo.ui.slider` で手動ステップ
   - JavaScript からの定期的なイベント発火

## 現在のコード

ファイル: `C:\Users\sasai\AppData\Local\Temp\pyodide1.py`

```python
import marimo

__generated_with = "0.19.6"
app = marimo.App(width="medium")

with app.setup:
    import marimo as mo
    from BackcastPro import Backtest
    from BackcastPro import get_stock_daily

    bt = Backtest(cash=100_000, commission=0.001, finalize_trades=True)

    get_refresher, set_refresher = mo.state(None)
    get_playing, set_playing = mo.state(False)

    def run():
        if get_playing():
            set_playing(False)
            set_refresher(None)
            print('ストップ')
        else:
            if bt.is_finished:
                print('バックテストは既に終了しています')
                return
            bt.enable_headless_trade_events()
            refresher = mo.ui.refresh(options=["400ms", "1s", "2s"], default_interval="400ms")
            set_refresher(refresher)
            set_playing(True)
            print('スタート')

    def reset():
        set_playing(False)
        set_refresher(None)
        bt.reset()
        print('リセットした')

    def do_step():
        if not get_playing():
            return False
        if bt.is_finished:
            set_playing(False)
            set_refresher(None)
            return False
        if bt.step() == False:
            set_playing(False)
            set_refresher(None)
            return False
        bt.publish_state_headless()
        return True

@app.cell
def _():
    # ゲームループ駆動: refresher を表示し、do_step() を呼ぶ
    refresher = get_refresher()
    if refresher is not None:
        _ = refresher.value
        do_step()
    return (refresher,)

@app.cell
def _():
    code = "7203"
    toyota = get_stock_daily(code)
    bt.set_data({code: toyota})
    bt.chart(code=code)
    return (code,)

@app.cell
def _(code):
    refresher1 = get_refresher()
    if refresher1 is not None:
        _ = refresher1.value
    df = bt.data[code]
    if len(df) > 1:
        c0 = df["Close"].iloc[-2]
        c1 = df["Close"].iloc[-1]
        pos = bt.position_of(code)
        if pos == 0 and c1 < c0:
            bt.buy(code=code, tag="dip_buy")
        elif pos > 0 and c1 > c0:
            bt.sell(code=code, tag="profit_take")
    return

@app.cell
def _():
    run()
    return

@app.cell
def _():
    reset()
    return

if __name__ == "__main__":
    app.run()
```

## 元のコード（mo.Thread 版）

ファイル: `C:\Users\sasai\AppData\Local\Temp\fintech1.py`

- `mo.Thread(target=_game_loop).start()` でバックグラウンドスレッドを起動
- `_game_loop` 内で `while` ループ + `time.sleep(0.4)`
- `set_step(bt._step_index)` で state 更新 → セル再実行

## 次のステップ候補

1. **mo.ui.refresh のライフサイクルを調査**
   - state 経由で渡された refresher がフロントエンドにどう接続されるか
   - 動的生成 vs 静的定義の違い

2. **別パターンの実装を試す**
   - refresher を常時存在させ、`mo.stop()` で制御
   - または refresher 無しで別の方法を検討

3. **marimo のソースコードを確認**
   - `UIElement` がセルに表示されたときのフロントエンド接続処理
   - `mo.state` 経由で UIElement を渡したときの挙動
