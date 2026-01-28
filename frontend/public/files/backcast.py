import marimo

__generated_with = "0.19.6"
app = marimo.App(width="medium")

with app.setup:
    import marimo as mo
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
        set_playing(False)  # ゲームループを停止
        bt.reset()  # BackcastProの状態をリセット
        set_step(0)  # UIの更新トリガーをリセット
        print("リセットした")


    # ゲームループ
    def do_step():
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


@app.cell
def _():
    code = "7203"  # トヨタ
    toyota = get_stock_daily(code)
    toyota
    return


@app.cell
def _():
    import os
    print(os.environ.get('BACKCASTPRO_CACHE_DIR'))
    return


if __name__ == "__main__":
    app.run()
