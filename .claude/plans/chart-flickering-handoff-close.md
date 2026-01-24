# チャート・チカチカ問題 - 完了報告書

## 問題
marimoノートブックで100msごとにセルが再実行されると、anywidgetチャートが：
1. チカチカする（flickering）
2. チャートの内容が更新されない

## 根本原因

### 原因1: チカチカ（解決済み - 前セッション）
- セル再実行のたびに新しい`_random_id`が生成され、Reactコンポーネントが再マウントされていた
- **解決策**: `js_hash`を`_random_id`として使用し、ESMコンテンツが同じなら同じIDを維持

### 原因2: チャートが更新されない（本セッションで解決）

**問題の流れ:**
```
Python側:
1. セル再実行 → 新しいanywidgetインスタンス作成
2. init_marimo_widget() → 新しいMarimoComm作成（comm_id = UUID）
3. "open"メッセージ送信（ui_element_id未設定のため uiElement: false）
4. _initialize()でcomm.ui_element_id設定（しかし既にメッセージ送信済み）

Frontend側:
5. WebSocketメッセージ受信: {modelId: true, uiElement: false}
6. handleWidgetMessage() → MODEL_MANAGERのモデルを更新
7. UI_ELEMENT_REGISTRY.broadcastMessage() → 呼ばれない（uiElement: false）
8. LoadedSlotのuseEventListener → イベントを受信しない
9. model.current → 更新されない
10. onModelUpdate → 呼ばれない
11. チャート → 更新されない
```

**核心的な問題:**
- `comm_id`（UUID）と`jsHash`が異なる値だった
- WebSocketメッセージの`modelId`でMODEL_MANAGERを検索しても、Reactコンポーネントの`jsHash`とマッチしなかった
- `uiElement`が常に`false`のため、イベントがReactコンポーネントに届かなかった

## 実装した解決策

### 1. Python側: `comm_id`として`js_hash`を使用

**ファイル:** `marimo/_plugins/ui/_impl/anywidget/init.py`

```python
# 変更前
if getattr(w, "_model_id", None) is None:
    w._model_id = uuid4().hex

# 変更後
if getattr(w, "_model_id", None) is None:
    js: str = w._esm if hasattr(w, "_esm") else ""
    if js:
        w._model_id = hashlib.md5(
            js.encode("utf-8"), usedforsecurity=False
        ).hexdigest()
    else:
        from uuid import uuid4
        w._model_id = uuid4().hex
```

**効果:** `modelId`と`jsHash`が同じ値になり、フロントエンドでマッチング可能に

### 2. Frontend側: グローバルコールバック機能を追加

**ファイル:** `frontend/src/plugins/impl/anywidget/model.ts`

```typescript
// グローバルコールバックレジストリ
type GlobalUpdateCallback = (modelId: string) => void;
const globalUpdateCallbacks = new Set<GlobalUpdateCallback>();

export function registerGlobalModelUpdateCallback(callback: GlobalUpdateCallback): () => void {
  globalUpdateCallbacks.add(callback);
  return () => globalUpdateCallbacks.delete(callback);
}

export function notifyGlobalModelUpdate(modelId: string): void {
  globalUpdateCallbacks.forEach((cb) => cb(modelId));
}

// handleWidgetMessage内でモデル更新時にコールバック呼び出し
if (method === "update") {
  const model = await modelManager.get(modelId);
  model.updateAndEmitDiffs(stateWithBuffers);
  notifyGlobalModelUpdate(modelId);  // 追加
  return;
}
```

### 3. Frontend側: Reactコンポーネントでグローバルコールバック登録

**ファイル:** `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx`

```typescript
useEffect(() => {
  const jsHash = data.jsHash;

  const unsubscribe = registerGlobalModelUpdateCallback((modelId) => {
    if (modelId === jsHash) {
      // MODEL_MANAGERのモデルからデータを取得してローカルモデルに同期
      MODEL_MANAGER.get(modelId).then((managerModel) => {
        const keys = Object.keys(value) as Array<keyof T>;
        const updatedValue: Partial<T> = {};
        for (const key of keys) {
          updatedValue[key] = managerModel.get(key);
        }
        model.current.updateAndEmitDiffs(updatedValue as T);
      }).catch(() => {});
    }
  });

  return unsubscribe;
}, [data.jsHash, value, handleModelUpdate]);
```

## 修正後のデータフロー

```
Python側:
1. セル再実行 → 新しいanywidgetインスタンス作成
2. init_marimo_widget() → MarimoComm作成（comm_id = js_hash）
3. "update"メッセージ送信

Frontend側:
4. WebSocketメッセージ受信: {modelId: js_hash, ...}
5. handleWidgetMessage() → MODEL_MANAGERのモデルを更新
6. notifyGlobalModelUpdate(modelId) → グローバルコールバック呼び出し
7. LoadedSlotのコールバック → modelId === jsHash なので処理実行
8. MODEL_MANAGERからデータ取得 → model.currentに同期
9. updateAndEmitDiffs() → onModelUpdate()呼び出し
10. setModelUpdateCount() → Reactステート更新
11. useEffect → runAnyWidgetModule() → チャート更新
```

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `marimo/_plugins/ui/_impl/anywidget/init.py` | `comm_id`として`js_hash`を使用 |
| `frontend/src/plugins/impl/anywidget/model.ts` | グローバルコールバック機能追加 |
| `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` | グローバルコールバック登録、データ同期処理 |

## テスト結果

- **チカチカ**: 解消 ✅
- **チャート更新**: 正常動作 ✅
- **100ms高頻度更新**: 正常動作 ✅

## 備考

- この修正は`uiElement`が`false`の場合でも動作するバイパス経路を提供
- 既存の`useEventListener`によるイベント処理は維持（`uiElement`が`true`の場合用）
- ipywidgets互換性のためMODEL_MANAGERへの更新も維持
