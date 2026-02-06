# -*- coding: utf-8 -*-
"""
スキルトリガーのユニットテスト

Sandbox / Bridge / Fail 系スキルが正しく発火するか検証する。
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

import skill_events
from skill_events import (
    _check_graduations,
    emit_skill,
    get_triggered_skills,
    sync_triggered_skills,
)


def make_trade(pl: float = 0, code: str = "7203") -> MagicMock:
    """pl 属性付きのモックトレードを生成"""
    trade = MagicMock()
    trade.pl = pl
    trade.code = code
    trade.entry_price = 1000
    trade.size = 100
    return trade


# ============================================================
# skill_events.py のテスト
# ============================================================


class TestEmitSkill:
    """emit_skill() の基本動作"""

    def test_adds_skill_to_triggered(self, mock_mo_output) -> None:
        emit_skill("SANDBOX_001")
        assert "SANDBOX_001" in get_triggered_skills()

    def test_ignores_duplicate(self, mock_mo_output) -> None:
        emit_skill("SANDBOX_001")
        call_count_before = mock_mo_output["append"].call_count
        emit_skill("SANDBOX_001")
        # 2回目の append は呼ばれない
        assert mock_mo_output["append"].call_count == call_count_before

    def test_emits_broadcast_html(self, mock_mo_output) -> None:
        emit_skill("SANDBOX_002")
        mock_mo_output["append"].assert_called()

    def test_multiple_skills_accumulate(self, mock_mo_output) -> None:
        emit_skill("SANDBOX_001")
        emit_skill("SANDBOX_002")
        s = get_triggered_skills()
        assert "SANDBOX_001" in s
        assert "SANDBOX_002" in s


class TestCheckGraduations:
    """_check_graduations() の卒業チェック"""

    def test_sandbox_graduation(self, mock_mo_output) -> None:
        """SANDBOX_001-005 全完了で SANDBOX_006 が自動発火"""
        for i in range(1, 6):
            skill_events._triggered_skills.add(f"SANDBOX_{i:03d}")
        _check_graduations()
        assert "SANDBOX_006" in get_triggered_skills()

    def test_sandbox_no_graduation_incomplete(self, mock_mo_output) -> None:
        """SANDBOX_001-004 のみでは 006 不発"""
        for i in range(1, 5):
            skill_events._triggered_skills.add(f"SANDBOX_{i:03d}")
        _check_graduations()
        assert "SANDBOX_006" not in get_triggered_skills()

    def test_bridge_graduation(self, mock_mo_output) -> None:
        """BRIDGE_002 完了で BRIDGE_003 が自動発火"""
        skill_events._triggered_skills.add("BRIDGE_002")
        _check_graduations()
        assert "BRIDGE_003" in get_triggered_skills()

    def test_bridge_no_graduation_without_002(self, mock_mo_output) -> None:
        """BRIDGE_001 のみでは BRIDGE_003 不発"""
        skill_events._triggered_skills.add("BRIDGE_001")
        _check_graduations()
        assert "BRIDGE_003" not in get_triggered_skills()


class TestSyncTriggeredSkills:
    """sync_triggered_skills() のテスト"""

    def test_restores_skills(self) -> None:
        sync_triggered_skills(["SANDBOX_001", "SANDBOX_002"])
        s = get_triggered_skills()
        assert "SANDBOX_001" in s
        assert "SANDBOX_002" in s

    def test_merges_with_existing(self) -> None:
        skill_events._triggered_skills.add("BRIDGE_001")
        sync_triggered_skills(["SANDBOX_001"])
        s = get_triggered_skills()
        assert "BRIDGE_001" in s
        assert "SANDBOX_001" in s


# ============================================================
# game_setup.py テスト — サンドボックス
# ============================================================


class TestSandboxSkills:
    """Sandbox スキルトリガー"""

    def test_buy_triggers_sandbox_002(self, mock_game_deps) -> None:
        """buy() → SANDBOX_002"""
        gs = mock_game_deps["game_setup"]
        gs.buy()
        assert "SANDBOX_002" in get_triggered_skills()

    def test_buy_returns_order(self, mock_game_deps) -> None:
        """buy() が Order オブジェクトを返す"""
        gs = mock_game_deps["game_setup"]
        result = gs.buy()
        assert result is not None

    def test_trades_triggers_sandbox_003(self, mock_game_deps) -> None:
        """trades() → SANDBOX_003（SANDBOX_002 済み + trades 非空）"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        skill_events._triggered_skills.add("SANDBOX_002")
        bt.trades = [make_trade(pl=100)]

        gs.trades()
        assert "SANDBOX_003" in get_triggered_skills()

    def test_trades_no_trigger_without_002(self, mock_game_deps) -> None:
        """trades() → SANDBOX_002 未達なら SANDBOX_003 不発"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        bt.trades = [make_trade(pl=100)]

        gs.trades()
        assert "SANDBOX_003" not in get_triggered_skills()

    def test_trades_no_trigger_empty_trades(self, mock_game_deps) -> None:
        """trades() → trades 空なら SANDBOX_003 不発"""
        gs = mock_game_deps["game_setup"]

        skill_events._triggered_skills.add("SANDBOX_002")
        # bt.trades はデフォルトで空リスト

        gs.trades()
        assert "SANDBOX_003" not in get_triggered_skills()

    def test_sell_triggers_sandbox_004(self, mock_game_deps) -> None:
        """sell() → SANDBOX_004"""
        gs = mock_game_deps["game_setup"]
        gs.sell()
        assert "SANDBOX_004" in get_triggered_skills()

    def test_chart_triggers_sandbox_005(self, mock_game_deps) -> None:
        """chart() → SANDBOX_005（SANDBOX_003 + 004 済み）"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        skill_events._triggered_skills.add("SANDBOX_003")
        skill_events._triggered_skills.add("SANDBOX_004")

        # _get_stock_daily のモック（chart 内で呼ばれる）
        from unittest.mock import MagicMock, patch

        mock_df = MagicMock()
        with patch.object(gs, "_get_stock_daily", return_value=mock_df):
            gs.chart("7203")

        assert "SANDBOX_005" in get_triggered_skills()

    def test_chart_no_trigger_without_003_004(self, mock_game_deps) -> None:
        """chart() → SANDBOX_003/004 未達なら SANDBOX_005 不発"""
        gs = mock_game_deps["game_setup"]

        from unittest.mock import MagicMock, patch

        mock_df = MagicMock()
        with patch.object(gs, "_get_stock_daily", return_value=mock_df):
            gs.chart("7203")

        assert "SANDBOX_005" not in get_triggered_skills()

    def test_sandbox_graduation_cascade(self, mock_game_deps) -> None:
        """SANDBOX_001-004 事前完了 + emit_skill("SANDBOX_005") → 006 自動"""
        # 001-004 を事前に完了（emit_skill 経由でないので卒業は発火しない）
        for i in range(1, 5):
            skill_events._triggered_skills.add(f"SANDBOX_{i:03d}")

        # 005 を emit_skill で発火 → _check_graduations で 006 も発火
        emit_skill("SANDBOX_005")
        assert "SANDBOX_005" in get_triggered_skills()
        assert "SANDBOX_006" in get_triggered_skills()


# ============================================================
# game_setup.py テスト — ブリッジ
# ============================================================


class TestBridgeSkills:
    """Bridge スキルトリガー"""

    def test_reveal_data_triggers_bridge_001(self, mock_game_deps) -> None:
        """reveal_data() → BRIDGE_001（bt._data 非空）"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        mock_df = make_trade()  # ダミーデータ
        mock_df.index = [0, 1, 2]
        bt._data = {"7203": mock_df}

        gs.reveal_data()
        assert "BRIDGE_001" in get_triggered_skills()

    def test_reveal_data_no_trigger_empty_data(self, mock_game_deps) -> None:
        """reveal_data() → bt._data 空なら不発 + ガイダンス表示"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        bt._data = {}

        result = gs.reveal_data()
        assert result is None
        assert "BRIDGE_001" not in get_triggered_skills()

    def test_get_stock_daily_triggers_bridge_002(
        self, mock_game_deps
    ) -> None:
        """get_stock_daily() → BRIDGE_002"""
        gs = mock_game_deps["game_setup"]

        from unittest.mock import MagicMock, patch

        mock_df = MagicMock()
        with patch.object(gs, "_get_stock_daily", return_value=mock_df):
            result = gs.get_stock_daily("6758")

        assert "BRIDGE_002" in get_triggered_skills()
        assert result is mock_df

    def test_bridge_graduation_cascade(self, mock_game_deps) -> None:
        """BRIDGE_002 発火 → BRIDGE_003 自動発火"""
        gs = mock_game_deps["game_setup"]

        from unittest.mock import MagicMock, patch

        mock_df = MagicMock()
        with patch.object(gs, "_get_stock_daily", return_value=mock_df):
            gs.get_stock_daily("6758")

        assert "BRIDGE_002" in get_triggered_skills()
        assert "BRIDGE_003" in get_triggered_skills()


# ============================================================
# game_setup.py テスト — FAIL
# ============================================================


class TestFailSkills:
    """Fail スキルトリガー"""

    def test_trades_triggers_fail_001(self, mock_game_deps) -> None:
        """trades() → FAIL_001（SANDBOX_002 済み + trade.pl < 0）"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        skill_events._triggered_skills.add("SANDBOX_002")
        bt.trades = [make_trade(pl=-5000)]

        gs.trades()
        assert "FAIL_001" in get_triggered_skills()

    def test_step_triggers_fail_001(self, mock_game_deps) -> None:
        """step() → FAIL_001（_check_unrealized_loss 経由）"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        skill_events._triggered_skills.add("SANDBOX_002")
        bt.trades = [make_trade(pl=-3000)]

        gs.step()
        assert "FAIL_001" in get_triggered_skills()

    def test_fail_001_no_trigger_without_002(self, mock_game_deps) -> None:
        """SANDBOX_002 未達 → FAIL_001 不発"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        bt.trades = [make_trade(pl=-5000)]

        gs.trades()
        assert "FAIL_001" not in get_triggered_skills()

    def test_fail_001_no_trigger_positive_pl(self, mock_game_deps) -> None:
        """pl >= 0 → FAIL_001 不発"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        skill_events._triggered_skills.add("SANDBOX_002")
        bt.trades = [make_trade(pl=1000)]

        gs.trades()
        assert "FAIL_001" not in get_triggered_skills()

    def test_sell_triggers_fail_002(self, mock_game_deps) -> None:
        """sell() → FAIL_002（closed_trades に pl < 0）"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        bt.closed_trades = [make_trade(pl=-2000)]

        gs.sell()
        assert "FAIL_002" in get_triggered_skills()

    def test_fail_002_no_trigger_positive_close(
        self, mock_game_deps
    ) -> None:
        """利益確定 → FAIL_002 不発"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        bt.closed_trades = [make_trade(pl=5000)]

        gs.sell()
        assert "FAIL_002" not in get_triggered_skills()

    def test_step_triggers_fail_003(self, mock_game_deps) -> None:
        """step() が例外 → FAIL_003"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        bt.step.side_effect = RuntimeError("破産しました")

        with pytest.raises(RuntimeError, match="破産しました"):
            gs.step()

        assert "FAIL_003" in get_triggered_skills()

    def test_fail_003_reraises_exception(self, mock_game_deps) -> None:
        """FAIL_003 発火後に例外が再送出される"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        bt.step.side_effect = Exception("equity <= 0")

        with pytest.raises(Exception, match="equity <= 0"):
            gs.step()

    def test_fail_001_no_trigger_trade_without_pl(
        self, mock_game_deps
    ) -> None:
        """hasattr(t, 'pl') が False の場合 → FAIL_001 不発"""
        bt = mock_game_deps["bt"]
        gs = mock_game_deps["game_setup"]

        skill_events._triggered_skills.add("SANDBOX_002")

        # pl 属性なしのトレード
        from unittest.mock import MagicMock

        trade_no_pl = MagicMock(spec=[])
        bt.trades = [trade_no_pl]

        gs.trades()
        assert "FAIL_001" not in get_triggered_skills()
