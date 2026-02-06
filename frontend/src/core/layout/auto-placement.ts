/* Copyright 2026 Marimo. All rights reserved. */

import type { CellId } from "@/core/cells/ids";

/**
 * Configuration for auto-placement
 */
export interface PlacementConfig {
  /** Total number of columns in the grid (default: 24) */
  columns: number;
  /** Height of each row in pixels (default: 20) */
  rowHeight: number;
  /** Default width for visual cells in columns (default: 12, half-width) */
  defaultWidth: number;
  /** Default height for visual cells in rows (default: 20, 400px) */
  defaultHeight: number;
}

/**
 * Represents a cell position in the grid
 */
export interface GridCellPosition {
  i: string; // Cell ID
  x: number; // X position (column)
  y: number; // Y position (row)
  w: number; // Width in columns
  h: number; // Height in rows
}

/**
 * Default placement configuration
 */
export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
  columns: 24,
  rowHeight: 20,
  defaultWidth: 12, // Half of the grid width
  defaultHeight: 20, // 400px at 20px per row
};

/**
 * Calculate auto-placement positions for a list of visual cell IDs
 *
 * Strategy:
 * - Stack cells vertically
 * - Use half-width (12 columns) for charts
 * - Arrange in 2-column layout when there are multiple charts
 */
export function calculateAutoPlacement(
  visualCellIds: CellId[],
  config: PlacementConfig = DEFAULT_PLACEMENT_CONFIG,
): GridCellPosition[] {
  if (visualCellIds.length === 0) {
    return [];
  }

  const { columns, defaultWidth, defaultHeight } = config;
  const cellPositions: GridCellPosition[] = [];

  // For a single cell, use full width
  if (visualCellIds.length === 1) {
    cellPositions.push({
      i: visualCellIds[0],
      x: 0,
      y: 0,
      w: columns, // Full width for single chart
      h: defaultHeight,
    });
    return cellPositions;
  }

  // For multiple cells, use 2-column layout
  let currentY = 0;

  for (let i = 0; i < visualCellIds.length; i++) {
    const cellId = visualCellIds[i];
    const isLeftColumn = i % 2 === 0;
    const isLastOdd = i === visualCellIds.length - 1 && i % 2 === 0;

    cellPositions.push({
      i: cellId,
      x: isLeftColumn ? 0 : defaultWidth,
      y: currentY,
      w: isLastOdd ? columns : defaultWidth, // Full width if last cell is alone
      h: defaultHeight,
    });

    // Move to next row after every 2 cells
    if (!isLeftColumn) {
      currentY += defaultHeight;
    }
  }

  return cellPositions;
}

/**
 * Calculate position for a new visual cell to be added to existing layout
 *
 * Strategy:
 * - Find the lowest occupied row
 * - Place new cell below all existing cells
 */
export function calculateNewCellPlacement(
  cellId: CellId,
  existingCells: GridCellPosition[],
  config: PlacementConfig = DEFAULT_PLACEMENT_CONFIG,
): GridCellPosition {
  const { columns, defaultHeight } = config;

  // Find the maximum y + h (bottom edge) of existing cells
  let maxBottom = 0;
  for (const cell of existingCells) {
    const bottom = cell.y + cell.h;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }

  // Place new cell below all existing cells with full width
  return {
    i: cellId,
    x: 0,
    y: maxBottom,
    w: columns,
    h: defaultHeight,
  };
}
