# -*- coding: utf-8 -*-
"""
チャート用データ変換・テーマ定義モジュール

Lightweight Charts 向けのデータ構造（辞書のリスト等）への変換ロジックや
テーマカラー設定、各種データ型の定義を扱う。
"""

from __future__ import annotations

import logging
from typing import TypedDict

import pandas as pd

_logger = logging.getLogger(__name__)


class CandleBar(TypedDict):
    """ローソク足バーの型定義"""

    time: int  # UNIXタイムスタンプ（UTC）
    open: float
    high: float
    low: float
    close: float


class VolumeBar(TypedDict):
    """出来高バーの型定義"""

    time: int
    value: float
    color: str


class MarkerData(TypedDict):
    """マーカーの型定義"""

    time: int
    position: str  # "aboveBar" or "belowBar"
    color: str
    shape: str  # "arrowUp", "arrowDown", "circle", "square"
    text: str


# =========================================================================
# テーマ定義
# =========================================================================

CHART_THEMES: dict[str, dict[str, str]] = {
    "dark": {
        "backgroundColor": "#1e1e1e",
        "textColor": "#d1d4dc",
        "gridColor": "#2B2B43",
        "upColor": "#26a69a",
        "downColor": "#ef5350",
        "exitColor": "#2196F3",
    },
    "light": {
        "backgroundColor": "#ffffff",
        "textColor": "#191919",
        "gridColor": "#e1e1e1",
        "upColor": "#26a69a",
        "downColor": "#ef5350",
        "exitColor": "#2196F3",
    },
}


def get_theme_colors(theme: str = "dark") -> dict[str, str]:
    """テーマ名から色設定を取得

    Args:
        theme: テーマ名 ("dark" または "light")

    Returns:
        テーマの色設定辞書
    """
    return CHART_THEMES.get(theme, CHART_THEMES["dark"])


def validate_color_theme(color_theme: str, stacklevel: int = 2) -> str:
    """色テーマをバリデーションして返す

    Args:
        color_theme: テーマ名
        stacklevel: warnings.warn の stacklevel

    Returns:
        バリデーション済みのテーマ名（無効な場合は "dark"）
    """
    import warnings

    valid_themes = tuple(CHART_THEMES.keys())
    if color_theme not in valid_themes:
        warnings.warn(
            f"Unknown color_theme '{color_theme}'. Using 'dark' as default. "
            f"Valid themes: {valid_themes}",
            stacklevel=stacklevel,
        )
        return "dark"
    return color_theme


# =========================================================================
# データ変換ロジック
# =========================================================================


def to_lwc_timestamp(idx, tz: str = "Asia/Tokyo") -> int:
    """
    インデックスをLightweight Charts用UTCタイムスタンプに変換

    Args:
        idx: DatetimeIndex, Timestamp, or date string
        tz: 元データのタイムゾーン（日本株はAsia/Tokyo）

    Returns:
        UTCベースのUNIXタイムスタンプ
    """
    import pandas as pd

    ts = pd.Timestamp(idx)
    if ts.tzinfo is None:
        ts = ts.tz_localize(tz)
    return int(ts.tz_convert("UTC").timestamp())


def df_to_lwc_data(df: pd.DataFrame, tz: str = "Asia/Tokyo") -> list[dict]:
    """
    DataFrameをLightweight Charts形式に変換

    Args:
        df: OHLC データを含むDataFrame（Open, High, Low, Close列が必要）
        tz: 元データのタイムゾーン

    Returns:
        Lightweight Charts形式のローソク足データリスト
    """
    if len(df) == 0:
        return []

    timestamps = [to_lwc_timestamp(idx, tz) for idx in df.index]
    return [
        {
            "time": t,
            "open": float(o),
            "high": float(h),
            "low": float(l),
            "close": float(c),
        }
        for t, o, h, l, c in zip(
            timestamps, df["Open"], df["High"], df["Low"], df["Close"]
        )
    ]


def get_last_bar(df: pd.DataFrame, tz: str = "Asia/Tokyo") -> dict:
    """
    DataFrameの最後のバーを取得

    Args:
        df: OHLC データを含むDataFrame
        tz: 元データのタイムゾーン

    Returns:
        最後のバーデータ（空DataFrameの場合は空辞書）
    """
    if len(df) == 0:
        return {}

    last_row = df.iloc[-1]
    idx = df.index[-1]

    return {
        "time": to_lwc_timestamp(idx, tz),
        "open": float(last_row["Open"]),
        "high": float(last_row["High"]),
        "low": float(last_row["Low"]),
        "close": float(last_row["Close"]),
    }


def df_to_lwc_volume(df: pd.DataFrame, tz: str = "Asia/Tokyo") -> list[dict]:
    """
    DataFrameの出来高をLightweight Charts形式に変換

    Args:
        df: Volume列を含むDataFrame
        tz: 元データのタイムゾーン

    Returns:
        Lightweight Charts形式の出来高データリスト
    """
    if "Volume" not in df.columns:
        return []

    timestamps = [to_lwc_timestamp(idx, tz) for idx in df.index]
    is_up_series = df["Close"] >= df["Open"]
    up_color = "rgba(38, 166, 154, 0.5)"
    down_color = "rgba(239, 83, 80, 0.5)"

    return [
        {"time": t, "value": float(v), "color": up_color if is_up else down_color}
        for t, v, is_up in zip(timestamps, df["Volume"], is_up_series)
    ]


def df_to_lwc_indicators(
    df: pd.DataFrame,
    indicator_columns: list[str],
    tz: str = "Asia/Tokyo",
) -> dict[str, list[dict]]:
    """
    DataFrameの指標列をLightweight Charts形式に変換

    Args:
        df: 指標列を含むDataFrame
        indicator_columns: 指標列名のリスト（例: ['SMA_20', 'SMA_50']）
        tz: 元データのタイムゾーン

    Returns:
        指標名をキーとし、Lightweight Charts形式のデータリストを値とする辞書
        NaN値は自動的にスキップされる
    """
    import warnings

    result = {}

    for col_name in indicator_columns:
        if col_name not in df.columns:
            warnings.warn(
                f"指標列 '{col_name}' が見つかりません。スキップします。",
                UserWarning,
                stacklevel=2,
            )
            continue

        # NaN値をフィルタリング（ベクトル化）
        mask = df[col_name].notna()
        filtered = df[mask]

        if len(filtered) == 0:
            warnings.warn(
                f"指標列 '{col_name}' にデータがありません（すべてNaN）。スキップします。",
                UserWarning,
                stacklevel=2,
            )
            continue

        timestamps = [to_lwc_timestamp(idx, tz) for idx in filtered.index]
        series_data = [
            {"time": t, "value": float(v)}
            for t, v in zip(timestamps, filtered[col_name])
        ]

        result[col_name] = series_data

    return result


def get_last_indicators(
    df: pd.DataFrame,
    indicator_columns: list[str],
    tz: str = "Asia/Tokyo",
) -> dict[str, dict]:
    """
    DataFrameの最後の指標値を取得

    Args:
        df: 指標列を含むDataFrame
        indicator_columns: 指標列名のリスト
        tz: 元データのタイムゾーン

    Returns:
        指標名をキーとし、最後の値を値とする辞書
        NaN値の場合は空辞書を返す
    """
    if len(df) == 0:
        return {}

    last_row = df.iloc[-1]
    idx = df.index[-1]
    time_value = to_lwc_timestamp(idx, tz)

    result = {}
    for col_name in indicator_columns:
        if col_name not in df.columns:
            continue

        value = last_row[col_name]
        if not pd.isna(value):
            result[col_name] = {
                "time": time_value,
                "value": float(value),
            }

    return result


def prepare_indicator_options(
    indicator_columns: list[str],
    user_options: dict = None,
) -> dict[str, dict]:
    """
    指標の表示オプションを準備

    Args:
        indicator_columns: 指標列名のリスト
        user_options: ユーザー指定のオプション辞書

    Returns:
        指標名をキーとし、オプション辞書を値とする辞書
    """
    DEFAULT_INDICATOR_COLORS = [
        "#2196F3",  # Blue
        "#FFC107",  # Amber
        "#9C27B0",  # Purple
        "#4CAF50",  # Green
        "#FF5722",  # Deep Orange
        "#00BCD4",  # Cyan
        "#E91E63",  # Pink
        "#8BC34A",  # Light Green
    ]

    result = {}
    user_options = user_options or {}

    for i, col_name in enumerate(indicator_columns):
        # デフォルトオプション
        default_opts = {
            "color": DEFAULT_INDICATOR_COLORS[i % len(DEFAULT_INDICATOR_COLORS)],
            "lineWidth": 2,
            "title": col_name,
        }

        # ユーザー指定のオプションでマージ
        if col_name in user_options:
            default_opts.update(user_options[col_name])

        result[col_name] = default_opts

    return result


def _prepare_chart_df(df: pd.DataFrame) -> pd.DataFrame:
    """チャート表示用データを準備"""
    df = df.copy()

    # DatetimeIndexの場合はそのまま使用
    if isinstance(df.index, pd.DatetimeIndex):
        df.index.name = "Date"
    elif "Date" in df.columns:
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.set_index("Date")
    elif "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date")
        df.index.name = "Date"
    else:
        try:
            df.index = pd.to_datetime(df.index)
            df.index.name = "Date"
        except (ValueError, TypeError):
            pass

    # カラム名を大文字に統一
    column_mapping = {
        "open": "Open",
        "high": "High",
        "low": "Low",
        "close": "Close",
        "volume": "Volume",
    }
    for lower, upper in column_mapping.items():
        if lower in df.columns and upper not in df.columns:
            df.rename(columns={lower: upper}, inplace=True)

    # 必要なカラムを抽出して数値変換
    required_cols = ["Open", "High", "Low", "Close", "Volume"]
    available_cols = [col for col in required_cols if col in df.columns]
    df = df[available_cols].copy()

    # 数値カラムを数値型に変換
    for col in available_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    return df.dropna()


def trades_to_markers(
    trades: list,
    code: str = None,
    show_tags: bool = True,
    tz: str = "Asia/Tokyo",
    theme_colors: dict[str, str] | None = None,
) -> list[dict]:
    """
    TradeオブジェクトをLightweight Chartsマーカー形式に変換

    Args:
        trades: Trade オブジェクトのリスト
        code: 銘柄コード（フィルタリング用）
        show_tags: 売買理由（tag）を表示するか
        tz: 元データのタイムゾーン
        theme_colors: テーマの色設定辞書

    Returns:
        Lightweight Charts形式のマーカーリスト
    """
    colors = theme_colors or get_theme_colors("dark")
    up_color = colors.get("upColor", "#26a69a")
    down_color = colors.get("downColor", "#ef5350")
    exit_color = colors.get("exitColor", "#2196F3")

    markers = []

    for trade in trades:
        # codeが指定されている場合はフィルタリング
        if code is not None and hasattr(trade, "code") and trade.code != code:
            continue

        is_long = trade.size > 0
        tag = getattr(trade, "tag", None)

        # エントリーマーカー
        entry_text = "BUY" if is_long else "SELL"
        if show_tags and tag:
            entry_text = f"{entry_text}: {tag}"

        markers.append(
            {
                "time": to_lwc_timestamp(trade.entry_time, tz),
                "position": "belowBar" if is_long else "aboveBar",
                "color": up_color if is_long else down_color,
                "shape": "arrowUp" if is_long else "arrowDown",
                "text": entry_text,
            }
        )

        # イグジットマーカー（決済済みの場合）
        exit_time = getattr(trade, "exit_time", None)
        exit_price = getattr(trade, "exit_price", None)
        if exit_time is not None and exit_price is not None:
            pnl = (exit_price - trade.entry_price) * trade.size
            markers.append(
                {
                    "time": to_lwc_timestamp(exit_time, tz),
                    "position": "aboveBar" if is_long else "belowBar",
                    "color": exit_color,
                    "shape": "circle",
                    "text": f"EXIT ({pnl:+.0f})",
                }
            )

    # 時間順にソート（Lightweight Chartsの要件）
    markers.sort(key=lambda x: x["time"])
    return markers
