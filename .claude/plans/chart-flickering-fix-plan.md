# チャート・チカチカ問題 改修プラン

## 前提

- **分析レポート**: [chart-flickering-analysis.md](chart-flickering-analysis.md)
- **既存プラン**: [lightweight-charts-anywidget.md](lightweight-charts-anywidget.md)
- **根本原因**: セル再実行時の`random-id`変更によるReactコンポーネント完全再マウント

---

## 改修アプローチ一覧

| アプローチ | 難易度 | 効果 | 即効性 |
|-----------|--------|------|--------|
| **C. jsHashをキーに変更** ★推奨 | **最低** | **高** | ✅ **最高** |
| A. アプリケーション改善 | 低 | 中 | ✅ 高 |
| B. anywidget差分更新 | 中 | 高 | ✅ 高 |
| D. フロントエンド遷移アニメーション | 低 | 低 | ✅ 高 |

---

## A. アプリケーションレベル改善 (即効性: 高)

### A1. ウィジェットをmo.state()で保持

**問題**: 毎回`bt.chart()`を呼ぶと新しいオブジェクトが生成される

**解決**: チャートウィジェットをstateで保持し、再生成を防ぐ

```python
@app.cell
def _(mo):
    # チャートウィジェットを一度だけ作成して保持
    from lightweight_chart_widget import LightweightChartWidget

    get_widget, set_widget = mo.state(None)

    if get_widget() is None:
        widget = LightweightChartWidget()
        widget.options = {"height": 500}
        set_widget(widget)

    return get_widget, set_widget

@app.cell
def _(get_widget, mo):
    # 表示用セル（ウィジェットインスタンスは変わらない）
    widget = get_widget()
    if widget:
        mo.ui.anywidget(widget)
```

### A2. データ更新と表示を分離

**原則**: 表示セルとデータ更新セルを分ける

```python
@app.cell
def _(mo):
    # ウィジェット作成（このセルは1回だけ実行）
    widget = LightweightChartWidget()
    wrapped = mo.ui.anywidget(widget)
    return widget, wrapped

@app.cell
def _(wrapped):
    # 表示専用セル（依存関係がないので再実行されない）
    wrapped

@app.cell
def _(bt, code, current_step, widget, my_strategy):
    # データ更新セル（refreshで再実行される）
    bt.goto(current_step, strategy=my_strategy)
    df = bt._current_data[code]

    # widgetのトレイトを更新（フロントエンドで差分反映）
    widget.last_bar = get_last_bar(df)
```

### A3. 情報パネルのみ更新

チャート自体は更新せず、情報パネルだけを更新する:

```python
@app.cell
def _(bt, mo):
    # 静的なチャート（初回のみ）
    full_df = bt._current_data[code]
    chart = bt.chart(code=code, height=500, show_tags=True)
    chart

@app.cell
def _(bt, code, current_step, mo, my_strategy):
    # 情報パネル（高頻度更新OK）
    bt.goto(current_step, strategy=my_strategy)

    mo.md(f"""
    | 項目 | 値 |
    |------|-----|
    | 日時 | {bt.current_time} |
    | 資産 | ¥{bt.equity:,.0f} |
    """)
```

---

## B. anywidget差分更新 (推奨)

### B1. Lightweight Charts + anywidget

既存プラン [lightweight-charts-anywidget.md](lightweight-charts-anywidget.md) を実装。

**核心**: `series.update(lastBar)` による差分更新

```python
class LightweightChartWidget(anywidget.AnyWidget):
    data = traitlets.List([]).tag(sync=True)      # 全データ（初回のみ）
    last_bar = traitlets.Dict({}).tag(sync=True)  # 差分更新用
```

```javascript
// JavaScript側
model.on("change:last_bar", () => {
    const bar = model.get("last_bar");
    candleSeries.update(bar);  // ★ 差分更新（DOM再構築なし）
});
```

**効果**:
- DOMの再構築なし
- Canvasの増分描画
- 100ms更新でもスムーズ

### B2. 実装手順

1. `lightweight_chart_widget.py` を作成
2. fintech1.pyを改修してLightweightChartWidgetを使用
3. 差分更新ロジックの実装

---

## C. js-url安定化 (marimo本体改修) ★推奨

### C1. 真の問題

```python
# marimo/_runtime/virtual_file/virtual_file.py:41-42
def random_filename(ext: str) -> str:
    basename = tid + "-" + "".join(random.choices(_ALPHABET, k=8))
    return f"{basename}.{ext}"  # ★ 毎回ランダム
```

セル再実行のたびに新しいランダムファイル名が生成され、`js-url`が変わる。

### C2. 改修案: js_hashをファイル名に使用

**既存コード** (from_anywidget.py:226-228):
```python
js_hash: str = hashlib.md5(js.encode("utf-8"), usedforsecurity=False).hexdigest()
```

このハッシュは既に計算されているが、ファイル名には使われていない。

**改修案**: コンテンツベースのファイル名を使用

```python
# marimo/_runtime/virtual_file/virtual_file.py に追加
def content_based_filename(ext: str, content_hash: str) -> str:
    """コンテンツハッシュに基づく安定したファイル名"""
    return f"cached-{content_hash[:16]}.{ext}"

# または、from_anywidget.py を改修
def __init__(self, widget: AnyWidget):
    js: str = widget._esm if hasattr(widget, "_esm") else ""
    js_hash = hashlib.md5(js.encode("utf-8"), usedforsecurity=False).hexdigest()

    # ★ ハッシュベースのファイル名を使用
    js_filename = f"anywidget-{js_hash[:16]}.js"
    js_url = mo_data.js_with_filename(js, js_filename).url  # 新API
```

### C3. 代替案: キャッシュの強化

```python
# グローバルキャッシュ: ESMコンテンツ → VirtualFile
_js_cache: dict[str, VirtualFile] = {}

def get_cached_js_url(js: str) -> str:
    js_hash = hashlib.md5(js.encode("utf-8"), usedforsecurity=False).hexdigest()
    if js_hash not in _js_cache:
        _js_cache[js_hash] = mo_data.js(js)
    return _js_cache[js_hash].url
```

### C4. フロントエンド側の改修（代替案）

**ファイル**: `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx`

```typescript
// 現状: jsUrlをキーとして使用（jsUrlが変わると再マウント）
const key = randomId ?? jsUrl;

// 改修案: jsHashをキーとして使用（内容が同じなら再マウントしない）
const jsHash = props.data.jsHash;
const key = randomId ?? jsHash ?? jsUrl;
```

**効果**: ESMの内容が同じなら`jsHash`も同じ → 再マウントしない

**リスク**: 低（jsHashは既に送信されている）

### C5. 推奨実装

**最小改修**: フロントエンドのキーを`jsHash`に変更

```typescript
// frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx:178
// Before:
const key = randomId ?? jsUrl;

// After:
const jsHash = props.data.jsHash;
const key = randomId ?? jsHash ?? jsUrl;
```

これにより:
- ESMの内容が同じならキーが同じ
- 再マウントが発生しない
- チカチカが解消される

---

## D. 遷移アニメーション (視覚的軽減)

### D1. CSSフェードアニメーション

```css
/* frontend/src/plugins/impl/anywidget/anywidget.css */
:host {
    transition: opacity 0.15s ease-in-out;
}

:host(.loading) {
    opacity: 0.7;
}
```

**効果**: チカチカを視覚的にソフトにする（根本解決ではない）

---

## 推奨実装順序

### Phase 0: 最小改修 (優先度: 最高) ★推奨

0. **フロントエンドのキーを`jsHash`に変更**
   - 1行の変更でチカチカが解消される可能性
   - ファイル: `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx:178`
   ```typescript
   // Before:
   const key = randomId ?? jsUrl;
   // After:
   const jsHash = props.data.jsHash;
   const key = randomId ?? jsHash ?? jsUrl;
   ```

### Phase 1: 即効性のある改善 (優先度: 高)

1. **fintech1.py をアプリケーションレベルで改修**
   - ウィジェットをmo.state()で保持
   - データ更新と表示を分離

2. **Lightweight Charts + anywidget を実装**
   - 既存プラン [lightweight-charts-anywidget.md](lightweight-charts-anywidget.md) に従う
   - 差分更新で100ms更新でもスムーズに

### Phase 2: marimo本体の改善 (優先度: 中)

3. **Python側のjs-url安定化**
   - コンテンツベースのファイル名を使用
   - またはJSキャッシュを追加

### Phase 3: オプション (優先度: 低)

4. **CSSアニメーション追加**
   - 視覚的な軽減策として

---

## fintech1.py 改修例

### Before (現状)

```python
@app.cell
def _(bt, code, current_step, mo, play_switch, slider):
    bt.goto(target_step, strategy=my_strategy)
    chart = bt.chart(code=code, height=500, show_tags=True)  # ★ 毎回生成
    mo.vstack([chart, info])
```

### After (改修後)

```python
# ウィジェット作成セル
@app.cell
def _(mo):
    from lightweight_chart_widget import LightweightChartWidget, df_to_lwc_data

    chart_widget = LightweightChartWidget()
    chart_widget.options = {"height": 500}
    wrapped = mo.ui.anywidget(chart_widget)
    return chart_widget, wrapped

# 前回ステップ追跡用
@app.cell
def _(mo):
    get_prev_step, set_prev_step = mo.state(0)
    return get_prev_step, set_prev_step

# データ更新セル
@app.cell
def _(bt, chart_widget, code, current_step, get_prev_step, set_prev_step, my_strategy, df_to_lwc_data, get_last_bar):
    bt.goto(current_step, strategy=my_strategy)
    df = bt._current_data[code]
    prev_step = get_prev_step()

    needs_full_update = (
        prev_step == 0 or
        current_step < prev_step or
        current_step - prev_step > 1
    )

    if needs_full_update:
        chart_widget.data = df_to_lwc_data(df)
        chart_widget.last_bar = {}
    else:
        chart_widget.last_bar = get_last_bar(df)

    set_prev_step(current_step)
    return

# 表示セル（再実行されない）
@app.cell
def _(wrapped):
    wrapped

# 情報パネル（高頻度更新OK）
@app.cell
def _(bt, code, mo):
    mo.md(f"""
    | 項目 | 値 |
    |------|-----|
    | 日時 | {bt.current_time} |
    | 資産 | ¥{bt.equity:,.0f} |
    """)
```

---

## 期待される効果

| 項目 | Before | After |
|------|--------|-------|
| チャート更新方式 | 完全再描画 | 差分更新 |
| DOM操作 | innerHTML = "" | series.update() |
| CPU負荷 | 高 | 低 |
| チカチカ | あり | なし |
| 体感速度 | カクつく | スムーズ |

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| LightweightChartsのCDN障害 | unpkg → jsDelivrフォールバック |
| mo.state()の状態管理 | 初期化判定ロジックを実装 |
| 巻き戻し時の不整合 | prev_stepとの比較で全更新判定 |

---

## 次のアクション

1. [ ] `lightweight_chart_widget.py` を作成
2. [ ] fintech1.pyを改修版に書き換え
3. [ ] 動作確認・パフォーマンス計測
4. [ ] 必要に応じてmarimo本体への提案
