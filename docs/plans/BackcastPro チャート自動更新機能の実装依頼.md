# BackcastPro チャート自動更新機能の実装依頼

## 背景

現在、marimoノートブックでBackcastProのバックテストを実行する際、チャート更新のために複雑なセル構造が必要になっている。

**サンプルデータ**: "C:\Users\sasai\AppData\Local\Temp\fintech1.py"`

**現在の問題あるパターン**:
```python
# セル1: チャート作成
@app.cell
def _(bt, code):
    chart_widget = bt.chart(code=code)
    chart_widget
    return (chart_widget,)

# セル2: 差分更新（AutoRefreshで繰り返し実行）
@app.cell
def _(AutoRefresh, bt, chart_widget, code):
    AutoRefresh()
    bt.update_chart(chart_widget, code)
```

**理想的なパターン**:
```python
# チャートを表示するだけ - bt.step()で自動更新される
@app.cell
def _(bt, code):
    bt.chart(code=code)
```

## 要求仕様

`bt.chart()` で生成したウィジェットが `bt.step()` 呼び出し時に自動的に更新されるようにする。

### 実装方針

1. **`Backtest` クラスにウィジェット管理を追加**
   - `bt.chart()` で生成したウィジェットを内部で保持（既に `_chart_widgets` がある）
   - `bt.step()` 内で保持しているウィジェットを自動更新

2. **`bt.step()` の修正**
   - ステップ実行後に `_chart_widgets` 内の全ウィジェットを更新
   - 更新処理は `update_chart()` メソッドを再利用

## 関連ファイル

### BackcastPro

| ファイル | 説明 |
|----------|------|
| `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\backtest.py` | メインのBacktestクラス |
| `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\api\chart.py` | チャートウィジェット実装 |

### 参考: 現在の実装

**`backtest.py` の `chart()` メソッド（440行目付近）**:
- 既に `self._chart_widgets[code] = widget` でウィジェットをキャッシュしている
- 2回目以降の呼び出しでは差分更新を行う設計

**`backtest.py` の `update_chart()` メソッド（535行目付近）**:
- 既存ウィジェットの差分更新ロジック
- `widget.data`, `widget.last_bar`, `widget.markers` を更新

**`backtest.py` の `step()` メソッド**:
- バックテストを1ステップ進める
- ここにチャート自動更新を追加する

## 実装タスク

### 1. `step()` メソッドにチャート自動更新を追加

`backtest.py` の `step()` メソッドの最後に以下を追加:

```python
def step(self) -> bool:
    # ... 既存のステップ処理 ...

    # チャート自動更新
    self._update_all_charts()

    return True

def _update_all_charts(self) -> None:
    """保持している全チャートウィジェットを更新"""
    for code, widget in self._chart_widgets.items():
        try:
            self.update_chart(widget, code)
        except Exception:
            pass  # エラーは無視（ウィジェットが破棄されている可能性）
```

### 2. fintech1.py の簡素化（検証用）

```python
@app.cell
def _(AutoRefresh, bt, code):
    AutoRefresh()  # 依存関係
    bt.chart(code=code)  # step()で自動更新されるので update_chart() 不要
```

## 検証方法

1. BackcastProを修正
2. `fintech1.py` を開いてバックテスト実行
3. チャートが `bt.step()` のたびに自動更新されることを確認
4. フロントエンドがフリーズしないことを確認

## 注意事項

- `_chart_widgets` は既に存在する（`chart()` メソッドで使用）
- `update_chart()` メソッドも既に存在する
- パフォーマンス: 複数チャートがある場合、全て更新されるので負荷に注意
- エラーハンドリング: ウィジェットが破棄された場合のエラーを適切に処理

## 関連ドキュメント

- [フロントエンドフリーズ対策計画.md](./フロントエンドフリーズ対策計画.md) - 問題の原因分析
- [Marimo Frontend HeaderへのBroadcastChannel HUDの実装計画.md](./Marimo%20Frontend%20HeaderへのBroadcastChannel%20HUDの実装計画.md) - BroadcastChannel関連
