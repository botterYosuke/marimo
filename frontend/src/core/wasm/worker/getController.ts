/* Copyright 2026 Marimo. All rights reserved. */
import { DefaultWasmController } from "./bootstrap";
import type { WasmController } from "./types";

// Load the controller
// Falls back to the default controller
export async function getController(version: string): Promise<WasmController> {
  try {
    const controllerModule = await import(
      /* @vite-ignore */ `/wasm/controller.js?version=${version}`
    );
    // Check if the module exports a valid controller
    // It should export a class that implements WasmController interface
    // If it's an empty module or doesn't export a controller, fall back to default
    if (
      controllerModule &&
      typeof controllerModule === "object" &&
      ("default" in controllerModule || "WasmController" in controllerModule)
    ) {
      const ControllerClass =
        controllerModule.default || controllerModule.WasmController;
      if (ControllerClass && typeof ControllerClass === "function") {
        return new ControllerClass();
      }
    }
    // If no valid controller found, fall back to default
    return new DefaultWasmController();
  } catch {
    // If import fails (404, network error, etc.), fall back to default
    return new DefaultWasmController();
  }
}
