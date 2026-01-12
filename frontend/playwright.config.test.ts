/* Copyright 2026 Marimo. All rights reserved. */

import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import LZString from "lz-string";

// Default base URL for testing with existing server
// Set MARIMO_TEST_URL environment variable to override
const BASE_URL = process.env.MARIMO_TEST_URL || "http://localhost:3000";

// Get the path to the e2e-tests/py directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pydir = path.join(__dirname, "e2e-tests", "py");

/**
 * Get the URL for a test app file using compressed code parameter
 * In WASM mode, files are loaded via ?code= parameter with compressed content
 * @param app - The app filename (e.g., "layout_grid.py")
 * @returns The full URL to the app with compressed code parameter
 */
export function getAppUrl(app: string): string {
  const pathToApp = path.join(pydir, app);
  // Read the file content
  const fileContent = readFileSync(pathToApp, "utf-8");
  // Compress the content using lz-string (same as used in store.ts)
  const compressed = LZString.compressToEncodedURIComponent(fileContent);
  // Use ?code= parameter for WASM mode
  return `${BASE_URL}/?code=${compressed}`;
}

// Simplified config for testing with existing server
const config: PlaywrightTestConfig = {
  testDir: "./e2e-tests",
  timeout: 120 * 1000, // Increased timeout for WASM mode (Pyodide needs more time)
  expect: {
    timeout: 60 * 1000, // Increased expect timeout for WASM mode
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  quiet: false,
  use: {
    baseURL: BASE_URL,
    actionTimeout: 30 * 1000, // Increased action timeout for WASM mode
    navigationTimeout: 60 * 1000, // Increased navigation timeout for WASM mode
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  // No webServer - use existing server started with:
  // $env:PYODIDE="true"; pnpm exec vite preview --host localhost --port 3000
};

export default config;
