# BackcastPro リプレイ機能 CPU負荷最適化計画

## 現状の問題

- **LCP (Largest Contentful Paint)**: 6.10s（非常に遅い）
- **refresh インターバル**: 100ms でチャート全体を再描画
- **データ量**: 6084 ステップ（約24年分の日足データ）

---

## 今回の作業で判明した知識

### 1. marimo のリアクティビティ

```python
# 動作する構成
@app.cell
def _(mo):
    play_switch = mo.ui.switch(label="自動再生", value=False)
    refresh = mo.ui.refresh(default_interval="200ms")
    mo.hstack([play_switch, refresh])  # 両方とも画面に表示が必要
    return play_switch, refresh

@app.cell
def _(mo):
    get_step, set_step = mo.state(1)
    return get_step, set_step

@app.cell
def _(bt, get_step, play_switch, refresh, set_step):
    _tick = refresh.value  # 依存関係を作る
    current_step = get_step()
    if play_switch.value and current_step < len(bt.index):
        set_step(current_step + 1)
    return (current_step,)
```

**重要な発見:**
- `mo.ui.refresh` は画面に描画されていないと `value` が更新されない
- `mo.ui.button` の `on_click` 内での `mo.state` 更新は不安定
- `mo.ui.switch` + `mo.state` + `refresh.value` の組み合わせが確実に動作

### 2. CPU負荷の原因（推定）

| 原因 | 影響度 | 説明 |
|------|--------|------|
| Plotly ローソク足描画 | 高 | 毎回全データを再描画 |
| `bt.goto()` の計算 | 中 | スライダーを戻すとリセット→再計算 |
| marimo セル再実行 | 低 | リアクティブな依存関係の連鎖 |
| WebSocket 通信 | 低 | 200ms ごとの状態同期 |

---

## 最適化案

### Phase 1: チャート描画の最適化（効果: 高）

#### 1.1 表示範囲の制限
```python
def chart(self, code: str, window: int = 100, height: int = 500):
    """直近 N 本のみ表示"""
    df = self._current_data[code]
    if len(df) > window:
        df = df.iloc[-window:]  # 直近 window 本のみ
    # ... plotly 描画
```

#### 1.2 Plotly の軽量化設定
```python
fig.update_layout(
    # アニメーション無効化
    transition=dict(duration=0),
    # ホバー情報の簡略化
    hovermode='x unified',
    # レンジスライダー無効化（既存）
    xaxis_rangeslider_visible=False,
)

# トレース数の削減
fig.update_traces(
    # ホバー情報を簡略化
    hoverinfo='skip',
)
```

#### 1.3 Canvas レンダラーの使用
```python
import plotly.io as pio
pio.renderers.default = 'browser'  # または 'notebook'

# チャート生成時
fig.show(renderer='browser', config={'staticPlot': True})
```

### Phase 2: BackcastPro の最適化（効果: 中）

#### 2.1 `goto()` の差分更新
```python
def goto(self, step: int, strategy=None):
    # 現在より前に戻る場合のみリセット
    if step < self._step_index:
        self.reset()

    # 差分だけ進める（現在の実装）
    while self._step_index < step:
        if strategy:
            strategy(self)
        self.step()
```

#### 2.2 スナップショット機能（将来）
```python
class Backtest:
    def __init__(self, ...):
        self._snapshots: dict[int, Snapshot] = {}
        self._snapshot_interval = 100  # 100ステップごとにスナップショット

    def goto(self, step: int, strategy=None):
        # 最寄りのスナップショットから復元
        nearest = max(s for s in self._snapshots if s <= step)
        self._restore_snapshot(nearest)
        # 残りを進める
        while self._step_index < step:
            ...
```

```python
# 週足に変換してリプレイ
df_weekly = df.resample('W').agg({
    'Open': 'first',
    'High': 'max',
    'Low': 'min',
    'Close': 'last',
    'Volume': 'sum'
})
```

---

## 実装優先順位

| 優先度 | 施策 | 工数 | 効果 |
|--------|------|------|------|
| 1 | チャート表示範囲の制限（window=100） | 小 | 高 |
| 2 | Plotly 軽量化設定 | 小 | 中 |
| 3 | スナップショット機能 | 大 | 中 |

---

## 計測方法

```python
import time

@app.cell
def _(bt, code, current_step, mo):
    start = time.perf_counter()

    bt.goto(current_step, strategy=my_strategy)
    goto_time = time.perf_counter() - start

    chart = bt.chart(code=code)
    chart_time = time.perf_counter() - start - goto_time

    mo.md(f"goto: {goto_time*1000:.1f}ms, chart: {chart_time*1000:.1f}ms")
    # ...
```

---

## 参考: 現在の動作フロー

```
refresh (200ms tick)
    ↓
set_step(current + 1)
    ↓
current_step セル再実行
    ↓
チャートセル再実行
    ├── bt.goto(step, strategy)  ← 戦略実行 + ブローカー処理
    ├── bt.chart()               ← Plotly 描画（重い）
    └── mo.vstack([chart, info]) ← DOM 更新
```

**ボトルネック推定**: `bt.chart()` の Plotly 描画が最も重い
