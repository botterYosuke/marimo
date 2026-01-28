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
 * Get the base URL for the application.
 * In a worker context, we derive it from self.location.
 * Worker is at /assets/worker-xxx.js, so we go up one level.
 */
function getBaseUrl(): string {
  // Worker location is like: https://botteryosuke.github.io/marimo/assets/worker-xxx.js
  // We need: https://botteryosuke.github.io/marimo/
  const workerUrl = self.location.href;
  const assetsIndex = workerUrl.lastIndexOf("/assets/");
  if (assetsIndex !== -1) {
    return workerUrl.substring(0, assetsIndex + 1);
  }
  // Fallback: use origin + BASE_URL
  return self.location.origin + (import.meta.env.BASE_URL || "/");
}

/**
 * Get the URL for the custom wheel hosted on GitHub Pages.
 * This is called from bootstrap.ts to fetch the actual wheel file.
 */
export async function getCustomWheelUrl(): Promise<string> {
  const baseUrl = getBaseUrl();
  const latestUrl = `${baseUrl}wheels/latest.txt`;

  Logger.log(`Fetching wheel info from: ${latestUrl}`);

  try {
    const response = await fetch(latestUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch latest.txt: ${response.status}`);
    }
    const wheelFilename = (await response.text()).trim();
    const wheelUrl = `${baseUrl}wheels/${wheelFilename}`;
    Logger.log(`Resolved wheel URL: ${wheelUrl}`);
    return wheelUrl;
  } catch (error) {
    Logger.error("Failed to get custom wheel URL:", error);
    throw error;
  }
}

/**
 * Get the URL for the BackcastPro wheel hosted on GitHub Pages.
 */
export async function getBackcastProWheelUrl(): Promise<string | null> {
  const baseUrl = getBaseUrl();
  const wheelsUrl = `${baseUrl}wheels/`;

  try {
    const response = await fetch(wheelsUrl);
    if (!response.ok) {
      Logger.log("Could not access wheels directory");
      return null;
    }
    const html = await response.text();
    // Find BackcastPro wheel filename in directory listing
    const match = html.match(/BackcastPro-[\d.]+-py3-none-any\.whl/);
    if (match) {
      const wheelUrl = `${wheelsUrl}${match[0]}`;
      Logger.log(`Found BackcastPro wheel: ${wheelUrl}`);
      return wheelUrl;
    }
    Logger.log("BackcastPro wheel not found in wheels directory");
    return null;
  } catch (error) {
    Logger.log("Failed to find BackcastPro wheel:", error);
    return null;
  }
}
