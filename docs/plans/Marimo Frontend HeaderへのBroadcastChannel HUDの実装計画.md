# BroadcastChannel HUD 実装ドキュメント

## 概要

バックテスト実行時の状態情報（時刻、進捗、資産など）を marimo フロントエンドのヘッダー領域にリアルタイム表示する機能を実装した。

**背景**: 従来は `fintech1.py` 内の iframe に HUD を埋め込んでいたが、marimo の UI と統合し、より自然なユーザー体験を提供するためにフロントエンドヘッダーへ移動した。

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│ [📊 Backtest HUD]                        [Menu] [Settings] [X]  │
│  Time | Progress | Equity | Cash | Position | Trades           │
├─────────────────────────────────────────────────────────────────┤
│                     Notebook Content                            │
└─────────────────────────────────────────────────────────────────┘
```

### 通信フロー

#### ヘッドレスモード（推奨）
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

#### AnyWidget モード（従来）
```
Python Backend (BackcastPro)
    │
    ▼ bt.state_publisher()
AnyWidget (BacktestStatePublisher)
    │
    ▼ BroadcastChannel: 'backtest_channel'
useBroadcastChannel hook
    │
    ▼
BacktestHud Component (Controls.tsx 内)
```

### 設計意図

1. **疎結合**: BroadcastChannel を使用することで、Python バックエンドと React フロントエンドを疎結合に保つ
2. **自動表示/非表示**: データ受信時のみ HUD を表示し、バックテスト非実行時は UI を占有しない
3. **既存 UI との統合**: shutdown/settings ボタンと同じ高さ・スタイルで視覚的一貫性を保つ

---

## 実装ファイル

### 1. useBroadcastChannel Hook

**ファイル**: `frontend/src/hooks/useBroadcastChannel.ts`

BroadcastChannel を購読し、バックテスト状態を React state として提供する。

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

**設計ポイント**:
- `useEffect` でチャンネル購読、クリーンアップで `channel.close()`
- メッセージの `type === 'backtest_update'` を検証してから処理
- 無効なメッセージは静かに無視（エラーログなし）

### 2. BacktestHud Component

**ファイル**: `frontend/src/components/editor/controls/backtest-hud.tsx`

HUD の表示を担当する React コンポーネント。

**設計ポイント**:
- `useBroadcastChannel` フックで状態を取得
- 状態が `null` の場合は `null` を返す（自動非表示）
- lucide-react アイコンで視覚的にわかりやすく
- Tailwind CSS で marimo UI と統一されたスタイリング
- 日本円フォーマット (`toLocaleString('ja-JP')`)

### 3. Controls.tsx への統合

**ファイル**: `frontend/src/components/editor/controls/Controls.tsx`

**変更内容**:
- `topLeftControls` CSS クラスを追加（`topRightControls` のミラー配置）
- `!closed` 条件下で `BacktestHud` をレンダリング

```tsx
{!closed && (
  <div className={topLeftControls}>
    <BacktestHud />
  </div>
)}
```

### 4. handlers.ts（WebSocket メッセージ処理）

**ファイル**: `frontend/src/core/kernel/handlers.ts`

WebSocket で受信した HTML 出力から `<marimo-broadcast>` 要素を抽出し、React のレンダリングを待たずに BroadcastChannel へ送信する。

**追加関数**:
- `extractAndSendBroadcastMessages(html: string)`: HTML から broadcast メッセージを抽出・送信

**設計ポイント**:
- React のステートバッチ処理を回避するため、WebSocket 受信時点で即座に処理
- 正規表現で属性順序に依存しない抽出
- `html.includes("marimo-broadcast")` で早期リターン（パフォーマンス最適化）

### 5. broadcastChannel.ts（シングルトン管理）

**ファイル**: `frontend/src/utils/broadcastChannel.ts`

BroadcastChannel インスタンスをシングルトンで管理し、メッセージ送信を行う。

```typescript
export function sendBroadcastMessage(
  channelName: string,
  type: string,
  payload: string,  // Base64 エンコード済み JSON
): boolean
```

### 6. RenderHTML.tsx（HTML パーサー）

**ファイル**: `frontend/src/plugins/core/RenderHTML.tsx`

`handleMarimoBroadcast()` 関数で `<marimo-broadcast>` 要素を検出し、空のフラグメントを返す（表示しない）。

**注意**: メッセージ送信は handlers.ts で行うため、ここでは送信しない（重複防止）。

---

## BroadcastChannel メッセージ形式

Python 側 (`BacktestStatePublisher`) から送信されるメッセージ:

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

**チャンネル名**: `backtest_channel` (定数として両側で定義)

---

## 関連ファイル（Python 側）

| ファイル | 役割 |
|----------|------|
| `BackcastPro/api/state_publisher.py` | AnyWidget による BroadcastChannel 送信 |
| `BackcastPro/backtest.py` | `state_publisher()` メソッド定義 |

使用例:
```python
publisher = bt.state_publisher()  # セルに配置して BroadcastChannel 配信開始
```

---

## テスト方法

### 手動テスト

1. `make dev` で marimo 開発サーバーを起動
2. `fintech1.py` ノートブックを開く
3. バックテストを実行（`toggle_run()` セル）
4. 確認項目:
   - HUD がヘッダー左上に表示される
   - 各項目（Time, Progress, Equity 等）がリアルタイム更新される
   - バックテスト停止後も最終状態が表示される
   - ページリロードで HUD が消える（データ未受信状態）

### ビルド検証

```bash
cd frontend && pnpm vite build --mode development
```

---

## 注意事項

1. **BroadcastChannel の制限**: 同一オリジン内でのみ動作する
2. **z-index**: `z-30` で他のコンテンツより上に配置
3. **WebSocket との違い**: BroadcastChannel はブラウザタブ間通信用。marimo の WebSocket (`/ws`) とは別系統
4. **パフォーマンス**: 高頻度更新時は `_timestamp` でデバウンス可能（現在未実装）

---

## 今後の拡張案

- [ ] HUD の折りたたみ/展開機能
- [ ] カスタマイズ可能な表示項目
- [ ] 複数バックテストの同時監視
- [ ] グラフ/チャートの小型表示
- [ ] アラート機能（特定条件で通知）

---

## トラブルシューティング

### HUD が表示されるが更新されない問題 (2026-01-28 修正)

#### 症状
- HUD がたまに表示される（intermittent）
- 表示されても更新されない
- Python 側のログでは正常に HTML が生成されている

#### 原因
`mo.output.replace()` が高速で連続呼び出しされた場合、React がステート更新をバッチ処理し、最終状態のみをレンダリングするため。

```
Python: メッセージ 1, 2, 3, ... 40 を生成
         ↓
WebSocket: すべてのメッセージを送信
         ↓
React: バッチ処理で最終状態のみレンダリング
         ↓
RenderHTML: 1 メッセージのみ処理 → 39 メッセージが欠落
```

#### 解決策
WebSocket メッセージ受信時点で `<marimo-broadcast>` 要素を抽出し、React のレンダリングに依存せずにメッセージを送信する。

**修正ファイル:**

1. `frontend/src/core/kernel/handlers.ts`
   - `extractAndSendBroadcastMessages()` 関数を追加
   - `handleCellNotificationeration()` で HTML 出力から broadcast メッセージを抽出

```typescript
function extractAndSendBroadcastMessages(html: string): void {
  if (!html.includes("marimo-broadcast")) {
    return;
  }

  // <marimo-broadcast> タグを抽出（属性順序非依存）
  const tagRegex = /<marimo-broadcast([^>]*)>/gi;
  let match = tagRegex.exec(html);
  while (match) {
    const attrString = match[1];
    const channelMatch = /channel="([^"]+)"/.exec(attrString);
    const typeMatch = /type="([^"]+)"/.exec(attrString);
    const payloadMatch = /payload="([^"]+)"/.exec(attrString);
    if (channelMatch && typeMatch && payloadMatch) {
      sendBroadcastMessage(channelMatch[1], typeMatch[1], payloadMatch[1]);
    }
    match = tagRegex.exec(html);
  }
  // ... data-marimo-broadcast 属性も同様に処理
}
```

2. `frontend/src/plugins/core/RenderHTML.tsx`
   - `handleMarimoBroadcast()` から送信ロジックを削除（重複防止）
   - 空のフラグメントを返すのみに簡略化

#### 設計意図
- **React のバッチ処理を回避**: WebSocket メッセージ受信時点で即座に処理
- **重複送信の防止**: RenderHTML 側では送信せず、handlers.ts のみで処理
- **パフォーマンス最適化**: `html.includes("marimo-broadcast")` で早期リターン
- **属性順序非依存**: 個別の正規表現で各属性を抽出

---

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-01-26 | 初期実装完了 |
| 2026-01-28 | HUD 更新問題を修正: WebSocket 受信時に broadcast メッセージを抽出するよう変更 |
