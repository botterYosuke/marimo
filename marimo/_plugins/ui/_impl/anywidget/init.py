# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    import ipywidgets  # type: ignore

from marimo import _loggers
from marimo._dependencies.dependencies import DependencyManager
from marimo._plugins.ui._impl.comm import (  # pyright: ignore[reportMissingTypeStubs]
    BufferType,
    MarimoComm,
    MarimoCommManager,
)

LOGGER = _loggers.marimo_logger()


# Initialize ipywidgets using a MarimoComm
def init_marimo_widget(w: ipywidgets.Widget) -> None:
    LOGGER.debug("[ANYWIDGET] init_marimo_widget called for %s", type(w).__name__)
    DependencyManager.ipywidgets.require("for anywidget support.")
    import ipywidgets  # type: ignore

    __protocol_version__ = ipywidgets._version.__protocol_version__
    from marimo._plugins.ui._impl.anywidget.utils import extract_buffer_paths

    # Get the initial state of the widget
    state, buffer_paths, buffers = extract_buffer_paths(w.get_state())

    # Use js_hash as model_id so it's stable across re-executions and matches
    # the frontend's jsHash. This allows the frontend to look up the model
    # in MODEL_MANAGER using the same key via the global callback mechanism.
    #
    # Note: This means multiple instances of the same widget type share
    # the same model_id. The frontend handles this via the global callback
    # which syncs data from MODEL_MANAGER to each local React model.
    if getattr(w, "_model_id", None) is None:
        # Compute js_hash from _esm (same as from_anywidget.py)
        js: str = w._esm if hasattr(w, "_esm") else ""  # type: ignore
        if js:
            w._model_id = hashlib.md5(
                js.encode("utf-8"), usedforsecurity=False
            ).hexdigest()
        else:
            # Fallback for widgets without _esm
            from uuid import uuid4

            w._model_id = uuid4().hex

    # Initialize the comm - sends initial state to frontend
    w.comm = MarimoComm(
        comm_id=w._model_id,  # pyright: ignore
        comm_manager=WIDGET_COMM_MANAGER,
        target_name="jupyter.widgets",
        data={"state": state, "buffer_paths": buffer_paths, "method": "open"},
        buffers=cast(BufferType, buffers),
        # TODO: should this be hard-coded?
        metadata={"version": __protocol_version__},
        # html_deps=session._process_ui(TagList(widget_dep))["deps"],
    )

    # Register ipywidgets' message handler so it can process incoming messages
    # with proper buffer handling via _put_buffers and serializer support
    w.comm.on_msg(w._handle_msg)

    # Add trait change observer for Python→Frontend sync
    # ipywidgets' built-in notify_change() may not fire reliably since
    # init_marimo_widget is called before Widget.open() completes
    def on_trait_change(change: dict[str, Any]) -> None:
        """Send trait updates to frontend when Python-side traits change."""
        if w.comm is None:
            LOGGER.warning(
                "[ANYWIDGET] on_trait_change: comm is None for %s, "
                "init_marimo_widget may not have been called",
                type(w).__name__
            )
            return

        name = change["name"]

        # Get synced trait names
        # In ipywidgets, `keys` is a List trait (not a method)
        synced_keys = getattr(w, "keys", None)
        if synced_keys is None:
            return
        if name not in synced_keys:
            return

        # Echo loop prevention:
        # When the frontend sends a trait change to Python, ipywidgets sets
        # _property_lock[name] = value during the update. We check this to
        # avoid sending the change back to the frontend (echo).
        #
        # NOTE: We only use _property_lock for echo prevention, not
        # _should_send_property(). The _should_send_property() method relies
        # on ipywidgets' internal state tracking which can become out-of-sync
        # with marimo's custom MarimoComm implementation. Using _property_lock
        # directly is simpler and more reliable.
        property_lock = getattr(w, "_property_lock", {})
        if name in property_lock:
            return

        # Get the changed state and send to frontend
        try:
            changed_state = w.get_state(key=name)
        except Exception as e:
            LOGGER.debug("get_state failed for key=%s: %s", name, e)
            return

        if not changed_state:
            return

        state_no_buffers, buf_paths, bufs = extract_buffer_paths(changed_state)
        msg = {
            "method": "update",
            "state": state_no_buffers,
            "buffer_paths": buf_paths,
        }
        w.comm.send(data=msg, buffers=cast(BufferType, bufs))

    # Register the observer for all synced traits
    synced_keys = getattr(w, "keys", None)
    if synced_keys:
        w.observe(on_trait_change, names=list(synced_keys))


WIDGET_COMM_MANAGER = MarimoCommManager()
