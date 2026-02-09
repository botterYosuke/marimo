# フロントエンドフリーズ対策

> **ステータス:** 調査完了

## 概要

marimoノートブックを開いて放置すると、数分後にフロントエンドがフリーズする問題の調査と対策。

---

## 問題の概要

- **現象:** marimoノートブックを開いて放置すると、数分後にフロントエンドがフリーズする
- **特徴:** `mo.state`を使った0.5秒間隔のリアクティブ更新を行うノートブックで発生

## E2Eテスト結果（3分間のテスト）

| 項目 | 初期値 | ピーク | 最終値 | 増加率 |
|------|--------|--------|--------|--------|
| Heap | 20MB | 116MB | 55MB | +175% |
| DOM Nodes | 620 | 31,658 | 8,772 | +1,314% |
| Event Listeners | 172 | 6,535 | 2,229 | +1,196% |

---

## 特定された根本原因

### 1. `useJotaiEffect`のサブスクリプションリーク (CRITICAL)

**ファイル:** `frontend/src/core/state/jotai.ts` 37-50行目

```typescript
// 問題のコード
export function useJotaiEffect<T>(
  atom: Atom<T>,
  effect: (value: T, prevValue: T) => void,
) {
  const store = useStore();
  useEffect(() => {
    let prevValue = store.get(atom);
    store.sub(atom, () => {  // unsubscribeが返されていない!
      const value = store.get(atom);
      effect(value, prevValue);
      prevValue = value;
    });
  }, [atom, effect, store]);
  // クリーンアップ関数がない
}
```

**修正案:**
```typescript
export function useJotaiEffect<T>(
  atom: Atom<T>,
  effect: (value: T, prevValue: T) => void,
) {
  const store = useStore();
  useEffect(() => {
    let prevValue = store.get(atom);
    const unsubscribe = store.sub(atom, () => {
      const value = store.get(atom);
      effect(value, prevValue);
      prevValue = value;
    });
    return unsubscribe; // クリーンアップ
  }, [atom, effect, store]);
}
```

### 2. `atomFamily`のキャッシュ累積 (HIGH)

**ファイル:** `frontend/src/core/cells/cells.ts` 1626-1638行目

- `cellDataAtom`, `cellRuntimeAtom`, `cellHandleAtom` がatomFamilyを使用
- セル操作時のクリーンアップが不完全
- `releaseCellAtoms()` 関数があるが、すべてのコードパスで呼ばれていない可能性

### 3. WebSocketメッセージキューの無制限蓄積 (MEDIUM)

**ファイル:** `marimo/_server/api/endpoints/ws_endpoint.py` 368行目

```python
self.message_queue = asyncio.Queue()  # maxsizeがない
```

---

## フリーズ発生メカニズム

```
mo.state更新 (0.5秒ごと)
    ↓
Jotaiサブスクリプション発火
    ↓
新しいDOMノード生成 + 古いリスナー残存
    ↓
メモリ・リスナー累積
    ↓
メインスレッドブロック (閾値超過時)
    ↓
フロントエンドフリーズ
```

---

## E2Eテスト実行方法

### 1. marimoサーバーを起動
```bash
python -m marimo edit "ノートブック.py" --port 2718 --headless
```

### 2. E2Eテストを実行
```bash
cd frontend
pnpm exec playwright test e2e-tests/freeze-test.spec.ts --headed --project=chromium
```

---

## 関連ファイル

- `frontend/src/core/state/jotai.ts` - Jotai状態管理
- `frontend/src/core/cells/cells.ts` - セル管理のatomFamily
- `frontend/src/core/websocket/useWebSocket.tsx` - WebSocket接続
- `marimo/_server/api/endpoints/ws_endpoint.py` - サーバー側WebSocket
