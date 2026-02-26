# -*- coding: utf-8 -*-
"""
Lightweight Charts ベースの株価チャートモジュール

anywidget を使用してリアルタイム更新可能な金融チャートを提供する。
Plotly から移行し、Canvas 差分更新によりパフォーマンスを大幅に改善。
"""

from __future__ import annotations

import logging
import pathlib
import threading


import anywidget
import traitlets

import datetime

import pandas as pd

from lib.chart_data import (
    df_to_lwc_data,
    df_to_lwc_volume,
    df_to_lwc_indicators,
    prepare_indicator_options,
    _prepare_chart_df,
    trades_to_markers,
    get_theme_colors,
)

_logger = logging.getLogger(__name__)


class LightweightChartWidget(anywidget.AnyWidget):
    """
    Lightweight Charts ローソク足チャートウィジェット

    marimo の mo.ui.anywidget() でラップして使用する。
    差分更新に対応し、高速なリアルタイム更新が可能。

    Attributes:
        data: 全ローソク足データ（初回設定用）
        volume_data: 出来高データ
        markers: 売買マーカー
        last_bar: 最新バー（差分更新用）
        options: チャートオプション（height, showVolumeなど）

    Example:
        widget = LightweightChartWidget()
        widget.options = {"height": 600, "showVolume": True}
        widget.data = df_to_lwc_data(df)

        # 差分更新
        widget.last_bar = get_last_bar(df)
    """

    _esm = pathlib.Path(__file__).parent / "chart.js"
    _css = pathlib.Path(__file__).parent / "chart.css"

    # 同期するトレイト
    data = traitlets.List([]).tag(sync=True)
    volume_data = traitlets.List([]).tag(sync=True)
    markers = traitlets.List([]).tag(sync=True)
    last_bar = traitlets.Dict({}).tag(sync=True)
    last_bar_packed = traitlets.Bytes(b"").tag(
        sync=True
    )  # バイナリプロトコル用
    options = traitlets.Dict({}).tag(sync=True)
    indicator_series = traitlets.Dict({}).tag(sync=True)  # 指標データ
    indicator_options = traitlets.Dict({}).tag(sync=True)  # 指標表示オプション
    last_indicators = traitlets.Dict({}).tag(sync=True)  # 差分更新用
    append_bars = traitlets.List([]).tag(
        sync=True
    )  # 新バー追加用（バッチ対応）

    def __init__(self):
        super().__init__()
        self._ack_event = threading.Event()
        self._last_df: pd.DataFrame | None = None
        self._last_indicator_columns: list[str] | None = None
        self.on_msg(self._handle_message)

    def _handle_message(self, widget, content, buffers):
        """JavaScript からのメッセージを受信"""
        msg_type = content.get("type")
        if msg_type == "render_ack":
            self._ack_event.set()
        elif msg_type == "request_state":
            if self._last_df is not None and len(self._last_df) > 0:
                self.data = df_to_lwc_data(self._last_df)
            if self._last_indicator_columns and self._last_df is not None:
                self.indicator_series = df_to_lwc_indicators(
                    self._last_df, self._last_indicator_columns
                )

    def update_and_wait(self, bar: dict, timeout: float = 5.0) -> bool:
        """バーを更新し、JavaScript の描画完了を待機（同期）

        Args:
            bar: ローソク足バーデータ（time, open, high, low, close）
            timeout: タイムアウト秒数（デフォルト: 5秒）

        Returns:
            bool: ACK を受信したら True、タイムアウトしたら False
        """
        self._ack_event.clear()
        self.update_bar_fast(bar)
        return self._ack_event.wait(timeout=timeout)

    def update_bar_fast(self, bar: dict) -> None:
        """バイナリプロトコルで高速更新 (INP改善用)

        msgpack でシリアライズしてペイロードを削減し、
        JavaScript 側のパース時間を短縮する。
        msgpack が利用できない場合は JSON ベースの last_bar にフォールバック。

        Args:
            bar: ローソク足バーデータ（time, open, high, low, close）
        """
        required_keys = ("time", "open", "high", "low", "close")

        # 必要なキーが存在するか検証
        if not all(k in bar for k in required_keys):
            self.last_bar = bar
            return

        try:
            import msgpack

            self.last_bar_packed = msgpack.packb(
                [bar[k] for k in required_keys]
            )
            # last_bar も同時に更新（テストやデバッグ用）
            self.last_bar = bar
        except (ImportError, Exception):
            # msgpack が利用できない場合は JSON にフォールバック
            self.last_bar = bar


def chart_by_df(
    df: pd.DataFrame,
    *,
    trades: list = None,
    height: int = 600,
    show_tags: bool = True,
    show_volume: bool = True,
    title: str = None,
    code: str = None,
    tz: str = "Asia/Tokyo",
    visible_bars: int = 60,
    indicators: list[str] = None,
    indicator_options: dict = None,
    theme: str = "dark",
) -> LightweightChartWidget:
    """
    株価データからLightweight Chartsチャートを作成

    Args:
        df: 株価データ（pandas DataFrame）
        trades: 取引リスト（Trade オブジェクトのリスト）
        height: チャートの高さ（ピクセル）
        show_tags: 売買理由（tag）をチャートに表示するか
        show_volume: 出来高を表示するか
        title: チャートのタイトル（現在は未使用）
        code: 銘柄コード（trades のフィルタリング用）
        tz: タイムゾーン（デフォルト: Asia/Tokyo）
        visible_bars: 初期表示するバー数（デフォルト: 60本≒約2か月）
        indicators: 表示する指標列名のリスト（例: ['SMA_20', 'SMA_50']）
        indicator_options: 指標の表示オプション辞書
        theme: 色テーマ ("dark" または "light")

    Returns:
        LightweightChartWidget: anywidget ベースのチャートウィジェット
    """
    # データを整形（indicators用に元のdfを保持）
    original_df = df.copy()
    df = _prepare_chart_df(df)

    # テーマ色を取得
    theme_colors = get_theme_colors(theme)

    # ウィジェット作成
    widget = LightweightChartWidget()
    widget._grid_height = height  # グリッド自動配置用の高さヒント
    widget.options = {
        "height": height,
        "showVolume": show_volume,
        "visibleBars": visible_bars,
        **theme_colors,
    }

    # ローソク足データ設定
    widget.data = df_to_lwc_data(df, tz)

    # 出来高データ設定
    if show_volume:
        widget.volume_data = df_to_lwc_volume(df, tz)

    # 売買マーカー設定
    if trades:
        widget.markers = trades_to_markers(
            trades, code, show_tags, tz, theme_colors
        )

    # 指標データ設定
    if indicators:
        widget.indicator_options = prepare_indicator_options(
            indicators, indicator_options
        )
        widget.indicator_series = df_to_lwc_indicators(
            original_df, indicators, tz
        )

    return widget


def chart(
    code: str = "",
    from_: datetime.datetime = None,
    to: datetime.datetime = None,
    df: pd.DataFrame = None,
):
    """
    株価データを指定して株価チャートを表示する

    Args:
        code: 銘柄コード（例: "6723"）
        from_: 開始日（datetime, オプション）
        to: 終了日（datetime, オプション）
        df: 株価データ（pandas DataFrame）
    """
    if df is None:
        # 株価データを取得（BackcastProからインポート）
        from BackcastPro.api.stocks_price import stocks_price

        __sp__ = stocks_price()
        df = __sp__.get_japanese_stock_price_data(code, from_=from_, to=to)

    if df.empty:
        raise ValueError(f"銘柄コード '{code}' の株価が取得できませんでした。")

    return chart_by_df(df)
