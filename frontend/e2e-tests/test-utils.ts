/* Copyright 2026 Marimo. All rights reserved. */

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Wait for a marimo app to be fully loaded and ready
 * In WASM mode, this waits for Pyodide to load and cells to execute
 */
export async function waitForMarimoApp(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout });
  } catch (e) {
    // Fallback to load state if networkidle fails
    await page.waitForLoadState("load", { timeout });
  }

  // Wait for the marimo app to be initialized
  // Check for various indicators that the app is loaded
  // Use polling to check periodically
  // In WASM mode, we need to wait for Pyodide to load AND cells to execute
  await page.waitForFunction(
    () => {
      // Check if the app is loaded by looking for key elements
      // In WASM mode, Pyodide might be available
      // In regular mode, we look for cell editors or cells
      const hasPyodide = (window as any).Pyodide !== undefined;
      const hasCellEditor = document.querySelector("[data-testid='cell-editor']") !== null;
      const hasMarimoCell = document.querySelector(".marimo-cell") !== null;
      const hasMarimoStatic = document.querySelector("[data-testid='marimo-static']") !== null;
      const hasLayoutSelect = document.querySelector("[data-testid='layout-select']") !== null;
      const bodyText = document.body.textContent || "";
      const hasGridLayout = bodyText.includes("Grid Layout");
      const hasText1 = bodyText.includes("text 1");
      const hasText2 = bodyText.includes("text 2");
      
      // In WASM mode, wait for Pyodide AND cell outputs
      if (hasPyodide) {
        return hasText1 && hasText2;
      }
      
      // In regular mode, check for app structure
      return (
        hasCellEditor ||
        hasMarimoCell ||
        hasMarimoStatic ||
        hasLayoutSelect ||
        hasGridLayout ||
        hasText1 ||
        hasText2
      );
    },
    { timeout, polling: 1000 },
  );
}

/**
 * Wait for cells to be executed and their output to be visible
 * This is especially important in WASM mode where Pyodide needs time to execute cells
 */
export async function waitForCellsExecuted(
  page: Page,
  expectedTexts: string[],
  timeout = 60_000,
): Promise<void> {
  // Wait for each text individually with retries
  // This is more reliable in WASM mode where cells may execute at different times
  for (const text of expectedTexts) {
    try {
      await expect(page.getByText(text).first()).toBeVisible({
        timeout: Math.min(timeout, 30000), // Cap individual timeout at 30s
      });
    } catch (error) {
      // If text is not found, try waiting a bit more and check page content
      console.log(`Waiting for text "${text}" to appear...`);
      await page.waitForTimeout(2000);
      
      // Final attempt with full timeout
      await expect(page.getByText(text).first()).toBeVisible({
        timeout: timeout,
      });
    }
  }

  // Additional wait to ensure cells are fully rendered and layout is stable
  await page.waitForTimeout(2000);
}

/**
 * Wait for server to be responsive with retries
 */
export async function waitForServerReady(
  page: Page,
  url: string,
  maxRetries = 5,
): Promise<void> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 10_000,
      });

      // Additional check to ensure the page is actually loaded
      await waitForMarimoApp(page);
      return;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        throw new Error(
          `Server not ready after ${maxRetries} retries: ${error}`,
        );
      }

      console.log(`Server not ready, retrying... (${retries}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Robust element interaction with retry
 */
export async function clickWithRetry(
  page: Page,
  selector: string,
  maxRetries = 3,
  timeout = 5000,
): Promise<void> {
  let element: Locator | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      element = page.locator(selector);
      await element.waitFor({ state: "visible", timeout });
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await page.waitForTimeout(1000);
    }
  }
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  await element.click({ timeout });
}

export async function hoverWithRetry(
  page: Page,
  selector: string,
  maxRetries = 3,
  timeout = 5000,
): Promise<void> {
  let element: Locator | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      element = page.locator(selector);
      await element.waitFor({ state: "visible", timeout });
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await page.waitForTimeout(1000);
    }
  }
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  await element.hover({ timeout });
}

/**
 * Safe page navigation with fallback
 */
export async function safeGoto(
  page: Page,
  url: string,
  timeout = 30_000,
): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout });
  } catch (error) {
    // Fallback to basic load
    console.log(`Network idle failed, trying basic load: ${error}`);
    await page.goto(url, { waitUntil: "load", timeout });
  }
}
