/* Copyright 2026 Marimo. All rights reserved. */
import { DefaultWasmController } from "./bootstrap";
import type { WasmController } from "./types";
import { Logger } from "../../../utils/Logger";

// Load the controller
// Falls back to the default controller
export async function getController(version: string): Promise<WasmController> {
  try {
    const controller = await import(
      /* @vite-ignore */ `/wasm/controller.js?version=${version}`
    );
    
    // インポートしたオブジェクトが有効なWasmControllerか検証
    // controllerがオブジェクトで、bootstrapメソッドを持つことを確認
    if (
      controller &&
      typeof controller === 'object' &&
      'bootstrap' in controller &&
      typeof controller.bootstrap === 'function'
    ) {
      return controller as WasmController;
    }
    
    // 無効な場合はフォールバックを使用
    Logger.warn(
      "Imported controller is not a valid WasmController, falling back to DefaultWasmController"
    );
    return new DefaultWasmController();
  } catch (error) {
    // インポートエラーの場合もフォールバックを使用
    Logger.warn("Failed to import controller, falling back to DefaultWasmController", error);
    return new DefaultWasmController();
  }
}
