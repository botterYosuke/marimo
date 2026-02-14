/* Copyright 2026 Marimo. All rights reserved. */
import {
  type BrowserContext,
  type Page,
  chromium,
  expect,
  test,
} from "@playwright/test";

import { CDP_ENDPOINT, findHomePage } from "./helpers";

test.describe("Tauri Desktop - External Links", () => {
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

  test("clicking external link does not open a new Tauri window", async () => {
    // Verify home page is loaded
    await expect(homePage.getByText("Create a new notebook")).toBeVisible({
      timeout: 15_000,
    });

    const pageCountBefore = context.pages().length;

    // Find and click an external link (Documentation -> docs.marimo.io)
    const docLink = homePage.locator('a[href*="docs.marimo.io"]').first();
    const linkExists = await docLink.isVisible().catch(() => false);

    if (!linkExists) {
      // Fallback: try GitHub link
      const ghLink = homePage
        .locator('a[href*="github.com/marimo-team"]')
        .first();
      await ghLink.click();
    } else {
      await docLink.click();
    }

    // Wait a moment for any potential new window to appear
    await homePage.waitForTimeout(3_000);

    // Verify no new Tauri window was created
    // (The link should have opened in the system browser via LINK_INTERCEPT_JS)
    expect(context.pages().length).toBe(pageCountBefore);
  });
});
