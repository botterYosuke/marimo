import marimo

__generated_with = "0.19.7"
app = marimo.App(width="grid")

with app.setup:
    import marimo as mo
    import game_setup as bt


@app.cell(hide_code=True)
def _():
    mo.md(r"""
## Welcome to Backcast!

What you see in front of you is a stock price chart of Toyota Motor (7203).

### What you can do right now

1. **Advance time**: Use `bt.step()` to move to the next day
2. **Place a buy order**: Type `bt.buy()` in the black window and run it
3. **Order gets filled**: Use `bt.step()` to advance to the next day and your order is filled!
4. **Watch the chart**: Use `bt.step()` to advance days and see the price move

### First goal

"Buy a stock!!"

Once you do that, you're officially an investor!
    """)

    return


@app.cell()
def _():
    bt.chart("7203")
    return


@app.cell
def _():
    # Write your code here!
    # Example: bt.buy()     ... Buy Toyota (7203) stock
    # Example: bt.step()    ... Advance to the next day

    return


if __name__ == "__main__":
    app.run()
