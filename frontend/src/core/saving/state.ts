/* Copyright 2026 Marimo. All rights reserved. */
import { atom } from "jotai";
import { isEqual } from "lodash-es";
import { arrayShallowEquals } from "@/utils/arrays";
import { type NotebookState, notebookAtom } from "../cells/cells";
import { type LayoutState, layoutStateAtom } from "../layout/layout";
import type { CellConfig } from "../network/types";
import { cell3DPositionsAtom } from "../three/cell-3d-positions";

export interface LastSavedNotebook {
  codes: string[];
  configs: CellConfig[];
  names: string[];
  layout: LayoutState;
  savedCell3DPositions?: Map<string, { x: number; y: number; z: number }>;
}

export const lastSavedNotebookAtom = atom<LastSavedNotebook | undefined>(
  undefined,
);

export const needsSaveAtom = atom((get) => {
  const lastSavedNotebook = get(lastSavedNotebookAtom);
  const state = get(notebookAtom);
  const layout = get(layoutStateAtom);
  const cell3DPositions = get(cell3DPositionsAtom);
  return notebookNeedsSave({ state, layout, lastSavedNotebook, cell3DPositions });
});

function notebookNeedsSave({
  state,
  layout,
  lastSavedNotebook,
  cell3DPositions,
}: {
  state: NotebookState;
  layout: LayoutState;
  lastSavedNotebook: LastSavedNotebook | undefined;
  cell3DPositions: Map<string, { x: number; y: number; z: number }>;
}) {
  if (!lastSavedNotebook) {
    return false;
  }
  const { cellIds, cellData } = state;
  const data = cellIds.inOrderIds.map((cellId) => cellData[cellId]);
  const codes = data.map((d) => d.code);
  const configs = data.map((d) => d.config);
  const names = data.map((d) => d.name);

  // Check if 3D positions changed
  const saved3D = lastSavedNotebook.savedCell3DPositions;
  const positions3DChanged =
    cell3DPositions.size > 0 &&
    (!saved3D || !isEqual(cell3DPositions, saved3D));

  return (
    !arrayShallowEquals(codes, lastSavedNotebook.codes) ||
    !arrayShallowEquals(names, lastSavedNotebook.names) ||
    !isEqual(configs, lastSavedNotebook.configs) ||
    !isEqual(layout.selectedLayout, lastSavedNotebook.layout.selectedLayout) ||
    !isEqual(layout.layoutData, lastSavedNotebook.layout.layoutData) ||
    positions3DChanged
  );
}
