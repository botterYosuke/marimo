/* Copyright 2026 Marimo. All rights reserved. */
import {
  type BrowserContext,
  type Page,
  chromium,
  expect,
  test,
} from "@playwright/test";

import {
  CDP_ENDPOINT,
  createNotebookViaIPC,
  findHomePage,
} from "./helpers";

test.describe("Tauri Desktop - Window Deduplication", () => {
  let context: BrowserContext;
  let homePage: Page;

  test.beforeAll(async () => {
    const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      throw new Error(
        "No browser context found. Is the Tauri app running with " +
          "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'?",
      );
    }

    context = contexts[0];

    if (context.pages().length === 0) {
      throw new Error("No pages found in the Tauri browser context.");
    }

    homePage = await findHomePage(context);
  });

  test("home page deduplication: opening home again focuses existing window", async () => {
    await expect(homePage.getByText("Create a new notebook")).toBeVisible({
      timeout: 15_000,
    });

    const pageCountBefore = context.pages().length;

    // Trigger open_home via IPC (simulates menu "Home Page" action)
    await homePage.evaluate(() => {
      if ((window as any).__TAURI_INTERNALS__) {
        (window as any).__TAURI_INTERNALS__.invoke("window_open_home");
      }
    });

    // Wait a moment for any potential new window
    await homePage.waitForTimeout(3_000);

    // Page count should remain the same (existing home page was focused)
    expect(context.pages().length).toBe(pageCountBefore);
  });

  test("notebook deduplication: opening same path focuses existing window", async () => {
    // Create a notebook with a unique file path (random to avoid conflicts
    // with windows left over from previous test runs)
    const testPath = `__new__s_dedup_${Date.now()}`;
    const pageCountBefore = context.pages().length;

    await homePage.evaluate((path: string) => {
      (window as any).__TAURI_INTERNALS__.invoke("window_open_notebook", {
        filePath: path,
      });
    }, testPath);

    await expect
      .poll(() => context.pages().length, { timeout: 15_000 })
      .toBeGreaterThan(pageCountBefore);

    const countAfterFirst = context.pages().length;

    // Try to open the same notebook path again
    await homePage.bringToFront();
    await homePage.evaluate((path: string) => {
      (window as any).__TAURI_INTERNALS__.invoke("window_open_notebook", {
        filePath: path,
      });
    }, testPath);

    // Wait a moment for any potential new window
    await homePage.waitForTimeout(3_000);

    // Page count should NOT increase (duplicate was focused, not created)
    expect(context.pages().length).toBe(countAfterFirst);
  });

  test("different notebook paths create separate windows", async () => {
    // Create two notebooks with different unique paths via IPC
    const notebook1 = await createNotebookViaIPC(homePage, context);
    expect(notebook1).toBeDefined();

    const countAfterFirst = context.pages().length;

    const notebook2 = await createNotebookViaIPC(homePage, context);
    expect(notebook2).toBeDefined();

    // Second notebook should have created a new page
    expect(context.pages().length).toBeGreaterThan(countAfterFirst);

    // Both notebooks should have different URLs
    expect(notebook1.url()).not.toBe(notebook2.url());
  });
});
