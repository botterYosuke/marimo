# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "marimo",
#     "traitlets",
#     "anywidget",
# ]
# [tool.marimo.runtime]
# auto_instantiate = true
# ///

import marimo

__generated_with = "0.19.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import time
    import anywidget
    import traitlets
    return mo, time, anywidget, traitlets


@app.cell
def _(anywidget, traitlets):
    class SimpleWidget(anywidget.AnyWidget):
        """Simple widget that displays a count value."""
        _esm = """
        function render({ model, el }) {
            const div = document.createElement('div');
            div.id = 'anywidget-count-display';
            div.style.fontSize = '24px';
            div.style.padding = '20px';
            div.style.border = '2px solid blue';
            div.innerHTML = 'Count: ' + model.get('count');
            el.appendChild(div);

            model.on('change:count', () => {
                console.log('[ANYWIDGET] count changed to:', model.get('count'));
                div.innerHTML = 'Count: ' + model.get('count');
            });
        }
        export default { render };
        """
        count = traitlets.Int(0).tag(sync=True)
    return (SimpleWidget,)


@app.cell
def _(SimpleWidget, mo):
    # Create the widget
    widget = SimpleWidget()
    widget_ui = mo.ui.anywidget(widget)
    return widget, widget_ui


@app.cell
def _(mo, time, widget):
    # State for tracking update progress
    get_status, set_status = mo.state("Waiting...")
    get_update_count, set_update_count = mo.state(0)

    def update_loop():
        """Background thread that updates widget count."""
        for i in range(1, 11):
            widget.count = i
            set_update_count(i)
            set_status(f"Updated to {i}")
            time.sleep(0.5)
        set_status("Completed!")

    return get_status, set_status, get_update_count, set_update_count, update_loop


@app.cell
def _(mo, update_loop):
    # Button to start the update loop
    start_button = mo.ui.button(
        label="Start Backend Updates",
        on_click=lambda _: mo.Thread(target=update_loop).start()
    )
    return (start_button,)


@app.cell
def _(get_status, get_update_count, mo, start_button, widget_ui):
    mo.vstack([
        mo.md("## AnyWidget Backend Sync Test"),
        mo.md("""
        This test verifies that backend trait changes are synced to the frontend.

        1. Click the button to start backend updates
        2. The count should update from 0 to 10
        3. Updates happen every 0.5 seconds
        """),
        start_button,
        mo.md(f"**Status:** {get_status()}"),
        mo.md(f"**Backend update count:** {get_update_count()}"),
        mo.md("### Widget Output:"),
        widget_ui,
    ])
    return


if __name__ == "__main__":
    app.run()
