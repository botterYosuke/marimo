import marimo

__generated_with = "0.19.7"
app = marimo.App(width="grid")

with app.setup:
    import marimo as mo
    import lib.game_setup as bt


@app.cell(hide_code=True)
def _():
    mo.md(r"""
## 欢迎来到 Backcast！

您面前看到的是丰田汽车（7203）的股价图表。

### 现在可以做的事

1. **推进时间**: 使用 `bt.step()` 前进到下一天
2. **下买入订单**: 在黑色窗口中输入 `bt.buy()` 并执行
3. **订单成交**: 使用 `bt.step()` 前进到下一天，买入订单成功成交！
4. **查看图表**: 使用 `bt.step()` 推进日期，观察股价走势

### 第一个目标

"买入股票！！"

做到这一步，您就正式成为投资者了！
    """)

    return


@app.cell()
def _():
    bt.chart("7203")
    return


@app.cell
def _():
    # 在这里编写您的代码！
    # 示例: bt.buy()     ... 买入丰田(7203)的股票
    # 示例: bt.step()    ... 前进到下一天

    return


if __name__ == "__main__":
    app.run()
