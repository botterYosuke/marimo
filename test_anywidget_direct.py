"""
Direct test of anywidget backend sync mechanism.

Run with: python test_anywidget_direct.py
"""

import logging
import time

# Set up logging to see debug messages
logging.basicConfig(level=logging.DEBUG, format='%(name)s - %(levelname)s - %(message)s')

# Import marimo and set up context
import marimo._runtime.context.types as ctx_types

print("=" * 60)
print("Testing anywidget backend sync mechanism")
print("=" * 60)

# Check if anywidget is available
try:
    import anywidget
    import traitlets
    print(f"anywidget version: {anywidget.__version__}")
except ImportError as e:
    print(f"ERROR: anywidget not installed: {e}")
    exit(1)

# Check if ipywidgets is available
try:
    import ipywidgets
    print(f"ipywidgets version: {ipywidgets.__version__}")
except ImportError as e:
    print(f"ERROR: ipywidgets not installed: {e}")
    exit(1)

# Import marimo's anywidget init module
from marimo._plugins.ui._impl.anywidget.init import init_marimo_widget, WIDGET_COMM_MANAGER

print(f"\nWIDGET_COMM_MANAGER.comms: {WIDGET_COMM_MANAGER.comms}")

# Check if on_widget_constructed callback is registered
callbacks = getattr(ipywidgets.Widget, '_widget_construction_callback', None)
print(f"Widget construction callbacks: {callbacks}")

# Create a simple test widget
class TestWidget(anywidget.AnyWidget):
    _esm = """
    function render({ model, el }) {
        el.innerHTML = 'Count: ' + model.get('count');
        model.on('change:count', () => {
            el.innerHTML = 'Count: ' + model.get('count');
        });
    }
    export default { render };
    """
    count = traitlets.Int(0).tag(sync=True)

print("\n--- Creating widget ---")
widget = TestWidget()

print(f"\nWidget created: {widget}")
print(f"Widget._model_id: {getattr(widget, '_model_id', 'NOT SET')}")
print(f"Widget.comm: {getattr(widget, 'comm', 'NOT SET')}")
print(f"Widget.keys (synced traits): {getattr(widget, 'keys', 'NOT SET')}")

# Check if comm was set up
if widget.comm is None:
    print("\nERROR: widget.comm is None - init_marimo_widget was not called!")
    print("This means the IPyWidgetsFormatter.register() callback was not executed.")
    print("\nChecking formatter registration...")

    # Try to manually call init_marimo_widget
    print("\n--- Manually calling init_marimo_widget ---")
    try:
        init_marimo_widget(widget)
        print(f"After manual init - Widget.comm: {widget.comm}")
        print(f"After manual init - Widget._model_id: {getattr(widget, '_model_id', 'NOT SET')}")
    except Exception as e:
        print(f"ERROR calling init_marimo_widget: {e}")
else:
    print(f"\nWidget.comm type: {type(widget.comm)}")
    print(f"Widget.comm.comm_id: {widget.comm.comm_id}")

# Try to update the widget trait
print("\n--- Testing trait update ---")
print(f"Before: widget.count = {widget.count}")
widget.count = 42
print(f"After: widget.count = {widget.count}")

print("\n--- Done ---")
