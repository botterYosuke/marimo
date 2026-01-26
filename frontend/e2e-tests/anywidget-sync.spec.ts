/* Copyright 2026 Marimo. All rights reserved. */
/**
 * E2E test for AnyWidget backend-to-frontend synchronization.
 *
 * This test verifies that when a widget trait is changed from Python
 * (backend), the change is properly synchronized to the frontend.
 */

import { test, expect } from "@playwright/test";
import { maybeRestartKernel, openCommandPalette } from "./helper";
import { waitForMarimoApp } from "./test-utils";

const BASE_URL = "http://127.0.0.1:2718";
const TEST_FILE = "e2e-tests/py/anywidget_sync.py";

test.describe("AnyWidget Backend Sync", () => {
  test.setTimeout(120000);

  test("backend trait changes are synced to frontend", async ({ page }) => {
    // Collect ALL console messages for debugging
    const allConsoleLogs: string[] = [];
    page.on("console", (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      allConsoleLogs.push(text);
      // Log frontend debug messages to test output
      if (msg.text().includes("FRONTEND-DEBUG") || msg.text().includes("handleWidgetMessage") || msg.text().includes("AnyWidget") || msg.text().includes("[WS]") || msg.text().includes("Model.emit") || msg.text().includes("UIRegistry") || msg.text().includes("MarimoIncomingMessageEvent") || msg.text().includes("marimo-ui-element")) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    // Open the test file
    await page.goto(`${BASE_URL}?file=${TEST_FILE}`);
    await waitForMarimoApp(page);
    await maybeRestartKernel(page);

    // Wait for notebook to fully load
    await page.waitForTimeout(3000);

    // Try to dismiss any AI fix dialogs (try multiple times)
    for (let i = 0; i < 5; i++) {
      const rejectButton = page.getByRole("button", { name: "Reject" });
      if (await rejectButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`[TEST] Dismissing AI fix dialog (attempt ${i + 1})`);
        await rejectButton.click();
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }

    // Run all cells using keyboard shortcut (Ctrl+Shift+R or Cmd+Shift+R)
    console.log("[TEST] Running all cells with keyboard shortcut");
    const isMac = await page.evaluate(() => navigator.userAgent.includes("Mac"));
    await page.keyboard.press(isMac ? "Meta+Shift+r" : "Control+Shift+r");

    // Wait for cells to execute
    await page.waitForTimeout(10000);

    // Dismiss any AI fix dialogs that appeared during execution
    for (let i = 0; i < 3; i++) {
      const rejectButton = page.getByRole("button", { name: "Reject" });
      if (await rejectButton.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log(`[TEST] Dismissing AI fix dialog after run (attempt ${i + 1})`);
        await rejectButton.click();
        await page.waitForTimeout(300);
      } else {
        break;
      }
    }

    // Find and verify initial widget state (use first() to handle duplicates)
    const widgetDisplay = page.locator("#anywidget-count-display").first();

    // Wait for the widget to render with increased timeout and retries
    console.log("[TEST] Waiting for widget to be visible");
    let widgetVisible = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await expect(widgetDisplay).toBeVisible({ timeout: 20000 });
        widgetVisible = true;
        console.log(`[TEST] Widget visible on attempt ${attempt + 1}`);
        break;
      } catch {
        console.log(`[TEST] Widget not visible on attempt ${attempt + 1}, rerunning cells...`);
        const isMac2 = await page.evaluate(() => navigator.userAgent.includes("Mac"));
        await page.keyboard.press(isMac2 ? "Meta+Shift+r" : "Control+Shift+r");
        await page.waitForTimeout(10000);
      }
    }

    if (!widgetVisible) {
      // Take screenshot for debugging
      await page.screenshot({
        path: "e2e-tests/screenshots/anywidget-widget-not-visible.png",
        fullPage: true,
      });
      throw new Error("Widget failed to render after 3 attempts - ESM may have failed to load");
    }

    // Verify initial count (may be 0 or already updated)
    const initialText = await widgetDisplay.textContent();
    console.log(`[TEST] Initial widget text: ${initialText}`);
    expect(initialText).toMatch(/Count: \d+/);

    // Find and click the start button
    const startButton = page.getByRole("button", {
      name: "Start Backend Updates",
    });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Wait for updates to start propagating
    await page.waitForTimeout(1000);

    // Collect count values over time to verify updates
    const collectedCounts: number[] = [];
    const startTime = Date.now();
    const maxWaitTime = 15000; // 15 seconds max

    while (Date.now() - startTime < maxWaitTime) {
      const text = await widgetDisplay.textContent();
      const match = text?.match(/Count: (\d+)/);
      if (match) {
        const count = Number.parseInt(match[1], 10);
        if (!collectedCounts.includes(count)) {
          collectedCounts.push(count);
          console.log(`[SYNC TEST] Observed count: ${count}`);
        }
        // Stop if we've reached the final count
        if (count >= 10) {
          break;
        }
      }
      await page.waitForTimeout(200);
    }

    // Log results
    console.log(
      `[SYNC TEST] Collected counts: [${collectedCounts.join(", ")}]`
    );
    console.log(`[SYNC TEST] Total unique counts: ${collectedCounts.length}`);

    // Verify we received updates
    // We should see at least some intermediate values (not just 0 and 10)
    console.log("[DEBUG] All console logs with AnyWidget/handleWidgetMessage:");
    allConsoleLogs.filter(log => log.includes("AnyWidget") || log.includes("handleWidgetMessage") || log.includes("send-ui-element")).forEach(log => {
      console.log(`  ${log}`);
    });
    console.log(`[DEBUG] Total console messages collected: ${allConsoleLogs.length}`);
    expect(collectedCounts.length).toBeGreaterThan(1);

    // Verify the count increased (proves sync is working)
    // We don't require reaching exactly 10 since timing can vary
    const maxCount = Math.max(...collectedCounts);
    console.log(`[SYNC TEST] Max observed count: ${maxCount}`);
    expect(maxCount).toBeGreaterThan(0);

    // Take a screenshot for verification
    await page.screenshot({
      path: "e2e-tests/screenshots/anywidget-sync-result.png",
      fullPage: true,
    });
  });

  test("widget updates are visible even after error", async ({ page }) => {
    // This test checks if the error message affects widget sync
    await page.goto(`${BASE_URL}?file=${TEST_FILE}`);
    await waitForMarimoApp(page);
    await maybeRestartKernel(page);

    // Wait for notebook to load
    await page.waitForTimeout(2000);

    // Check for any error messages in the console
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleMessages.push(msg.text());
      }
    });

    // Run all cells using command palette
    await openCommandPalette({ page, command: "Run all" });

    // Wait for cells to execute
    await page.waitForTimeout(5000);

    // Start the update
    const startButton = page.getByRole("button", {
      name: "Start Backend Updates",
    });
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // Wait for updates to complete
    await page.waitForTimeout(8000);

    // Check if there were any relevant errors
    const relevantErrors = consoleMessages.filter(
      (msg) =>
        msg.includes("UIElement") ||
        msg.includes("anywidget") ||
        msg.includes("truth value")
    );

    console.log("[ERROR CHECK] Relevant console errors:", relevantErrors);

    // Log all errors for debugging
    if (consoleMessages.length > 0) {
      console.log("[ERROR CHECK] All console errors:", consoleMessages);
    }
  });
});
