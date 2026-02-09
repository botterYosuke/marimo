# bt.step() 200回ループ時のフリーズ問題修正

**ステータス**: 完了

## 問題

`bt.step()` を 200 回ループで呼ぶとチャートがフリーズし、`Append bars failed: Error: Cannot update oldest data` が800回発生。

## 原因分析

1. **原因1**: 全データ再送信（毎step()で80-120KB送信）
2. **原因2**: RAFバッチングによるバー欠落（199個のバーが失われる）
3. **根本原因**: `_prev_data_len=0` の状態で `append_bars` を使うと、JS側で `candleSeries.setData()` が呼ばれていない状態で `candleSeries.update()` が呼ばれてエラー発生

## 修正内容

**ファイル**: `frontend/public/files/chart.py`

```python
if prev_len == 0:
    # 初回は全データをdataで設定（append_barsではなく）
    # JS側でcandleSeries.setData()が呼ばれ、正しく初期化される
    widget.data = df_to_lwc_data(df)
    widget._prev_data_len = current_len
elif current_len > prev_len:
    # 差分更新: 新しいバーのみを取得して追加
    new_bars = df.iloc[prev_len:current_len]
    widget.append_bars = df_to_lwc_data(new_bars)
    widget._prev_data_len = current_len
```

**結果**: エラー0件（800件 → 0件）

---

## 設計意図

### `widget.data` vs `widget.append_bars` の使い分け

| 状況 | 使用するtraitlet | 理由 |
|------|------------------|------|
| 初回表示 (`prev_len=0`) | `widget.data` | JS側で `setData()` を呼び、チャートを初期化 |
| 差分更新 (`prev_len>0`) | `widget.append_bars` | JS側で `update()` を呼び、新バーのみ追加 |

### `_prev_data_len` の初期化箇所

必ず以下の3箇所で設定すること:
1. `backtest_chart()` 既存ウィジェット全データ更新時 (1332行)
2. `backtest_chart()` 既存ウィジェット差分更新時 (1358行)
3. `backtest_chart()` 初回ウィジェット作成時 (1396行)

---

## Tips

### Lightweight Charts の `series.update()` の動作

| 条件 | 結果 |
|------|------|
| 既存の時刻と同じ | バーを更新 |
| 既存の最後の時刻より新しい | 新バーを追加 |
| 既存の最初の時刻より古い | **エラー** |
| シリーズにデータがない状態で呼ぶ | **エラー** |

→ 必ず `setData()` で初期化してから `update()` を使う

### anywidget のtraitlet同期

```python
# Python側
widget.append_bars = [...]  # トリガー

# JS側
model.on("change:append_bars", () => {
    const bars = model.get("append_bars") || [];
    for (const bar of bars) {
        candleSeries.update(bar);
    }
});
```

## 関連ファイル

| ファイル | パス |
|---------|------|
| chart.py | `frontend/public/files/chart.py` |

| 関数名 | 行番号 | 役割 |
|--------|--------|------|
| `LightweightChartWidget` | 380 | anywidget ウィジェットクラス |
| `backtest_chart()` | 1237 | バックテスト用チャート表示（キャッシュ管理） |
| `update_all_backtest_charts()` | 1456 | 全チャートの差分更新 |
| `df_to_lwc_data()` | 162 | DataFrameをLWC形式に変換 |
