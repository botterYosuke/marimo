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
  findHomePage,
  findOrCreateNotebook,
} from "./helpers";

test.describe("Tauri Desktop - Cell Execution", () => {
  let context: BrowserContext;
  let notebookPage: Page;

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

    const homePage = await findHomePage(context);
    notebookPage = await findOrCreateNotebook(homePage, context);
  });

  test("can execute a cell with Ctrl+Enter and see output", async () => {
    // Bring notebook to front and close any overlapping panels
    await notebookPage.bringToFront();

    // Click on the editable area inside CodeMirror.
    // Use force:true because sidebar panels may overlay the editor.
    const editor = notebookPage.locator(".cm-content").first();
    await editor.click({ force: true });

    // Select all existing content and replace with our code
    await notebookPage.keyboard.press("Control+a");
    await notebookPage.keyboard.type("1 + 1");

    // Execute with Ctrl+Enter (verifies no hotkey conflict with menu)
    await notebookPage.keyboard.press("Control+Enter");

    // Wait for output to appear
    await expect(
      notebookPage.locator("[data-cell-role='output']").first(),
    ).toBeVisible({ timeout: 15_000 });

    // Verify output contains the result
    const outputText = await notebookPage
      .locator("[data-cell-role='output']")
      .first()
      .textContent();
    expect(outputText).toContain("2");
  });
});
