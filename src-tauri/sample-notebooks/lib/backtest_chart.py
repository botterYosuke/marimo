# -*- coding: utf-8 -*-
"""
バックテスト用チャートモジュール

Backtest インスタンスに依存したチャート描画・更新処理を提供する。
汎用チャートウィジェットは lib.chart を参照。
"""

from __future__ import annotations

import logging
import pandas as pd

from lib.chart import LightweightChartWidget, chart_by_df
from lib.chart_data import (
    _prepare_chart_df,
    df_to_lwc_data,
    df_to_lwc_indicators,
    get_last_bar,
    get_last_indicators,
    get_theme_colors,
    prepare_indicator_options,
    trades_to_markers,
    validate_color_theme,
)


_logger = logging.getLogger(__name__)


class ChartStateManager:
    """バックテスト用チャート状態管理

    Backtestインスタンスが持つべきチャート関連の状態を管理する。
    """

    def __init__(self, color_theme: str = "dark"):
        """チャート状態を初期化

        Args:
            color_theme: 色テーマ ("dark" または "light")
        """
        self.widgets: dict = {}
        self.last_index: dict[str, int] = {}
        self.indicators: dict[str, tuple] = {}
        self.color_theme: str = validate_color_theme(color_theme, stacklevel=3)

    def reset(self, clear_cache: bool = False) -> None:
        """チャート状態をリセット

        Args:
            clear_cache: ウィジェットキャッシュもクリアするか
        """
        self.last_index = {}
        if clear_cache:
            self.widgets = {}
            self.indicators = {}


# =========================================================================
# バックテスト用チャート関数
# =========================================================================


def _build_backtest_chart_options(
    color_theme: str, height: int, visible_bars: int
) -> dict:
    """バックテスト用チャートオプションを構築（テーマ色を含む）"""
    theme_colors = get_theme_colors(color_theme)
    return {
        "height": height,
        "showVolume": False,
        "visibleBars": visible_bars,
        **theme_colors,
    }


def _ensure_backtest_widget(
    bt,
    code: str,
    height: int = 600,
    visible_bars: int = 60,
    indicators: list[str] = None,
    indicator_options: dict = None,
) -> LightweightChartWidget:
    """
    ウィジェットの存在を保証し、初期化する共通処理。

    backtest_chart() の重複コードを抽出したヘルパー関数。
    キャッシュにウィジェットがない場合は新規作成し、
    ロード済みデータがあればチャートに表示する。

    Args:
        bt: Backtest インスタンス
        code: 銘柄コード
        height: チャートの高さ（ピクセル）
        visible_bars: 表示するバー数
        indicators: 表示する指標列名のリスト
        indicator_options: 指標の表示オプション辞書

    Returns:
        LightweightChartWidget: 初期化されたウィジェット
    """
    if code not in bt._chart_state.widgets:
        bt._chart_state.widgets[code] = LightweightChartWidget()

    widget = bt._chart_state.widgets[code]
    widget._grid_height = height  # グリッド自動配置用の高さヒント
    opts = _build_backtest_chart_options(
        bt._chart_state.color_theme, height, visible_bars
    )
    widget.options = opts

    # _prev_data_len を初期化（状態管理の一貫性のため）
    if not hasattr(widget, "_prev_data_len"):
        widget._prev_data_len = 0

    # ロード済みデータがあればチャートに表示（プレビュー用）
    if code in bt._data and len(bt._data[code]) > 0:
        df = _prepare_chart_df(bt._data[code])
        widget.data = df_to_lwc_data(df)
        # プレビューデータの長さを記録（タイミング問題回避）
        widget._prev_data_len = len(df)

        # last_bar を設定（JS側の change:last_bar イベント発火用）
        bar = get_last_bar(df)
        widget.update_bar_fast(bar)

        if indicators:
            widget.indicator_options = prepare_indicator_options(
                indicators, indicator_options
            )
            widget.indicator_series = df_to_lwc_indicators(df, indicators)

    return widget


def _perform_full_chart_update(
    widget: LightweightChartWidget,
    df: "pd.DataFrame",
    all_trades: list,
    code: str,
    show_tags: bool,
    theme_colors: dict,
) -> None:
    """
    全データ更新を実行するヘルパー関数。

    Args:
        widget: 更新対象のチャートウィジェット
        df: OHLCデータフレーム
        all_trades: 全取引リスト（アクティブ + 決済済み）
        code: 銘柄コード
        show_tags: 売買理由をチャートに表示するか
        theme_colors: テーマ色設定
    """
    widget.data = df_to_lwc_data(df)
    widget._prev_data_len = len(df)
    widget.markers = trades_to_markers(
        all_trades, code, show_tags, theme_colors=theme_colors
    )


def _perform_differential_chart_update(
    widget: LightweightChartWidget,
    df: "pd.DataFrame",
    prev_len: int,
    current_len: int,
    all_trades: list,
    code: str,
    show_tags: bool,
    theme_colors: dict,
) -> None:
    """
    差分更新を実行するヘルパー関数。

    新しいバーのみを append_bars に追加する。
    widget.data は変更しない（差分更新なので）。

    Args:
        widget: 更新対象のチャートウィジェット
        df: OHLCデータフレーム
        prev_len: 前回のデータ長
        current_len: 現在のデータ長
        all_trades: 全取引リスト
        code: 銘柄コード
        show_tags: 売買理由をチャートに表示するか
        theme_colors: テーマ色設定
    """
    # 新しいバーがある場合のみ append_bars を更新
    if current_len > prev_len:
        new_bars = df.iloc[prev_len:current_len]
        widget.append_bars = df_to_lwc_data(new_bars)

    widget._prev_data_len = current_len
    widget.markers = trades_to_markers(
        all_trades, code, show_tags, theme_colors=theme_colors
    )


def backtest_chart(
    bt,  # Backtest インスタンス
    code: str = None,
    height: int = 600,
    show_tags: bool = True,
    visible_bars: int = 60,
    indicators: list[str] = None,
    indicator_options: dict = None,
) -> LightweightChartWidget:
    """
    バックテスト用のローソク足チャートを生成（売買マーカー付き）

    差分更新対応:
    - 初回呼び出し: 全データでウィジェット作成
    - 2回目以降: 既存ウィジェットを再利用し差分更新

    Args:
        bt: Backtest インスタンス
        code: 銘柄コード
        height: チャートの高さ
        show_tags: 売買理由（tag）をチャートに表示するか
        visible_bars: 初期表示するバー数（デフォルト: 60本≒約2か月）
        indicators: 表示する指標列名のリスト（例: ['SMA_20', 'SMA_50']）
        indicator_options: 指標の表示オプション辞書

    Returns:
        LightweightChartWidget
    """
    if code is None:
        if len(bt._data) == 1:
            code = list(bt._data.keys())[0]
        else:
            raise ValueError("複数銘柄がある場合はcodeを指定してください")

    # indicators をキャッシュに保存（早期リターン前に）
    if indicators:
        bt._chart_state.indicators[code] = (indicators, indicator_options)

    if not bt._is_started:
        return _ensure_backtest_widget(
            bt, code, height, visible_bars, indicators, indicator_options
        )

    if code not in bt._current_data or len(bt._current_data[code]) == 0:
        return _ensure_backtest_widget(
            bt, code, height, visible_bars, indicators, indicator_options
        )

    df = bt._current_data[code]
    current_idx = len(df)

    # 全取引（アクティブ + 決済済み）を取得
    all_trades = list(bt.closed_trades) + list(bt.trades)

    # キャッシュ確認
    if code in bt._chart_state.widgets:
        widget = bt._chart_state.widgets[code]
        last_idx = bt._chart_state.last_index.get(code, 0)

        # テーマ色を含むオプションを更新（キャッシュヒット時も常に適用）
        widget.options = _build_backtest_chart_options(
            bt._chart_state.color_theme, height, visible_bars
        )

        # 巻き戻しまたは大きなジャンプの場合は全データ更新
        needs_full_update = (
            last_idx == 0
            or current_idx < last_idx
            or current_idx - last_idx > 1
        )

        if needs_full_update:
            # 全データ更新
            theme_colors = get_theme_colors(bt._chart_state.color_theme)
            widget.data = df_to_lwc_data(df)
            widget._prev_data_len = len(df)  # 差分更新用に初期データ長を記録
            widget.markers = trades_to_markers(
                all_trades, code, show_tags, theme_colors=theme_colors
            )

            # last_bar も設定（全データ更新時）
            bar = get_last_bar(df)
            widget.update_bar_fast(bar)

            # 指標データ全更新（キャッシュからも取得を試みる）
            effective_indicators = (
                indicators
                or (bt._chart_state.indicators.get(code, (None, None))[0])
            )
            effective_options = (
                indicator_options
                or (bt._chart_state.indicators.get(code, (None, None))[1])
            )
            if effective_indicators:
                widget.indicator_options = prepare_indicator_options(
                    effective_indicators, effective_options
                )
                widget.indicator_series = df_to_lwc_indicators(
                    df, effective_indicators
                )
        else:
            # 差分更新: _perform_differential_chart_update() を使用
            theme_colors = get_theme_colors(bt._chart_state.color_theme)
            prev_len = getattr(widget, "_prev_data_len", 0)
            current_len = len(df)

            _perform_differential_chart_update(
                widget,
                df,
                prev_len,
                current_len,
                all_trades,
                code,
                show_tags,
                theme_colors,
            )

            # last_bar も更新（リアルタイム描画用）
            bar = get_last_bar(df)
            widget.update_bar_fast(bar)

            # 指標データ差分更新（キャッシュからも取得を試みる）
            effective_indicators = (
                indicators
                or (bt._chart_state.indicators.get(code, (None, None))[0])
            )
            if effective_indicators:
                last_ind = get_last_indicators(df, effective_indicators)
                if last_ind:
                    widget.last_indicators = last_ind

        bt._chart_state.last_index[code] = current_idx
        # indicators 設定をキャッシュ（update_chart用）
        if indicators:
            bt._chart_state.indicators[code] = (indicators, indicator_options)
        return widget

    # 初回: 新規ウィジェット作成
    widget = chart_by_df(
        df,
        trades=all_trades,
        height=height,
        show_tags=show_tags,
        show_volume=False,
        title=f"{code} - {bt.current_time}",
        code=code,
        visible_bars=visible_bars,
        indicators=indicators,
        indicator_options=indicator_options,
        theme=bt._chart_state.color_theme,
    )

    # 初回作成時にlast_barを設定
    bar = get_last_bar(df)
    widget.update_bar_fast(bar)

    widget._prev_data_len = len(df)  # 差分更新用に初期データ長を記録
    bt._chart_state.widgets[code] = widget
    bt._chart_state.last_index[code] = current_idx
    bt._chart_state.indicators[code] = (indicators, indicator_options)

    return widget


def update_backtest_chart(
    bt, widget: LightweightChartWidget, code: str = None
) -> None:
    """
    既存チャートウィジェットを差分更新（軽量）

    backtest_chart()と異なり、ウィジェット作成やキャッシュ管理をスキップし、
    データとマーカーの更新のみを行う。高頻度更新に最適。

    Args:
        bt: Backtest インスタンス
        widget: backtest_chart()で作成したLightweightChartWidget
        code: 銘柄コード（省略時は最初のデータを使用）

    Example:
        # セル1: チャート作成（一度だけ）
        chart_widget = backtest_chart(bt, code=code)

        # セル2: 差分更新（AutoRefreshで繰り返し）
        update_backtest_chart(bt, chart_widget, code)
    """
    if code is None:
        code = next(iter(bt._data.keys()), None)
    if code is None:
        return

    if code not in bt._current_data or len(bt._current_data[code]) == 0:
        return

    df = bt._current_data[code]
    prev_len = getattr(widget, "_prev_data_len", 0)
    current_len = len(df)

    theme_colors = get_theme_colors(bt._chart_state.color_theme)
    all_trades = []
    if bt._is_started:
        all_trades = list(bt.closed_trades) + list(bt.trades)

    # 差分更新ロジック（後退のみフル更新、前進は常に差分）
    needs_full = prev_len == 0 or current_len < prev_len

    if needs_full:
        # 初回または巻き戻し: 全データ更新
        _perform_full_chart_update(
            widget,
            df,
            all_trades,
            code,
            show_tags=True,
            theme_colors=theme_colors,
        )
    elif current_len > prev_len:
        # 増分: 差分更新
        _perform_differential_chart_update(
            widget,
            df,
            prev_len,
            current_len,
            all_trades,
            code,
            show_tags=True,
            theme_colors=theme_colors,
        )
        # 差分更新時のみ last_bar を送信（全更新時は widget.data で全バー送信済み）
        widget.update_bar_fast(get_last_bar(df))
    else:
        # current_len == prev_len: マーカーのみ更新
        widget.markers = trades_to_markers(
            all_trades, code, show_tags=True, theme_colors=theme_colors
        )

    # インジケーター更新
    if code in bt._chart_state.indicators:
        indicators, ind_opts = bt._chart_state.indicators[code]
        if indicators:
            if needs_full:
                widget.indicator_series = df_to_lwc_indicators(df, indicators)
                if not widget.indicator_options:
                    widget.indicator_options = prepare_indicator_options(
                        indicators, ind_opts
                    )
            else:
                last_ind = get_last_indicators(df, indicators)
                if last_ind:
                    widget.last_indicators = last_ind
            widget._last_indicator_columns = indicators  # 再描画復元用

    # 再描画復元用に最新 df を保持
    widget._last_df = df


def update_all_backtest_charts(bt) -> None:
    """
    Update all chart widgets registered in a Backtest instance.

    非ブロッキングで高速に動作する。
    while ループで連続呼び出ししてもフリーズしない。

    Args:
        bt: Backtest instance with _chart_state (ChartStateManager),
            _current_data, _broker_instance
    """
    for code, widget in bt._chart_state.widgets.items():
        try:
            update_backtest_chart(bt, widget, code)
        except Exception as e:
            # ウィジェット破棄時などのエラーをログに記録
            _logger.debug("Failed to update chart for %s: %s", code, e)
