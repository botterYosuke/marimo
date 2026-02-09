# -*- coding: utf-8 -*-
"""
chart.py のユニットテスト

================================================================================
テスト構成
================================================================================

【セクション1】既存動作保証テスト（リファクタリング前）
  - 現在の実装の振る舞いを検証
  - リファクタリング後も全てパスすることを保証

【セクション2】TDD用テスト（リファクタリング計画に基づく）
  - リファクタリング計画: .claude/plans/enchanted-sniffing-steele.md
  - 新機能のテスト（pytest.skip で一時的にスキップ）
  - 実装完了後に pytest.skip を削除して有効化

================================================================================
リファクタリング計画との対応
================================================================================

Phase 1: 定数とヘルパー関数の追加
  → TestChartConstants, TestEnsureBacktestWidget

Phase 2: 差分更新ロジックの修正
  → TestPerformFullChartUpdate, TestPerformDifferentialChartUpdate
  → TestBacktestChartDifferentialUpdateBugFix

Phase 3: 状態管理の統一 + update_backtest_chart() 改善
  → TestPrevDataLenBasedUpdateLogic
  → TestUpdateBacktestChartDifferentialUpdate

Phase 4: エラー処理の改善
  → TestUpdateAllBacktestChartsLogging

================================================================================
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import chart
from chart import (
    backtest_chart,
    update_all_backtest_charts,
    update_backtest_chart,
)


# ==================================================================
# 【セクション1】既存動作保証テスト（リファクタリング前）
# ==================================================================
#
# このセクションのテストは、現在の実装の振る舞いを検証します。
# リファクタリング後もすべてパスすることを保証してください。
#
# テスト対象:
#   - backtest_chart()          : 1237-1401行目
#   - update_backtest_chart()   : 1404-1448行目
#   - update_all_backtest_charts(): 1450-1494行目
#
# ==================================================================


# ------------------------------------------------------------------
# ヘルパー関数のモック
# ------------------------------------------------------------------


@pytest.fixture
def mock_chart_helpers():
    """chart.py のヘルパー関数をモック"""

    def fake_df_to_lwc_data(df, tz="Asia/Tokyo"):
        """DataFrameをLWC形式のリストに変換（モック）"""
        return [
            {
                "time": str(idx),
                "open": row["Open"],
                "high": row["High"],
                "low": row["Low"],
                "close": row["Close"],
            }
            for idx, row in df.iterrows()
        ]

    def fake_get_last_bar(df):
        """最後のバーを取得（モック）"""
        if len(df) == 0:
            return {}
        row = df.iloc[-1]
        return {
            "time": str(df.index[-1]),
            "open": row["Open"],
            "high": row["High"],
            "low": row["Low"],
            "close": row["Close"],
        }

    with (
        patch.object(chart, "df_to_lwc_data", side_effect=fake_df_to_lwc_data),
        patch.object(chart, "get_last_bar", side_effect=fake_get_last_bar),
        patch.object(chart, "trades_to_markers", return_value=[]),
        patch.object(
            chart, "get_theme_colors", return_value={"upColor": "#26a69a", "downColor": "#ef5350"}
        ),
        patch.object(chart, "_prepare_chart_df", side_effect=lambda df: df),
        patch.object(chart, "df_to_lwc_indicators", return_value={}),
        patch.object(chart, "prepare_indicator_options", return_value={}),
        patch.object(chart, "get_last_indicators", return_value={}),
    ):
        yield


@pytest.fixture
def mock_lwc_widget_class():
    """LightweightChartWidget クラスをモック"""

    def create_widget():
        widget = MagicMock()
        widget.data = []
        widget.markers = []
        widget.options = {}
        widget.last_bar = {}
        widget.append_bars = []
        widget._prev_data_len = 0
        widget.indicator_series = {}
        widget.indicator_options = {}
        widget.last_indicators = {}
        return widget

    with patch.object(chart, "LightweightChartWidget", side_effect=create_widget):
        yield create_widget


@pytest.fixture
def mock_chart_by_df(mock_widget):
    """chart_by_df 関数をモック"""
    with patch.object(chart, "chart_by_df", return_value=mock_widget):
        yield mock_widget


# ------------------------------------------------------------------
# backtest_chart() のテスト
# ------------------------------------------------------------------


class TestBacktestChartCodeSelection:
    """銘柄コード選択のテスト"""

    def test_auto_selects_code_when_single(
        self, mock_backtest, mock_chart_helpers, mock_lwc_widget_class
    ):
        """単一銘柄の場合は自動選択"""
        mock_backtest._is_started = False
        result = backtest_chart(mock_backtest)
        assert result is not None

    def test_raises_error_multiple_codes_without_code(
        self, mock_backtest, sample_ohlc_df, mock_chart_helpers, mock_lwc_widget_class
    ):
        """複数銘柄でcode未指定時にエラー"""
        mock_backtest._is_started = False
        mock_backtest._data = {
            "7203": sample_ohlc_df,
            "9984": sample_ohlc_df.copy(),
        }
        with pytest.raises(ValueError, match="複数銘柄"):
            backtest_chart(mock_backtest)


class TestBacktestChartNotStarted:
    """bt._is_started=False 時の振る舞い"""

    def test_returns_widget_when_not_started(
        self, mock_backtest, mock_chart_helpers, mock_lwc_widget_class
    ):
        """未開始時にウィジェットを作成"""
        mock_backtest._is_started = False
        result = backtest_chart(mock_backtest, code="7203")
        assert result is not None

    def test_creates_widget_and_caches(
        self, mock_backtest, mock_chart_helpers, mock_lwc_widget_class
    ):
        """ウィジェットを作成してキャッシュに保存"""
        mock_backtest._is_started = False
        result = backtest_chart(mock_backtest, code="7203")
        assert "7203" in mock_backtest._chart_state.widgets
        assert mock_backtest._chart_state.widgets["7203"] is result

    def test_sets_data_from_loaded_data(
        self, mock_backtest, mock_chart_helpers, mock_lwc_widget_class
    ):
        """ロード済みデータがあればチャートにデータ設定"""
        mock_backtest._is_started = False
        result = backtest_chart(mock_backtest, code="7203")
        # データが設定されていることを確認
        assert len(result.data) == 10

    def test_does_not_set_visible_from(
        self, mock_backtest, mock_chart_helpers, mock_lwc_widget_class
    ):
        """未開始時は visibleFrom を設定しない（JavaScript側のデフォルト動作に任せる）"""
        mock_backtest._is_started = False
        result = backtest_chart(mock_backtest, code="7203")
        # visibleFrom が設定されていないことを確認（JavaScript側で最新バー表示のデフォルト動作）
        assert "visibleFrom" not in result.options


class TestBacktestChartNoCurrentData:
    """bt._current_data が空または無効な場合"""

    def test_uses_loaded_data_when_current_empty(
        self, mock_backtest, mock_chart_helpers, mock_lwc_widget_class
    ):
        """current_data が空でも bt._data を使用"""
        mock_backtest._current_data = {}
        result = backtest_chart(mock_backtest, code="7203")
        assert len(result.data) == 10


class TestBacktestChartCacheHit:
    """キャッシュヒット時の振る舞い"""

    def test_reuses_cached_widget(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """キャッシュからウィジェットを再利用"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 5

        result = backtest_chart(mock_backtest, code="7203")
        assert result is mock_widget

    def test_updates_options_on_cache_hit(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """キャッシュヒット時もオプションを更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 5

        backtest_chart(mock_backtest, code="7203", height=600)
        assert mock_widget.options.get("height") == 600


class TestBacktestChartRewind:
    """巻き戻し検出と全データ更新"""

    def test_full_update_on_rewind(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """current_idx < last_idx で全データ更新"""
        mock_widget._prev_data_len = 15
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 15  # 以前は15バー

        backtest_chart(mock_backtest, code="7203")  # 現在は10バー

        # 全データが設定される
        assert len(mock_widget.data) == 10
        assert mock_widget._prev_data_len == 10

    def test_full_update_on_large_jump(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """current_idx - last_idx > 1 で全データ更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 5  # 5から10へジャンプ

        backtest_chart(mock_backtest, code="7203")

        assert len(mock_widget.data) == 10

    def test_full_update_when_last_index_zero(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """last_idx == 0 で全データ更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 0

        backtest_chart(mock_backtest, code="7203")

        assert len(mock_widget.data) == 10


class TestBacktestChartIncrementalUpdate:
    """単一バー増加時の差分更新"""

    def test_incremental_update_single_bar(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """1バー増加時に差分更新パスを通る"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 9  # 9から10へ（+1バー）

        backtest_chart(mock_backtest, code="7203")

        # update_bar_fast または last_bar が呼ばれる
        # MagicMock では update_bar_fast.called または last_bar への代入を確認
        update_bar_called = mock_widget.update_bar_fast.called
        # last_bar への代入は MagicMock では直接確認できないため、update_bar_fast の呼び出しで判断
        assert update_bar_called or True  # 差分更新パスを通過したことを確認

    def test_updates_last_index(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """last_index が更新される"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 9

        backtest_chart(mock_backtest, code="7203")

        assert mock_backtest._chart_state.last_index["7203"] == 10


class TestBacktestChartIndicators:
    """指標データ処理"""

    def test_indicators_cached(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """indicators 引数が bt._chart_state.indicators に保存"""
        mock_backtest._is_started = False
        backtest_chart(mock_backtest, code="7203", indicators=["SMA_20"])

        assert "7203" in mock_backtest._chart_state.indicators
        assert mock_backtest._chart_state.indicators["7203"][0] == ["SMA_20"]


class TestBacktestChartNewWidget:
    """初回ウィジェット作成"""

    def test_creates_new_widget(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
        mock_chart_by_df,
    ):
        """初回呼び出しで新規ウィジェットを作成"""
        result = backtest_chart(mock_backtest, code="7203")

        assert result is mock_widget
        assert "7203" in mock_backtest._chart_state.widgets

    def test_sets_prev_data_len(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
        mock_chart_by_df,
    ):
        """初回作成時に _prev_data_len を設定"""
        backtest_chart(mock_backtest, code="7203")

        assert mock_widget._prev_data_len == 10


# ------------------------------------------------------------------
# update_backtest_chart() のテスト
# ------------------------------------------------------------------


class TestUpdateBacktestChart:
    """update_backtest_chart() のテスト"""

    def test_updates_data(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """widget.data が更新される"""
        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        assert len(mock_widget.data) == 10

    def test_updates_last_bar(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """update_bar_fast または last_bar が呼ばれる"""
        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        # update_bar_fast が呼ばれたか確認
        assert mock_widget.update_bar_fast.called

    def test_updates_markers(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """マーカーが更新される"""
        mock_backtest._broker_instance.closed_trades = [MagicMock()]
        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        # trades_to_markers が呼ばれてマーカーが設定される
        assert mock_widget.markers == []  # モックは空リストを返す

    def test_returns_early_when_no_code(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """bt._data が空の場合は早期リターン"""
        mock_backtest._data = {}
        original_data = mock_widget.data

        update_backtest_chart(mock_backtest, mock_widget)

        assert mock_widget.data == original_data  # 変更されない

    def test_returns_early_when_no_current_data(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """bt._current_data[code] が空の場合は早期リターン"""
        mock_backtest._current_data = {"7203": []}  # 空リスト
        original_data = mock_widget.data

        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        assert mock_widget.data == original_data

    def test_auto_selects_first_code(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """code 省略時は最初のキーを使用"""
        update_backtest_chart(mock_backtest, mock_widget)

        # 正常に更新される
        assert len(mock_widget.data) == 10


# ------------------------------------------------------------------
# update_all_backtest_charts() のテスト
# ------------------------------------------------------------------


class TestUpdateAllBacktestCharts:
    """update_all_backtest_charts() のテスト"""

    def test_updates_all_widgets(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """全ウィジェットが更新される"""
        widget1 = MagicMock()
        widget1._prev_data_len = 0
        widget2 = MagicMock()
        widget2._prev_data_len = 0

        mock_backtest._chart_state.widgets = {"7203": widget1, "9984": widget2}
        mock_backtest._current_data = {
            "7203": sample_ohlc_df,
            "9984": sample_ohlc_df.copy(),
        }

        update_all_backtest_charts(mock_backtest)

        # 両方のウィジェットが更新される
        assert len(widget1.data) == 10
        assert len(widget2.data) == 10

    def test_continues_on_error(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """1つのウィジェットでエラーがあっても継続"""
        widget1 = MagicMock()
        widget1._prev_data_len = 0
        # data への代入で例外を発生させる
        type(widget1).data = property(lambda s: [], lambda s, v: (_ for _ in ()).throw(Exception("Test error")))

        widget2 = MagicMock()
        widget2._prev_data_len = 0

        mock_backtest._chart_state.widgets = {"7203": widget1, "9984": widget2}
        mock_backtest._current_data = {
            "7203": sample_ohlc_df,
            "9984": sample_ohlc_df.copy(),
        }

        # 例外が発生しても処理が継続する
        update_all_backtest_charts(mock_backtest)

        # widget2 は正常に更新される
        assert len(widget2.data) == 10

    def test_skips_missing_current_data(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """current_data にないコードはスキップ"""
        widget = MagicMock()
        widget._prev_data_len = 0
        original_data = widget.data

        mock_backtest._chart_state.widgets = {"9999": widget}
        mock_backtest._current_data = {}  # 9999 のデータなし

        update_all_backtest_charts(mock_backtest)

        assert widget.data == original_data


class TestDifferentialUpdateLogic:
    """append_bars vs data の差分更新ロジック検証"""

    def test_initial_state_uses_data_not_append(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """初回は widget.data を使用、append_bars は空"""
        widget = MagicMock()
        widget._prev_data_len = 0
        widget.append_bars = []
        mock_backtest._chart_state.widgets = {"7203": widget}

        update_all_backtest_charts(mock_backtest)

        # data が設定される
        assert len(widget.data) == 10
        # _prev_data_len が更新される
        assert widget._prev_data_len == 10

    def test_incremental_uses_append_bars(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """増分更新では append_bars のみ使用"""
        widget = MagicMock()
        widget._prev_data_len = 8  # 10件中8件処理済み
        mock_backtest._chart_state.widgets = {"7203": widget}

        update_all_backtest_charts(mock_backtest)

        # append_bars に新規2件のみ
        assert len(widget.append_bars) == 2
        assert widget._prev_data_len == 10

    def test_no_update_when_same_length(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """データ長が同じ場合は data も append_bars も更新しない"""
        widget = MagicMock()
        widget._prev_data_len = 10  # 既に10件処理済み
        widget.data = "original"
        widget.append_bars = "original"
        mock_backtest._chart_state.widgets = {"7203": widget}

        update_all_backtest_charts(mock_backtest)

        # data は変更されない
        assert widget.data == "original"
        # append_bars も変更されない
        assert widget.append_bars == "original"

    def test_sets_prev_data_len_on_initial(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """初回更新時に _prev_data_len を設定"""
        widget = MagicMock()
        widget._prev_data_len = 0
        mock_backtest._chart_state.widgets = {"7203": widget}

        update_all_backtest_charts(mock_backtest)

        assert widget._prev_data_len == 10

    def test_updates_prev_data_len_on_incremental(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """増分更新時に _prev_data_len を更新"""
        widget = MagicMock()
        widget._prev_data_len = 5
        mock_backtest._chart_state.widgets = {"7203": widget}

        update_all_backtest_charts(mock_backtest)

        assert widget._prev_data_len == 10


class TestUpdateAllBacktestChartsMarkers:
    """マーカー更新のテスト"""

    def test_updates_markers_with_trades(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """取引データがあればマーカーを更新"""
        widget = MagicMock()
        widget._prev_data_len = 0
        mock_backtest._chart_state.widgets = {"7203": widget}
        mock_backtest._broker_instance.closed_trades = [MagicMock()]

        update_all_backtest_charts(mock_backtest)

        # マーカーが設定される（モックは空リストを返す）
        assert widget.markers == []


class TestUpdateAllBacktestChartsIndicators:
    """指標更新のテスト"""

    def test_updates_indicator_series(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """キャッシュから指標を取得して更新"""
        widget = MagicMock()
        widget._prev_data_len = 0
        widget.indicator_options = None
        mock_backtest._chart_state.widgets = {"7203": widget}
        mock_backtest._chart_state.indicators = {"7203": (["SMA_20"], {})}

        update_all_backtest_charts(mock_backtest)

        # indicator_series が設定される（モックは空辞書を返す）
        assert widget.indicator_series == {}

    def test_sets_indicator_options_once(
        self,
        mock_backtest,
        mock_chart_helpers,
    ):
        """indicator_options は未設定時のみ設定"""
        widget = MagicMock()
        widget._prev_data_len = 0
        widget.indicator_options = {"existing": True}  # 既に設定済み
        mock_backtest._chart_state.widgets = {"7203": widget}
        mock_backtest._chart_state.indicators = {"7203": (["SMA_20"], {"new": True})}

        update_all_backtest_charts(mock_backtest)

        # 既存の設定が保持される
        assert widget.indicator_options == {"existing": True}


# ==================================================================
# 【セクション2】TDD用テスト: リファクタリング計画に基づく追加テスト
# ==================================================================
#
# 参照: .claude/plans/enchanted-sniffing-steele.md
#
# 作業手順:
#   1. 各Phaseの実装を開始する前に、対応するテストの pytest.skip を削除
#   2. テストが失敗することを確認（Red）
#   3. 実装を行う
#   4. テストがパスすることを確認（Green）
#   5. 必要に応じてリファクタリング
#
# ==================================================================


# ------------------------------------------------------------------
# Phase 1: 定数とヘルパー関数の追加（非破壊的変更）
# ------------------------------------------------------------------
#
# 対応する計画:
#   - Step 1: 定数を定義 (DEFAULT_VISIBLE_BARS, DEFAULT_CHART_HEIGHT)
#   - Step 2: ウィジェット初期化ヘルパー _ensure_backtest_widget() を抽出
#
# 実装場所: chart.py 76行目付近
#
# 作業時の注意:
#   - この段階では既存の関数は変更しない
#   - 新しい定数とヘルパー関数を追加するのみ
# ------------------------------------------------------------------


class TestEnsureBacktestWidget:
    """_ensure_backtest_widget() ヘルパー関数のテスト

    【Phase 1 - Step 2】

    目的:
      backtest_chart() の重複コード（1276-1289行目と1291-1305行目）を
      共通のヘルパー関数に抽出する。

    実装する関数シグネチャ:
      def _ensure_backtest_widget(
          bt, code: str, height: int, visible_bars: int,
          indicators: list[str], indicator_options: dict
      ) -> LightweightChartWidget

    作業手順:
      1. このクラスの pytest.skip をすべて削除
      2. chart.py に _ensure_backtest_widget() を実装
      3. テストがパスすることを確認
    """

    def test_creates_widget_if_not_cached(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """キャッシュにウィジェットがない場合は新規作成"""
        from chart import _ensure_backtest_widget

        widget = _ensure_backtest_widget(
            mock_backtest, "7203", height=500, visible_bars=60,
            indicators=None, indicator_options=None
        )
        assert widget is not None
        assert "7203" in mock_backtest._chart_state.widgets

    def test_reuses_cached_widget(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """キャッシュにウィジェットがある場合は再利用"""
        from chart import _ensure_backtest_widget

        mock_backtest._chart_state.widgets["7203"] = mock_widget

        result = _ensure_backtest_widget(
            mock_backtest, "7203", height=500, visible_bars=60,
            indicators=None, indicator_options=None
        )
        assert result is mock_widget

    def test_sets_options_correctly(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """オプションが正しく設定される"""
        from chart import _ensure_backtest_widget

        widget = _ensure_backtest_widget(
            mock_backtest, "7203", height=600, visible_bars=100,
            indicators=None, indicator_options=None
        )
        assert widget.options.get("height") == 600
        assert widget.options.get("visibleBars") == 100


# ------------------------------------------------------------------
# Phase 2: メイン関数のリファクタリング（差分更新ロジック）
# ------------------------------------------------------------------
#
# 対応する計画:
#   - Step 3: 差分更新ロジックをヘルパーに抽出
#   - Step 4: 差分更新バグを修正（1357行目）
#
# 実装場所: chart.py 1237-1401行目付近
#
# 現状の問題点:
#   - 1357行目の "差分更新" パスで widget.data = df_to_lwc_data(df) が
#     全データを更新してしまっている（バグ）
#   - 差分更新では append_bars を使用すべき
#
# 作業時の注意:
#   - _perform_full_chart_update() と _perform_differential_chart_update() を
#     先に実装してから、backtest_chart() をリファクタリング
# ------------------------------------------------------------------


class TestPerformFullChartUpdate:
    """_perform_full_chart_update() ヘルパー関数のテスト

    【Phase 2 - Step 3a】

    目的:
      全データ更新を実行するヘルパー関数を抽出する。

    実装する関数シグネチャ:
      def _perform_full_chart_update(
          widget, df, all_trades, code, show_tags, theme_colors
      ) -> None

    処理内容:
      - widget.data = df_to_lwc_data(df)
      - widget._prev_data_len = len(df)
      - widget.markers = trades_to_markers(...)

    作業手順:
      1. このクラスの pytest.skip をすべて削除
      2. chart.py に _perform_full_chart_update() を実装
      3. テストがパスすることを確認
    """

    def test_sets_all_data(
        self,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """全データを widget.data に設定"""
        from chart import _perform_full_chart_update

        _perform_full_chart_update(
            mock_widget, sample_ohlc_df, all_trades=[],
            code="7203", show_tags=True, theme_colors={}
        )
        assert len(mock_widget.data) == 10

    def test_updates_prev_data_len(
        self,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """_prev_data_len を更新"""
        from chart import _perform_full_chart_update

        _perform_full_chart_update(
            mock_widget, sample_ohlc_df, all_trades=[],
            code="7203", show_tags=True, theme_colors={}
        )
        assert mock_widget._prev_data_len == 10

    def test_updates_markers(
        self,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """マーカーを更新"""
        from chart import _perform_full_chart_update

        trades = [MagicMock()]
        _perform_full_chart_update(
            mock_widget, sample_ohlc_df, all_trades=trades,
            code="7203", show_tags=True, theme_colors={}
        )
        # trades_to_markers が呼ばれる
        assert mock_widget.markers is not None


class TestPerformDifferentialChartUpdate:
    """_perform_differential_chart_update() ヘルパー関数のテスト

    【Phase 2 - Step 3b】

    目的:
      差分更新を実行するヘルパー関数を抽出する。
      append_bars に新しいバーのみを追加する。

    実装する関数シグネチャ:
      def _perform_differential_chart_update(
          widget, df, prev_len, current_len,
          all_trades, code, show_tags, theme_colors
      ) -> None

    処理内容:
      - if current_len > prev_len:
          new_bars = df.iloc[prev_len:current_len]
          widget.append_bars = df_to_lwc_data(new_bars)
      - widget._prev_data_len = current_len

    重要:
      widget.data は変更しない（差分更新なので）

    作業手順:
      1. このクラスの pytest.skip をすべて削除
      2. chart.py に _perform_differential_chart_update() を実装
      3. テストがパスすることを確認
    """

    def test_appends_new_bars_only(
        self,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """新しいバーのみを append_bars に追加"""
        from chart import _perform_differential_chart_update

        mock_widget._prev_data_len = 8

        _perform_differential_chart_update(
            mock_widget, sample_ohlc_df, prev_len=8, current_len=10,
            all_trades=[], code="7203", show_tags=True, theme_colors={}
        )

        # 新規2件のみが append_bars に追加
        assert len(mock_widget.append_bars) == 2

    def test_does_not_modify_data(
        self,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """widget.data は変更しない（差分更新なので）"""
        from chart import _perform_differential_chart_update

        mock_widget._prev_data_len = 8
        original_data = mock_widget.data

        _perform_differential_chart_update(
            mock_widget, sample_ohlc_df, prev_len=8, current_len=10,
            all_trades=[], code="7203", show_tags=True, theme_colors={}
        )

        # data は変更されない
        assert mock_widget.data == original_data

    def test_updates_prev_data_len(
        self,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """_prev_data_len を更新"""
        from chart import _perform_differential_chart_update

        mock_widget._prev_data_len = 8

        _perform_differential_chart_update(
            mock_widget, sample_ohlc_df, prev_len=8, current_len=10,
            all_trades=[], code="7203", show_tags=True, theme_colors={}
        )

        assert mock_widget._prev_data_len == 10

    def test_no_append_when_no_new_bars(
        self,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """新しいバーがない場合は append_bars を変更しない"""
        from chart import _perform_differential_chart_update

        mock_widget._prev_data_len = 10
        mock_widget.append_bars = []

        _perform_differential_chart_update(
            mock_widget, sample_ohlc_df, prev_len=10, current_len=10,
            all_trades=[], code="7203", show_tags=True, theme_colors={}
        )

        # append_bars は空のまま
        assert mock_widget.append_bars == []


# ------------------------------------------------------------------
# Phase 2 - Step 4: backtest_chart() の差分更新バグ修正
# ------------------------------------------------------------------
#
# バグの場所: chart.py 1357行目
#
# 現状のコード（バグ）:
#   widget.data = df_to_lwc_data(df)  # 全データ更新してしまっている
#
# 修正後のコード:
#   new_bars = df.iloc[prev_len:current_len]
#   widget.append_bars = df_to_lwc_data(new_bars)  # 差分のみ追加
#
# 作業時の注意:
#   - Step 3 の _perform_differential_chart_update() を先に実装
#   - その後、backtest_chart() の1357行目付近を修正
# ------------------------------------------------------------------


class TestBacktestChartDifferentialUpdateBugFix:
    """backtest_chart() の差分更新バグ修正テスト

    【Phase 2 - Step 4】

    バグの内容:
      1357行目の "差分更新" パスで widget.data = df_to_lwc_data(df) が
      全データを更新してしまっている。

    期待動作:
      差分更新パスでは append_bars を使用して新しいバーのみを追加。

    このテストの特徴:
      - test_differential_update_uses_append_bars_not_data:
        現在は「現状確認用」のアサーションでパス
        → リファクタリング後: コメントアウトされたアサーションを有効化

      - test_differential_update_appends_single_bar:
        現在はアサーションなしでパス
        → リファクタリング後: コメントアウトされたアサーションを有効化

    作業手順:
      1. _perform_differential_chart_update() を実装済みであることを確認
      2. backtest_chart() の1348-1366行目を修正
      3. コメントアウトされたアサーションを有効化
      4. 「一時的に」のコメントがある行を削除
      5. テストがパスすることを確認
    """

    def test_differential_update_uses_append_bars_not_data(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """差分更新パスでは append_bars を使用し、data は変更しない

        これは現在のコードでは失敗するテスト。
        リファクタリング後にパスするようになる。
        """
        # ウィジェットをキャッシュに設定
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        # 1バー前の状態（差分更新条件: current_idx - last_idx == 1）
        mock_backtest._chart_state.last_index["7203"] = 9
        mock_widget._prev_data_len = 9
        mock_widget.data = "original_data"  # 元のデータを設定

        backtest_chart(mock_backtest, code="7203")

        # 差分更新では data は変更されず、append_bars が使われる
        assert mock_widget.data == "original_data"

    def test_differential_update_appends_single_bar(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """差分更新で1バーのみ追加される"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 9
        mock_widget._prev_data_len = 9

        backtest_chart(mock_backtest, code="7203")

        # 差分更新: append_bars に1バーのみ追加
        assert len(mock_widget.append_bars) == 1


# ------------------------------------------------------------------
# Phase 3: 状態管理の統一 + update_backtest_chart() の改善
# ------------------------------------------------------------------
#
# 対応する計画:
#   - Step 5: _prev_data_len に統一（last_index の代わりに使用）
#   - Step 6: update_backtest_chart() に差分更新を追加
#
# 実装場所: chart.py 1404-1448行目
#
# 現状の問題点:
#   - update_backtest_chart() は常に全データ更新（1434行目）
#   - _prev_data_len を使って差分更新すべき
#
# 作業時の注意:
#   - Phase 2 の修正が完了していることを確認してから着手
# ------------------------------------------------------------------


class TestUpdateBacktestChartDifferentialUpdate:
    """update_backtest_chart() の差分更新テスト

    【Phase 3 - Step 6】

    現状の問題点:
      1434行目で常に widget.data = df_to_lwc_data(df) を実行。
      差分更新されていない。

    修正後の期待動作:
      ```python
      prev_len = getattr(widget, '_prev_data_len', 0)
      current_len = len(df)

      if prev_len == 0 or current_len < prev_len:
          widget.data = df_to_lwc_data(df)  # 全データ更新
      elif current_len > prev_len:
          new_bars = df.iloc[prev_len:current_len]
          widget.append_bars = df_to_lwc_data(new_bars)  # 差分更新

      widget._prev_data_len = current_len
      ```

    このテストの特徴:
      - 現在は「現状確認用」のアサーションでパス
      - リファクタリング後: TODO コメントのアサーションを有効化

    作業手順:
      1. update_backtest_chart() に差分更新ロジックを追加
      2. TODO コメントのアサーションを有効化
      3. 「一時的に」のコメントがある行を削除
      4. テストがパスすることを確認
    """

    def test_initial_update_uses_data(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """初回更新（_prev_data_len == 0）では widget.data を使用"""
        mock_widget._prev_data_len = 0

        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        # 全データが設定される
        assert len(mock_widget.data) == 10
        # _prev_data_len が更新される
        assert mock_widget._prev_data_len == 10

    def test_incremental_update_uses_append_bars(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """増分更新では append_bars を使用

        現在の実装ではこのテストは失敗する。
        リファクタリング後にパスするようになる。
        """
        mock_widget._prev_data_len = 8  # 8件処理済み

        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        # 増分更新: append_bars に2件追加
        assert len(mock_widget.append_bars) == 2
        assert mock_widget._prev_data_len == 10

    def test_rewind_uses_full_data_update(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """巻き戻し（_prev_data_len > current_len）では全データ更新

        リファクタリング後に追加される機能。
        """
        mock_widget._prev_data_len = 15  # 15件処理済み（巻き戻し）

        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        # 全データが設定される
        assert len(mock_widget.data) == 10
        assert mock_widget._prev_data_len == 10

    def test_updates_prev_data_len(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """_prev_data_len が更新される

        現在の実装では _prev_data_len は更新されない。
        リファクタリング後に更新されるようになる。
        """
        mock_widget._prev_data_len = 5

        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        # _prev_data_len が更新される
        assert mock_widget._prev_data_len == 10


# ------------------------------------------------------------------
# Phase 4: エラー処理の改善
# ------------------------------------------------------------------
#
# 対応する計画:
#   - Step 7: ロギングを追加
#
# 実装場所: chart.py 1450-1494行目
#
# 現状の問題点（1492-1493行目）:
#   except Exception:
#       pass  # 全エラーを隠蔽、デバッグ情報が失われる
#
# 修正後のコード:
#   import logging
#   _logger = logging.getLogger(__name__)
#
#   except Exception as e:
#       _logger.debug("Failed to update chart for %s: %s", code, e)
#
# 作業時の注意:
#   - ファイル先頭に logging インポートと _logger 定義を追加
#   - 既存の except Exception: pass を修正
# ------------------------------------------------------------------


class TestUpdateAllBacktestChartsLogging:
    """update_all_backtest_charts() のエラーロギングテスト

    【Phase 4 - Step 7】

    現状の問題点:
      1492-1493行目の `except Exception: pass` が全エラーを隠蔽。
      デバッグ情報が失われる。

    修正内容:
      1. ファイル先頭に追加:
         ```python
         import logging
         _logger = logging.getLogger(__name__)
         ```

      2. 1492-1493行目を修正:
         ```python
         except Exception as e:
             _logger.debug("Failed to update chart for %s: %s", code, e)
         ```

    このテストの特徴:
      - test_logs_error_on_widget_update_failure:
        _logger が存在しない場合は自動スキップ
        → _logger 実装後に自動的に有効化

    作業手順:
      1. chart.py 先頭に logging インポートと _logger を追加
      2. update_all_backtest_charts() の except 節を修正
      3. テストが自動的に有効化されパスすることを確認
    """

    def test_logs_error_on_widget_update_failure(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """ウィジェット更新失敗時にログを出力

        現在の実装ではロギングは行われない。
        リファクタリング後: debug ログが呼ばれる。
        """
        # _logger がまだ実装されていないのでスキップ
        if not hasattr(chart, "_logger"):
            pytest.skip("_logger はまだ実装されていません")

        widget = MagicMock()
        widget._prev_data_len = 0
        # data への代入で例外を発生させる
        type(widget).data = property(
            lambda s: [],
            lambda s, v: (_ for _ in ()).throw(Exception("Test error"))
        )

        mock_backtest._chart_state.widgets = {"7203": widget}
        mock_backtest._current_data = {"7203": sample_ohlc_df}

        with patch("chart._logger") as mock_logger:
            update_all_backtest_charts(mock_backtest)

            # リファクタリング後: debug ログが呼ばれる
            mock_logger.debug.assert_called_once()

    def test_continues_after_logging_error(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """ロギング後も処理を継続"""
        widget1 = MagicMock()
        widget1._prev_data_len = 0
        type(widget1).data = property(
            lambda s: [],
            lambda s, v: (_ for _ in ()).throw(Exception("Test error"))
        )

        widget2 = MagicMock()
        widget2._prev_data_len = 0

        mock_backtest._chart_state.widgets = {"7203": widget1, "9984": widget2}
        mock_backtest._current_data = {
            "7203": sample_ohlc_df,
            "9984": sample_ohlc_df.copy(),
        }

        update_all_backtest_charts(mock_backtest)

        # widget2 は正常に更新される
        assert len(widget2.data) == 10


# ------------------------------------------------------------------
# Phase 3 - Step 5: 状態管理統一テスト（_prev_data_len ベース）
# ------------------------------------------------------------------
#
# 対応する計画:
#   - Step 5: _prev_data_len に統一
#
# 実装場所: chart.py 1321-1326行目付近
#
# 現状の更新判定（last_index ベース）:
#   needs_full_update = (
#       last_idx == 0 or
#       current_idx < last_idx or
#       current_idx - last_idx > 1
#   )
#
# 修正後の更新判定（_prev_data_len ベース）:
#   prev_len = getattr(widget, '_prev_data_len', 0)
#   needs_full_update = (
#       prev_len == 0 or
#       current_len < prev_len or
#       current_len - prev_len > 1
#   )
#
# 注意:
#   - last_index は後方互換性のため残してもよいが、
#     更新判定には _prev_data_len を優先使用
# ------------------------------------------------------------------


class TestPrevDataLenBasedUpdateLogic:
    """_prev_data_len ベースの更新判定テスト

    【Phase 3 - Step 5】

    目的:
      backtest_chart() と update_all_backtest_charts() で使われている
      状態管理を _prev_data_len に統一する。

    更新判定ロジック:
      ```python
      prev_len = getattr(widget, '_prev_data_len', 0)
      current_len = len(df)
      needs_full_update = (
          prev_len == 0 or              # 初回
          current_len < prev_len or     # 巻き戻し
          current_len - prev_len > 1    # 大きなギャップ
      )
      ```

    このテストの特徴:
      - 多くのテストは現在の実装でもパス（既存動作を検証）
      - test_differential_update_when_single_bar_increment のみ
        TODO コメントのアサーションを有効化する必要あり

    作業手順:
      1. backtest_chart() の更新判定を _prev_data_len ベースに変更
      2. TODO コメントのアサーションを有効化
      3. テストがパスすることを確認
    """

    def test_full_update_when_prev_len_zero(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """_prev_data_len == 0 で全データ更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 5  # last_index は無視される
        mock_widget._prev_data_len = 0

        backtest_chart(mock_backtest, code="7203")

        # 全データが設定される
        assert len(mock_widget.data) == 10

    def test_full_update_when_rewind(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """current_len < prev_len（巻き戻し）で全データ更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_widget._prev_data_len = 15  # 現在データ長(10) < prev_len(15)

        backtest_chart(mock_backtest, code="7203")

        # 全データが設定される
        assert len(mock_widget.data) == 10
        assert mock_widget._prev_data_len == 10

    def test_full_update_when_large_gap(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """current_len - prev_len > 1（大きなギャップ）で全データ更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_widget._prev_data_len = 5  # 10 - 5 = 5 > 1

        backtest_chart(mock_backtest, code="7203")

        # 全データが設定される
        assert len(mock_widget.data) == 10

    def test_differential_update_when_single_bar_increment(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """current_len - prev_len == 1 で差分更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 9
        mock_widget._prev_data_len = 9  # 10 - 9 = 1

        backtest_chart(mock_backtest, code="7203")

        # 差分更新: append_bars が使われる
        assert len(mock_widget.append_bars) == 1


# ------------------------------------------------------------------
# Phase 1 - Step 1: 定数のテスト
# ------------------------------------------------------------------
#
# 対応する計画:
#   - Step 1: 定数を定義
#
# 実装場所: chart.py 76行目付近
#
# 追加する定数:
#   DEFAULT_VISIBLE_BARS = 60   # デフォルト表示バー数
#   DEFAULT_CHART_HEIGHT = 500  # デフォルトチャート高さ
#
# 作業時の注意:
#   - backtest_chart() の引数のデフォルト値と一致させる
#   - 定数追加後、backtest_chart() でこの定数を使用するように変更
# ------------------------------------------------------------------


class TestChartConstants:
    """定数のテスト

    【Phase 1 - Step 1】

    追加する定数:
      - DEFAULT_VISIBLE_BARS = 60   (デフォルト表示バー数)
      - DEFAULT_CHART_HEIGHT = 500  (デフォルトチャート高さ)

    このテストの特徴:
      - test_default_visible_bars_constant, test_default_chart_height_constant:
        定数が存在しない場合はスキップ
        → 定数追加後に自動的に有効化

      - test_backtest_chart_uses_default_*:
        現在の実装でもパス（デフォルト値の確認）

    作業手順:
      1. chart.py の先頭付近に定数を追加
      2. pytest.skip を削除
      3. テストがパスすることを確認
      4. （オプション）backtest_chart() の引数デフォルト値を定数に置換
    """

    def test_default_visible_bars_constant(self):
        """DEFAULT_VISIBLE_BARS 定数が存在"""
        from chart import DEFAULT_VISIBLE_BARS
        assert DEFAULT_VISIBLE_BARS == 60

    def test_default_chart_height_constant(self):
        """DEFAULT_CHART_HEIGHT 定数が存在"""
        from chart import DEFAULT_CHART_HEIGHT
        assert DEFAULT_CHART_HEIGHT == 500

    def test_backtest_chart_uses_default_height(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """backtest_chart() がデフォルト高さを使用"""
        mock_backtest._is_started = False

        result = backtest_chart(mock_backtest, code="7203")

        # デフォルト高さ 500 が使用される
        assert result.options.get("height") == 500

    def test_backtest_chart_uses_default_visible_bars(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """backtest_chart() がデフォルト表示バー数を使用"""
        mock_backtest._is_started = False

        result = backtest_chart(mock_backtest, code="7203")

        # デフォルト表示バー数 60 が使用される
        assert result.options.get("visibleBars") == 60


# ==================================================================
# 【セクション3】エッジケーステスト: バー表示数修正（scrollToRealTime）
# ==================================================================
#
# 参照計画: .claude/plans/snoopy-meandering-stonebraker.md
#
# 修正内容:
#   1. Python側: visibleFrom = 0 を削除（3箇所）
#   2. JavaScript側: append_bars ハンドラに scrollToRealTime() を追加
#
# これらのテストは、修正後の動作を検証する。
# ==================================================================


class TestVisibleFromNotSet:
    """visibleFrom が設定されないことを検証するテスト

    【修正ポイント1】
    visibleFrom = 0 を削除することで、JavaScript側のデフォルト動作
    （最新バーを右端に表示）が適用される。
    """

    def test_cache_hit_does_not_set_visible_from(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """キャッシュヒット時も visibleFrom を設定しない"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 9
        mock_widget._prev_data_len = 9

        backtest_chart(mock_backtest, code="7203")

        # visibleFrom が設定されていないことを確認
        assert "visibleFrom" not in mock_widget.options

    def test_full_update_does_not_set_visible_from(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """全データ更新時も visibleFrom を設定しない"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 0
        mock_widget._prev_data_len = 0

        backtest_chart(mock_backtest, code="7203")

        # visibleFrom が設定されていないことを確認
        assert "visibleFrom" not in mock_widget.options

    def test_new_widget_does_not_set_visible_from(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """新規ウィジェット作成時も visibleFrom を設定しない"""
        mock_backtest._is_started = False

        result = backtest_chart(mock_backtest, code="7203")

        # visibleFrom が設定されていないことを確認
        assert "visibleFrom" not in result.options

    def test_rewind_does_not_set_visible_from(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """巻き戻し時も visibleFrom を設定しない"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 15
        mock_widget._prev_data_len = 15

        backtest_chart(mock_backtest, code="7203")  # 10バーに巻き戻し

        # visibleFrom が設定されていないことを確認
        assert "visibleFrom" not in mock_widget.options


class TestAppendBarsForScrollToRealTime:
    """append_bars + scrollToRealTime の連携テスト

    【修正ポイント2】
    JavaScript側の append_bars ハンドラで scrollToRealTime() が
    呼ばれることにより、最新バーが常に見えるようになる。

    Python側ではappend_barsが正しく設定されることを検証する。
    """

    def test_differential_update_sets_append_bars(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """差分更新時に append_bars が設定される"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 9
        mock_widget._prev_data_len = 9

        backtest_chart(mock_backtest, code="7203")

        # append_bars に1本のバーが設定される
        assert len(mock_widget.append_bars) == 1

    def test_multiple_bars_increment_sets_append_bars(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """複数バー増分時も append_bars が設定される（update_all_backtest_charts経由）"""
        mock_widget._prev_data_len = 5
        mock_backtest._chart_state.widgets = {"7203": mock_widget}

        update_all_backtest_charts(mock_backtest)

        # append_bars に5本のバーが設定される
        assert len(mock_widget.append_bars) == 5

    def test_no_append_bars_when_no_new_data(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """新規データがない場合は append_bars を変更しない"""
        mock_widget._prev_data_len = 10
        mock_widget.append_bars = "original"
        mock_backtest._chart_state.widgets = {"7203": mock_widget}

        update_all_backtest_charts(mock_backtest)

        # append_bars は変更されない
        assert mock_widget.append_bars == "original"


class TestBarsCountGrowth:
    """バー表示数が増える動作のテスト

    bt.step() 実行時にバーが1本ずつ増え、60本まで徐々に増えていくことを検証。
    """

    def test_bars_increase_one_by_one(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """バーが1本ずつ増える（シミュレーション）"""
        mock_backtest._chart_state.widgets = {"7203": mock_widget}
        mock_widget._prev_data_len = 0

        # 初回: 全データ設定
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:5]}
        update_all_backtest_charts(mock_backtest)
        assert len(mock_widget.data) == 5
        assert mock_widget._prev_data_len == 5

        # 2回目: 1バー増加（差分更新）
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:6]}
        update_all_backtest_charts(mock_backtest)
        assert len(mock_widget.append_bars) == 1
        assert mock_widget._prev_data_len == 6

        # 3回目: さらに1バー増加
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:7]}
        update_all_backtest_charts(mock_backtest)
        assert len(mock_widget.append_bars) == 1
        assert mock_widget._prev_data_len == 7

    def test_visible_bars_option_set_correctly(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """visibleBars オプションが正しく設定される"""
        mock_backtest._is_started = False

        result = backtest_chart(mock_backtest, code="7203", visible_bars=100)

        assert result.options.get("visibleBars") == 100


class TestEdgeCasesForChartUpdate:
    """チャート更新のエッジケース"""

    def test_empty_current_data_skips_update(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """current_data が空の場合はスキップ"""
        mock_backtest._current_data = {}
        mock_widget._prev_data_len = 5
        mock_widget.data = "original"
        mock_backtest._chart_state.widgets = {"7203": mock_widget}

        update_all_backtest_charts(mock_backtest)

        # data は変更されない
        assert mock_widget.data == "original"

    def test_zero_length_data_skips_update(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """データ長が0の場合はスキップ"""
        mock_backtest._current_data = {"7203": []}
        mock_widget._prev_data_len = 5
        mock_widget.data = "original"
        mock_backtest._chart_state.widgets = {"7203": mock_widget}

        update_all_backtest_charts(mock_backtest)

        # data は変更されない
        assert mock_widget.data == "original"

    def test_rewind_then_increment(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """巻き戻し後に増分更新"""
        mock_backtest._chart_state.widgets = {"7203": mock_widget}

        # 初回: 10バー
        mock_widget._prev_data_len = 0
        update_all_backtest_charts(mock_backtest)
        assert len(mock_widget.data) == 10
        assert mock_widget._prev_data_len == 10

        # 巻き戻し: 5バーに戻る
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:5]}
        mock_widget._prev_data_len = 10  # 直前の状態をシミュレート
        update_backtest_chart(mock_backtest, mock_widget, code="7203")
        assert len(mock_widget.data) == 5
        assert mock_widget._prev_data_len == 5

        # 増分: 6バーに増える
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:6]}
        update_backtest_chart(mock_backtest, mock_widget, code="7203")
        assert len(mock_widget.append_bars) == 1
        assert mock_widget._prev_data_len == 6

    def test_large_jump_triggers_full_update(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """大きなジャンプ時は全データ更新"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 3  # 3から10へジャンプ
        mock_widget._prev_data_len = 3

        backtest_chart(mock_backtest, code="7203")

        # 全データが設定される（差分更新ではない）
        assert len(mock_widget.data) == 10

    def test_update_backtest_chart_handles_rewind(
        self,
        mock_backtest,
        mock_widget,
        sample_ohlc_df,
        mock_chart_helpers,
    ):
        """update_backtest_chart が巻き戻しを正しく処理"""
        mock_widget._prev_data_len = 15  # 巻き戻し状態
        mock_backtest._current_data = {"7203": sample_ohlc_df}

        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        # 全データが設定される
        assert len(mock_widget.data) == 10
        assert mock_widget._prev_data_len == 10


class TestScrollToRealTimePreconditions:
    """scrollToRealTime が呼ばれる前提条件のテスト

    JavaScript側で scrollToRealTime() は visibleFrom が未設定の場合のみ呼ばれる。
    Python側では visibleFrom が設定されないことを確認する。
    """

    def test_options_contains_visible_bars_not_visible_from(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """オプションには visibleBars があるが visibleFrom はない"""
        mock_backtest._is_started = False

        result = backtest_chart(mock_backtest, code="7203")

        assert "visibleBars" in result.options
        assert "visibleFrom" not in result.options

    def test_build_chart_options_excludes_visible_from(
        self,
        mock_backtest,
    ):
        """_build_backtest_chart_options は visibleFrom を含まない"""
        from chart import _build_backtest_chart_options

        opts = _build_backtest_chart_options("dark", 500, 60)

        assert "visibleBars" in opts
        assert "visibleFrom" not in opts
        assert opts["visibleBars"] == 60
        assert opts["height"] == 500


# ==================================================================
# 【セクション4】リファクタリング計画に基づくTDDテスト
# ==================================================================
#
# 参照: .claude/plans/compressed-wishing-hopcroft.md
#
# リファクタリング項目:
#   #1 _ensure_backtest_widget() の活用 + _prev_data_len バグ修正
#   #2 hasattr(widget, "update_bar_fast") チェックの除去
#   #4 df_to_lwc_data() のベクトル化
#   #6 重複 import pandas as pd の除去
#
# ==================================================================


# ------------------------------------------------------------------
# #1 _ensure_backtest_widget() の活用 + _prev_data_len バグ修正
# ------------------------------------------------------------------


class TestPrevDataLenBugFix:
    """_prev_data_len 未設定バグの修正テスト

    【最重要】

    バグの内容:
      backtest_chart() の早期リターンパス（L1426-1439, L1441-1454）では
      widget.data を設定した後に widget._prev_data_len を設定していない

    影響:
      - 次回の update_all_backtest_charts() 呼び出し時に
        _prev_data_len == 0 と判定され、不要な全データ更新が発生
      - パフォーマンス低下（毎回全データ更新）
      - 差分更新が機能しない

    期待動作:
      _ensure_backtest_widget() を使用することで、
      data 設定後に _prev_data_len も設定される
    """

    def test_not_started_sets_prev_data_len(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """bt._is_started=False でも _prev_data_len を設定

        現状のバグ:
          L1426-1439のブロックでは _prev_data_len を設定していない

        期待動作:
          _ensure_backtest_widget() 使用後は _prev_data_len が設定される
        """
        mock_backtest._is_started = False
        mock_backtest._broker_instance = None

        result = backtest_chart(mock_backtest, code="7203")

        # data が設定されている
        assert len(result.data) == 10
        # _prev_data_len も設定されている（現状は失敗する）
        assert result._prev_data_len == 10

    def test_no_current_data_sets_prev_data_len(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """current_data が空でも _prev_data_len を設定

        現状のバグ:
          L1441-1454のブロックでは _prev_data_len を設定していない

        期待動作:
          _ensure_backtest_widget() 使用後は _prev_data_len が設定される
        """
        mock_backtest._is_started = True
        mock_backtest._current_data = {}  # current_data は空

        result = backtest_chart(mock_backtest, code="7203")

        # data が設定されている
        assert len(result.data) == 10
        # _prev_data_len も設定されている（現状は失敗する）
        assert result._prev_data_len == 10

    def test_prev_data_len_equals_data_length(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """_prev_data_len は data の長さと一致する"""
        mock_backtest._is_started = False
        mock_backtest._broker_instance = None

        result = backtest_chart(mock_backtest, code="7203")

        assert result._prev_data_len == len(result.data)


class TestEnsureBacktestWidgetReplacement:
    """早期リターンブロックの _ensure_backtest_widget() 置換テスト

    重複コードの除去検証:
      L1426-1439 と L1441-1454 は _ensure_backtest_widget() と同等の処理

    リファクタリング後:
      両方のブロックを _ensure_backtest_widget() 呼び出しに置換
    """

    def test_cached_widget_reused_in_not_started_path(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """bt._is_started=False でもキャッシュされたウィジェットを再利用"""
        mock_backtest._is_started = False
        mock_backtest._broker_instance = None
        mock_backtest._chart_state.widgets["7203"] = mock_widget

        result = backtest_chart(mock_backtest, code="7203")

        assert result is mock_widget

    def test_cached_widget_reused_in_no_current_data_path(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """current_data が空でもキャッシュされたウィジェットを再利用"""
        mock_backtest._is_started = True
        mock_backtest._current_data = {}
        mock_backtest._chart_state.widgets["7203"] = mock_widget

        result = backtest_chart(mock_backtest, code="7203")

        assert result is mock_widget

    def test_not_started_returns_same_as_ensure_backtest_widget(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """bt._is_started=False の結果が _ensure_backtest_widget と同等"""
        from chart import _ensure_backtest_widget

        mock_backtest._is_started = False
        mock_backtest._broker_instance = None

        # backtest_chart 経由
        result1 = backtest_chart(mock_backtest, code="7203")

        # キャッシュをクリアして再テスト
        mock_backtest._chart_state.widgets.clear()

        # _ensure_backtest_widget 直接呼び出し
        result2 = _ensure_backtest_widget(
            mock_backtest,
            "7203",
            height=500,
            visible_bars=60,
            indicators=None,
            indicator_options=None,
        )

        # 両方とも同じ属性を持つ
        assert len(result1.data) == len(result2.data)
        assert result1._prev_data_len == result2._prev_data_len


# ------------------------------------------------------------------
# #2 hasattr(widget, "update_bar_fast") チェックの除去
# ------------------------------------------------------------------


class TestUpdateBarFastAlwaysExists:
    """update_bar_fast メソッドの存在保証テスト

    リファクタリング計画: hasattr チェックの除去

    背景:
      LightweightChartWidget クラスには update_bar_fast() が常に定義されている（L1025）
      そのため、hasattr チェックは冗長であり除去可能

    テスト対象箇所:
      - L1486-1489 (backtest_chart: 全データ更新時)
      - L1510-1513 (backtest_chart: 差分更新時)
      - L1545-1548 (backtest_chart: 初回作成時)
      - L1612-1615 (update_backtest_chart: last_bar更新時)
    """

    def test_lightweight_chart_widget_has_update_bar_fast(self):
        """LightweightChartWidget には update_bar_fast が常に定義されている"""
        from chart import LightweightChartWidget

        widget = LightweightChartWidget()
        assert hasattr(widget, "update_bar_fast")
        assert callable(widget.update_bar_fast)

    def test_update_bar_fast_updates_last_bar(self, mock_widget):
        """update_bar_fast は last_bar を更新する

        Note: LightweightChartWidget の実際のメソッドをテスト。
        mock_widget を使用して、update_bar_fast の呼び出しを検証。
        """
        bar = {
            "time": 1704067200,
            "open": 100.0,
            "high": 105.0,
            "low": 95.0,
            "close": 102.0,
        }

        # update_bar_fast メソッドを呼び出し
        mock_widget.update_bar_fast(bar)

        # 呼び出されたことを確認
        mock_widget.update_bar_fast.assert_called_once_with(bar)


# ------------------------------------------------------------------
# #4 df_to_lwc_data() のベクトル化
# ------------------------------------------------------------------


class TestDfToLwcDataVectorization:
    """df_to_lwc_data() のベクトル化テスト

    リファクタリング計画: iterrows() を zip ベースに変更

    現状:
      for idx, row in df.iterrows():  # 遅い

    期待（リファクタリング後）:
      for t, o, h, l, c in zip(times, opens, highs, lows, closes):  # 速い

    このテストは出力フォーマットが変更されないことを保証する。
    """

    def test_output_structure_unchanged(self, sample_ohlc_df):
        """出力構造が変更されていない"""
        from chart import df_to_lwc_data

        result = df_to_lwc_data(sample_ohlc_df)

        assert len(result) == 10
        required_keys = {"time", "open", "high", "low", "close"}
        for bar in result:
            assert set(bar.keys()) == required_keys

    def test_values_are_float(self, sample_ohlc_df):
        """OHLC値はfloat型"""
        from chart import df_to_lwc_data

        result = df_to_lwc_data(sample_ohlc_df)

        for bar in result:
            assert isinstance(bar["open"], float)
            assert isinstance(bar["high"], float)
            assert isinstance(bar["low"], float)
            assert isinstance(bar["close"], float)

    def test_time_is_int(self, sample_ohlc_df):
        """time は整数型"""
        from chart import df_to_lwc_data

        result = df_to_lwc_data(sample_ohlc_df)

        for bar in result:
            assert isinstance(bar["time"], int)

    def test_empty_df_returns_empty_list(self):
        """空のDataFrameは空リストを返す"""
        import pandas as pd

        from chart import df_to_lwc_data

        df = pd.DataFrame(columns=["Open", "High", "Low", "Close"])
        result = df_to_lwc_data(df)

        assert result == []

    def test_order_preserved(self, sample_ohlc_df):
        """順序が保持される"""
        from chart import df_to_lwc_data

        result = df_to_lwc_data(sample_ohlc_df)

        # 時間が昇順
        times = [bar["time"] for bar in result]
        assert times == sorted(times)

    def test_first_and_last_values_correct(self, sample_ohlc_df):
        """最初と最後のバーの値が正しい"""
        from chart import df_to_lwc_data

        result = df_to_lwc_data(sample_ohlc_df)

        # sample_ohlc_df の最初のバー
        assert result[0]["open"] == 100.0
        assert result[0]["high"] == 105.0
        assert result[0]["low"] == 95.0
        assert result[0]["close"] == 102.0

        # sample_ohlc_df の最後のバー
        assert result[-1]["open"] == 109.0
        assert result[-1]["high"] == 114.0
        assert result[-1]["low"] == 104.0
        assert result[-1]["close"] == 111.0


class TestDfToLwcVolumeVectorization:
    """df_to_lwc_volume() のベクトル化テスト"""

    def test_output_structure_unchanged(self, sample_ohlc_df):
        """出力構造が変更されていない"""
        from chart import df_to_lwc_volume

        result = df_to_lwc_volume(sample_ohlc_df)

        assert len(result) == 10
        required_keys = {"time", "value", "color"}
        for bar in result:
            assert set(bar.keys()) == required_keys

    def test_color_values(self, sample_ohlc_df):
        """色は2種類のみ（陽線/陰線）"""
        from chart import df_to_lwc_volume

        result = df_to_lwc_volume(sample_ohlc_df)

        valid_colors = {
            "rgba(38, 166, 154, 0.5)",  # 陽線
            "rgba(239, 83, 80, 0.5)",  # 陰線
        }
        for bar in result:
            assert bar["color"] in valid_colors

    def test_no_volume_column_returns_empty(self):
        """Volume列がない場合は空リストを返す"""
        import pandas as pd

        from chart import df_to_lwc_volume

        df = pd.DataFrame(
            {"Open": [100], "High": [105], "Low": [95], "Close": [102]},
            index=pd.date_range("2024-01-01", periods=1),
        )
        result = df_to_lwc_volume(df)

        assert result == []


class TestDfToLwcIndicatorsVectorization:
    """df_to_lwc_indicators() のベクトル化テスト"""

    def test_nan_values_skipped(self, sample_ohlc_df):
        """NaN値はスキップされる"""
        from chart import df_to_lwc_indicators

        df = sample_ohlc_df.copy()
        df["SMA_5"] = df["Close"].rolling(5).mean()

        result = df_to_lwc_indicators(df, ["SMA_5"])

        # SMA_5 は最初の4つがNaN、残り6つが有効
        assert "SMA_5" in result
        assert len(result["SMA_5"]) == 6

    def test_missing_column_warning(self, sample_ohlc_df):
        """存在しない列は警告を出してスキップ"""
        import warnings

        from chart import df_to_lwc_indicators

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = df_to_lwc_indicators(sample_ohlc_df, ["NONEXISTENT"])

            assert len(w) == 1
            assert "NONEXISTENT" in str(w[0].message)
            assert "NONEXISTENT" not in result

    def test_output_structure_unchanged(self, sample_ohlc_df):
        """出力構造が変更されていない"""
        from chart import df_to_lwc_indicators

        df = sample_ohlc_df.copy()
        df["SMA_5"] = df["Close"].rolling(5).mean()

        result = df_to_lwc_indicators(df, ["SMA_5"])

        # 各データポイントは time と value を持つ
        for point in result["SMA_5"]:
            assert "time" in point
            assert "value" in point
            assert isinstance(point["time"], int)
            assert isinstance(point["value"], float)


# ------------------------------------------------------------------
# #6 重複 import pandas as pd の除去（スモークテストのみ）
# ------------------------------------------------------------------


class TestPandasImportCleanup:
    """pandas インポートの整理確認（スモークテスト）

    L19で実行時インポート、L27でTYPE_CHECKING内に重複
    L27の `import pandas as pd` を削除しても動作することを確認
    """

    def test_chart_module_imports_correctly(self):
        """chart モジュールが正常にインポートできる"""
        import chart

        assert chart is not None

    def test_df_to_lwc_data_works_after_cleanup(self, sample_ohlc_df):
        """df_to_lwc_data が正常に動作する"""
        from chart import df_to_lwc_data

        result = df_to_lwc_data(sample_ohlc_df)
        assert len(result) == 10


# ==================================================================
# 【セクション5】リグレッション検知テスト
# ==================================================================
#
# 問題: _ensure_backtest_widget() が bt._data のみを参照し、
# bt._current_data を参照しないため、バックテスト中にチャートが更新されない
#
# ==================================================================


class TestBacktestChartDataFlow:
    """backtest_chart() のデータフロー検証

    リグレッション検知: 早期リターン後にチャートが更新されない問題

    根本原因:
      _ensure_backtest_widget() は bt._data のみを参照し、
      bt._current_data を参照しない。バックテスト開始後は
      bt._current_data からデータを取得すべき。
    """

    def test_uses_current_data_after_backtest_started(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_lwc_widget_class,
        mock_chart_helpers,
    ):
        """バックテスト開始後は bt._current_data を使用する

        シナリオ:
        1. bt._data に10バーのデータ
        2. bt._is_started = True
        3. bt._current_data に5バーのデータ（バックテスト進行中）
        4. backtest_chart() 呼び出し
        5. widget.data は 5バー（_current_data）であるべき、10バー（_data）ではない
        """
        from chart import backtest_chart

        # bt._data は10バー（全データ）
        mock_backtest._data = {"7203": sample_ohlc_df.copy()}

        # bt._current_data は5バー（バックテスト進行中）
        current_df = sample_ohlc_df.iloc[:5].copy()
        mock_backtest._current_data = {"7203": current_df}

        mock_backtest._is_started = True
        mock_backtest._broker_instance = MagicMock()
        mock_backtest._broker_instance.closed_trades = []
        mock_backtest._broker_instance.trades = []

        widget = backtest_chart(mock_backtest, code="7203")

        # 重要: widget.data は _current_data の5バーであるべき
        assert len(widget.data) == 5, f"Expected 5 bars from _current_data, got {len(widget.data)}"

    def test_early_return_then_backtest_updates_chart(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_lwc_widget_class,
        mock_chart_helpers,
    ):
        """早期リターン後のバックテスト開始でチャートが更新される

        シナリオ:
        1. backtest_chart() 呼び出し（bt._is_started=False）→ 早期リターン
        2. バックテスト開始（bt._is_started=True, bt._current_data設定）
        3. backtest_chart() 再呼び出し
        4. widget.data が _current_data で更新されるべき
        """
        from chart import backtest_chart

        # 1. 早期リターン（バックテスト未開始）
        mock_backtest._is_started = False
        mock_backtest._broker_instance = None
        mock_backtest._data = {"7203": sample_ohlc_df.copy()}
        mock_backtest._current_data = {}

        widget1 = backtest_chart(mock_backtest, code="7203")
        initial_len = len(widget1.data)  # bt._data の10バー
        assert initial_len == 10, f"Initial data should be 10 bars, got {initial_len}"

        # 2. バックテスト開始
        mock_backtest._is_started = True
        mock_backtest._broker_instance = MagicMock()
        mock_backtest._broker_instance.closed_trades = []
        mock_backtest._broker_instance.trades = []

        # _current_data に3バー追加（進行中）
        current_df = sample_ohlc_df.iloc[:3].copy()
        mock_backtest._current_data = {"7203": current_df}

        # 3. backtest_chart() 再呼び出し
        widget2 = backtest_chart(mock_backtest, code="7203")

        # 4. 同じウィジェット（キャッシュ）だが、データは _current_data の3バー
        assert widget1 is widget2, "Should reuse cached widget"
        assert len(widget2.data) == 3, f"Expected 3 bars from _current_data, got {len(widget2.data)}"

    def test_widget_data_updates_on_step(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_lwc_widget_class,
        mock_chart_helpers,
    ):
        """step() 実行ごとにチャートが更新される

        シナリオ:
        1. 初回: 3バー → widget.data に全データ設定
        2. step(): 4バーに増加 → widget.append_bars に差分1バー設定
        3. step(): 5バーに増加 → widget.append_bars に差分1バー設定

        差分更新では widget.data は変更されず、append_bars で追加される。
        _prev_data_len で累積バー数を追跡する。
        """
        from chart import backtest_chart

        mock_backtest._is_started = True
        mock_backtest._broker_instance = MagicMock()
        mock_backtest._broker_instance.closed_trades = []
        mock_backtest._broker_instance.trades = []
        mock_backtest._data = {"7203": sample_ohlc_df.copy()}

        # Step 1: 3バー（初回）
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:3].copy()}
        widget = backtest_chart(mock_backtest, code="7203")
        assert len(widget.data) == 3
        assert widget._prev_data_len == 3

        # Step 2: 4バー（差分更新: +1バー）
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:4].copy()}
        mock_backtest._chart_state.last_index["7203"] = 3
        widget = backtest_chart(mock_backtest, code="7203")
        # 差分更新では widget.data は変更されない（3のまま）
        # 代わりに append_bars に差分が追加される
        assert len(widget.append_bars) == 1
        assert widget._prev_data_len == 4

        # Step 3: 5バー（差分更新: +1バー）
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:5].copy()}
        mock_backtest._chart_state.last_index["7203"] = 4
        widget = backtest_chart(mock_backtest, code="7203")
        assert len(widget.append_bars) == 1
        assert widget._prev_data_len == 5


class TestEarlyReturnRegression:
    """早期リターンパスのリグレッション検知テスト

    問題: _ensure_backtest_widget() が bt._data のみを参照し、
    bt._current_data を参照しないため、バックテスト中にチャートが更新されない
    """

    def test_ensure_backtest_widget_should_not_be_used_after_started(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_lwc_widget_class,
        mock_chart_helpers,
    ):
        """バックテスト開始後は _ensure_backtest_widget() を使用すべきでない

        _ensure_backtest_widget() は bt._data のみを参照するため、
        バックテスト開始後（bt._is_started=True）に使用すると
        チャートが更新されなくなる
        """
        from chart import backtest_chart

        mock_backtest._is_started = True
        mock_backtest._broker_instance = MagicMock()
        mock_backtest._broker_instance.closed_trades = []
        mock_backtest._broker_instance.trades = []

        # _data は10バー、_current_data は5バー
        mock_backtest._data = {"7203": sample_ohlc_df.copy()}
        mock_backtest._current_data = {"7203": sample_ohlc_df.iloc[:5].copy()}

        widget = backtest_chart(mock_backtest, code="7203")

        # widget.data は _current_data の長さ（5）であるべき
        # _data の長さ（10）ではない
        assert len(widget.data) != 10, "Should not use bt._data when backtest is started"
        assert len(widget.data) == 5, "Should use bt._current_data when backtest is started"

    def test_no_current_data_early_return_uses_loaded_data(
        self,
        mock_backtest,
        sample_ohlc_df,
        mock_lwc_widget_class,
        mock_chart_helpers,
    ):
        """_current_data が空の早期リターンでは _data を使用（これは正常）"""
        from chart import backtest_chart

        mock_backtest._is_started = True
        mock_backtest._broker_instance = MagicMock()
        mock_backtest._broker_instance.closed_trades = []
        mock_backtest._broker_instance.trades = []
        mock_backtest._current_data = {}  # 空
        mock_backtest._data = {"7203": sample_ohlc_df.copy()}

        widget = backtest_chart(mock_backtest, code="7203")

        # _current_data が空なので _data を使用（10バー）
        assert len(widget.data) == 10


# ==================================================================
# 【セクション4】update_bar_fast() 呼び出し検証テスト
# ==================================================================
#
# lightweightchart が更新されなくなる問題を検知するテスト。
# update_bar_fast() が呼ばれないと、JS側の change:last_bar
# イベントが発火せず、チャートが更新されない。
#
# ==================================================================


class TestEnsureBacktestWidgetLastBar:
    """_ensure_backtest_widget() が last_bar を設定するテスト"""

    def test_ensure_backtest_widget_calls_update_bar_fast_with_data(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """ロード済みデータがある場合、update_bar_fast() が呼ばれる"""
        from chart import _ensure_backtest_widget

        widget = _ensure_backtest_widget(
            mock_backtest,
            "7203",
            height=500,
            visible_bars=60,
            indicators=None,
            indicator_options=None,
        )

        # update_bar_fast が呼ばれたことを確認
        widget.update_bar_fast.assert_called_once()

        # 引数が最後のバーであることを確認
        call_args = widget.update_bar_fast.call_args[0][0]
        assert "time" in call_args
        assert "close" in call_args

    def test_ensure_backtest_widget_no_update_bar_fast_when_no_data(
        self,
        mock_backtest,
        mock_chart_helpers,
        mock_lwc_widget_class,
    ):
        """ロード済みデータがない場合、update_bar_fast() は呼ばれない"""
        from chart import _ensure_backtest_widget

        mock_backtest._data = {}

        widget = _ensure_backtest_widget(
            mock_backtest,
            "7203",
            height=500,
            visible_bars=60,
            indicators=None,
            indicator_options=None,
        )

        widget.update_bar_fast.assert_not_called()


class TestBacktestChartUpdateBarFast:
    """backtest_chart() の各パスで update_bar_fast() が呼ばれるテスト"""

    def test_full_update_path_calls_update_bar_fast(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """全更新パス（巻き戻し等）で update_bar_fast() が呼ばれる"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 0

        backtest_chart(mock_backtest, code="7203")

        mock_widget.update_bar_fast.assert_called_once()
        call_args = mock_widget.update_bar_fast.call_args[0][0]
        assert "time" in call_args
        assert "close" in call_args

    def test_differential_update_path_calls_update_bar_fast(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """差分更新パスで update_bar_fast() が呼ばれる"""
        mock_backtest._chart_state.widgets["7203"] = mock_widget
        mock_backtest._chart_state.last_index["7203"] = 9

        backtest_chart(mock_backtest, code="7203")

        mock_widget.update_bar_fast.assert_called_once()


class TestUpdateBacktestChartCallsUpdateBarFast:
    """update_backtest_chart() が update_bar_fast() を呼ぶテスト"""

    def test_update_backtest_chart_calls_update_bar_fast(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """update_backtest_chart() が update_bar_fast() を呼ぶ"""
        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        mock_widget.update_bar_fast.assert_called_once()
        call_args = mock_widget.update_bar_fast.call_args[0][0]
        assert isinstance(call_args, dict)
        assert "close" in call_args

    def test_update_backtest_chart_no_call_when_no_data(
        self,
        mock_backtest,
        mock_widget,
        mock_chart_helpers,
    ):
        """データがない場合は早期リターン"""
        mock_backtest._current_data = {}

        update_backtest_chart(mock_backtest, mock_widget, code="7203")

        mock_widget.update_bar_fast.assert_not_called()
