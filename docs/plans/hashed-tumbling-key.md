# 3Dモード対応: edit-grid-layout.tsx に auto-resize を追加

## Context

`grid-layout.tsx` に実装済みの auto-resize 機能が、3Dモードで使われる `edit-grid-layout.tsx` には未実装のため、3Dモードではチャートの高さが固定のまま（400px）でクリッピングされる。

## Plan

### Step 1: 共有ユーティリティを抽出

**新規ファイル:** `frontend/src/components/editor/renderers/grid-layout/grid-layout-utils.ts`

`grid-layout.tsx` から以下を移動し export する:
- `CellLayout` 型
- `cellsOverlap()` 関数
- `resolveCollisions()` 関数

### Step 2: grid-layout.tsx のインポート更新

`grid-layout.tsx` からインライン定義を削除し、`./grid-layout-utils` から import に変更。

### Step 3: edit-grid-layout.tsx に auto-resize 基盤を追加

`EditGridLayoutRenderer` 内に以下を追加（`grid-layout.tsx` と同等）:
- `useCallback` を React import に追加
- `resolveCollisions` を `./grid-layout-utils` から import
- `layoutRef`, `autoResizedHeightsRef`, `pendingResizesRef`, `rafIdRef`
- `handleAutoResize` コールバック（rAF バッチ処理）

### Step 4: onLayoutChange を更新

`autoResizedHeightsRef` で auto-resize 済みの高さを `Math.max` で保護する。

### Step 5: onResizeStop を更新

ユーザーの手動リサイズ時に `autoResizedHeightsRef` をクリア。

### Step 6: onDelete を更新

セル削除時に `autoResizedHeightsRef` をクリア。

### Step 7: GridCell に props 追加

`GridCellProps` に `rowHeight?` と `onAutoResize?` を追加。

### Step 8: GridCell にオーバーフロー検知を追加

- `containerRef`, `hasAutoResized` ref
- `output` / `isScrollable` 変更時の `hasAutoResized` リセット
- ResizeObserver + MutationObserver によるオーバーフロー検知
- 両方の return パスの `<div>` に `ref={containerRef}` を追加

### Step 9: GridCell に props を渡す

イングリッドセルの `<GridCell>` に `rowHeight={layout.rowHeight}` と `onAutoResize={handleAutoResize}` を追加。サイドバーセルは対象外。

## Files

| File | Action |
|------|--------|
| `frontend/src/components/editor/renderers/grid-layout/grid-layout-utils.ts` | 新規作成 |
| `frontend/src/components/editor/renderers/grid-layout/grid-layout.tsx` | ユーティリティを import に変更 |
| `frontend/src/components/editor/renderers/grid-layout/edit-grid-layout.tsx` | auto-resize ロジック全体を追加 |

## Verification

1. 3Dモード（edit-grid-layout）でチャートセルの高さが自動調整されることを確認
2. 2Dモード（grid-layout）が引き続き正常に動作することを確認
3. `isScrollable` セルで auto-resize が発動しないことを確認
4. セル削除・手動リサイズ後に auto-resize 状態がクリアされることを確認
5. 複数チャートセルの同時配置で全セルが正しくリサイズされることを確認
