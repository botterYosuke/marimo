# -*- coding: utf-8 -*-
"""
Lightweight Charts ベースの株価チャートモジュール

anywidget を使用してリアルタイム更新可能な金融チャートを提供する。
Plotly から移行し、Canvas 差分更新によりパフォーマンスを大幅に改善。
"""
from __future__ import annotations

import logging
import threading
from typing import TypedDict

import anywidget
import traitlets

import datetime

import pandas as pd

from skill_events import emit_skill

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

# =========================================================================
# デフォルト定数
# =========================================================================

DEFAULT_VISIBLE_BARS = 60  # デフォルト表示バー数（約2か月）
DEFAULT_CHART_HEIGHT = 500  # デフォルトチャート高さ（ピクセル）


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
            stacklevel=stacklevel
        )
        return "dark"
    return color_theme


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
        {"time": t, "open": float(o), "high": float(h), "low": float(l), "close": float(c)}
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
                stacklevel=2
            )
            continue

        # NaN値をフィルタリング（ベクトル化）
        mask = df[col_name].notna()
        filtered = df[mask]

        if len(filtered) == 0:
            warnings.warn(
                f"指標列 '{col_name}' にデータがありません（すべてNaN）。スキップします。",
                UserWarning,
                stacklevel=2
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
        widget.options = {"height": 500, "showVolume": True}
        widget.data = df_to_lwc_data(df)

        # 差分更新
        widget.last_bar = get_last_bar(df)
    """

    _esm = """
    // CDNフォールバック付きのインポート
    let createChart;

    async function loadLibrary() {
        const CDN_URLS = [
            'https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.mjs',
            'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.mjs',
        ];

        for (const url of CDN_URLS) {
            try {
                const mod = await import(url);
                return mod.createChart;
            } catch (e) {
                console.warn(`Failed to load from ${url}:`, e);
            }
        }
        throw new Error('All CDN sources failed');
    }

    // msgpack ライブラリ読み込み（Phase 3: バイナリプロトコル）
    let msgpackDecode = null;
    let msgpackLoadPromise = null;
    async function loadMsgpack() {
        // ESM 互換の CDN URL のみ使用
        const CDN_URLS = [
            'https://cdn.jsdelivr.net/npm/msgpack-lite@0.1.26/+esm',
            'https://cdn.jsdelivr.net/npm/@msgpack/msgpack@3.0.0-beta2/+esm',
        ];
        for (const url of CDN_URLS) {
            try {
                const mod = await import(url);
                // msgpack-lite と @msgpack/msgpack の両方に対応
                return mod.default?.decode || mod.decode;
            } catch (e) {
                console.warn(`Failed to load msgpack from ${url}:`, e);
            }
        }
        console.warn('msgpack failed to load, falling back to JSON');
        return null;
    }

    // 遅延ロード用ヘルパー
    async function ensureMsgpack() {
        if (msgpackDecode) return msgpackDecode;
        if (!msgpackLoadPromise) {
            msgpackLoadPromise = loadMsgpack();
        }
        msgpackDecode = await msgpackLoadPromise;
        return msgpackDecode;
    }

    // バーデータの検証
    function isValidBar(bar) {
        return bar &&
            typeof bar.time === 'number' &&
            typeof bar.open === 'number' &&
            typeof bar.high === 'number' &&
            typeof bar.low === 'number' &&
            typeof bar.close === 'number';
    }

    // チャートインスタンスを保持するためのキー
    // 重要: el ではなく model に保存する
    // marimo の AnyWidgetPlugin は値が変わるたびに render() を呼び出し、
    // 毎回異なる el 要素が渡される可能性がある。
    // model オブジェクトは同一インスタンスが維持されるため、こちらに保存する。
    const MODEL_CHART_KEY = '__lwcChart';
    const MODEL_SERIES_KEY = '__lwcSeries';
    const MODEL_VOLUME_KEY = '__lwcVolume';
    const MODEL_OBSERVER_KEY = '__lwcObserver';
    const MODEL_EL_KEY = '__lwcElement';
    const MODEL_INDICATOR_SERIES_KEY = '__lwcIndicatorSeries';

    async function render({ model, el }) {
        // 既存のチャートがあるか確認（べき等性のため）
        // marimo は値が変わるたびに render() を呼び出すが、
        // change:* イベントリスナーが既にデータを更新しているため、
        // ここでは新規作成をスキップする
        if (model[MODEL_CHART_KEY]) {
            // 新しい el が渡された場合、チャートを新しい el に移動
            const oldEl = model[MODEL_EL_KEY];
            if (oldEl !== el && oldEl && model[MODEL_CHART_KEY]) {
                // 既存のチャートコンテナを新しい el に移動
                while (oldEl.firstChild) {
                    el.appendChild(oldEl.firstChild);
                }
                model[MODEL_EL_KEY] = el;
                // ResizeObserver を新しい el に付け替え
                if (model[MODEL_OBSERVER_KEY]) {
                    model[MODEL_OBSERVER_KEY].disconnect();
                    model[MODEL_OBSERVER_KEY].observe(el);
                }
            }
            return () => {};
        }

        // ライブラリ読み込み
        try {
            createChart = await loadLibrary();
            // msgpack は遅延ロード (ensureMsgpack() で初回使用時にロード)
        } catch (e) {
            el.innerHTML = '<p style="color:#ef5350;padding:20px;">Chart library failed to load. Check network connection.</p>';
            console.error(e);
            return;
        }

        // チャート作成
        const options = model.get("options") || {};
        const chart = createChart(el, {
            width: el.clientWidth || 800,
            height: options.height || 400,
            layout: {
                background: { color: options.backgroundColor || '#1e1e1e' },
                textColor: options.textColor || '#d1d4dc',
            },
            grid: {
                vertLines: { color: options.gridColor || '#2B2B43' },
                horzLines: { color: options.gridColor || '#2B2B43' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: 1,
            },
        });

        // チャートインスタンスを model に保存
        model[MODEL_CHART_KEY] = chart;
        model[MODEL_EL_KEY] = el;

        // 高頻度更新キーを設定（React 再レンダーをスキップ）
        // last_bar, last_bar_packed は model.on() で直接処理されるため、React の再レンダーは不要
        if (model.setDirectUpdateKeys) {
            model.setDirectUpdateKeys(['last_bar', 'last_bar_packed']);
        }

        // ローソク足シリーズ
        const upColor = options.upColor || '#26a69a';
        const downColor = options.downColor || '#ef5350';
        const candleSeries = chart.addCandlestickSeries({
            upColor: upColor,
            downColor: downColor,
            borderVisible: false,
            wickUpColor: upColor,
            wickDownColor: downColor,
        });
        model[MODEL_SERIES_KEY] = candleSeries;

        // 出来高シリーズ（オプション）
        let volumeSeries = null;
        const showVolume = options.showVolume !== false;
        if (showVolume) {
            volumeSeries = chart.addHistogramSeries({
                color: upColor,
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });
            chart.priceScale('volume').applyOptions({
                scaleMargins: { top: 0.8, bottom: 0 },
            });
            model[MODEL_VOLUME_KEY] = volumeSeries;
        }

        // インジケーターライン系列（Map で管理）
        model[MODEL_INDICATOR_SERIES_KEY] = new Map();

        // 初期データ設定
        const data = model.get("data") || [];
        if (data.length > 0) {
            candleSeries.setData(data);

            // 表示範囲を制限（デフォルト60本≒約2か月）
            const visibleBars = options.visibleBars || 60;
            const visibleFrom = options.visibleFrom;
            if (data.length > visibleBars) {
                if (visibleFrom !== undefined && visibleFrom !== null) {
                    chart.timeScale().setVisibleLogicalRange({
                        from: visibleFrom,
                        to: visibleFrom + visibleBars - 1,
                    });
                } else {
                    chart.timeScale().setVisibleLogicalRange({
                        from: data.length - visibleBars,
                        to: data.length - 1,
                    });
                }
            } else {
                chart.timeScale().fitContent();
            }
        }

        // 出来高データ設定
        const volumeData = model.get("volume_data") || [];
        if (volumeSeries && volumeData.length > 0) {
            volumeSeries.setData(volumeData);
        }

        // マーカー設定
        const markers = model.get("markers") || [];
        if (markers.length > 0) {
            candleSeries.setMarkers(markers);
        }

        // インジケーターライン系列の初期化
        const indicatorOptions = model.get("indicator_options") || {};
        const indicatorData = model.get("indicator_series") || {};

        for (const [name, options] of Object.entries(indicatorOptions)) {
            const lineSeries = chart.addLineSeries({
                color: options.color || '#2196F3',
                lineWidth: options.lineWidth || 2,
                title: options.title || name,
                lastValueVisible: true,
                priceLineVisible: false,
            });

            model[MODEL_INDICATOR_SERIES_KEY].set(name, lineSeries);

            // 初期データがあれば設定
            if (indicatorData[name] && indicatorData[name].length > 0) {
                lineSeries.setData(indicatorData[name]);
            }
        }

        // バー数の正確な追跡（タイムスタンプベース）
        // 注: data は L573 で取得済みの変数を使用（タイミング問題回避）
        let actualBarCount = data.length;
        let lastTimestamp = data.length > 0 ? data[data.length - 1].time : 0;

        // データ全体が変更された時
        model.on("change:data", () => {
            const newData = model.get("data") || [];
            // カウンタリセット
            actualBarCount = newData.length;
            lastTimestamp = newData.length > 0 ? newData[newData.length - 1].time : 0;

            if (newData.length > 0) {
                candleSeries.setData(newData);

                // 表示範囲を制限
                const currentOptions = model.get("options") || {};
                const visibleBars = currentOptions.visibleBars || 60;
                const visibleFrom = currentOptions.visibleFrom;
                if (newData.length > visibleBars) {
                    if (visibleFrom !== undefined && visibleFrom !== null) {
                        chart.timeScale().setVisibleLogicalRange({
                            from: visibleFrom,
                            to: visibleFrom + visibleBars - 1,
                        });
                    } else {
                        chart.timeScale().setVisibleLogicalRange({
                            from: newData.length - visibleBars,
                            to: newData.length - 1,
                        });
                    }
                } else {
                    chart.timeScale().fitContent();
                }
            }
        });

        // 出来高データ変更時
        model.on("change:volume_data", () => {
            if (!volumeSeries) return;
            const newVolumeData = model.get("volume_data") || [];
            if (newVolumeData.length > 0) {
                volumeSeries.setData(newVolumeData);
            }
        });

        // マーカー変更時
        model.on("change:markers", () => {
            const newMarkers = model.get("markers") || [];
            candleSeries.setMarkers(newMarkers);
        });

        // インジケーターデータ変更時（全データ更新）
        model.on("change:indicator_series", () => {
            const newIndicatorData = model.get("indicator_series") || {};
            const indicatorSeriesMap = model[MODEL_INDICATOR_SERIES_KEY];

            if (!indicatorSeriesMap) return;

            for (const [name, series] of indicatorSeriesMap.entries()) {
                if (newIndicatorData[name] && newIndicatorData[name].length > 0) {
                    series.setData(newIndicatorData[name]);
                }
            }
        });

        // インジケーターオプション変更時（系列再作成）
        model.on("change:indicator_options", () => {
            const newOptions = model.get("indicator_options") || {};
            const indicatorSeriesMap = model[MODEL_INDICATOR_SERIES_KEY];

            if (!indicatorSeriesMap) return;

            // 古い系列を削除
            for (const [name, series] of indicatorSeriesMap.entries()) {
                if (!newOptions[name]) {
                    chart.removeSeries(series);
                    indicatorSeriesMap.delete(name);
                }
            }

            // 新しい系列を追加
            const indicatorData = model.get("indicator_series") || {};
            for (const [name, options] of Object.entries(newOptions)) {
                if (!indicatorSeriesMap.has(name)) {
                    const lineSeries = chart.addLineSeries({
                        color: options.color || '#2196F3',
                        lineWidth: options.lineWidth || 2,
                        title: options.title || name,
                        lastValueVisible: true,
                        priceLineVisible: false,
                    });

                    indicatorSeriesMap.set(name, lineSeries);

                    if (indicatorData[name] && indicatorData[name].length > 0) {
                        lineSeries.setData(indicatorData[name]);
                    }
                }
            }
        });

        // 最後のバーのみ更新（差分更新）
        // RAF ベースのバッチ更新: ブラウザの描画サイクルに同期して更新
        // 100ms間隔の更新でも最大60fpsに制限し、CPU負荷を軽減
        let pendingBar = null;
        let rafId = null;
        let isDisposed = false;

        const flushPendingBar = () => {
            // Guard: チャートが破棄されていたらスキップ
            if (isDisposed || !model[MODEL_CHART_KEY]) {
                pendingBar = null;
                rafId = null;
                return;
            }
            try {
                if (pendingBar && isValidBar(pendingBar)) {
                    candleSeries.update(pendingBar);
                }
            } catch (e) {
                // チャートがRAF待機中に破棄された場合のエラーを抑制
                console.debug('Chart update skipped (disposed):', e);
            } finally {
                const hadBar = pendingBar !== null;
                pendingBar = null;
                rafId = null;

                // ACK 送信（描画完了通知）
                if (hadBar) {
                    model.send({ type: 'render_ack' });
                }
            }
        };

        model.on("change:last_bar", () => {
            // チャートが破棄されていたら新規更新をスキップ
            if (isDisposed) return;

            const bar = model.get("last_bar");
            if (!isValidBar(bar)) return;

            // 複数の更新が同フレーム内に発生した場合、最新の値のみ使用
            pendingBar = bar;

            // 次の描画フレームでまとめて更新
            if (rafId === null) {
                rafId = requestAnimationFrame(flushPendingBar);
            }
        });

        // バイナリプロトコル用ハンドラ (Phase 3: INP改善)
        // msgpack でペイロードを削減し、パース時間を短縮
        // ハンドラは常に登録し、msgpack は遅延ロード
        model.on("change:last_bar_packed", async () => {
            if (isDisposed) return;

            const packed = model.get("last_bar_packed");
            if (!packed || packed.byteLength === 0) return;

            // 遅延ロード: 初回使用時に msgpack をロード
            const decode = await ensureMsgpack();
            if (!decode) {
                console.warn('msgpack unavailable, ignoring packed data');
                return;
            }

            try {
                const decoded = decode(new Uint8Array(packed));
                if (!Array.isArray(decoded) || decoded.length !== 5) {
                    console.warn('Invalid packed bar format');
                    return;
                }
                const [time, open, high, low, close] = decoded;
                if (!isValidBar({ time, open, high, low, close })) {
                    console.warn('Invalid bar values after decode');
                    return;
                }
                pendingBar = { time, open, high, low, close };

                if (rafId === null) {
                    rafId = requestAnimationFrame(flushPendingBar);
                }
            } catch (e) {
                console.warn('msgpack decode failed:', e);
            }
        });

        // インジケーターの差分更新（RAFバッチング）
        let pendingIndicators = {};
        let indicatorRafId = null;

        const flushPendingIndicators = () => {
            if (isDisposed || !model[MODEL_CHART_KEY]) {
                pendingIndicators = {};
                indicatorRafId = null;
                return;
            }

            try {
                const indicatorSeriesMap = model[MODEL_INDICATOR_SERIES_KEY];
                if (!indicatorSeriesMap) return;

                for (const [name, data] of Object.entries(pendingIndicators)) {
                    const series = indicatorSeriesMap.get(name);
                    if (series && data && typeof data.time === 'number' && typeof data.value === 'number') {
                        series.update(data);
                    }
                }
            } catch (e) {
                console.debug('Indicator update skipped (disposed):', e);
            } finally {
                pendingIndicators = {};
                indicatorRafId = null;
            }
        };

        model.on("change:last_indicators", () => {
            if (isDisposed) return;

            const newIndicators = model.get("last_indicators");
            if (!newIndicators || Object.keys(newIndicators).length === 0) return;

            pendingIndicators = { ...pendingIndicators, ...newIndicators };

            if (indicatorRafId === null) {
                indicatorRafId = requestAnimationFrame(flushPendingIndicators);
            }
        });

        // 新バーの追加（RAFバッチングなしで即座に処理）
        model.on("change:append_bars", () => {
            if (isDisposed || !model[MODEL_CHART_KEY]) return;

            const bars = model.get("append_bars") || [];
            if (bars.length === 0) return;

            try {
                for (const bar of bars) {
                    if (isValidBar(bar)) {
                        candleSeries.update(bar);
                        // タイムスタンプが新しい場合のみカウント（上書きはカウントしない）
                        if (bar.time > lastTimestamp) {
                            actualBarCount++;
                            lastTimestamp = bar.time;
                        }
                    }
                }

                // 表示範囲を更新
                const currentOptions = model.get("options") || {};
                const visibleBars = currentOptions.visibleBars || 60;

                if (actualBarCount <= visibleBars) {
                    // 成長フェーズ: 全バーを表示（バーが増えるたび広がる）
                    chart.timeScale().fitContent();
                } else {
                    // スクロールフェーズ: 最新バーを右端に、visibleBars 本分を表示
                    chart.timeScale().setVisibleLogicalRange({
                        from: actualBarCount - visibleBars,
                        to: actualBarCount - 1,
                    });
                }
            } catch (e) {
                console.debug('Append bars failed:', e);
            }
        });

        // リスナー設定前に発生した last_bar の変更を適用
        // （チャート作成中にイベントが発火した場合への対処）
        const currentLastBar = model.get("last_bar");
        if (isValidBar(currentLastBar)) {
            candleSeries.update(currentLastBar);
        }

        // リサイズ対応
        const resizeObserver = new ResizeObserver(entries => {
            const { width } = entries[0].contentRect;
            if (width > 0) {
                chart.applyOptions({ width });
            }
        });
        resizeObserver.observe(el);
        model[MODEL_OBSERVER_KEY] = resizeObserver;

        // クリーンアップ関数を作成
        // 注: model に保存しているため、cleanup は最終的な破棄時のみ呼ばれる想定
        // marimo が毎回 cleanup を呼んでも、model にチャートが残っている限り再利用される
        const cleanup = () => {
            // 破棄フラグを設定（RAF コールバックでの更新を防止）
            isDisposed = true;

            // RAF をキャンセル（メモリリーク防止）
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            pendingBar = null;

            // インジケーター RAF をキャンセル
            if (indicatorRafId !== null) {
                cancelAnimationFrame(indicatorRafId);
                indicatorRafId = null;
            }
            pendingIndicators = {};

            // model にチャートが存在しない場合はスキップ
            if (!model[MODEL_CHART_KEY]) {
                return;
            }

            // 現在の el が DOM に接続されている場合は削除しない
            // （ウィジェットがまだ表示されている可能性がある）
            const currentEl = model[MODEL_EL_KEY];
            if (currentEl && currentEl.isConnected) {
                return;
            }
            if (model[MODEL_OBSERVER_KEY]) {
                model[MODEL_OBSERVER_KEY].disconnect();
            }
            if (model[MODEL_CHART_KEY]) {
                model[MODEL_CHART_KEY].remove();
            }
            // チャート参照をクリア
            delete model[MODEL_CHART_KEY];
            delete model[MODEL_SERIES_KEY];
            delete model[MODEL_VOLUME_KEY];
            delete model[MODEL_OBSERVER_KEY];
            delete model[MODEL_EL_KEY];
            delete model[MODEL_INDICATOR_SERIES_KEY];
        };

        return cleanup;
    }

    export default { render };
    """

    _css = """
    :host {
        display: block;
        width: 100%;
    }
    """

    # 同期するトレイト
    data = traitlets.List([]).tag(sync=True)
    volume_data = traitlets.List([]).tag(sync=True)
    markers = traitlets.List([]).tag(sync=True)
    last_bar = traitlets.Dict({}).tag(sync=True)
    last_bar_packed = traitlets.Bytes(b"").tag(sync=True)  # バイナリプロトコル用
    options = traitlets.Dict({}).tag(sync=True)
    indicator_series = traitlets.Dict({}).tag(sync=True)  # 指標データ
    indicator_options = traitlets.Dict({}).tag(sync=True)  # 指標表示オプション
    last_indicators = traitlets.Dict({}).tag(sync=True)  # 差分更新用
    append_bars = traitlets.List([]).tag(sync=True)  # 新バー追加用（バッチ対応）

    def __init__(self):
        super().__init__()
        self._ack_event = threading.Event()
        self.on_msg(self._handle_ack)

    def _handle_ack(self, widget, content, buffers):
        """JavaScript からの ACK を受信"""
        if content.get('type') == 'render_ack':
            self._ack_event.set()

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

        markers.append({
            "time": to_lwc_timestamp(trade.entry_time, tz),
            "position": "belowBar" if is_long else "aboveBar",
            "color": up_color if is_long else down_color,
            "shape": "arrowUp" if is_long else "arrowDown",
            "text": entry_text,
        })

        # イグジットマーカー（決済済みの場合）
        exit_time = getattr(trade, "exit_time", None)
        exit_price = getattr(trade, "exit_price", None)
        if exit_time is not None and exit_price is not None:
            pnl = (exit_price - trade.entry_price) * trade.size
            markers.append({
                "time": to_lwc_timestamp(exit_time, tz),
                "position": "aboveBar" if is_long else "belowBar",
                "color": exit_color,
                "shape": "circle",
                "text": f"EXIT ({pnl:+.0f})",
            })

    # 時間順にソート（Lightweight Chartsの要件）
    markers.sort(key=lambda x: x["time"])
    return markers


def chart_by_df(
    df: pd.DataFrame,
    *,
    trades: list = None,
    height: int = 500,
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
        widget.markers = trades_to_markers(trades, code, show_tags, tz, theme_colors)

    # 指標データ設定
    if indicators:
        widget.indicator_options = prepare_indicator_options(indicators, indicator_options)
        widget.indicator_series = df_to_lwc_indicators(original_df, indicators, tz)

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


# =========================================================================
# バックテスト用チャート関数
# =========================================================================

def _build_backtest_chart_options(color_theme: str, height: int, visible_bars: int) -> dict:
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
    height: int = DEFAULT_CHART_HEIGHT,
    visible_bars: int = DEFAULT_VISIBLE_BARS,
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
    opts = _build_backtest_chart_options(bt._chart_state.color_theme, height, visible_bars)
    widget.options = opts

    # _prev_data_len を初期化（状態管理の一貫性のため）
    if not hasattr(widget, '_prev_data_len'):
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
            widget.indicator_options = prepare_indicator_options(indicators, indicator_options)
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
    widget.markers = trades_to_markers(all_trades, code, show_tags, theme_colors=theme_colors)


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
    widget.markers = trades_to_markers(all_trades, code, show_tags, theme_colors=theme_colors)


def backtest_chart(
    bt,  # Backtest インスタンス
    code: str = None,
    height: int = 500,
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

    if not bt._is_started or bt._broker_instance is None:
        return _ensure_backtest_widget(bt, code, height, visible_bars, indicators, indicator_options)

    if code not in bt._current_data or len(bt._current_data[code]) == 0:
        return _ensure_backtest_widget(bt, code, height, visible_bars, indicators, indicator_options)

    df = bt._current_data[code]
    current_idx = len(df)

    # 全取引（アクティブ + 決済済み）を取得
    all_trades = list(bt._broker_instance.closed_trades) + list(bt._broker_instance.trades)

    # キャッシュ確認
    if code in bt._chart_state.widgets:
        widget = bt._chart_state.widgets[code]
        last_idx = bt._chart_state.last_index.get(code, 0)

        # テーマ色を含むオプションを更新（キャッシュヒット時も常に適用）
        widget.options = _build_backtest_chart_options(bt._chart_state.color_theme, height, visible_bars)

        # 巻き戻しまたは大きなジャンプの場合は全データ更新
        needs_full_update = (
            last_idx == 0 or
            current_idx < last_idx or
            current_idx - last_idx > 1
        )

        if needs_full_update:
            # 全データ更新
            theme_colors = get_theme_colors(bt._chart_state.color_theme)
            widget.data = df_to_lwc_data(df)
            widget._prev_data_len = len(df)  # 差分更新用に初期データ長を記録
            widget.markers = trades_to_markers(all_trades, code, show_tags, theme_colors=theme_colors)

            # last_bar も設定（全データ更新時）
            bar = get_last_bar(df)
            widget.update_bar_fast(bar)

            # 指標データ全更新（キャッシュからも取得を試みる）
            effective_indicators = indicators or (bt._chart_state.indicators.get(code, (None, None))[0])
            effective_options = indicator_options or (bt._chart_state.indicators.get(code, (None, None))[1])
            if effective_indicators:
                widget.indicator_options = prepare_indicator_options(effective_indicators, effective_options)
                widget.indicator_series = df_to_lwc_indicators(df, effective_indicators)
        else:
            # 差分更新: _perform_differential_chart_update() を使用
            theme_colors = get_theme_colors(bt._chart_state.color_theme)
            prev_len = getattr(widget, '_prev_data_len', 0)
            current_len = len(df)

            _perform_differential_chart_update(
                widget, df, prev_len, current_len,
                all_trades, code, show_tags, theme_colors
            )

            # last_bar も更新（リアルタイム描画用）
            bar = get_last_bar(df)
            widget.update_bar_fast(bar)

            # 指標データ差分更新（キャッシュからも取得を試みる）
            effective_indicators = indicators or (bt._chart_state.indicators.get(code, (None, None))[0])
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


def update_backtest_chart(bt, widget: LightweightChartWidget, code: str = None) -> None:
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
    prev_len = getattr(widget, '_prev_data_len', 0)
    current_len = len(df)

    theme_colors = get_theme_colors(bt._chart_state.color_theme)
    all_trades = []
    if bt._broker_instance:
        all_trades = list(bt._broker_instance.closed_trades) + list(bt._broker_instance.trades)

    # 差分更新ロジック
    if prev_len == 0 or current_len < prev_len:
        # 初回または巻き戻し: 全データ更新
        _perform_full_chart_update(
            widget, df, all_trades, code, show_tags=True, theme_colors=theme_colors
        )
    elif current_len > prev_len:
        # 増分: 差分更新
        _perform_differential_chart_update(
            widget, df, prev_len, current_len,
            all_trades, code, show_tags=True, theme_colors=theme_colors
        )
    else:
        # current_len == prev_len: マーカーのみ更新
        widget.markers = trades_to_markers(all_trades, code, show_tags=True, theme_colors=theme_colors)

    # last_bar も更新（リアルタイム描画用）
    bar = get_last_bar(df)
    widget.update_bar_fast(bar)


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
            if code not in bt._current_data or len(bt._current_data[code]) == 0:
                continue

            df = bt._current_data[code]

            # 常に全データ更新（タイミング問題回避のため append_bars は使用しない）
            widget.data = df_to_lwc_data(df)
            widget._prev_data_len = len(df)

            if bt._broker_instance:
                theme_colors = get_theme_colors(bt._chart_state.color_theme)
                all_trades = list(bt._broker_instance.closed_trades) + list(bt._broker_instance.trades)
                widget.markers = trades_to_markers(all_trades, code, show_tags=True, theme_colors=theme_colors)

            if code in bt._chart_state.indicators:
                indicators, indicator_options = bt._chart_state.indicators[code]
                if indicators:
                    widget.indicator_series = df_to_lwc_indicators(df, indicators)
                    if not widget.indicator_options:
                        widget.indicator_options = prepare_indicator_options(indicators, indicator_options)
        except Exception as e:
            # ウィジェット破棄時などのエラーをログに記録
            _logger.debug("Failed to update chart for %s: %s", code, e)
