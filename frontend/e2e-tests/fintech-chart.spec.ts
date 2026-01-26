/* Copyright 2026 Marimo. All rights reserved. */
/**
 * E2E test for fintech1.py to reproduce the anywidget sync issue.
 *
 * Error: "The truth value of a UIElement is always True. You probably want to call `.value` instead."
 */

import { test, expect } from "@playwright/test";
import { maybeRestartKernel, openCommandPalette } from "./helper";
import { waitForMarimoApp } from "./test-utils";

const BASE_URL = "http://127.0.0.1:2718";
const TEST_FILE = "C:/Users/sasai/AppData/Local/Temp/fintech1.py";

test.describe("Fintech Chart Sync Issue", () => {
  test.setTimeout(180000); // 3 minutes

  test("reproduce chart sync issue", async ({ page }) => {
    // Collect all console messages
    const consoleMessages: { type: string; text: string }[] = [];
    page.on("console", (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    // Open the test file
    console.log(`[TEST] Opening ${TEST_FILE}`);
    await page.goto(`${BASE_URL}?file=${TEST_FILE}`);
    await waitForMarimoApp(page);
    await maybeRestartKernel(page);

    // Wait for notebook to fully load
    await page.waitForTimeout(2000);

    // Run all cells
    console.log("[TEST] Running all cells...");
    await openCommandPalette({ page, command: "Run all" });

    // Wait for cells to execute and data to load
    console.log("[TEST] Waiting for cells to execute...");
    await page.waitForTimeout(15000);

    // Take screenshot of initial state
    await page.screenshot({
      path: "e2e-tests/screenshots/fintech-chart-initial.png",
      fullPage: true,
    });

    // Look for any error messages in the UI
    const errorText = await page
      .locator('text="truth value"')
      .first()
      .textContent()
      .catch(() => null);
    if (errorText) {
      console.log(`[TEST] Found error in UI: ${errorText}`);
    }

    // Check for UIElement error in console
    const uiElementErrors = consoleMessages.filter(
      (msg) =>
        msg.text.includes("UIElement") || msg.text.includes("truth value")
    );
    console.log("[TEST] UIElement related console messages:", uiElementErrors);

    // Check for page errors
    console.log("[TEST] Page errors:", pageErrors);

    // Wait and observe for 30 seconds to see if chart updates
    console.log("[TEST] Observing for 30 seconds...");
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      console.log(`[TEST] Observation checkpoint ${i + 1}/6`);

      // Check if progress indicator updates
      const progressText = await page
        .locator('text=/進捗.*%/')
        .first()
        .textContent()
        .catch(() => null);
      if (progressText) {
        console.log(`[TEST] Progress: ${progressText}`);
      }
    }

    // Take final screenshot
    await page.screenshot({
      path: "e2e-tests/screenshots/fintech-chart-final.png",
      fullPage: true,
    });

    // Log all console errors for analysis
    const allErrors = consoleMessages.filter((msg) => msg.type === "error");
    console.log(`[TEST] All console errors (${allErrors.length}):`);
    for (const err of allErrors) {
      console.log(`  - ${err.text.slice(0, 200)}`);
    }

    // The test "passes" but we collect data for analysis
    // Real assertion would be: chart updates should be visible
    expect(true).toBe(true);
  });
});
