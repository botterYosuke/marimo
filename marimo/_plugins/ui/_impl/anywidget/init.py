# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    import ipywidgets  # type: ignore

from marimo._dependencies.dependencies import DependencyManager
from marimo._plugins.ui._impl.comm import (  # pyright: ignore[reportMissingTypeStubs]
    BufferType,
    MarimoComm,
    MarimoCommManager,
)


# Initialize ipywidgets using a MarimoComm
def init_marimo_widget(w: ipywidgets.Widget) -> None:
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


WIDGET_COMM_MANAGER = MarimoCommManager()
