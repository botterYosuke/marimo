# リアルタイムチャート パフォーマンス最適化

> **ステータス:** Phase 3 完了 ✅ (2026-01-25)
> **ブランチ:** `sasa/cpu`

## 概要

100ms間隔のリアルタイムチャート更新でCPU負荷が高い問題を解決するための最適化プロジェクト。

---

## 成果サマリー

| Phase | 実施内容 | LCP | INP | 状態 |
|-------|---------|-----|-----|------|
| 初期状態 | - | 11.79s | 216ms | - |
| Phase 1-2 | RAF + React バイパス | 1.21s | 224ms | ✅ 完了 |
| Phase 3 | msgpack バイナリプロトコル | 33.95s | 128ms | ~~⚠️ LCP 回帰~~ |
| Phase 3 修正 | msgpack 遅延ロード | **4.91s** | **24ms** | ✅ 完了 |

### 最終結果

| Metric | 初期値 | 最終値 | 改善率 |
|--------|--------|--------|--------|
| **LCP** | 11.79s | 4.91s | **58% 改善** |
| **INP** | 216ms | 24ms | **89% 改善** ✅ 目標達成 |

### 残課題

- **LCP**: 4.91s (目標 < 2s 未達) - CodeMirror 初期化がボトルネック (チャート外の問題)
- **INP**: 24ms ✅ 目標達成 (< 100ms)

---

## Phase 1-2: 完了

### Phase 1: RAF ベースのバッチ更新

**問題:** `model.on("change:last_bar")` が呼ばれるたびに即座に描画。ブラウザの vsync と非同期。

**解決:** `requestAnimationFrame` で更新をバッファリングし、描画サイクルに同期。

```javascript
let pendingBar = null;
let rafId = null;

const flushPendingBar = () => {
    if (pendingBar && isValidBar(pendingBar)) {
        candleSeries.update(pendingBar);
    }
    pendingBar = null;
    rafId = null;
};

model.on("change:last_bar", () => {
    pendingBar = model.get("last_bar");
    if (rafId === null) {
        rafId = requestAnimationFrame(flushPendingBar);
    }
});
```

### Phase 2: React バイパス

**問題:** `last_bar` 変更のたびに React 再レンダーが発生。

**解決:** `directUpdateKeys` 機能を追加し、特定キーの React 再レンダーをスキップ。

```javascript
if (model.setDirectUpdateKeys) {
    model.setDirectUpdateKeys(['last_bar']);
}
```

**変更ファイル:**
- `marimo/frontend/src/plugins/impl/anywidget/model.ts`
- `BackcastPro/src/BackcastPro/api/chart.py`

---

## Phase 3: msgpack バイナリプロトコル ✅ 完了

### 実装内容

JSON シリアライズを msgpack バイナリに変更し、ペイロードとパース時間を削減。

**Python 側:**
```python
# 新しい traitlet
last_bar_packed = traitlets.Bytes(b"").tag(sync=True)

def update_bar_fast(self, bar: dict) -> None:
    import msgpack
    self.last_bar_packed = msgpack.packb([
        bar["time"], bar["open"], bar["high"], bar["low"], bar["close"]
    ])
```

**JavaScript 側:**
```javascript
model.on("change:last_bar_packed", async () => {
    const decode = await ensureMsgpack();
    const [time, open, high, low, close] = decode(new Uint8Array(packed));
    pendingBar = { time, open, high, low, close };
    if (rafId === null) {
        rafId = requestAnimationFrame(flushPendingBar);
    }
});
```

**変更ファイル:**
- `BackcastPro/pyproject.toml` - msgpack 依存追加
- `BackcastPro/src/BackcastPro/api/chart.py` - Python/ESM 両方
- `BackcastPro/src/BackcastPro/backtest.py` - update_bar_fast() 呼び出し

### LCP 回帰と修正 (2026-01-25 解決済み)

**原因:** render() 内で msgpack を先読みしていた
```javascript
createChart = await loadLibrary();
msgpackDecode = await loadMsgpack();  // ← これが LCP をブロック
```

**修正:** msgpack の先読み行を削除し、完全に遅延ロードに移行
```javascript
createChart = await loadLibrary();
// msgpack は遅延ロード (ensureMsgpack() で初回使用時にロード)
```

**結果:** LCP 33.95s → 4.91s (86% 改善)

---

## Phase 4: WebWorker + OffscreenCanvas (不要)

> **ステータス:** INP 24ms で目標達成済み。実装不要。

当初は INP が目標 (<100ms) に達しない場合の追加最適化案として検討していた。

Lightweight Charts の描画を WebWorker に移動し、メインスレッドを完全解放。

```
Main Thread                    Worker Thread
-----------                    -------------
WebSocket → Model
     ├─(transferable)─────→ Lightweight Charts + OffscreenCanvas
     └←─(bitmap)──────────←
```

**結論:** Phase 1-3 の最適化で INP 24ms を達成したため、WebWorker 実装は不要。

---

## 安全機構

### レースコンディション対策

RAF コールバックがチャート破棄後に実行される問題を防止:

```javascript
let isDisposed = false;

const flushPendingBar = () => {
    if (isDisposed || !model[MODEL_CHART_KEY]) {
        pendingBar = null;
        rafId = null;
        return;
    }
    // ...
};

const cleanup = () => {
    isDisposed = true;
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
    }
};
```

---

## 変更ファイル一覧

| ファイル | Phase | 変更内容 |
|---------|-------|---------|
| `marimo/frontend/src/plugins/impl/anywidget/model.ts` | 2 | `directUpdateKeys`、`setDirectUpdateKeys()` |
| `BackcastPro/pyproject.toml` | 3 | msgpack 依存追加 |
| `BackcastPro/src/BackcastPro/api/chart.py` | 1-3 | RAF、disposed ガード、msgpack |
| `BackcastPro/src/BackcastPro/backtest.py` | 3 | `update_bar_fast()` 呼び出し |

---

## 検証方法

```bash
# marimo サーバー起動
marimo edit fintech1.py

# DevTools → Lighthouse → Core Web Vitals で確認
# - LCP: 目標 < 2s
# - INP: 目標 < 100ms
```

---

## 次のアクション

1. ~~**LCP 回帰修正**~~ ✅ 完了 (33.95s → 4.91s)
2. ~~**再測定**~~ ✅ 完了 (INP 24ms 達成)
3. **LCP 追加最適化 (オプション)** - 現在の LCP 4.91s は CodeMirror 初期化がボトルネック。チャート外の問題のため優先度低。
4. **Phase 4 (保留)** - INP 24ms で目標達成済み。WebWorker 実装は不要。

---

## 参考資料

- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [anywidget Documentation](https://anywidget.dev/)
- [Core Web Vitals](https://web.dev/vitals/)
