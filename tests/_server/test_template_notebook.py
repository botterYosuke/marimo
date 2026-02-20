# Copyright 2026 Marimo. All rights reserved.
"""Regression tests for unnamed notebook with template feature.

Tests the changes where:
1. AppFileManager accepts a `template` parameter to load content from a
   template file while keeping filename=None (unnamed).
2. LazyListOfFilesAppFileRouter.get_file_manager() auto-discovers
   backcast.py as a template for __new__ keys.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from marimo._server.file_router import (
    AppFileRouter,
    LazyListOfFilesAppFileRouter,
)
from marimo._session.notebook import AppFileManager

TEMPLATE_CONTENT = """\
import marimo
__generated_with = "0.0.1"
app = marimo.App()

@app.cell
def __():
    import game_setup as bt
    return (bt,)

@app.cell
def __(bt):
    bt.setup()
    return

if __name__ == "__main__":
    app.run()
"""

MINIMAL_NOTEBOOK = """\
import marimo
__generated_with = "0.0.1"
app = marimo.App()

@app.cell
def __():
    return

if __name__ == "__main__":
    app.run()
"""


# ─── AppFileManager with template ───────────────────────────────────────


class TestAppFileManagerTemplate:
    """Tests for AppFileManager template loading behaviour."""

    def test_template_loads_content_but_stays_unnamed(
        self, tmp_path: Path
    ) -> None:
        """Template content is loaded but filename remains None."""
        template = tmp_path / "backcast.py"
        template.write_text(TEMPLATE_CONTENT)

        mgr = AppFileManager(None, template=str(template))

        # Must be unnamed
        assert mgr.filename is None
        assert not mgr.is_notebook_named

        # But cells must contain the template code
        code = mgr.to_code()
        assert "import game_setup as bt" in code

    def test_template_clears_internal_app_filename(
        self, tmp_path: Path
    ) -> None:
        """After loading from template, app._filename must be None."""
        template = tmp_path / "backcast.py"
        template.write_text(TEMPLATE_CONTENT)

        mgr = AppFileManager(None, template=str(template))

        assert mgr.app._app._filename is None

    def test_no_template_creates_empty_notebook(self) -> None:
        """Without template, unnamed manager creates an empty notebook."""
        mgr = AppFileManager(None)

        assert mgr.filename is None
        assert not mgr.is_notebook_named
        # Empty notebook still has at least one cell
        assert len(mgr.app.cell_manager.cell_data()) >= 1

    def test_template_ignored_when_filename_is_set(
        self, tmp_path: Path
    ) -> None:
        """If filename is provided, template is ignored — actual file is used."""
        actual_file = tmp_path / "my_notebook.py"
        actual_file.write_text(MINIMAL_NOTEBOOK)

        template = tmp_path / "backcast.py"
        template.write_text(TEMPLATE_CONTENT)

        mgr = AppFileManager(str(actual_file), template=str(template))

        assert mgr.filename == str(actual_file)
        assert mgr.is_notebook_named
        code = mgr.to_code()
        # Should contain the actual file content, NOT the template
        assert "import game_setup" not in code

    def test_nonexistent_template_falls_back_to_empty(
        self, tmp_path: Path
    ) -> None:
        """If template path doesn't exist, create empty notebook as normal."""
        mgr = AppFileManager(
            None, template=str(tmp_path / "nonexistent.py")
        )

        assert mgr.filename is None
        assert not mgr.is_notebook_named
        # Should create empty notebook, not crash
        assert len(mgr.app.cell_manager.cell_data()) >= 1

    def test_template_notebook_can_be_saved_with_new_name(
        self, tmp_path: Path
    ) -> None:
        """A template-loaded unnamed notebook can be renamed and saved."""
        template = tmp_path / "backcast.py"
        template.write_text(TEMPLATE_CONTENT)

        mgr = AppFileManager(None, template=str(template))
        assert mgr.filename is None

        # Rename to give it a real filename
        new_file = tmp_path / "my_game.py"
        mgr.rename(str(new_file))

        assert mgr.filename == str(new_file)
        assert mgr.is_notebook_named
        assert new_file.exists()

        # Content should be preserved
        saved_content = new_file.read_text()
        assert "import game_setup as bt" in saved_content

    def test_template_none_param_is_same_as_no_template(self) -> None:
        """Passing template=None is identical to not passing it."""
        mgr1 = AppFileManager(None)
        mgr2 = AppFileManager(None, template=None)

        assert mgr1.filename == mgr2.filename
        assert mgr1.is_notebook_named == mgr2.is_notebook_named

    def test_no_progress_json_for_unnamed_template_notebook(
        self, tmp_path: Path
    ) -> None:
        """Unnamed notebook from template must not create progress.json."""
        template = tmp_path / "backcast.py"
        template.write_text(TEMPLATE_CONTENT)

        mgr = AppFileManager(None, template=str(template))
        assert mgr.filename is None

        # No .progress.json files should exist in the directory
        progress_files = list(tmp_path.glob("*.progress.json"))
        assert len(progress_files) == 0


# ─── LazyListOfFilesAppFileRouter template discovery ────────────────────


class TestLazyRouterTemplateDiscovery:
    """Tests for LazyListOfFilesAppFileRouter auto-discovering backcast.py."""

    def test_new_file_key_discovers_backcast_template(
        self, tmp_path: Path
    ) -> None:
        """__new__ key should discover backcast.py and load its content."""
        # Create backcast.py in the directory
        backcast = tmp_path / "backcast.py"
        backcast.write_text(TEMPLATE_CONTENT)

        router = AppFileRouter.from_directory(str(tmp_path))
        assert isinstance(router, LazyListOfFilesAppFileRouter)

        mgr = router.get_file_manager(AppFileRouter.NEW_FILE)

        # Must be unnamed
        assert mgr.filename is None
        assert not mgr.is_notebook_named

        # Must contain template content
        code = mgr.to_code()
        assert "import game_setup as bt" in code

    def test_new_file_key_without_backcast_gives_empty(
        self, tmp_path: Path
    ) -> None:
        """__new__ key without backcast.py should create empty notebook."""
        # Create a regular notebook file so directory is non-empty
        other = tmp_path / "other.py"
        other.write_text(MINIMAL_NOTEBOOK)

        router = AppFileRouter.from_directory(str(tmp_path))
        mgr = router.get_file_manager(AppFileRouter.NEW_FILE)

        assert mgr.filename is None
        assert not mgr.is_notebook_named
        # Should be empty — no template to load
        code = mgr.to_code()
        assert "import game_setup" not in code

    def test_new_file_with_session_suffix_discovers_template(
        self, tmp_path: Path
    ) -> None:
        """__new__<session_id> key should also discover the template."""
        backcast = tmp_path / "backcast.py"
        backcast.write_text(TEMPLATE_CONTENT)

        router = AppFileRouter.from_directory(str(tmp_path))
        # Frontend sends keys like "__new__abc123"
        mgr = router.get_file_manager("__new__session_abc123")

        assert mgr.filename is None
        code = mgr.to_code()
        assert "import game_setup as bt" in code

    def test_regular_file_key_ignores_template(
        self, tmp_path: Path
    ) -> None:
        """A regular file key should load the actual file, not template."""
        backcast = tmp_path / "backcast.py"
        backcast.write_text(TEMPLATE_CONTENT)

        regular = tmp_path / "regular.py"
        regular.write_text(MINIMAL_NOTEBOOK)

        router = AppFileRouter.from_directory(str(tmp_path))
        mgr = router.get_file_manager("regular.py")

        assert mgr.filename is not None
        assert mgr.is_notebook_named
        code = mgr.to_code()
        assert "import game_setup" not in code

    def test_multiple_new_notebooks_are_independent(
        self, tmp_path: Path
    ) -> None:
        """Multiple __new__ notebooks from the same router are independent."""
        backcast = tmp_path / "backcast.py"
        backcast.write_text(TEMPLATE_CONTENT)

        router = AppFileRouter.from_directory(str(tmp_path))

        mgr1 = router.get_file_manager("__new__session1")
        mgr2 = router.get_file_manager("__new__session2")

        # Both unnamed with template content
        assert mgr1.filename is None
        assert mgr2.filename is None
        assert "import game_setup as bt" in mgr1.to_code()
        assert "import game_setup as bt" in mgr2.to_code()

        # But they must be separate instances
        assert mgr1 is not mgr2
        assert mgr1.app is not mgr2.app

    def test_new_file_does_not_create_physical_file(
        self, tmp_path: Path
    ) -> None:
        """Opening a new notebook must NOT create any .py file in directory."""
        backcast = tmp_path / "backcast.py"
        backcast.write_text(TEMPLATE_CONTENT)

        files_before = set(tmp_path.iterdir())

        router = AppFileRouter.from_directory(str(tmp_path))
        mgr = router.get_file_manager("__new__test123")

        files_after = set(tmp_path.iterdir())

        # No new files should have been created
        assert files_before == files_after

    def test_menu_style_new_key_discovers_template(
        self, tmp_path: Path
    ) -> None:
        """__new__menu_<timestamp> key (from Tauri menu) should work."""
        backcast = tmp_path / "backcast.py"
        backcast.write_text(TEMPLATE_CONTENT)

        router = AppFileRouter.from_directory(str(tmp_path))
        # Simulates the Tauri menu handler format
        mgr = router.get_file_manager("__new__menu_1708444800000")

        assert mgr.filename is None
        code = mgr.to_code()
        assert "import game_setup as bt" in code
