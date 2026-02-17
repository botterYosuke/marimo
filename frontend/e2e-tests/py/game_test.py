import marimo

__generated_with = "0.1.0"
app = marimo.App(width="medium", app_title="Game Test")


@app.cell
def __():
    import marimo as mo
    return (mo,)


@app.cell
def __(mo):
    mo.md(
        r"""
        # Game Test Notebook

        このノートブックはスキルツリーゲームの e2e テスト用です。
        """
    )
    return ()


if __name__ == "__main__":
    app.run()
