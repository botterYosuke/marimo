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

test.describe("Tauri Desktop - New Notebook", () => {
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

  test("opening a new notebook creates a Tauri window with editor", async () => {
    // Verify we're on the home page
    await expect(homePage.getByText("Create a new notebook")).toBeVisible({
      timeout: 15_000,
    });

    // Create notebook via IPC with a unique ID to avoid deduplication.
    // The UI "Create a new notebook" link has a fixed href per session,
    // so clicking it when a notebook window already exists just focuses
    // the existing window (correct deduplication behavior).
    const newPage = await createNotebookViaIPC(homePage, context);

    // Wait for the notebook to fully load
    await newPage.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    // Verify the URL contains the new notebook pattern
    expect(newPage.url()).toContain("__new__");

    // Verify the notebook editor is rendered (not a blank page)
    await newPage.waitForFunction(
      () => document.querySelector(".cm-editor") !== null,
      { timeout: 30_000 },
    );

    const hasEditor = await newPage.evaluate(
      () => document.querySelector(".cm-editor") !== null,
    );
    expect(hasEditor).toBe(true);
  });
});
