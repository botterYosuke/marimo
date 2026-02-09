# Grid Layout: Auto-resize cells to fit content

## Context

When charts (e.g., BackcastPro's `bt.chart()` using lightweight-charts) are auto-placed in the grid layout, they receive a **fixed height of 400px** (20 rows × 20px/row). If the chart content (status bar + chart + axis labels) exceeds this height, the bottom gets clipped by `overflow-y: hidden`. There is currently **no mechanism** to adjust the grid cell height based on actual content size.

## Root Cause

- `auto-placement.ts:37` — `defaultHeight: 20` is hardcoded for all auto-placed cells
- `grid-layout.tsx:402` — Container uses `overflow-y-hidden`, clipping overflow
- No content measurement or ResizeObserver exists to detect overflow after rendering

## Plan

### Modify: `frontend/src/components/editor/renderers/grid-layout/grid-layout.tsx`

**1. Add `onAutoResize` and `rowHeight` props to `GridCell`**

```typescript
interface GridCellProps extends Pick<CellRuntimeState, "output" | "status"> {
  // ... existing props
  rowHeight?: number;
  onAutoResize?: (cellId: CellId, neededRows: number) => void;
}
```

**2. Add content overflow detection inside `GridCell`**

- Add `useRef<HTMLDivElement>` on the container div
- Add a `hasAutoResized` ref (one-shot flag to prevent resize loops)
- Use `useEffect` + `MutationObserver` to detect when widget content renders:
  - Check `el.scrollHeight > el.clientHeight + rowHeight` (threshold = 1 row)
  - If overflowing: calculate `neededRows = Math.ceil(el.scrollHeight / rowHeight) + 1` (buffer)
  - Call `onAutoResize(cellId, neededRows)` once
  - Set `hasAutoResized = true` to prevent further auto-resizes
- Reset `hasAutoResized` when `output` changes (re-run cell = re-measure)
- Also add a fallback `setTimeout` of ~500ms for content that renders asynchronously without DOM mutations

**3. Add `handleAutoResize` callback in `GridLayoutRenderer`**

```typescript
const layoutRef = useRef(layout);
layoutRef.current = layout;

const handleAutoResize = useCallback((cellId: string, neededRows: number) => {
  const currentLayout = layoutRef.current;
  setLayout({
    ...currentLayout,
    cells: currentLayout.cells.map(cell =>
      cell.i === cellId ? { ...cell, h: Math.max(cell.h, neededRows) } : cell
    ),
  });
  // Notify widgets of resize
  window.dispatchEvent(new Event("resize"));
}, [setLayout]);
```

- Use a `layoutRef` to avoid stale closures (setLayout doesn't support functional updater)
- Only resize upward (`Math.max`) — never shrink

**4. Pass new props to GridCell instances**

In both the edit-mode and read-mode rendering paths:
```tsx
<GridCell
  // ...existing props
  rowHeight={layout.rowHeight}
  onAutoResize={handleAutoResize}
/>
```

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/editor/renderers/grid-layout/grid-layout.tsx` | Add overflow detection to GridCell, add handleAutoResize to GridLayoutRenderer |

## Verification

1. Open a marimo notebook with grid layout
2. Run a cell that produces a chart via `bt.chart()` (or any tall visual output)
3. Verify the chart is auto-placed in the grid AND the cell height adjusts to show all content without clipping
4. Verify manually resizing a cell still works (no infinite loops)
5. Verify re-running the cell re-triggers auto-sizing
6. Verify cells with content that fits in 400px are NOT unnecessarily resized
