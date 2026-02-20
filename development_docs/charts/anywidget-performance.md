# AnyWidget パフォーマンス改善

> **ステータス:** 完了 (2026-01-25)
> **ブランチ:** `sasa/cpu`

## 概要

marimoノートブックでリアルタイムチャート（100ms更新）を実現するためのパフォーマンス改善。
Plotly から Lightweight Charts への移行により、CPU負荷の大幅な削減とチカチカ問題の解決を達成。

---

## 成果サマリー

| 項目 | Before | After |
|------|--------|-------|
| チャートライブラリ | Plotly (SVG) | Lightweight Charts (Canvas) |
| 更新方式 | 全データ再描画 | 差分更新 (`series.update()`) |
| チカチカ問題 | あり | **解決** |
| チャート更新停止 | あり | **解決** |
| "Object is disposed" エラー | 2,081件 | **0件** |

### Core Web Vitals

| Metric | 初期値 | 最終値 | 改善率 |
|--------|--------|--------|--------|
| **LCP** | 11.79s | 4.91s | **58% 改善** |
| **INP** | 216ms | 24ms | **89% 改善** |

---

## 解決した問題

### 1. Plotly のパフォーマンス問題

**問題:** Plotlyで6000データ点を100msごとに全再描画 → CPU負荷高、LCP 6.10s

**解決:** TradingViewのLightweight Chartsに移行
- Canvas描画で高速
- `series.update()` による差分更新
- anywidgetでラップして marimo 統合

### 2. チャートがチカチカする問題

**問題:** セル再実行のたびに新しい `_random_id` が生成され、Reactコンポーネントが再マウント

**解決:** `js_hash` を `_random_id` として使用し、ESMコンテンツが同じなら同じIDを維持

### 3. チャートが更新されない問題

**問題:** `comm_id`（UUID）と `jsHash` が異なり、WebSocketメッセージが正しいReactコンポーネントにルーティングされない

**解決:**
1. `comm_id` として `_model_id` を使用（`anywidget/init.py`）

### 4. "Object is disposed" エラー

**問題:** lightweight-chartsが内部で `requestAnimationFrame` を使用し、コンポーネントアンマウント後もコールバックが実行される

**解決:**
1. `model.dispose()` でアンマウント時にリスナーをクリア
2. try-catchでエラーを捕捉

---

## 最適化フェーズ

### Phase 1: RAF ベースのバッチ更新

`requestAnimationFrame` で更新をバッファリングし、描画サイクルに同期。

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

### Phase 2: React バイパス（未実装）

> ⚠️ 以下は構想のみ。コードベースには未反映。

`directUpdateKeys` 機能を追加し、特定キーの React 再レンダーをスキップ。

### Phase 3: msgpack バイナリプロトコル（未実装）

> ⚠️ 以下は構想のみ。コードベースには未反映。

JSON シリアライズを msgpack バイナリに変更し、ペイロードとパース時間を削減。

---

## 変更ファイル一覧

### Python Backend

| ファイル | 変更内容 |
|---------|---------|
| `marimo/_plugins/ui/_impl/anywidget/init.py` | `comm_id` として `js_hash` を使用 |
| `marimo/_plugins/ui/_impl/from_anywidget.py` | `_random_id` を `js_hash` に事前設定 |
| `marimo/_plugins/ui/_core/ui_element.py` | `_random_id` の事前設定を許可 |
| `marimo/_plugins/ui/_impl/comm.py` | `defer_open` 機能追加 |

### TypeScript Frontend

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/plugins/impl/anywidget/model.ts` | disposed フラグ、try-catch追加 |
| `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` | isEqual比較 |

---

## 参考資料

- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [anywidget Documentation](https://anywidget.dev/)
- [Core Web Vitals](https://web.dev/vitals/)
