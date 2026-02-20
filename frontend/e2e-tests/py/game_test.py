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
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_002", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    from marimo._output.hypertext import Html as _Html
    _Html('<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="!!!invalid!!!" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    return


@app.cell
def _():
    from marimo._output.hypertext import Html as _Html
    _Html('<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="!!!invalid!!!" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_002", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    """)
    return


@app.cell
def _():
    from marimo._output.hypertext import Html as _Html
    _Html('<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="!!!invalid!!!" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    return


@app.cell
def _():
    from marimo._output.hypertext import Html as _Html
    _Html('<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="!!!invalid!!!" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_002", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    from marimo._output.hypertext import Html as _Html
    _Html('<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="!!!invalid!!!" style="display:none;"></marimo-broadcast>')
    return


@app.cell
def _():
    import base64 as _base64, json as _json, time as _time
    from marimo._output.hypertext import Html as _Html
    _ev = {"skill_id": "SANDBOX_001", "context": {}, "timestamp": int(_time.time() * 1000)}
    _b = _base64.b64encode(_json.dumps(_ev).encode()).decode()
    _Html(f'<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="{_b}" style="display:none;"></marimo-broadcast>')
    return


if __name__ == "__main__":
    app.run()
