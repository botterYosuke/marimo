/* Copyright 2026 Marimo. All rights reserved. */
import type { PlaywrightTestConfig } from "@playwright/test";

/**
 * Playwright config for Tauri E2E tests.
 *
 * Prerequisites (start manually before running tests):
 *   Terminal 1: uv run marimo edit --no-token --headless /tmp --port 2718
 *   Terminal 2: $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"; cargo tauri dev
 *
 * Run:
 *   npx playwright test --config=playwright-tauri.config.ts
 */
const config: PlaywrightTestConfig = {
  testDir: "./e2e-tests/tauri",
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "html",
  use: {
    actionTimeout: 10 * 1000,
    navigationTimeout: 15 * 1000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // No webServer - Tauri app and marimo server are started externally
  // No globalSetup/globalTeardown - we don't want to kill marimo processes
};

export default config;
