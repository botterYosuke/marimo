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


@app.cell
def _():
    import sys
    from pathlib import Path
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.buy()
    return (gs,)


@app.cell
def _():
    import sys
    from pathlib import Path
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.chart("7203")
    return (gs,)


@app.cell
def _(gs):
    gs.buy()
    return


@app.cell
def _(gs):
    gs.buy()
    return


@app.cell
def _():
    import sys
    from pathlib import Path
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.chart("7203")
    gs.sell()
    return (gs,)


@app.cell
def _():
    import sys
    from pathlib import Path
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.buy()
    return (gs,)


@app.cell
def _():
    import sys
    from pathlib import Path
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.chart("7203")
    return (gs,)


@app.cell
def _(gs):
    gs.buy()
    return


@app.cell
def _(gs):
    gs.buy()
    return


@app.cell
def _():
    import sys
    from pathlib import Path
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.chart("7203")
    gs.sell()
    return (gs,)


@app.cell
def _():
    import sys
    from pathlib import Path
    # 前テストの bt 状態をクリア（game_setup を再インポートして新しい bt インスタンスを取得）
    for k in list(sys.modules.keys()):
        if k in ('game_setup', 'skill_events'):
            del sys.modules[k]
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.buy()
    return (gs,)


@app.cell
def _():
    import sys
    from pathlib import Path
    # 前テストの bt 状態をクリア（game_setup を再インポートして新しい bt インスタンスを取得）
    for k in list(sys.modules.keys()):
        if k in ('game_setup', 'skill_events'):
            del sys.modules[k]
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.chart("7203")
    return (gs,)


@app.cell
def _(gs):
    gs.buy()
    return


@app.cell
def _(gs):
    gs.buy()
    return


@app.cell
def _():
    import sys
    from pathlib import Path
    # 前テストの bt 状態をクリア（game_setup を再インポートして新しい bt インスタンスを取得）
    for k in list(sys.modules.keys()):
        if k in ('game_setup', 'skill_events'):
            del sys.modules[k]
    # src-tauri/sample-notebooks をパスに追加
    sample_notebooks_dir = Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    sys.path.insert(0, str(sample_notebooks_dir))
    import game_setup as gs
    gs.chart("7203")
    gs.sell()
    return (gs,)


@app.cell
def _():
    import sys as _sys
    from pathlib import Path as _Path
    # 前テストの bt 状態をクリア（game_setup を再インポートして新しい bt インスタンスを取得）
    for _k in list(_sys.modules.keys()):
        if _k in ('game_setup', 'skill_events'):
            del _sys.modules[_k]
    # src-tauri/sample-notebooks をパスに追加
    _sample_notebooks_dir = _Path(__file__).resolve().parents[3] / "src-tauri" / "sample-notebooks"
    _sys.path.insert(0, str(_sample_notebooks_dir))
    import game_setup as _gs
    _gs.buy()
    return


if __name__ == "__main__":
    app.run()
