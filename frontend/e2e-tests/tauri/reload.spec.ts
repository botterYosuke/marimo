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

test.describe("Tauri Desktop - Reload", () => {
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

  test("F5 reloads the page and editor re-renders", async () => {
    // Verify editor is present before reload
    const hasEditorBefore = await notebookPage.evaluate(
      () => document.querySelector(".cm-editor") !== null,
    );
    expect(hasEditorBefore).toBe(true);

    // Press F5 to reload (handled by Tauri menu accelerator)
    await notebookPage.keyboard.press("F5");

    // Wait for the page to reload and editor to re-render
    await notebookPage.waitForLoadState("domcontentloaded", {
      timeout: 15_000,
    });

    // Wait for the editor to appear again after reload
    await notebookPage.waitForFunction(
      () => document.querySelector(".cm-editor") !== null,
      { timeout: 30_000 },
    );

    const hasEditorAfter = await notebookPage.evaluate(
      () => document.querySelector(".cm-editor") !== null,
    );
    expect(hasEditorAfter).toBe(true);
  });
});
