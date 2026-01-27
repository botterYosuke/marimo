/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import type { CellId } from "@/core/cells/ids";
import {
  calculateAutoPlacement,
  calculateNewCellPlacement,
  DEFAULT_PLACEMENT_CONFIG,
  type GridCellPosition,
  type PlacementConfig,
} from "../auto-placement";

describe("DEFAULT_PLACEMENT_CONFIG", () => {
  it("should have expected default values", () => {
    expect(DEFAULT_PLACEMENT_CONFIG.columns).toBe(24);
    expect(DEFAULT_PLACEMENT_CONFIG.rowHeight).toBe(20);
    expect(DEFAULT_PLACEMENT_CONFIG.defaultWidth).toBe(12);
    expect(DEFAULT_PLACEMENT_CONFIG.defaultHeight).toBe(20);
  });
});

describe("calculateAutoPlacement", () => {
  const createCellId = (id: string): CellId => id as CellId;

  it("should return empty array for empty input", () => {
    expect(calculateAutoPlacement([])).toEqual([]);
  });

  it("should use full width for single cell", () => {
    const result = calculateAutoPlacement([createCellId("cell1")]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      i: "cell1",
      x: 0,
      y: 0,
      w: 24, // Full width
      h: 20, // Default height
    });
  });

  it("should use 2-column layout for two cells", () => {
    const result = calculateAutoPlacement([
      createCellId("c1"),
      createCellId("c2"),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      i: "c1",
      x: 0,
      y: 0,
      w: 12, // Half width
      h: 20,
    });
    expect(result[1]).toEqual({
      i: "c2",
      x: 12, // Right column
      y: 0, // Same row
      w: 12,
      h: 20,
    });
  });

  it("should stack rows for more than 2 cells", () => {
    const result = calculateAutoPlacement([
      createCellId("c1"),
      createCellId("c2"),
      createCellId("c3"),
      createCellId("c4"),
    ]);
    expect(result).toHaveLength(4);
    // First row
    expect(result[0].y).toBe(0);
    expect(result[1].y).toBe(0);
    // Second row
    expect(result[2].y).toBe(20);
    expect(result[3].y).toBe(20);
  });

  it("should use full width for odd last cell", () => {
    const result = calculateAutoPlacement([
      createCellId("c1"),
      createCellId("c2"),
      createCellId("c3"),
    ]);
    expect(result).toHaveLength(3);
    // Last cell should be full width
    expect(result[2]).toEqual({
      i: "c3",
      x: 0,
      y: 20,
      w: 24, // Full width for last odd cell
      h: 20,
    });
  });

  it("should accept custom config", () => {
    const config: PlacementConfig = {
      columns: 12,
      rowHeight: 30,
      defaultWidth: 6,
      defaultHeight: 10,
    };
    const result = calculateAutoPlacement([createCellId("c1")], config);
    expect(result[0]).toEqual({
      i: "c1",
      x: 0,
      y: 0,
      w: 12, // Full width of 12-column grid
      h: 10, // Custom height
    });
  });
});

describe("calculateNewCellPlacement", () => {
  const createCellId = (id: string): CellId => id as CellId;
  const createPosition = (
    i: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): GridCellPosition => ({ i, x, y, w, h });

  it("should place first cell at top-left with full width", () => {
    const result = calculateNewCellPlacement(createCellId("new"), []);
    expect(result).toEqual({
      i: "new",
      x: 0,
      y: 0,
      w: 24,
      h: 20,
    });
  });

  it("should place new cell below existing cells", () => {
    const existing = [createPosition("c1", 0, 0, 12, 20)];
    const result = calculateNewCellPlacement(createCellId("new"), existing);
    expect(result.y).toBe(20); // Below the first cell
    expect(result.x).toBe(0);
    expect(result.w).toBe(24);
  });

  it("should place below the lowest cell", () => {
    const existing = [
      createPosition("c1", 0, 0, 12, 20),
      createPosition("c2", 12, 0, 12, 30), // Taller cell
    ];
    const result = calculateNewCellPlacement(createCellId("new"), existing);
    expect(result.y).toBe(30); // Below the tallest cell
  });

  it("should handle stacked cells correctly", () => {
    const existing = [
      createPosition("c1", 0, 0, 24, 20),
      createPosition("c2", 0, 20, 24, 20),
      createPosition("c3", 0, 40, 24, 20),
    ];
    const result = calculateNewCellPlacement(createCellId("new"), existing);
    expect(result.y).toBe(60); // Below all existing cells
  });

  it("should accept custom config", () => {
    const config: PlacementConfig = {
      columns: 12,
      rowHeight: 30,
      defaultWidth: 6,
      defaultHeight: 15,
    };
    const result = calculateNewCellPlacement(createCellId("new"), [], config);
    expect(result).toEqual({
      i: "new",
      x: 0,
      y: 0,
      w: 12, // Uses columns from config
      h: 15, // Uses defaultHeight from config
    });
  });
});
