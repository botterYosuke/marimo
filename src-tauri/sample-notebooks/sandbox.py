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
    # サンドボックスモード: すぐに取引を始められる環境
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
    # サンドボックス初期化（プリロード済み）
    # =========================================================================

    bt = Backtest(
        cash=100_000,  # サンドボックスは10万円から
        commission=0.001,
        finalize_trades=True,
        color_theme="light",
    )

    enable_headless_trade_events(bt)

    # state管理
    get_playing, set_playing = mo.state(False)
    AutoRefresh, set_step = mo.state(0)


    def run():
        """ループ開始/停止を制御"""
        if get_playing() == False:
            set_playing(True)
            mo.Thread(target=do_step).start()
            print("スタート")
        else:
            set_playing(False)
            print("ストップ")


    def reset():
        """バックテストをリセットして最初から"""
        set_playing(False)
        bt.reset()
        bt._chart_state.reset()  # チャート状態をリセット
        set_step(0)
        print("リセットした")


    def do_step():
        while bt.is_finished == False:
            if get_playing() == False:
                break
            if bt.step() == False:
                break
            publish_state_headless(bt, status_label="実行中", status_variant="success")
            set_step(bt.step_index)
            time.sleep(0.4)
        publish_state_headless(bt, status_label="停止中", status_variant="secondary")


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    # 🎮 サンドボックスモード

    すぐに株取引を体験できます。データは自動的に読み込まれています。

    ## 今すぐできること

    1. **株を買う**: `bt.buy()` を実行
    2. **時間を進める**: `bt.step()` で次の日に進む
    3. **株を売る**: `for trade in bt.trades(): trade.close()`
    """)
    return


@app.cell
def _():
    # トヨタ（7203）のデータを取得（サンドボックスでは自動）
    code = "7203"
    toyota = get_stock_daily(code)
    toyota
    return code, toyota


@app.cell
def _(code, toyota):
    # 移動平均線を追加
    toyota['SMA1'] = toyota['Close'].rolling(2).mean()
    toyota['SMA2'] = toyota['Close'].rolling(5).mean()

    # データをセット（サンドボックスでは自動）
    bt.set_data({
        code: toyota
    })
    return


@app.cell
def _(bt, code):
    # チャートを表示
    backtest_chart(bt, code=code, indicators=['SMA1', 'SMA2'])
    return


@app.cell
def _(code):
    # 戦略: あなたのコードをここに書いてください！
    AutoRefresh()

    df = bt.data[code]

    if len(df) > 2:
        sma1_prev = df["SMA1"].iloc[-2]
        sma2_prev = df["SMA2"].iloc[-2]
        sma1_curr = df["SMA1"].iloc[-1]
        sma2_curr = df["SMA2"].iloc[-1]

        pos = bt.position_of(code)

        # ゴールデンクロス → 買い
        if pos == 0 and sma1_prev <= sma2_prev and sma1_curr > sma2_curr:
            bt.buy(code=code, tag="golden_cross")
        # デッドクロス → 売り
        elif pos > 0 and sma1_prev >= sma2_prev and sma1_curr < sma2_curr:
            for trade in bt.trades():
                if trade.code == code:
                    trade.close()
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
