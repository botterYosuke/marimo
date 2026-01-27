import marimo

__generated_with = "0.19.6"
app = marimo.App(width="grid", layout_file="layouts/fintech1.grid.json")

with app.setup:
    """
    シンプルな戦略:
    - 前日比下落 → 買い
    - 前日比上昇 & ポジションあり → 売り
    """
    import marimo as mo
    import pandas as pd
    import pandas_datareader.data as web
    import time
    from BackcastPro import Backtest
    from BackcastPro import get_stock_daily

    # バックテスト初期化
    bt = Backtest(
        cash=100_000,
        commission=0.001,
        finalize_trades=True,
    )

    # state管理
    get_playing, set_playing = mo.state(True)
    AutoRefresh, set_step = mo.state(0)  # チャート更新トリガー用

    # ゲームループ
    def _game_loop():
        # ヘッドレス取引イベントを有効化（ループ開始時に1回）
        bt.enable_headless_trade_events()
        while bt.is_finished == False:
            if get_playing() == False:
                break  # run関数がもう一度呼ばれたら終了
            if bt.step() == False:
                break  # ステップ実行に問題があったら終了
            # ヘッドレス版で状態公開（BroadcastChannel経由）
            bt.publish_state_headless()
            set_step(bt._step_index)
            time.sleep(0.4)

    def run():
        """ループ開始/停止を制御"""
        if get_playing() == False:
            set_playing(True)
            mo.Thread(target=_game_loop).start()
            print('スタート')
        else:
            set_playing(False)
            print('ストップ')

    def reset():
        """バックテストをリセットして最初から"""
        set_playing(False)  # ゲームループを停止
        bt.reset()          # BackcastProの状態をリセット
        set_step(0)         # UIの更新トリガーをリセット
        print('リセットした')


@app.cell
def _():
    code = "7203"  # トヨタ
    toyota = get_stock_daily(code)

    bt.set_data({code: toyota})

    print(f"データ取得完了: {code} ({len(toyota)} 件)")
    return (code,)


@app.cell
def _(code):
    # 戦略定義: あなたの戦略をここに書いてください！
    def my_strategy(bt_inner):
        """
        シンプルな戦略:
        - 前日比下落 → 買い
        - 前日比上昇 & ポジションあり → 売り
        """
        df = bt_inner.data[code]

        if len(df) < 2:
            return

        c0 = df["Close"].iloc[-2]
        c1 = df["Close"].iloc[-1]

        pos = bt_inner.position_of(code)

        if pos == 0 and c1 < c0:
            bt_inner.buy(code=code, tag="dip_buy")
        elif pos > 0 and c1 > c0:
            bt_inner.sell(code=code, tag="profit_take")

    # 戦略を登録
    bt.set_strategy(my_strategy)
    return


@app.cell
def _(code):
    bt.chart(code=code)
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
