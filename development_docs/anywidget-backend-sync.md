# AnyWidget バックエンド→フロントエンド同期

> **ステータス:** 解決済み (2026-01-26)

## 概要

`mo.Thread` からの AnyWidget トレイト更新がフロントエンドに反映されない問題を修正。

---

## 問題

**現象:** `mo.Thread` 内で AnyWidget のトレイトを更新しても、フロントエンドのチャートが更新されない。

## 根本原因

### UIElement レジストリのエントリ削除問題

1. セルが再実行されると、`UI_ELEMENT_REGISTRY.removeElementsByCell()` が呼ばれる
2. これにより、AnyWidget の UIElement エントリが削除される
3. `broadcastMessage()` は削除されたエントリを見つけられず、イベントを配信できない
4. 結果として、フロントエンドの AnyWidget コンポーネントは更新を受け取れない

**証拠（ブラウザログ）:**
```
[marimo-ui-element] connectedCallback registering: vblA-0 MARIMO-ANYWIDGET  ← 登録される
... (セル再実行で削除される)
[UIRegistry.broadcastMessage] objectId=vblA-0, entry=missing, elements=0    ← エントリがない！
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

**なぜこれで動くか:**
- `skipGlobalNotify: false` により、`notifyGlobalModelUpdate()` が常に呼ばれる
- グローバルコールバック → AnyWidgetPlugin.tsx の `registerGlobalModelUpdateCallback` → ローカルモデル更新
- この経路は `UI_ELEMENT_REGISTRY` に依存しないため、エントリ削除の影響を受けない

---

## メッセージフロー

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

**重要:** 両方の経路が同じことをしようとしているが、UIElementRegistry は不安定（エントリ削除）。

---

## 修正されたファイル一覧

| ファイル | 変更内容 | 重要度 |
|---------|---------|--------|
| `frontend/src/core/websocket/useMarimoKernelConnection.tsx` | `skipGlobalNotify: false` に変更 | **必須** |
| `frontend/src/plugins/impl/anywidget/model.ts` | `skipGlobalNotify` パラメータ追加 | 参考 |

---

## 学んだこと

1. **ログは正しい場所に追加する**: `Model.emit` のリスナー数や `UIRegistry.broadcastMessage` のエントリ状態をログに出すことで問題が明確になった

2. **最初の仮説を疑う**: ESM ロード失敗は「見えやすいエラー」だったが、根本原因ではなかった

3. **データフローを可視化する**: 複雑なメッセージフローは図に書いて整理すると、どこで問題が起きているか特定しやすい
