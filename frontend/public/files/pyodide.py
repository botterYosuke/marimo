import marimo

__generated_with = "0.19.6"
app = marimo.App(width="grid")

with app.setup:
    import marimo as mo
    from BackcastPro import Backtest
    from BackcastPro import get_stock_daily

    # バックテスト初期化
    bt = Backtest(
        cash=100_000,
        commission=0.001,
        finalize_trades=True,
    )

    # state管理（refresher は state に入れない）
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
            bt.enable_headless_trade_events()
            set_playing(True)
            print('スタート')

    def reset():
        """リセット"""
        set_playing(False)
        bt.reset()
        print('リセットした')

    def do_step():
        """1ステップ実行（playing時のみ）"""
        if not get_playing():
            return False
        if bt.is_finished or bt.step() == False:
            set_playing(False)
            return False
        bt.publish_state_headless()
        return True


@app.cell(hide_code=True)
def _():
    # refresher を静的に定義（常に表示）
    refresher = mo.ui.refresh(
        options=["400ms", "1s", "2s"],
        default_interval="400ms"
    )
    refresher  # これで表示される
    return (refresher,)


@app.cell(hide_code=True)
def _(refresher):
    # refresher.value の変化でこのセルが再実行される
    _ = refresher.value
    do_step()
    return



if __name__ == "__main__":
    app.run()
