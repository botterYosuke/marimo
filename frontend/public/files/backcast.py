import marimo

__generated_with = "0.19.7"
app = marimo.App(width="grid")

with app.setup:
    import marimo as mo
    import game_setup as bt


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    ## ようこそ、Backcastへ！

    目の前に見えているのは、トヨタ自動車（7203）の株価チャートです。

    ### 今すぐできること

    1. **株を買う注文する**: 黒いウィンドウに `bt.buy()` と入力して実行
    2. **時間を進める**: `bt.step()` で次の日に進む
    3. **買注文が決済される**: 無事に買い注文が決済され株主になりました！
    4. **チャートを見る**: `bt.step()` で日を進めて株価の動きを確認

    ### 最初の目標

    「株を買う！！」

    これができたら、あなたも投資家の仲間入り！
    """)

    return


@app.cell()
def _():
    bt.chart("7203")
    return


@app.cell
def _():
    # ここにコードを書いてみよう！
    # 例: bt.buy()     ... トヨタ(7203)の株を買う
    # 例: bt.step()    ... 次の日に進む

    return


if __name__ == "__main__":
    app.run()
