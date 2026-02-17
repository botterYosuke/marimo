import marimo

__generated_with = "0.19.7"
app = marimo.App(width="grid")

with app.setup:
    import marimo as mo
    import json
    import base64
    import time
    from marimo._output.hypertext import Html
    from BackcastPro import Backtest, get_stock_daily
    from chart import backtest_chart

    # =========================================================================
    # ヘッドレス関数（Pyodide対応版）
    # =========================================================================

    def publish_state_headless(
        bt: Backtest,
        status_label: str = "Backtest",
        status_variant: str = "secondary",
    ):
        """バックテスト状態をBroadcastChannelで公開"""
        state = bt.get_state_snapshot()
        state["status_label"] = status_label
        state["status_variant"] = status_variant

        state_json = json.dumps(state)
        state_b64 = base64.b64encode(state_json.encode()).decode()
        unique_id = f"marimo-bc-{bt.step_index}-{int(time.time() * 1000)}"

        html = (
            f'<marimo-broadcast '
            f'id="{unique_id}" '
            f'channel="backtest_channel" '
            f'type="backtest_update" '
            f'payload="{state_b64}" '
            f'style="display:none;"></marimo-broadcast>'
        )
        mo.output.replace(Html(html))

    def publish_trade_event_headless(
        event_type: str,
        code: str,
        size: int,
        price: float,
        tag: str | None = None,
    ):
        """取引イベントをBroadcastChannelで公開"""
        event = {
            "event_type": event_type,
            "code": code,
            "size": abs(size),
            "price": float(price),
            "tag": str(tag) if tag else None,
        }

        event_json = json.dumps(event)
        event_b64 = base64.b64encode(event_json.encode()).decode()

        html = (
            f'<div data-marimo-broadcast="trade_event_channel" '
            f'data-marimo-type="trade_event" '
            f'data-marimo-payload="{event_b64}" '
            f'style="display:none;"></div>'
        )
        mo.output.append(Html(html))

    def enable_headless_trade_events(bt: Backtest):
        """取引イベントをヘッドレスモードで自動発行するよう設定"""
        def on_trade(event_type: str, trade):
            publish_trade_event_headless(
                event_type=event_type,
                code=trade.code,
                size=trade.size,
                price=trade.entry_price,
                tag=getattr(trade, "tag", None),
            )
        bt.add_trade_callback(on_trade)

    # =========================================================================
    # バックテスト初期化
    # =========================================================================

    bt = Backtest(
        cash=1_000_000,
        commission=0.001,
        finalize_trades=True,
    )

    # state管理（Pyodide版: refresher は state に入れない）
    get_playing, set_playing = mo.state(False)

    def run():
        """開始/停止をトグル"""
        if get_playing():
            set_playing(False)
            print('ストップ')
        else:
            if bt.is_finished:
                print('バックテストは既に終了しています')
                return
            enable_headless_trade_events(bt)
            set_playing(True)
            print('スタート')

    def reset():
        """リセット"""
        set_playing(False)
        bt.reset()
        bt._chart_state.reset()  # チャート状態をリセット
        print('リセットした')

    def do_step():
        """1ステップ実行（playing時のみ）- Pyodide対応版"""
        if not get_playing():
            publish_state_headless(bt, status_label="停止中", status_variant="secondary")
            return False
        if bt.is_finished or bt.step() == False:
            set_playing(False)
            publish_state_headless(bt, status_label="停止中", status_variant="secondary")
            return False
        publish_state_headless(bt, status_label="実行中", status_variant="success")
        return True


@app.cell(hide_code=True)
def _():
    # refresher を静的に定義（常に表示）- Pyodide対応のポーリング方式
    refresher = mo.ui.refresh(
        options=["400ms", "1s", "2s"],
        default_interval="400ms"
    )
    refresher
    return (refresher,)


@app.cell(hide_code=True)
def _(refresher):
    # refresher.value の変化でこのセルが再実行される
    _ = refresher.value
    do_step()
    return


@app.cell
def _():
    code = "7203"  # トヨタ
    toyota = get_stock_daily(code)
    toyota
    return code, toyota


@app.cell
def _(code, toyota):
    toyota['SMA1'] = toyota['Close'].rolling(2).mean()
    toyota['SMA2'] = toyota['Close'].rolling(5).mean()

    bt.set_data({
        code: toyota
    })
    return


@app.cell
def _(bt, code):
    backtest_chart(bt, code=code, indicators=['SMA1', 'SMA2'])
    return


@app.cell
def _(code, refresher):
    # 戦略定義: あなたの戦略をここに書いてください！
    _ = refresher.value  # refresh トリガーで再実行

    """
    単純移動平均（SMA）クロスオーバー戦略:
    - ゴールデンクロス（SMA1がSMA2を上抜け） → 買い
    - デッドクロス（SMA1がSMA2を下抜け） → 売り
    """
    df = bt.data[code]

    if len(df) > 2:
        # 前日と当日のSMA値を取得
        sma1_prev = df["SMA1"].iloc[-2]
        sma2_prev = df["SMA2"].iloc[-2]
        sma1_curr = df["SMA1"].iloc[-1]
        sma2_curr = df["SMA2"].iloc[-1]

        pos = bt.position_of(code)

        # ゴールデンクロス: 短期SMAが長期SMAを上抜け
        if pos == 0 and sma1_prev <= sma2_prev and sma1_curr > sma2_curr:
            bt.buy(code=code, tag="golden_cross")
        # デッドクロス: 短期SMAが長期SMAを下抜け
        elif pos > 0 and sma1_prev >= sma2_prev and sma1_curr < sma2_curr:
            for trade in bt.trades():
                if trade.code == code:
                    trade.close()
    return


@app.cell
def _():
    run()
    return


if __name__ == "__main__":
    app.run()
