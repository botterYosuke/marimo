# BroadcastChannel HUD 実装

> **ステータス:** 完了 (2026-01-26)

## 概要

バックテスト実行時の状態情報（時刻、進捗、資産など）を marimo フロントエンドのヘッダー領域にリアルタイム表示する機能。

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│ [Backtest HUD]                        [Menu] [Settings] [X]     │
│  Time | Progress | Equity | Cash | Position | Trades            │
├─────────────────────────────────────────────────────────────────┤
│                     Notebook Content                            │
└─────────────────────────────────────────────────────────────────┘
```

### 通信フロー

```
Python Backend (BackcastPro)
    │
    ▼ bt.publish_state_headless()
mo.output.replace(<marimo-broadcast ...>)
    │
    ▼ WebSocket (cell-op)
handlers.ts: extractAndSendBroadcastMessages()
    │
    ▼ BroadcastChannel: 'backtest_channel'
useBroadcastChannel hook
    │
    ▼
BacktestHud Component (Controls.tsx 内)
```

---

## 実装ファイル

### 1. useBroadcastChannel Hook

**ファイル:** `frontend/src/hooks/useBroadcastChannel.ts`

```typescript
interface BacktestState {
  current_time: string;   // 現在のバックテスト日時
  progress: number;       // 進捗率 (0.0 - 1.0)
  equity: number;         // 総資産
  cash: number;           // 現金残高
  position: number;       // 保有株数（全銘柄合計）
  positions: Record<string, number>;  // 各銘柄のポジション
  closed_trades: number;  // 決済済み取引数
  step_index: number;     // 現在のステップ
  total_steps: number;    // 総ステップ数
}
```

### 2. BacktestHud Component

**ファイル:** `frontend/src/components/editor/controls/backtest-hud.tsx`

- `useBroadcastChannel` フックで状態を取得
- 状態が `null` の場合は `null` を返す（自動非表示）
- lucide-react アイコンで視覚的にわかりやすく

### 3. Controls.tsx への統合

**ファイル:** `frontend/src/components/editor/controls/Controls.tsx`

```tsx
{!closed && (
  <div className={topLeftControls}>
    <BacktestHud />
  </div>
)}
```

### 4. handlers.ts（WebSocket メッセージ処理）

**ファイル:** `frontend/src/core/kernel/handlers.ts`

WebSocket で受信した HTML 出力から `<marimo-broadcast>` 要素を抽出し、React のレンダリングを待たずに BroadcastChannel へ送信。

---

## BroadcastChannel メッセージ形式

```javascript
{
  type: 'backtest_update',
  data: {
    current_time: "2024-01-26",
    progress: 0.75,
    equity: 125000.0,
    cash: 50000.0,
    position: 100,
    positions: { "7203": 100, "9984": -50 },
    closed_trades: 15,
    step_index: 75,
    total_steps: 100,
    _timestamp: 1706234567890
  }
}
```

**チャンネル名:** `backtest_channel`

---

## 注意事項

1. **BroadcastChannel の制限:** 同一オリジン内でのみ動作する
2. **z-index:** `z-30` で他のコンテンツより上に配置
3. **WebSocket との違い:** BroadcastChannel はブラウザタブ間通信用

---

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-01-26 | 初期実装完了 |
| 2026-01-28 | HUD 更新問題を修正: WebSocket 受信時に broadcast メッセージを抽出するよう変更 |
