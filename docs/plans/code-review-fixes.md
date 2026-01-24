# コードレビュー修正記録

> **日付:** 2026-01-25
> **ブランチ:** `sasa/cpu`
> **結果:** 一部採用、一部リバート

---

## 概要

anywidget パフォーマンス改善コードのレビューを実施。
CRITICAL/HIGH の指摘事項を修正したが、一部の修正がチカチカ問題を再発させたためリバート。

---

## レビュー指摘事項と対応

### CRITICAL（必須修正）

| # | 指摘 | 対応 | 結果 |
|---|------|------|------|
| 1 | `window.onerror` のオーバーライド | `addEventListener` に変更 | **採用** |
| 2 | 同一ESMで `model_id` が衝突 | `id(widget)` を追加 | **リバート** |

### HIGH（推奨修正）

| # | 指摘 | 対応 | 結果 |
|---|------|------|------|
| 3 | `disposed` フラグが設定されない | `off()` → `dispose()` | **採用** |
| 4 | unsubscribe の競合状態 | クリーンアップを先に実行 | **リバート** |
| 5 | グローバルコールバックのメモリリーク | 対応見送り | - |
| 6 | 浅い比較と深い比較の不整合 | `isEqual` に統一 | **採用** |

### MEDIUM/LOW

対応見送り（影響軽微）

---

## 採用した修正

### CRITICAL-1: addEventListener パターン

**変更前:**
```typescript
window.onerror = (message, ...) => {
  if (message === "Object is disposed") {
    return true;  // ページ全体のエラーを抑制
  }
  if (originalOnError) {
    return originalOnError(...);
  }
  return false;
};
```

**変更後:**
```typescript
const handler = (event: ErrorEvent) => {
  if (isDisposedError && isFromLightweightCharts) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
};
window.addEventListener("error", handler, { capture: true });
```

**理由:** ハンドラチェーンを作らず、他のエラーハンドラと共存可能。

---

### HIGH-3: dispose() の使用

**変更前:**
```typescript
return () => {
  model.current.off();  // disposed フラグを設定しない
  unsubPromise.then((unsub) => unsub());
};
```

**変更後:**
```typescript
return () => {
  model.current.dispose();  // disposed フラグを設定
  unsubPromise.then((unsub) => unsub());
};
```

**理由:** `dispose()` は `disposed = true` を設定し、以後の `emit()` を無視。

---

### HIGH-6: isEqual による深い比較

**変更前:**
```typescript
if (this.data[k] !== value[k]) {  // 浅い比較
  this.set(k, value[k]);
}
```

**変更後:**
```typescript
if (!isEqual(this.data[k], value[k])) {  // 深い比較
  this.set(k, value[k]);
}
```

**理由:** オブジェクト/配列の参照が変わっても内容同一なら更新不要。

---

## リバートした修正

### CRITICAL-2: model_id にインスタンスID追加

**修正内容:**
```python
# 修正前
self._random_id = js_hash

# 修正後（リバート）
self._random_id = f"{js_hash}_{id(widget)}"
```

**リバート理由:**
- `id(widget)` はセル再実行のたびに変わる
- `_random_id` が変わると React コンポーネントが再マウント
- 再マウント時にチャートが一瞬消える（チカチカ）

**元の設計意図:**
- ESM コンテンツが同じなら同じ `_random_id` を維持
- React の key が安定し、再マウントを防止

---

### HIGH-4: unsubscribe の順序変更

**修正内容:**
```typescript
// 修正前
runAnyWidgetModule(...).then((unsub) => {
  unsubRef.current?.();  // 新規レンダリング後にクリーンアップ
  unsubRef.current = unsub;
});

// 修正後（リバート）
unsubRef.current?.();  // 先にクリーンアップ
runAnyWidgetModule(...).then((unsub) => {
  unsubRef.current = unsub;
});
```

**リバート理由:**
- 先にクリーンアップするとチャートが破棄される
- 新しいチャートがレンダリングされるまで空白になる（チカチカ）

**元の設計意図:**
- `clearElement=false` でチャートを維持したまま更新
- クリーンアップは新しいレンダリング完了後に実行

---

## 教訓

1. **設計意図の理解が重要**
   - コードの「問題点」に見えるものが、実は意図的なトレードオフの可能性
   - 変更前に設計ドキュメントを確認

2. **視覚的な確認が必須**
   - チカチカは型チェックやテストでは検出できない
   - 実際にブラウザで動作確認

3. **コメントで意図を残す**
   - なぜそのような実装になっているかを記載
   - 将来のリファクタリング時の参考に

---

## 関連ドキュメント

- [README.md](README.md) - プロジェクト概要
- [chart-flickering-handoff-v4.md](chart-flickering-handoff-v4.md) - チカチカ問題の詳細
