# Issue: Position 表示が "[object Object] shares"

**作成日**: 2026-02-20
**重要度**: Medium
**カテゴリ**: UI / Frontend
**ステータス**: Open

---

## 📝 概要

ステータスバーの Position（保有ポジション）フィールドが `[object Object] shares` と表示され、正しい数値が表示されない。

**現象**: ポジション数が数値ではなく、JavaScriptのオブジェクトがそのまま文字列化されている。

---

## 🔍 再現手順

1. marimoで backcast.py を開く
2. `bt.chart("7203")` を実行（チャート表示）
3. `bt.buy()` を実行（株購入）
4. ステータスバーの "Position" フィールドを確認

**期待される表示**: `100 shares` （または具体的な保有数）
**実際の表示**: `[object Object] shares`

---

## 🐛 原因（推測）

### 仮説1: フロントエンドでのオブジェクト→文字列変換エラー

Python側から送信されるポジション情報がオブジェクト形式で、フロントエンド側で `.toString()` や数値変換が正しく行われていない。

**想定される Python 出力**:
```python
{
  "position": {"7203": 100}  # オブジェクト形式
}
```

**フロントエンドでの期待処理**:
```typescript
// 正しい処理
const positionValue = Object.values(position)[0]; // 100
`${positionValue} shares`

// 現在の（誤った）処理
`${position} shares`  // "[object Object] shares"
```

### 仮説2: バックエンドでのシリアライズエラー

Python側で position をJSON化する際に、数値ではなくオブジェクトとして送信している。

**検証方法**:
```python
# game_setup.py または headless_broadcast.py でログ出力
print(f"[DEBUG] Position data: {bt.position}, type: {type(bt.position)}")
```

### 仮説3: フロントエンドのテンプレート文字列エラー

React コンポーネントでposition を表示する際のテンプレート文字列が正しくない。

**想定される問題コード**:
```typescript
// 間違い
<span>Position: {position} shares</span>

// 正しい
<span>Position: {Object.values(position)[0]} shares</span>
```

---

## 📊 影響範囲

- **ユーザー体験**: ポジション数が確認できず、取引の状況が分からない
- **UI の信頼性**: バグが明確に見えるため、アプリ全体の品質に対する信頼が低下
- **ゲーム進行**: 機能的には問題ないが、視覚的なフィードバックが不正確

**重要度 Medium の理由**: 機能に直接影響しないが、UXを著しく損なう

---

## 💡 修正提案

### ステップ1: 原因の特定

1. **ブラウザのデベロッパーツールでデータを確認**:
   ```javascript
   // Reactコンポーネントの state や props を確認
   // Positionフィールドのデータ型を確認
   ```

2. **バックエンドのログ確認**:
   ```python
   # headless_broadcast.py に追加
   print(f"[DEBUG] bt.position = {bt.position}, type = {type(bt.position)}")
   ```

3. **フロントエンドのコンポーネントを特定**:
   ```bash
   cd frontend/src
   grep -r "Position.*shares" .
   grep -r "object Object" .
   ```

### ステップ2: 修正案

**パターン1: Python側で数値に変換**

`headless_broadcast.py` または `backtest_wrapper.py` で、position を数値に変換:

```python
def publish_state_headless(bt, status_label, status_variant):
    # positionをオブジェクトから数値に変換
    position_value = sum(bt.position.values()) if hasattr(bt.position, 'values') else bt.position

    state = {
        "status_label": status_label,
        "status_variant": status_variant,
        "position": position_value,  # 数値
        # ...
    }
    # ... HTML生成
```

**パターン2: フロントエンド側で処理**

Reactコンポーネントで、positionオブジェクトを正しく処理:

```typescript
// StatusBar.tsx (仮のファイル名)
const positionValue = typeof position === 'object'
  ? Object.values(position).reduce((sum, val) => sum + val, 0)
  : position;

return <span>Position: {positionValue} shares</span>;
```

**パターン3: 型安全な処理（TypeScript）**

```typescript
interface PositionData {
  [symbol: string]: number;
}

function formatPosition(position: number | PositionData): string {
  if (typeof position === 'number') {
    return `${position} shares`;
  }

  // オブジェクトの場合は合計値を計算
  const total = Object.values(position).reduce((sum, val) => sum + val, 0);
  return `${total} shares`;
}

// 使用例
<span>Position: {formatPosition(position)}</span>
```

---

## 🎯 推奨アクション

**優先度1: フロントエンドコンポーネントの特定**

```bash
cd /d/Documents/marimo/frontend/src
grep -rn "shares" . | grep -i position
```

**優先度2: デバッグログの追加**

該当コンポーネントに以下を追加:
```typescript
console.log('[Position Debug] position data:', position, 'type:', typeof position);
```

**優先度3: 修正の実装**

原因が特定できたら、パターン3（型安全な処理）を推奨。

---

## 📎 関連ファイル

- [`headless_broadcast.py`](../../src-tauri/sample-notebooks/headless_broadcast.py) - ステータス送信
- [`backtest_wrapper.py`](../../src-tauri/sample-notebooks/backtest_wrapper.py) - バックテストラッパー
- フロントエンド: 該当コンポーネント（調査が必要）
  - 候補: `frontend/src/components/*/StatusBar.tsx` など
- [ゲームプレイレポート](../../.claude/plans/my-game-play-report.md) - バグ発見元

---

## 📝 補足情報

### backtesting.py の position の仕様

backtesting.py ライブラリでは、`position` は通常、以下の形式:

```python
# 単一銘柄の場合
bt.position = 100  # int

# 複数銘柄の場合
bt.position = {"7203": 100, "6758": 50}  # dict
```

Backcastでは単一銘柄（7203）のみを扱うため、`bt.position` は数値であるべき。もしオブジェクトが送信されているなら、ラッパー層（`backtest_wrapper.py` または `headless_broadcast.py`）で変換が必要。

### スクリーンショットの確認

ゲームプレイレポートのスクリーンショット（`05-after-buy.png`、`07-after-sell.png` など）で、Position フィールドが `[object Object] shares` と表示されていることを確認済み。

### 緊急度の評価

このバグは視覚的に非常に目立ち、アプリの品質を疑わせるため、優先的に修正すべき。ただし、機能的には問題ないため、重要度は Medium。
