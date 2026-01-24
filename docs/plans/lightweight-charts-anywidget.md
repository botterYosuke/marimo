# Lightweight Charts Anywidget 実装計画

## 概要

marimoでリアルタイム更新可能な金融チャートを実装するため、TradingViewのLightweight Chartsをanywidgetでラップする。

## 背景・動機

### 現状の問題
- Plotlyでローソク足チャートを100msごとに再描画
- 6000データ点で毎回全再描画 → CPU負荷高
- LCP 6.10s（非常に遅い）

### 期待される改善
| 項目 | Plotly (現状) | Lightweight Charts (目標) |
|------|--------------|--------------------------|
| レンダリング | SVG全再描画 | Canvas差分更新 |
| 100ms更新 | 全データ再描画 | 最後のバーのみ更新 |
| CPU負荷 | 高 | 低 |
| メモリ | 大 | 小 |

### 動作確認済み環境
- marimo: 0.19.6+
- Lightweight Charts: v4.2.0
- Python: 3.10+

---

## 技術設計

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  Python (marimo cell)                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LightweightChartWidget                             │    │
│  │  - data: List[dict]        # 全ローソク足データ     │    │
│  │  - last_bar: Dict          # 最新バー（差分更新用） │    │
│  │  - options: Dict           # チャート設定           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │ traitlets sync
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  JavaScript (anywidget ESM)                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  render({ model, el })                              │    │
│  │  - chart = createChart(el)                          │    │
│  │  - series = chart.addCandlestickSeries()            │    │
│  │  - model.on("change:data") → series.setData()       │    │
│  │  - model.on("change:last_bar") → series.update()    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 差分更新の仕組み

```python
# 初回: 全データ設定
widget.data = candlestick_data  # → series.setData()

# 以降: 最後のバーのみ更新
widget.last_bar = {"time": ..., "open": ..., ...}  # → series.update()
```

---

## 実装詳細

### Phase 1: 基本ウィジェット

**ファイル**: `lightweight_chart_widget.py`

```python
import anywidget
import traitlets
from typing import TypedDict

class CandleBar(TypedDict):
    """ローソク足バーの型定義"""
    time: int  # UNIXタイムスタンプ（UTC）
    open: float
    high: float
    low: float
    close: float

class LightweightChartWidget(anywidget.AnyWidget):
    """Lightweight Charts ローソク足チャートウィジェット"""

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

    // バーデータの検証
    function isValidBar(bar) {
        return bar &&
            typeof bar.time === 'number' &&
            typeof bar.open === 'number' &&
            typeof bar.high === 'number' &&
            typeof bar.low === 'number' &&
            typeof bar.close === 'number';
    }

    async function render({ model, el }) {
        // ライブラリ読み込み
        try {
            createChart = await loadLibrary();
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
                background: { color: '#1e1e1e' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#2B2B43' },
                horzLines: { color: '#2B2B43' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const candleSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // 初期データ設定
        const data = model.get("data") || [];
        if (data.length > 0) {
            candleSeries.setData(data);
            chart.timeScale().fitContent();
        }

        // データ全体が変更された時
        model.on("change:data", () => {
            const newData = model.get("data") || [];
            if (newData.length > 0) {
                candleSeries.setData(newData);
                chart.timeScale().fitContent();
            }
        });

        // 最後のバーのみ更新（差分更新）
        model.on("change:last_bar", () => {
            const bar = model.get("last_bar");
            if (isValidBar(bar)) {
                candleSeries.update(bar);
            } else if (bar && Object.keys(bar).length > 0) {
                console.warn('Invalid bar format:', bar);
            }
            // 空オブジェクトの場合は無視（クリア時）
        });

        // リサイズ対応
        const resizeObserver = new ResizeObserver(entries => {
            const { width } = entries[0].contentRect;
            chart.applyOptions({ width });
        });
        resizeObserver.observe(el);

        // クリーンアップ
        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
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
    last_bar = traitlets.Dict({}).tag(sync=True)
    options = traitlets.Dict({}).tag(sync=True)
```

### Phase 2: BackcastPro統合ヘルパー

```python
import marimo as mo
import pandas as pd
from typing import Literal

def to_lwc_timestamp(idx, tz: str = "Asia/Tokyo") -> int:
    """
    インデックスをLightweight Charts用UTCタイムスタンプに変換

    Args:
        idx: DatetimeIndex or Timestamp
        tz: 元データのタイムゾーン（日本株はAsia/Tokyo）

    Returns:
        UTCベースのUNIXタイムスタンプ
    """
    ts = pd.Timestamp(idx)
    if ts.tzinfo is None:
        ts = ts.tz_localize(tz)
    return int(ts.tz_convert("UTC").timestamp())


def df_to_lwc_data(df: pd.DataFrame, tz: str = "Asia/Tokyo") -> list[dict]:
    """DataFrameをLightweight Charts形式に変換"""
    records = []
    for idx, row in df.iterrows():
        records.append({
            "time": to_lwc_timestamp(idx, tz),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
        })
    return records


def get_last_bar(df: pd.DataFrame, tz: str = "Asia/Tokyo") -> dict:
    """DataFrameの最後のバーを取得"""
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


def create_backcast_chart(bt, code: str, height: int = 400):
    """BackcastPro用チャートウィジェットを作成"""
    widget = LightweightChartWidget()
    widget.options = {"height": height}

    # 現在のデータを設定
    df = bt._current_data[code]
    widget.data = df_to_lwc_data(df)

    return mo.ui.anywidget(widget)
```

### Phase 3: marimo ノートブック統合

```python
import marimo as mo
from lightweight_chart_widget import LightweightChartWidget, df_to_lwc_data, get_last_bar

@app.cell
def _(mo):
    # ウィジェットを一度だけ作成
    chart_widget = LightweightChartWidget()
    chart_widget.options = {"height": 500}
    wrapped = mo.ui.anywidget(chart_widget)
    return chart_widget, wrapped

@app.cell
def _(mo):
    # 前回のステップを追跡（巻き戻し判定用）
    get_prev_step, set_prev_step = mo.state(0)
    return get_prev_step, set_prev_step

@app.cell
def _(bt, chart_widget, code, current_step, get_prev_step, set_prev_step):
    # goto実行
    bt.goto(current_step, strategy=my_strategy)

    df = bt._current_data[code]
    prev_step = get_prev_step()

    # 全データ再設定が必要なケース:
    # - 初回 (prev_step == 0)
    # - 巻き戻し (current_step < prev_step)
    # - 大きなジャンプ (current_step - prev_step > 1)
    needs_full_update = (
        prev_step == 0 or
        current_step < prev_step or
        current_step - prev_step > 1
    )

    if needs_full_update:
        # 全データ設定
        chart_widget.data = df_to_lwc_data(df)
        chart_widget.last_bar = {}  # クリア（両方のイベント発火を防ぐ）
    else:
        # 差分更新: 最後のバーのみ
        chart_widget.last_bar = get_last_bar(df)

    # 現在のステップを記録
    set_prev_step(current_step)
    return

@app.cell
def _(wrapped):
    # チャート表示（再実行されても同じウィジェットインスタンス）
    wrapped
```

**巻き戻し判定のロジック:**

| ケース | 条件 | 処理 |
|--------|------|------|
| 初回表示 | `prev_step == 0` | 全データ設定 |
| 巻き戻し | `current_step < prev_step` | 全データ設定 |
| 大ジャンプ | `current_step - prev_step > 1` | 全データ設定 |
| 通常進行 | `current_step == prev_step + 1` | 差分更新 |

---

## 追加機能（オプション）

### 出来高表示

```javascript
const volumeSeries = chart.addHistogramSeries({
    color: '#26a69a',
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    scaleMargins: { top: 0.8, bottom: 0 },
});
volumeSeries.setData(volumeData);
```

### マーカー（売買シグナル）

```python
markers = traitlets.List([]).tag(sync=True)

# JavaScript側
model.on("change:markers", () => {
    const markers = model.get("markers");
    candleSeries.setMarkers(markers);
});

# Python側
widget.markers = [
    {"time": timestamp, "position": "belowBar", "color": "green", "shape": "arrowUp", "text": "Buy"},
    {"time": timestamp, "position": "aboveBar", "color": "red", "shape": "arrowDown", "text": "Sell"},
]
```

### クロスヘア連動

```javascript
chart.subscribeCrosshairMove((param) => {
    if (param.time) {
        model.set("crosshair_time", param.time);
        model.save_changes();
    }
});
```

---

## 実装順序

| Phase | 内容 | 工数 | 優先度 |
|-------|------|------|--------|
| 1 | 基本ウィジェット（ローソク足表示・差分更新） | 小 | 高 |
| 2 | BackcastPro統合ヘルパー | 小 | 高 |
| 3 | ノートブック統合・動作確認 | 小 | 高 |
| 4 | 出来高表示 | 小 | 中 |
| 5 | マーカー（売買シグナル） | 中 | 中 |
| 6 | クロスヘア連動 | 中 | 低 |

---

## 検証方法

### パフォーマンス計測

```python
import time

@app.cell
def _(bt, chart_widget, code, current_step, mo):
    start = time.perf_counter()

    bt.goto(current_step, strategy=my_strategy)
    goto_time = time.perf_counter() - start

    # 差分更新
    df = bt._current_data[code]
    last_row = df.iloc[-1]
    chart_widget.last_bar = {...}
    update_time = time.perf_counter() - start - goto_time

    mo.md(f"goto: {goto_time*1000:.1f}ms, update: {update_time*1000:.1f}ms")
```

### 期待される結果

| 項目 | Plotly (現状) | Lightweight Charts (目標) |
|------|--------------|--------------------------|
| チャート更新 | 100-500ms | <10ms |
| CPU使用率 | 高 | 低 |
| 体感速度 | カクつく | スムーズ |

---

## リスクと対策

| リスク | 対策 | 実装状況 |
|--------|------|----------|
| CDN依存 | unpkg → jsDelivr フォールバック | ✅ Phase 1 |
| ESM import失敗 | エラーメッセージ表示 | ✅ Phase 1 |
| 巻き戻し時の不整合 | prev_stepとの比較で全更新判定 | ✅ Phase 3 |
| タイムゾーンずれ | UTC変換を明示 | ✅ Phase 2 |
| 不正なバーデータ | isValidBar()で検証 | ✅ Phase 1 |
| traitlets同期競合 | 全更新時にlast_barをクリア | ✅ Phase 3 |
| メモリリーク | クリーンアップ関数で解放 | ✅ Phase 1 |
| ブラウザ互換性 | Lightweight Charts v4.2は主要ブラウザ対応 | - |

---

## テスト計画

### ユニットテスト

```python
import pytest
from lightweight_chart_widget import to_lwc_timestamp, df_to_lwc_data, get_last_bar

def test_to_lwc_timestamp_naive():
    """タイムゾーンなしのTimestampを正しく変換"""
    import pandas as pd
    ts = pd.Timestamp("2024-01-15 09:00:00")
    result = to_lwc_timestamp(ts, tz="Asia/Tokyo")
    # JST 09:00 = UTC 00:00
    assert result == pd.Timestamp("2024-01-15 00:00:00", tz="UTC").timestamp()

def test_df_to_lwc_data_format():
    """DataFrameを正しい形式に変換"""
    import pandas as pd
    df = pd.DataFrame({
        "Open": [100.0],
        "High": [110.0],
        "Low": [95.0],
        "Close": [105.0],
    }, index=pd.to_datetime(["2024-01-15"]))

    result = df_to_lwc_data(df)
    assert len(result) == 1
    assert "time" in result[0]
    assert result[0]["open"] == 100.0
    assert result[0]["close"] == 105.0

def test_get_last_bar_empty():
    """空のDataFrameで空辞書を返す"""
    import pandas as pd
    df = pd.DataFrame(columns=["Open", "High", "Low", "Close"])
    result = get_last_bar(df)
    assert result == {}
```

### パフォーマンス回帰テスト

```python
import time

def test_update_performance():
    """差分更新が10ms以内で完了"""
    widget = LightweightChartWidget()
    widget.data = df_to_lwc_data(large_df)  # 6000行

    start = time.perf_counter()
    widget.last_bar = get_last_bar(large_df)
    elapsed = time.perf_counter() - start

    assert elapsed < 0.01  # 10ms以内
```

### 手動確認項目

- [ ] 初回表示でチャートが正しく描画される
- [ ] 自動再生で滑らかに更新される（カクつきなし）
- [ ] スライダー巻き戻しで正しく再描画される
- [ ] ブラウザリサイズでチャート幅が追従する
- [ ] オフライン時にエラーメッセージが表示される

---

## 参考資料

- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [anywidget Documentation](https://anywidget.dev/)
- [marimo anywidget API](marimo/_plugins/ui/_impl/from_anywidget.py)
