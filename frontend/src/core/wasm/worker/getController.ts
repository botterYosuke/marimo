/* Copyright 2026 Marimo. All rights reserved. */
import { DefaultWasmController } from "./bootstrap";
import type { WasmController } from "./types";

// Load the controller
// Falls back to the default controller
export async function getController(version: string): Promise<WasmController> {
  try {
    const controller = await import(
      /* @vite-ignore */ `/wasm/controller.js?version=${version}`
    );
    // Guard: if the module doesn't export a valid WasmController, fall back.
    // This handles the case where controller.js is a placeholder (export {}).
    if (typeof controller.bootstrap !== "function") {
      return new DefaultWasmController();
    }
    return controller;
  } catch {
    return new DefaultWasmController();
  }
}
