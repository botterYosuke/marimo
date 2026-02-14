/* Copyright 2026 Marimo. All rights reserved. */
import {
  type BrowserContext,
  type Page,
  chromium,
  expect,
  test,
} from "@playwright/test";

const CDP_ENDPOINT = "http://localhost:9222";

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
    const pages = context.pages();

    if (pages.length === 0) {
      throw new Error("No pages found in the Tauri browser context.");
    }

    // Find the home page (no ?file= parameter in URL)
    for (const page of pages) {
      const url = page.url();
      if (url.includes("localhost") && !url.includes("file=")) {
        homePage = page;
        break;
      }
    }

    // Fallback: find by content
    if (!homePage) {
      for (const page of pages) {
        const visible = await page
          .getByText("Create a new notebook")
          .isVisible()
          .catch(() => false);
        if (visible) {
          homePage = page;
          break;
        }
      }
    }

    if (!homePage) {
      homePage = pages[0];
    }
  });

  test("clicking 'Create a new notebook' opens a new Tauri window", async () => {
    // Verify we're on the home page
    await expect(homePage.getByText("Create a new notebook")).toBeVisible({
      timeout: 15_000,
    });

    const pageCountBefore = context.pages().length;

    // Click "Create a new notebook" link
    await homePage.getByText("Create a new notebook").click();

    // Wait for a new page to appear in the context
    await expect
      .poll(() => context.pages().length, { timeout: 15_000 })
      .toBeGreaterThan(pageCountBefore);

    // Find the new notebook page
    const newPage = context
      .pages()
      .find(
        (p) => p.url().includes("__new__") || p.url().includes("file="),
      );
    expect(newPage).toBeDefined();

    // Wait for the notebook to fully load
    await newPage!.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    // Verify the URL contains the new notebook pattern
    expect(newPage!.url()).toContain("__new__");

    // Verify the notebook editor is rendered (not a blank page)
    await newPage!.waitForFunction(
      () => document.querySelector(".cm-editor") !== null,
      { timeout: 30_000 },
    );

    const hasEditor = await newPage!.evaluate(
      () => document.querySelector(".cm-editor") !== null,
    );
    expect(hasEditor).toBe(true);
  });
});
