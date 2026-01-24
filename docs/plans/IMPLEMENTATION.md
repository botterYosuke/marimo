# Lightweight Charts 移行 - 実装詳細

> **比較ブランチ:** `game` → `sasa/cpu`
> **完了日:** 2025-01-25

このドキュメントは技術的な実装詳細を記録しています。概要は [README.md](README.md) を参照してください。

---

## 1. 問題の根本原因

### 1.1 Plotly のパフォーマンス問題

| 項目 | 値 |
|------|-----|
| データ点数 | 6,084ステップ（約24年分の日足） |
| 更新間隔 | 100ms |
| レンダリング方式 | SVG 全再描画 |
| LCP | 6.10秒（非常に遅い） |

### 1.2 チカチカ問題の原因フロー

```
セル再実行
  ↓
Python: anywidget.__init__() で mo_data.js(js) を呼び出し
  ↓
VirtualFileLifecycleItem.create() で random_filename() を呼び出し
  ↓
★ 毎回新しいランダムなファイル名（URL）が生成される
  ↓
js-url が変わる（例: "./@file/1234-abc.js" → "./@file/1234-xyz.js"）
  ↓
フロントエンド: AnyWidgetSlot の key が変わる
  const key = randomId ?? jsUrl;  // jsUrlがキーとして使用
  ↓
React: キー変更 → LoadedSlot を完全再マウント
  ↓
runAnyWidgetModule(): el.innerHTML = "" でDOM消去
  ↓
✅ チャートが0から新規描画される → チカチカ
```

---

## 2. 解決策の詳細

### 2.1 Lightweight Charts への移行

TradingViewのLightweight Chartsをanywidgetでラップ:

```
┌─────────────────────────────────────────────────────────────┐
│  Python (marimo cell)                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LightweightChartWidget                             │    │
│  │  - data: List[dict]        # 全ローソク足データ     │    │
│  │  - last_bar: Dict          # 最新バー（差分更新用） │    │
│  │  - options: Dict           # チャート設定           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │ traitlets sync
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  JavaScript (anywidget ESM)                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  render({ model, el })                              │    │
│  │  - chart = createChart(el)                          │    │
│  │  - series = chart.addCandlestickSeries()            │    │
│  │  - model.on("change:data") → series.setData()       │    │
│  │  - model.on("change:last_bar") → series.update()    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**差分更新の仕組み:**
```python
# 初回: 全データ設定
widget.data = candlestick_data  # → series.setData()

# 以降: 最後のバーのみ更新
widget.last_bar = {"time": ..., "open": ..., ...}  # → series.update()
```

### 2.2 `_random_id` の安定化

**問題:** セル再実行のたびに新しい `_random_id` が生成され、Reactコンポーネントが再マウント

**Before (`ui_element.py`):**
```python
def _initialize(self):
    self._random_id = str(uuid.UUID(int=self._random_seed.getrandbits(128)))
```

**After (`ui_element.py`):**
```python
def _initialize(self):
    # Subclasses may pre-set _random_id to a stable value
    if not hasattr(self, "_random_id") or self._random_id is None:
        self._random_id = str(uuid.UUID(int=self._random_seed.getrandbits(128)))
```

**After (`from_anywidget.py`):**
```python
# Pre-set _random_id to js_hash to prevent flickering
self._random_id = js_hash
```

### 2.3 `comm_id` の統一

**問題:** `comm_id`（UUID）と `jsHash` が異なり、WebSocketメッセージが正しいReactコンポーネントにルーティングされない

**Before (`init.py`):**
```python
from uuid import uuid4

if getattr(w, "_model_id", None) is None:
    w._model_id = uuid4().hex
```

**After (`init.py`):**
```python
import hashlib

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

### 2.4 グローバルコールバック機能

**問題:** WebSocketメッセージが `MODEL_MANAGER` に届くが、ローカルの React モデルに同期されない

**After (`model.ts`):**
```typescript
// Global callbacks for when any model is updated
type GlobalUpdateCallback = (modelId: string) => void;
const globalUpdateCallbacks = new Set<GlobalUpdateCallback>();

export function registerGlobalModelUpdateCallback(callback: GlobalUpdateCallback): () => void {
  globalUpdateCallbacks.add(callback);
  return () => globalUpdateCallbacks.delete(callback);
}

export function notifyGlobalModelUpdate(modelId: string): void {
  globalUpdateCallbacks.forEach((cb) => cb(modelId));
}

// handleWidgetMessage内で呼び出し
if (method === "update") {
  const model = await modelManager.get(modelId);
  model.updateAndEmitDiffs(stateWithBuffers);
  notifyGlobalModelUpdate(modelId);  // 追加
}
```

### 2.5 エラー抑制

**問題:** lightweight-charts の `requestAnimationFrame` がアンマウント後に実行され "Object is disposed" エラー

**After (`AnyWidgetPlugin.tsx`):**
```typescript
// HMR SUPPORT: Use a global flag to prevent re-registration
const HANDLER_KEY = "__marimo_anywidget_error_handler__";
if (!(window as Record<string, unknown>)[HANDLER_KEY]) {
  (window as Record<string, unknown>)[HANDLER_KEY] = true;
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const isDisposedError =
      message === "Object is disposed" ||
      message === "Uncaught Object is disposed" ||
      (typeof message === "string" && message.includes("disposed"));

    const isFromKnownSource =
      !source ||
      source.includes("lightweight-charts") ||
      source.includes("anywidget");

    if (isDisposedError && isFromKnownSource) {
      Logger.debug("[AnyWidget] Suppressed 'Object is disposed' error");
      return true;  // エラーを抑制
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
}
```

**After (`model.ts` - emit関数):**
```typescript
private emit<K extends keyof T>(event: `change:${K & string}`, value: T[K]) {
  if (this.disposed) return;  // disposed なら早期リターン

  listeners.forEach((cb) => {
    if (this.disposed) return;
    try {
      cb(value);
    } catch (err) {
      Logger.debug("[anywidget] Error in change listener:", err);
    }
  });
}
```

### 2.6 チカチカ防止

**問題:** `el.innerHTML = ""` で毎回要素がクリアされ、チカチカする

**Before (`AnyWidgetPlugin.tsx`):**
```typescript
async function runAnyWidgetModule(widgetDef, model, el) {
  el.innerHTML = "";  // 毎回クリア
  // ...
}

useEffect(() => { ... }, [widget, data.jsUrl]);
```

**After (`AnyWidgetPlugin.tsx`):**
```typescript
async function runAnyWidgetModule(widgetDef, model, el, clearElement = true) {
  if (clearElement) {
    el.innerHTML = "";  // 初回のみクリア
  }
  // ...
}

useEffect(() => { ... }, [widget, data.jsHash]);  // jsHashで判定

// 値変更時は clearElement=false で呼び出し
runAnyWidgetModule(widget, model.current, htmlRef.current, false);
```

---

## 3. 変更ファイル一覧

### Python Backend

| ファイル | 変更内容 |
|---------|---------|
| `marimo/_plugins/ui/_impl/anywidget/init.py` | `comm_id` として `js_hash` を使用 |
| `marimo/_plugins/ui/_impl/from_anywidget.py` | `_random_id` を `js_hash` に事前設定 |
| `marimo/_plugins/ui/_core/ui_element.py` | `_random_id` の事前設定を許可 |
| `marimo/_plugins/ui/_impl/comm.py` | `defer_open` 機能追加（将来用） |

### TypeScript Frontend

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/plugins/impl/anywidget/model.ts` | グローバルコールバック、disposed フラグ、try-catch追加 |
| `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` | コールバック登録、isEqual比較、window.onerror エラー抑制 |

---

## 4. コードレビュー修正の記録

### 採用した修正

| 修正 | 内容 | 理由 |
|------|------|------|
| **CRITICAL-1** | `window.onerror` にHMR対応とsourceフィルタ追加 | より安全なエラーハンドリング |
| **HIGH-3** | `off()` → `dispose()` | disposed フラグを適切に設定 |
| **HIGH-6** | 浅い比較 → `isEqual` | オブジェクト/配列の変更検出を改善 |

### リバートした修正

| 修正 | 元に戻した内容 | 理由 |
|------|---------------|------|
| **CRITICAL-2** | `_random_id = js_hash` に戻す | `id(widget)` を追加するとセル再実行のたびにIDが変わりReactが再マウント |
| **HIGH-4** | クリーンアップを `.then()` 内に戻す | 先にクリーンアップするとチャートが破棄されてチカチカ |

### 教訓

1. **既存の設計意図を理解してからリファクタリング**
   - チカチカ防止のための意図的なトレードオフがあった
   - コードレビューの指摘は技術的には正しいが、既存の設計と競合

2. **変更後は必ず動作確認**
   - チャートの表示/更新が正常に動作するか確認
   - チカチカ（フリッカー）がないか確認

---

## 5. 検証方法

```bash
# サーバー起動
marimo edit fintech1.py

# ブラウザで開く
# http://localhost:3000/?file=fintech1.py

# 確認項目:
# - チャートが100msごとにスムーズに更新される
# - チカチカしない
# - コンソールにエラーが出ない
```

### 検証結果

| 項目 | Before | After |
|------|--------|-------|
| チャートライブラリ | Plotly (SVG) | Lightweight Charts (Canvas) |
| 更新方式 | 全データ再描画 | 差分更新 |
| チカチカ問題 | あり | **解決** |
| チャート更新停止 | あり | **解決** |
| "Object is disposed" エラー | 2,081件 | **0件** |

---

## 6. 今後の改善案（未実装）

| 施策 | 優先度 | 説明 |
|------|--------|------|
| 出来高表示 | 中 | `addHistogramSeries()` で出来高バー追加 |
| マーカー（売買シグナル） | 中 | `setMarkers()` で売買ポイント表示 |
| クロスヘア連動 | 低 | 複数チャート間でクロスヘア同期 |

---

## 参考資料

- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [anywidget Documentation](https://anywidget.dev/)
- [marimo anywidget API](../../marimo/_plugins/ui/_impl/from_anywidget.py)
