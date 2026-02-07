# -*- coding: utf-8 -*-
"""
gamification テスト用フィクスチャ

frontend/public/files/ の game_setup.py / skill_events.py をテストするため
BackcastPro, anywidget, headless_broadcast 等の外部依存をモックする。
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch

import pytest

# ------------------------------------------------------------------
# 1. 外部依存のモジュールモック（インポート前に設定する必要がある）
# ------------------------------------------------------------------
_MOCK_MODULES = [
    "BackcastPro",
    "anywidget",
    "traitlets",
    "headless_broadcast",
]

_original_modules: dict[str, ModuleType | None] = {}

for _mod_name in _MOCK_MODULES:
    _original_modules[_mod_name] = sys.modules.get(_mod_name)
    mock_mod = MagicMock()
    if _mod_name == "BackcastPro":
        # Backtest クラスのインスタンスを返すようにする
        mock_mod.Backtest.return_value = MagicMock()
        mock_mod.get_stock_daily.return_value = MagicMock()
    sys.modules[_mod_name] = mock_mod

# ------------------------------------------------------------------
# 2. frontend/public/files をパスに追加
# ------------------------------------------------------------------
FILES_DIR = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend"
    / "public"
    / "files"
)
if str(FILES_DIR) not in sys.path:
    sys.path.insert(0, str(FILES_DIR))

# ------------------------------------------------------------------
# 3. モジュールインポート（モック設定後）
# ------------------------------------------------------------------
import skill_events  # noqa: E402


# ------------------------------------------------------------------
# フィクスチャ
# ------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_triggered_skills():
    """各テスト前に _triggered_skills をクリアする"""
    skill_events._triggered_skills.clear()
    yield
    skill_events._triggered_skills.clear()


@pytest.fixture()
def mock_mo_output():
    """marimo.output.append と Html をモック"""
    with (
        patch("skill_events.mo.output.append") as mock_append,
        patch("skill_events.Html") as mock_html,
    ):
        yield {"append": mock_append, "Html": mock_html}


@pytest.fixture()
def mock_game_deps():
    """game_setup.py の外部依存をすべてモック

    Returns:
        dict: 主要モックへの参照
    """
    import game_setup

    mock_bt = MagicMock()
    mock_bt._data = {}
    mock_bt.trades = []
    mock_bt.closed_trades = []

    with (
        patch.object(game_setup, "bt", mock_bt),
        patch.object(game_setup, "update_all_backtest_charts"),
        patch.object(game_setup, "publish_state_headless"),
        patch.object(game_setup, "backtest_chart"),
        patch("skill_events.mo.output.append"),
        patch("skill_events.Html"),
        patch("game_setup.mo.output.append"),
        patch("game_setup.mo.callout", return_value="callout"),
        patch("game_setup.mo.md", return_value="md"),
    ):
        yield {
            "bt": mock_bt,
            "game_setup": game_setup,
        }


def make_trade(pl: float = 0, code: str = "7203") -> MagicMock:
    """pl 属性付きのモックトレードを生成"""
    trade = MagicMock()
    trade.pl = pl
    trade.code = code
    trade.entry_price = 1000
    trade.size = 100
    return trade
