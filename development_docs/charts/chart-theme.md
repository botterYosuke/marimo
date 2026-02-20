# Color Theme デバッグ作業依頼

## 問題
`Backtest(color_theme="light")` を指定しても、チャートがライトテーマで表示されない。

## 関連ファイル
- **BackcastPro**: `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\`
  - `backtest.py` - `__init__`で`color_theme`受け取り、`chart()`で使用
  - `api/chart.py` - `CHART_THEMES`, `get_theme_colors()`, `chart_by_df()`, JavaScript ESM
- **サンプル**: `C:\Users\sasai\AppData\Roaming\marimo\notebooks\backcast.py`

## 仮説

### 仮説1: widget.options にテーマ色が渡っていない
`chart_by_df()` で `widget.options` に `theme_colors` を展開しているが、正しく設定されていない可能性。

### 仮説2: ウィジェットキャッシュが原因
`_chart_widgets` にキャッシュされた古いウィジェットが再利用され、新しいテーマ設定が反映されない。

### 仮説3: JavaScript側で options を読み取れていない
ESM の `render()` 関数で `model.get("options")` が空または不正な値を返している。

## デバッグ手順

### Step 1: ログ追加

**backtest.py** (`chart()` メソッド内、`chart_by_df` 呼び出し前):
```python
print(f"[DEBUG] Backtest.chart() - color_theme: {self._color_theme}")
```

**api/chart.py** (`chart_by_df()` 関数内):
```python
print(f"[DEBUG] chart_by_df() - theme: {theme}")
print(f"[DEBUG] chart_by_df() - theme_colors: {theme_colors}")
print(f"[DEBUG] chart_by_df() - widget.options: {widget.options}")
```

**api/chart.py** (JavaScript ESM、`render()` 関数内):
```javascript
console.log('[DEBUG] LWC render - options:', options);
console.log('[DEBUG] LWC render - backgroundColor:', options.backgroundColor);
```

### Step 2: 実行と確認
```bash
cd C:\Users\sasai\Documents\marimo
marimo edit C:\Users\sasai\AppData\Roaming\marimo\notebooks\backcast.py
```
- Pythonログはターミナルで確認
- JSログはブラウザのDevTools Console で確認

### Step 3: 原因特定と修正
ログから以下を確認:
1. `self._color_theme` が "light" になっているか
2. `theme_colors` に正しい値が入っているか
3. `widget.options` にテーマ色が含まれているか
4. JS側で options が受け取れているか

### Step 4: ログ削除
修正完了後、追加した `print()` と `console.log()` をすべて削除。

## 期待する動作
`color_theme="light"` 指定時:
- 背景色: `#ffffff`
- テキスト色: `#191919`
- グリッド色: `#e1e1e1`
