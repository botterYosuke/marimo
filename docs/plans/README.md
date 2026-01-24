# anywidget パフォーマンス改善プロジェクト

> **ステータス: 完了** (2025-01-25)

## 概要

marimoノートブックでリアルタイムチャート（100ms更新）を実現するためのパフォーマンス改善プロジェクト。

### 成果

| 項目 | Before | After |
|------|--------|-------|
| チャートライブラリ | Plotly (SVG) | Lightweight Charts (Canvas) |
| 更新方式 | 全データ再描画 | 差分更新 |
| チカチカ問題 | あり | **解決** |
| チャート更新停止 | あり | **解決** |
| "Object is disposed" エラー | 2,081件 | **0件** |

---

## 解決した問題

### 1. Plotly → Lightweight Charts 移行

**問題:** Plotlyで6000データ点を100msごとに全再描画 → CPU負荷高、LCP 6.10s

**解決:** TradingViewのLightweight Chartsに移行
- Canvas描画で高速
- `series.update()` による差分更新
- anywidgetでラップして marimo 統合

詳細: [lightweight-charts-anywidget.md](lightweight-charts-anywidget.md)

### 2. チャートがチカチカする問題

**問題:** セル再実行のたびに新しい `_random_id` が生成され、Reactコンポーネントが再マウント

**解決:** `js_hash` を `_random_id` として使用し、ESMコンテンツが同じなら同じIDを維持

### 3. チャートが更新されない問題

**問題:** `comm_id`（UUID）と `jsHash` が異なり、WebSocketメッセージが正しいReactコンポーネントにルーティングされない

**解決:**
1. `comm_id` として `js_hash` を使用
2. グローバルコールバック機能を追加
3. Reactコンポーネントでコールバック登録

### 4. "Object is disposed" エラー

**問題:** lightweight-chartsが内部で `requestAnimationFrame` を使用し、コンポーネントアンマウント後もコールバックが実行される

**解決:**
1. `window.onerror` でエラーを抑制（非同期エラー対策）
2. `model.current.off()` でアンマウント時にリスナーをクリア
3. try-catchでエラーを捕捉

詳細: [chart-flickering-handoff-v4.md](chart-flickering-handoff-v4.md)

---

## 変更ファイル一覧

> **比較ブランチ:** `game` → `sasa/cpu`

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

## 変更前後の詳細（コードレビュー用）

### 1. Python: `_random_id` の安定化

**問題:** セル再実行のたびに新しい `_random_id` が生成され、Reactコンポーネントが再マウント → チカチカ

#### Before (`ui_element.py`)
```python
def _initialize(self):
    self._random_id = str(uuid.UUID(int=self._random_seed.getrandbits(128)))
```

#### After (`ui_element.py`)
```python
def _initialize(self):
    # Subclasses may pre-set _random_id to a stable value
    if not hasattr(self, "_random_id") or self._random_id is None:
        self._random_id = str(uuid.UUID(int=self._random_seed.getrandbits(128)))
```

#### After (`from_anywidget.py`)
```python
# Pre-set _random_id to js_hash to prevent flickering
self._random_id = js_hash
```

---

### 2. Python: `comm_id` の統一

**問題:** `comm_id`（UUID）と `jsHash` が異なり、WebSocketメッセージが正しいReactコンポーネントにルーティングされない

#### Before (`init.py`)
```python
from uuid import uuid4

if getattr(w, "_model_id", None) is None:
    w._model_id = uuid4().hex
```

#### After (`init.py`)
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

---

### 3. TypeScript: グローバルコールバック機能

**問題:** WebSocketメッセージが `MODEL_MANAGER` に届くが、ローカルの React モデルに同期されない

#### Before (`model.ts`)
```typescript
// グローバルコールバック機能なし
```

#### After (`model.ts`)
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

---

### 4. TypeScript: エラー抑制

**問題:** lightweight-charts の `requestAnimationFrame` がアンマウント後に実行され "Object is disposed" エラー

#### Before (`AnyWidgetPlugin.tsx`)
```typescript
// エラー処理なし
```

#### After (`AnyWidgetPlugin.tsx`)
```typescript
// window.onerror でエラーを抑制
useEffect(() => {
  const originalOnError = window.onerror;
  window.onerror = (message, _source, _lineno, _colno, _error) => {
    if (message === "Object is disposed" || message === "Uncaught Object is disposed") {
      Logger.debug("[AnyWidget] Suppressed 'Object is disposed' error");
      return true;  // エラーを抑制
    }
    if (originalOnError) {
      return originalOnError(message, _source, _lineno, _colno, _error);
    }
    return false;
  };
  return () => { window.onerror = originalOnError; };
}, []);
```

#### After (`model.ts` - emit関数)
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

---

### 5. TypeScript: チカチカ防止

**問題:** `el.innerHTML = ""` で毎回要素がクリアされ、チカチカする

#### Before (`AnyWidgetPlugin.tsx`)
```typescript
async function runAnyWidgetModule(widgetDef, model, el) {
  el.innerHTML = "";  // 毎回クリア
  // ...
}

// useEffectで jsUrl が変わるたびに再実行
useEffect(() => { ... }, [widget, data.jsUrl]);
```

#### After (`AnyWidgetPlugin.tsx`)
```typescript
async function runAnyWidgetModule(widgetDef, model, el, clearElement = true) {
  if (clearElement) {
    el.innerHTML = "";  // 初回のみクリア
  }
  // ...
}

// jsHash が変わるたびに再実行（URLではなくコンテンツベース）
useEffect(() => { ... }, [widget, data.jsHash]);

// 値変更時は clearElement=false で呼び出し
runAnyWidgetModule(widget, model.current, htmlRef.current, false);
```

---

### 6. TypeScript: Reactコンポーネントのキー

#### Before (`AnyWidgetPlugin.tsx`)
```typescript
const key = randomId ?? jsUrl;
```

#### After (`AnyWidgetPlugin.tsx`)
```typescript
// jsHash を優先（コンテンツベースで安定）
const key = randomId ?? jsHash ?? jsUrl;
```

---

## 検証方法

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

---

## ドキュメント構成

| ファイル | 内容 | ステータス |
|---------|------|----------|
| **README.md** | このサマリー | 最新 |
| [lightweight-charts-anywidget.md](lightweight-charts-anywidget.md) | 実装計画・技術設計 | 参照用 |
| [chart-flickering-handoff-v4.md](chart-flickering-handoff-v4.md) | 問題解決の詳細記録 | 最終版 |
| [backcast-cpu-optimization.md](backcast-cpu-optimization.md) | 初期の最適化計画 | アーカイブ |

### アーカイブ（履歴参照用）

以下は問題解決過程の記録です。最終的な解決策は上記ドキュメントを参照してください。

- `chart-flickering-handoff-v3.md`
- `chart-flickering-handoff-v2.md`
- `chart-flickering-handoff.md`
- `chart-flickering-analysis.md`
- `chart-flickering-fix-plan.md`
- `handoff-prompt-v5.md`

---

## 今後の改善案（未実装）

| 施策 | 優先度 | 説明 |
|------|--------|------|
| 出来高表示 | 中 | `addHistogramSeries()` で出来高バー追加 |
| マーカー（売買シグナル） | 中 | `setMarkers()` で売買ポイント表示 |
| クロスヘア連動 | 低 | 複数チャート間でクロスヘア同期 |

---

## インシデント記録: コードレビュー修正によるチカチカ問題再発 (2026-01-25)

### 概要

コードレビューで指摘された問題を修正した結果、チカチカ問題が再発した。
原因を特定し、元の設計に戻すことで解決。

### 経緯

1. **コードレビュー実施** - anywidget パフォーマンス改善のコードをレビュー
2. **指摘事項に基づき修正** - CRITICAL/HIGH の問題を修正
3. **チカチカ問題が再発** - lightweight-charts が一瞬消えて再描画される現象
4. **原因特定** - 修正が既存のチカチカ防止設計と競合
5. **元に戻して解決**

### コードレビューの指摘と実際の設計意図

| 指摘 | 修正内容 | 問題 | 元の設計意図 |
|------|----------|------|-------------|
| **CRITICAL-2**: model_id 衝突防止 | `_random_id = f"{js_hash}_{id(widget)}"` | チカチカ再発 | ESM同一なら同じIDを維持してReact再マウントを防止 |
| **HIGH-4**: 競合状態防止 | クリーンアップを先に実行 | チカチカ再発 | チャート破棄を防ぐため後でクリーンアップ |

### 採用した修正（維持）

以下の修正は問題なく、そのまま維持：

| 修正 | 内容 | 理由 |
|------|------|------|
| **CRITICAL-1** | `window.onerror` → `addEventListener('error', ...)` | より安全なエラーハンドリングパターン |
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

3. **コメントで設計意図を明記**
   - なぜそのような実装になっているかをコメントで説明
   - 将来のリファクタリング時の参考に

### 関連ファイル

- [コードレビュー修正依頼](code-review-fixes.md) - 元のレビュー指摘事項
- [browser.devtool.log](browser.devtool.log) - 問題発生時のブラウザログ

---

## 参考資料

- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [anywidget Documentation](https://anywidget.dev/)
- [marimo anywidget API](../../marimo/_plugins/ui/_impl/from_anywidget.py)
