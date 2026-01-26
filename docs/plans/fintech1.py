import marimo

__generated_with = "0.19.6"
app = marimo.App(width="grid", layout_file="layouts/fintech1.grid.json")


@app.cell
def _():
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
    get_playing, set_playing = mo.state(False)
    AutoRefresh, set_step = mo.state(0)  # チャート更新トリガー用

    # ゲームループ
    def _game_loop():
        while not bt.is_finished:
            if not get_playing():
                break
            if not bt.step():
                break
            set_step(bt._step_index)
            time.sleep(0.5)

    def toggle_run():
        """ループ開始/停止を制御"""
        if not get_playing():
            set_playing(True)
            mo.Thread(target=_game_loop).start()
        else:
            set_playing(False)
    return AutoRefresh, bt, get_stock_daily, mo, pd, toggle_run


@app.cell
def _(AutoRefresh, bt, code, mo):
    _ = AutoRefresh()  # 依存関係を作る
    # 情報パネル
    info = mo.md(f"""
    ## 状況

    | 項目 | 値 |
    |------|-----|
    | 日時 | {bt.current_time} |
    | 進捗 | {bt.progress * 100:.1f}% ({bt._step_index}/{len(bt.index)}) |
    | 資産 | ¥{bt.equity:,.0f} |
    | 現金 | ¥{bt.cash:,.0f} |
    | ポジション | {bt.position_of(code)} 株 |
    | 決済済取引 | {len(bt.closed_trades)} 件 |
    """)

    info
    return


@app.cell
def _(bt, get_stock_daily):
    code = "7203"  # トヨタ
    df = get_stock_daily(code)

    bt.set_data({
        code: df
    })

    print(f"データ取得完了: {code} ({len(df)} 件)")
    return (code,)


@app.cell
def _(bt, code):
    # 戦略定義: 前日比で売買
    def my_strategy(bt):
        """
        シンプルな戦略:
        - 前日比下落 → 買い
        - 前日比上昇 & ポジションあり → 売り
        """
        df = bt.data[code]

        if len(df) < 2:
            return

        c0 = df["Close"].iloc[-2]
        c1 = df["Close"].iloc[-1]

        pos = bt.position_of(code)

        if pos == 0 and c1 < c0:
            bt.buy(code=code, tag="dip_buy")
        elif pos > 0 and c1 > c0:
            bt.sell(code=code, tag="profit_take")

    # 戦略を登録
    bt.set_strategy(my_strategy)
    return


@app.cell
def _(toggle_run):
    toggle_run()
    return


@app.cell
def _(AutoRefresh, bt, code):
    AutoRefresh()  # 依存関係を作る（state更新で再実行される）
    # チャート生成
    chart = bt.chart(code=code, height=500, show_tags=True)
    chart
    return


@app.cell
def _(AutoRefresh, bt, mo, pd):
    _ = AutoRefresh()  # 依存関係を作る
    # 取引履歴テーブル
    if bt.closed_trades:
        trades_data = []
        for t in bt.closed_trades:
            trades_data.append({
                "銘柄": t.code,
                "方向": "買" if t.size > 0 else "売",
                "数量": abs(t.size),
                "エントリー": t.entry_time,
                "エントリー価格": f"¥{t.entry_price:,.0f}",
                "イグジット": t.exit_time,
                "イグジット価格": f"¥{t.exit_price:,.0f}",
                "損益": f"¥{t.pl:+,.0f}",
                "理由": t.tag or "-",
            })

        trades_df = pd.DataFrame(trades_data)
        mo.md("## 取引履歴")
        mo.ui.table(trades_df)
    else:
        mo.md("_まだ取引がありません_")
    return


if __name__ == "__main__":
    app.run()
