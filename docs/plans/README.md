# Lightweight Charts 移行によるパフォーマンス改善

> **ステータス: 完了** (2025-01-25)
>
> **比較ブランチ:** `game` → `sasa/cpu`

## 概要

marimoノートブックでリアルタイムチャート（100ms更新）を実現するためのパフォーマンス改善プロジェクト。
Plotly から Lightweight Charts への移行により、CPU負荷の大幅な削減とチカチカ問題の解決を達成。

---

## 成果

| 項目 | Before | After |
|------|--------|-------|
| チャートライブラリ | Plotly (SVG) | Lightweight Charts (Canvas) |
| 更新方式 | 全データ再描画 | 差分更新 (`series.update()`) |
| チカチカ問題 | あり | **解決** |
| チャート更新停止 | あり | **解決** |
| "Object is disposed" エラー | 2,081件 | **0件** |

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
1. `comm_id` として `js_hash` を使用
2. グローバルコールバック機能を追加
3. Reactコンポーネントでコールバック登録

### 4. "Object is disposed" エラー

**問題:** lightweight-chartsが内部で `requestAnimationFrame` を使用し、コンポーネントアンマウント後もコールバックが実行される

**解決:**
1. `window.onerror` でエラーを抑制（HMR対応・sourceフィルタ付き）
2. `model.dispose()` でアンマウント時にリスナーをクリア
3. try-catchでエラーを捕捉

---

## 変更ファイル一覧

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

## コードレビュー対応

### 採用した修正

| 修正 | 内容 | 理由 |
|------|------|------|
| HMR対応 | `window.onerror` にグローバルフラグ追加 | 開発モードでの重複登録防止 |
| sourceフィルタ | lightweight-charts/anywidgetからのエラーのみ抑制 | 他ライブラリのエラーを隠さない |
| エラーパターン限定 | `includes("disposed")` → `includes("Object is disposed")` | 無関係なdisposedエラーを抑制しない |
| `dispose()` | `off()` → `dispose()` | disposed フラグを適切に設定 |
| `isEqual` | 浅い比較 → 深い比較 | オブジェクト/配列の変更検出を改善 |

### リバートした修正

| 修正 | 理由 |
|------|------|
| `_random_id = f"{js_hash}_{id(widget)}"` | セル再実行のたびにIDが変わりReactが再マウント → チカチカ |
| クリーンアップを先に実行 | チャートが破棄されてから再描画 → チカチカ |

**教訓:** コードの「問題点」に見えるものが、実は意図的なトレードオフの可能性がある。

---

## 検証方法

```bash
# サーバー起動
marimo edit fintech1.py

# 確認項目:
# - チャートが100msごとにスムーズに更新される
# - チカチカしない
# - コンソールにエラーが出ない
```

---

## ドキュメント構成

| ファイル | 内容 |
|---------|------|
| **README.md** | このサマリー |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | 技術的な実装詳細・コード変更 |

---

## 今後の改善案（未実装）

| 施策 | 優先度 | 説明 |
|------|--------|------|
| 出来高表示 | 中 | `addHistogramSeries()` で出来高バー追加 |
| マーカー（売買シグナル） | 中 | `setMarkers()` で売買ポイント表示 |
| クロスヘア連動 | 低 | 複数チャート間でクロスヘア同期 |

---

## 参考資料

- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [anywidget Documentation](https://anywidget.dev/)
