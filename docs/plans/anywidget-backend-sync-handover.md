# 作業引継ぎ: AnyWidget バックエンド→フロントエンド同期

## ステータス: 解決済み (2026-01-26)

**問題**: `mo.Thread` からの AnyWidget トレイト更新がフロントエンドに反映されない。

**解決策**: `useMarimoKernelConnection.tsx` で `skipGlobalNotify: false` を設定し、常にグローバルコールバック機構を使用するよう変更。

---

## 根本原因

### 発見: UIElement レジストリのエントリ削除問題

**最初に疑われた原因（ESM ロード失敗）は誤り**でした。実際の根本原因は:

1. セルが再実行されると、`UI_ELEMENT_REGISTRY.removeElementsByCell()` が呼ばれる
2. これにより、AnyWidget の UIElement エントリが削除される
3. `broadcastMessage()` は削除されたエントリを見つけられず、イベントを配信できない
4. 結果として、フロントエンドの AnyWidget コンポーネントは更新を受け取れない

**証拠（ブラウザログ）**:
```
[marimo-ui-element] connectedCallback registering: vblA-0 MARIMO-ANYWIDGET  ← 登録される
... (セル再実行で削除される)
[UIRegistry.broadcastMessage] objectId=vblA-0, entry=missing, elements=0    ← エントリがない！
```

### なぜ broadcastMessage が機能しないか

```
Python → WebSocket → useMarimoKernelConnection.tsx
                            ↓
                    handleWidgetMessage() ← MODEL_MANAGER のモデルを更新
                            ↓
                    broadcastMessage()    ← UIElement エントリを探す
                            ↓
                    entry=missing         ← セル再実行で削除済み！
```

---

## 解決策

### 変更ファイル: `frontend/src/core/websocket/useMarimoKernelConnection.tsx`

```typescript
// Before (問題あり):
handleWidgetMessage({
  ...
  skipGlobalNotify: Boolean(uiElement),  // uiElement があれば global callback をスキップ
});

// After (修正済み):
handleWidgetMessage({
  ...
  skipGlobalNotify: false,  // 常に global callback を使用
});
```

**なぜこれで動くか**:
- `skipGlobalNotify: false` により、`notifyGlobalModelUpdate()` が常に呼ばれる
- グローバルコールバック → AnyWidgetPlugin.tsx の `registerGlobalModelUpdateCallback` → ローカルモデル更新
- この経路は `UI_ELEMENT_REGISTRY` に依存しないため、エントリ削除の影響を受けない

---

## 苦労したポイント

### 1. 誤った方向に進んだ調査

**最初の仮説**: ESM モジュールのロード失敗
- エラーログ: `Failed to fetch dynamically imported module`
- 実際にはこれは**テスト環境の不安定さ**であり、根本原因ではなかった

**正しい調査方法**: ブラウザコンソールのログを詳細に追跡
- `[Model.emit] change:count, listeners: 0` ← リスナーが 0 なのが問題
- `[UIRegistry.broadcastMessage] entry=missing` ← エントリが削除されている

### 2. 二重処理問題の誤解

当初、「メッセージが二重処理されている」と考えた:
1. `handleWidgetMessage` → MODEL_MANAGER → global callback
2. `broadcastMessage` → MarimoIncomingMessageEvent → local model

しかし、実際には **broadcastMessage は機能していなかった**（エントリが削除されていたため）。
global callback だけが正しく機能していた。

### 3. 複雑なメッセージフロー

AnyWidget のメッセージフローは複雑:
```
Backend → WebSocket → useMarimoKernelConnection
                            ↓
            ┌───────────────┴───────────────┐
            ↓                               ↓
    handleWidgetMessage               broadcastMessage
    (MODEL_MANAGER.model)             (UIElementRegistry)
            ↓                               ↓
    global callback                   MarimoIncomingMessageEvent
            ↓                               ↓
    AnyWidgetPlugin.tsx               useEventListener
    (ローカルモデル更新)                (ローカルモデル更新)
```

**重要**: 両方の経路が同じことをしようとしているが、UIElementRegistry は不安定（エントリ削除）。

---

## 修正されたファイル一覧

| ファイル | 変更内容 | 重要度 |
|---------|---------|--------|
| `frontend/src/core/websocket/useMarimoKernelConnection.tsx` | `skipGlobalNotify: false` に変更 | **必須** |
| `frontend/src/plugins/impl/anywidget/model.ts` | `skipGlobalNotify` パラメータ追加（未使用） | 参考 |
| `frontend/e2e-tests/anywidget-sync.spec.ts` | テストの安定性向上 | テスト |

### デバッグログのクリーンアップ完了

以下のファイルからデバッグログを削除:
- `marimo/_plugins/ui/_impl/comm.py`
- `marimo/_messaging/notification_utils.py`
- `marimo/_plugins/ui/_impl/anywidget/init.py`
- `frontend/src/core/dom/uiregistry.ts`
- `frontend/src/core/dom/ui-element.ts`
- `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx`

---

## テスト結果

```
[SYNC TEST] Collected counts: [3, 4, 5, 6, 7, 8, 9, 10]
[SYNC TEST] Total unique counts: 8
[SYNC TEST] Max observed count: 10
2 passed (57.8s)
```

**注意**: テストはまだ若干不安定（ESM ロード失敗で時々失敗）。これは別の問題。

---

## 残る課題

### 1. E2E テストの不安定さ

ESM のダイナミックインポートが時々失敗する:
```
Failed to fetch dynamically imported module: http://127.0.0.1:2718/@file/xxx.js
```

**対策**:
- テストにリトライロジックを追加済み
- 根本的な修正には `/@file/` エンドポイントの調査が必要

### 2. broadcastMessage の役割の再検討

現在、`broadcastMessage` はほぼ機能していない（AnyWidget に対して）:
- UIElement エントリが削除されると機能しない
- global callback だけで十分動作する

将来的に `broadcastMessage` を廃止するか、エントリ削除のタイミングを見直すか検討が必要。

---

## 学んだこと

1. **ログは正しい場所に追加する**: `Model.emit` のリスナー数や `UIRegistry.broadcastMessage` のエントリ状態をログに出すことで問題が明確になった

2. **最初の仮説を疑う**: ESM ロード失敗は「見えやすいエラー」だったが、根本原因ではなかった

3. **データフローを可視化する**: 複雑なメッセージフローは図に書いて整理すると、どこで問題が起きているか特定しやすい

4. **E2E テストは不安定になりやすい**: タイミングの問題、ESM ロード、AI ダイアログなど、多くの要因でテストが不安定になる。リトライロジックや寛容なアサーションが必要

---

## コマンド

```bash
# E2E テスト実行
cd frontend && pnpm playwright test anywidget-sync.spec.ts --project=chromium

# フロントエンドビルド
cd frontend && pnpm build

# 静的ファイルコピー
rm -rf marimo/_static && cp -r frontend/dist marimo/_static
```

---

## 関連ファイル

### 必ず読むべきファイル
- `frontend/src/core/websocket/useMarimoKernelConnection.tsx` - WebSocket メッセージハンドラ
- `frontend/src/plugins/impl/anywidget/model.ts` - AnyWidget モデル管理
- `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` - React コンポーネント

### 参考ファイル
- `frontend/src/core/dom/uiregistry.ts` - UIElement レジストリ
- `marimo/_plugins/ui/_impl/from_anywidget.py` - Python 側 AnyWidget ラッパー
- `marimo/_plugins/ui/_impl/comm.py` - MarimoComm 実装
