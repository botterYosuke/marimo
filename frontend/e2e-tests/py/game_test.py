import marimo

__generated_with = "0.19.11"
app = marimo.App(
    width="grid",
    app_title="Game Test",
    layout_file="layouts/game_test.grid.json",
)


@app.cell
def _():
    import marimo as mo

    return (mo,)


@app.cell
def _(mo):
    mo.md(r"""
    # Game Test Notebook

    このノートブックはスキルツリーゲームの e2e テスト用です。
    """)
    return


if __name__ == "__main__":
    app.run()
