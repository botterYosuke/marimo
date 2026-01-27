/* Copyright 2026 Marimo. All rights reserved. */

import { Logger } from "@/utils/Logger";

export function getMarimoWheel(_version: string) {
  if (import.meta.env.DEV && import.meta.env.VITE_WASM_MARIMO_PREBUILT_WHEEL) {
    return "marimo-base";
  }

  if (import.meta.env.DEV) {
    return `http://localhost:8000/dist/marimo-${
      import.meta.env.VITE_MARIMO_VERSION
    }-py3-none-any.whl`;
  }

  // Use custom wheel from GitHub Pages if VITE_USE_CUSTOM_WHEEL is set
  if (import.meta.env.VITE_USE_CUSTOM_WHEEL) {
    // Return a marker to indicate we should use the custom wheel
    // The actual URL will be resolved in bootstrap.ts
    return "custom-wheel";
  }

  return "marimo-base";
}

/**
 * Get the URL for the custom wheel hosted on GitHub Pages.
 * This is called from bootstrap.ts to fetch the actual wheel file.
 */
export async function getCustomWheelUrl(): Promise<string> {
  // Fetch the latest wheel filename from the server
  const baseUrl = import.meta.env.BASE_URL || "/";
  const latestUrl = `${baseUrl}wheels/latest.txt`;

  try {
    const response = await fetch(latestUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch latest.txt: ${response.status}`);
    }
    const wheelFilename = (await response.text()).trim();
    return `${baseUrl}wheels/${wheelFilename}`;
  } catch (error) {
    Logger.error("Failed to get custom wheel URL:", error);
    throw error;
  }
}
