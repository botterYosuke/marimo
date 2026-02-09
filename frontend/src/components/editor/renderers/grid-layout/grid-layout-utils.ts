/* Copyright 2026 Marimo. All rights reserved. */
import { useCallback, useRef } from "react";
import type { GridLayout } from "./types";

export type CellLayout = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Check if two cells overlap (share any grid area).
 */
export function cellsOverlap(a: CellLayout, b: CellLayout): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * After resizing the cell at `resizedIdx`, push down any overlapping cells
 * and cascade recursively until no collisions remain.
 */
export function resolveCollisions(
  cells: CellLayout[],
  resizedIdx: number,
): CellLayout[] {
  const result = [...cells];
  const resolved = new Set<number>();
  const queue = [resizedIdx];

  while (queue.length > 0) {
    const srcIdx = queue.shift()!;
    if (resolved.has(srcIdx)) {
      continue;
    }
    resolved.add(srcIdx);
    const src = result[srcIdx];

    for (let i = 0; i < result.length; i++) {
      if (i === srcIdx) {
        continue;
      }
      const target = result[i];
      if (cellsOverlap(src, target)) {
        // Push target below the source cell
        result[i] = { ...target, y: src.y + src.h };
        queue.push(i);
      }
    }
  }

  return result;
}

/**
 * Hook that encapsulates all auto-resize logic for grid layout cells.
 * Used by both grid-layout.tsx and edit-grid-layout.tsx.
 */
export function useAutoResize(
  layout: GridLayout,
  setLayout: (layout: GridLayout) => void,
) {
  // Track latest layout to avoid stale closures
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Track auto-resized heights to protect them from onLayoutChange overwrite
  const autoResizedHeightsRef = useRef<Map<string, number>>(new Map());

  // Batch multiple auto-resize requests via requestAnimationFrame
  const pendingResizesRef = useRef<Map<string, number>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  const handleAutoResize = useCallback(
    (cellId: string, neededRows: number) => {
      pendingResizesRef.current.set(cellId, neededRows);

      if (rafIdRef.current) {
        return;
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const resizes = new Map(pendingResizesRef.current);
        pendingResizesRef.current.clear();

        const currentLayout = layoutRef.current;
        let updatedCells = [...currentLayout.cells];

        for (const [id, rows] of resizes) {
          const idx = updatedCells.findIndex((c) => c.i === id);
          if (idx === -1) {
            continue;
          }
          const cell = updatedCells[idx];
          const newH = Math.max(cell.h, rows);
          const deltaH = newH - cell.h;
          if (deltaH <= 0) {
            continue;
          }

          // Update height
          updatedCells[idx] = { ...cell, h: newH };
          autoResizedHeightsRef.current.set(id, newH);

          // Push down overlapping cells and cascade to resolve all collisions
          updatedCells = resolveCollisions(updatedCells, idx);
        }

        setLayout({ ...currentLayout, cells: updatedCells });
        window.dispatchEvent(new Event("resize"));
      });
    },
    [setLayout],
  );

  /**
   * Protect auto-resized heights from being overwritten by react-grid-layout.
   * Use in onLayoutChange callbacks.
   */
  const protectAutoResizedHeights = useCallback(
    (cellLayouts: CellLayout[]): CellLayout[] => {
      return cellLayouts.map((cell) => {
        const autoH = autoResizedHeightsRef.current.get(cell.i);
        return autoH ? { ...cell, h: Math.max(cell.h, autoH) } : cell;
      });
    },
    [],
  );

  /**
   * Clear auto-resize tracking for a cell.
   * Use in onResizeStop and onDelete callbacks.
   */
  const clearAutoResize = useCallback((cellId: string) => {
    autoResizedHeightsRef.current.delete(cellId);
  }, []);

  return {
    handleAutoResize,
    autoResizedHeightsRef,
    protectAutoResizedHeights,
    clearAutoResize,
  };
}
