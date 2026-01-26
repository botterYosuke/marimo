# marimo フロントエンドフリーズ調査 - 引継ぎドキュメント

## 作業依頼

`C:\Users\sasai\AppData\Local\Temp\fintech1.py` をmarimoで開いてしばらく放置するとフロントエンドがフリーズする問題を調査・修正してください。

## 問題の概要

- **現象**: marimoノートブックを開いて放置すると、数分後にフロントエンドがフリーズする
- **再現ファイル**: `C:\Users\sasai\AppData\Local\Temp\fintech1.py`
- **特徴**: `mo.state`を使った0.5秒間隔のリアクティブ更新を行うバックテストノートブック

## E2Eテストの実行方法

### 1. marimoサーバーを起動
```bash
cd c:/Users/sasai/Documents/marimo
c:/Users/sasai/Documents/marimo/.venv/Scripts/python.exe -m marimo edit "C:/Users/sasai/AppData/Local/Temp/fintech1.py" --port 2718 --headless
```

### 2. E2Eテストを実行
```bash
cd c:/Users/sasai/Documents/marimo/frontend
pnpm exec playwright test e2e-tests/freeze-test.spec.ts --headed --project=chromium
```

### 3. テストファイル（必要に応じて作成）

`c:/Users/sasai/Documents/marimo/frontend/e2e-tests/freeze-test.spec.ts` に以下の内容で作成：

```typescript
import { test, expect, type Page } from "@playwright/test";

const ACCESS_TOKEN = "YOUR_ACCESS_TOKEN"; // サーバー起動時に表示されるトークン
const BASE_URL = "http://127.0.0.1:2718";
const TEST_DURATION_MS = 5 * 60 * 1000; // 5分
const CHECK_INTERVAL_MS = 10 * 1000;

test.describe("Frontend Freeze Investigation", () => {
  test.setTimeout(TEST_DURATION_MS + 60000);

  test("Monitor notebook for freeze over time", async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");

    await page.goto(`${BASE_URL}?access_token=${ACCESS_TOKEN}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(5000);

    const startTime = Date.now();
    let initialMetrics: any = null;

    while (Date.now() - startTime < TEST_DURATION_MS) {
      const result = await client.send("Performance.getMetrics");
      const metricsMap: Record<string, number> = {};
      for (const metric of result.metrics) {
        metricsMap[metric.name] = metric.value;
      }

      const currentMetrics = {
        elapsed: Math.round((Date.now() - startTime) / 1000),
        jsHeapSizeMB: Math.round(metricsMap["JSHeapUsedSize"] / 1024 / 1024),
        domNodes: metricsMap["Nodes"] || 0,
        jsEventListeners: metricsMap["JSEventListeners"] || 0,
      };

      if (!initialMetrics) {
        initialMetrics = { ...currentMetrics };
        console.log("[INITIAL]", JSON.stringify(initialMetrics));
      }

      console.log(
        `[${currentMetrics.elapsed}s] Heap: ${currentMetrics.jsHeapSizeMB}MB, ` +
        `DOM: ${currentMetrics.domNodes}, Listeners: ${currentMetrics.jsEventListeners}`
      );

      // 異常検出
      if (currentMetrics.jsEventListeners > initialMetrics.jsEventListeners * 2) {
        console.log(`[WARNING] Event listeners doubled!`);
      }

      await page.waitForTimeout(CHECK_INTERVAL_MS);
    }
  });
});
```

## 既に判明している事実

### E2Eテスト結果（3分間のテスト）

| 項目 | 初期値 | ピーク | 最終値 | 増加率 |
|------|--------|--------|--------|--------|
| Heap | 20MB | 116MB | 55MB | +175% |
| DOM Nodes | 620 | 31,658 | 8,772 | +1,314% |
| Event Listeners | 172 | 6,535 | 2,229 | +1,196% |

### 観測された問題

1. **Event Listenersの爆発的増加**: 172 → 6,535 (38倍)
2. **DOM Nodesの異常な増加**: 620 → 31,658 (51倍)
3. **メモリ使用量の増加**: 20MB → 116MB (5.8倍)

## 特定された根本原因

### 1. `useJotaiEffect`のサブスクリプションリーク (CRITICAL)

**ファイル**: `frontend/src/core/state/jotai.ts` 37-50行目

```typescript
// 問題のコード
export function useJotaiEffect<T>(
  atom: Atom<T>,
  effect: (value: T, prevValue: T) => void,
) {
  const store = useStore();
  useEffect(() => {
    let prevValue = store.get(atom);
    store.sub(atom, () => {  // ⚠️ unsubscribeが返されていない!
      const value = store.get(atom);
      effect(value, prevValue);
      prevValue = value;
    });
  }, [atom, effect, store]);
  // ⚠️ クリーンアップ関数がない
}
```

**修正案**:
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

**ファイル**: `frontend/src/core/cells/cells.ts` 1626-1638行目

- `cellDataAtom`, `cellRuntimeAtom`, `cellHandleAtom` がatomFamilyを使用
- セル操作時のクリーンアップが不完全
- `releaseCellAtoms()` 関数があるが、すべてのコードパスで呼ばれていない可能性

### 3. WebSocketメッセージキューの無制限蓄積 (MEDIUM)

**ファイル**: `marimo/_server/api/endpoints/ws_endpoint.py` 368行目

```python
self.message_queue = asyncio.Queue()  # maxsizeがない
```

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

## 次のステップ

1. **`useJotaiEffect`の修正**: unsubscribe処理を追加
2. **atomFamilyのクリーンアップ確認**: すべてのコードパスで`releaseCellAtoms()`が呼ばれているか確認
3. **修正後のE2Eテスト**: Event Listenersが安定することを確認
4. **長時間テスト**: 15分以上のテストでフリーズが発生しないことを確認

## 関連ファイル

- `frontend/src/core/state/jotai.ts` - Jotai状態管理
- `frontend/src/core/cells/cells.ts` - セル管理のatomFamily
- `frontend/src/core/websocket/useWebSocket.tsx` - WebSocket接続
- `marimo/_server/api/endpoints/ws_endpoint.py` - サーバー側WebSocket
- `C:\Users\sasai\AppData\Local\Temp\fintech1.py` - テスト用ノートブック

## テスト環境

- marimo version: 0.19.6
- Python: 3.13.11
- Node.js: v24.13.0
- Playwright: 1.57.0
- OS: Windows
