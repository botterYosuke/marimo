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
    # フルモード: 自由にセットアップ
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
    # フルモード初期化（自由にカスタマイズ可能）
    # =========================================================================

    get_playing, set_playing = mo.state(False)
    AutoRefresh, set_step = mo.state(0)


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    # 🚀 フルモード

    おめでとうございます！フルモードに到達しました。

    ここでは、すべての機能が解禁されています：

    - **複数銘柄の同時運用**
    - **インジケーター**（移動平均線、RSI、MACD、ボリンジャーバンド）
    - **リスク管理**（ストップロス、テイクプロフィット）
    - **詳細な統計分析**

    下のセルから、自分だけのバックテストを始めましょう！
    """)
    return


@app.cell
def _():
    # =========================================================================
    # Step 1: Backtestの初期化
    # =========================================================================
    # 好きな金額と手数料を設定してください

    bt = Backtest(
        cash=1_000_000,       # 初期資金（自由に変更可能）
        commission=0.001,     # 手数料率（0.1%）
        finalize_trades=True,
        color_theme="light",
    )

    enable_headless_trade_events(bt)
    print(f"初期資金: {bt.cash:,}円")
    return (bt,)


@app.cell
def _():
    # =========================================================================
    # Step 2: 株価データの取得
    # =========================================================================
    # 好きな銘柄コードを指定してください

    code = "7203"  # トヨタ自動車
    # code = "6758"  # ソニー
    # code = "9984"  # ソフトバンクグループ
    # code = "6861"  # キーエンス

    df = get_stock_daily(code)
    print(f"銘柄: {code}")
    print(f"データ期間: {df.index[0]} 〜 {df.index[-1]}")
    print(f"データ件数: {len(df)}件")
    df.head()
    return code, df


@app.cell
def _(bt, code, df):
    # =========================================================================
    # Step 3: インジケーターの追加（オプション）
    # =========================================================================
    # 自分のインジケーターを追加してください

    # 移動平均線
    df['SMA5'] = df['Close'].rolling(5).mean()
    df['SMA20'] = df['Close'].rolling(20).mean()
    df['SMA60'] = df['Close'].rolling(60).mean()

    # RSI（相対力指数）
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    df['RSI'] = 100 - (100 / (1 + gain / loss))

    # ボリンジャーバンド
    df['BB_middle'] = df['Close'].rolling(20).mean()
    df['BB_std'] = df['Close'].rolling(20).std()
    df['BB_upper'] = df['BB_middle'] + 2 * df['BB_std']
    df['BB_lower'] = df['BB_middle'] - 2 * df['BB_std']

    # データをセット
    bt.set_data({
        code: df
    })
    return


@app.cell
def _(bt, code):
    # =========================================================================
    # Step 4: チャート表示
    # =========================================================================

    backtest_chart(bt, code=code, indicators=['SMA5', 'SMA20', 'SMA60'])
    return


@app.cell
def _(bt, code):
    # =========================================================================
    # Step 5: 戦略の実装
    # =========================================================================
    # あなたの戦略をここに書いてください！

    AutoRefresh()

    data = bt.data[code]

    if len(data) > 20:
        # 現在のポジション
        pos = bt.position_of(code)

        # インジケーター値
        sma5 = data["SMA5"].iloc[-1]
        sma20 = data["SMA20"].iloc[-1]
        rsi = data["RSI"].iloc[-1]
        close = data["Close"].iloc[-1]

        # 例: SMAクロス + RSIフィルター戦略
        # ゴールデンクロス & RSI < 70 → 買い
        if pos == 0:
            sma5_prev = data["SMA5"].iloc[-2]
            sma20_prev = data["SMA20"].iloc[-2]
            if sma5_prev <= sma20_prev and sma5 > sma20 and rsi < 70:
                bt.buy(
                    code=code,
                    tag="golden_cross_rsi",
                    # sl=close * 0.95,  # ストップロス -5%
                    # tp=close * 1.10,  # テイクプロフィット +10%
                )

        # デッドクロス or RSI > 80 → 売り
        elif pos > 0:
            sma5_prev = data["SMA5"].iloc[-2]
            sma20_prev = data["SMA20"].iloc[-2]
            if (sma5_prev >= sma20_prev and sma5 < sma20) or rsi > 80:
                for trade in bt.trades():
                    if trade.code == code:
                        trade.close()
    return


@app.cell
def _():
    # =========================================================================
    # ゲームループ制御
    # =========================================================================

    def run():
        if get_playing() == False:
            set_playing(True)
            mo.Thread(target=do_step).start()
            print("スタート")
        else:
            set_playing(False)
            print("ストップ")

    def reset():
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

    return do_step, reset, run


@app.cell
def _(run):
    run()
    return


@app.cell
def _(reset):
    reset()
    return


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    ## 上級者向け機能

    ### ストップロス / テイクプロフィット

    ```python
    bt.buy(
        code=code,
        sl=close * 0.95,   # ストップロス: 現在価格の-5%
        tp=close * 1.10,   # テイクプロフィット: 現在価格の+10%
    )
    ```

    ### 複数銘柄の運用

    ```python
    toyota = get_stock_daily("7203")
    sony = get_stock_daily("6758")

    bt.set_data({
        "7203": toyota,
        "6758": sony,
    })
    ```

    ### 結果の分析

    ```python
    results = bt.finalize()
    print(f"総リターン: {results['total_return']:.2%}")
    print(f"シャープレシオ: {results['sharpe_ratio']:.2f}")
    print(f"最大ドローダウン: {results['max_drawdown']:.2%}")
    ```
    """)
    return


if __name__ == "__main__":
    app.run()
