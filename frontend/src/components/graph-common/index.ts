/* Copyright 2026 Marimo. All rights reserved. */
import type { Edge } from "reactflow";

// Handle IDs (ReactFlow の接続ポイント識別子)
export const OUTPUTS_HANDLE_ID = "outputs";
export const INPUTS_HANDLE_ID = "inputs";

// Tree edge helper
export function createTreeEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: OUTPUTS_HANDLE_ID,
    targetHandle: INPUTS_HANDLE_ID,
    type: "straight",
    animated: true,
    style: { strokeWidth: 2, stroke: "transparent" },
  };
}
