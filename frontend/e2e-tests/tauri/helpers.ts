/* Copyright 2026 Marimo. All rights reserved. */
import { type BrowserContext, type Page, expect } from "@playwright/test";

export const CDP_ENDPOINT = "http://localhost:9222";

/**
 * Find the home page among CDP pages.
 * Home page = localhost URL without ?file= parameter.
 * Fallback: find by "Create a new notebook" text content.
 */
export async function findHomePage(
  context: BrowserContext,
): Promise<Page> {
  const pages = context.pages();

  // Find by URL pattern
  for (const page of pages) {
    const url = page.url();
    if (url.includes("localhost") && !url.includes("file=")) {
      return page;
    }
  }

  // Fallback: find by content
  for (const page of pages) {
    const visible = await page
      .getByText("Create a new notebook")
      .isVisible()
      .catch(() => false);
    if (visible) {
      return page;
    }
  }

  // Last resort: first page
  return pages[0];
}

/**
 * Find an existing notebook page in the CDP context.
 * Returns undefined if no notebook page exists.
 */
export function findNotebookPage(
  context: BrowserContext,
): Page | undefined {
  return context.pages().find(
    (p) =>
      p.url().includes("localhost") &&
      p.url().includes("file="),
  );
}

/**
 * Create a new notebook window via Tauri IPC with a unique file path.
 * This bypasses the UI click and avoids deduplication issues.
 */
export async function createNotebookViaIPC(
  homePage: Page,
  context: BrowserContext,
): Promise<Page> {
  const pageCountBefore = context.pages().length;
  const randomId = Math.random().toString(36).substring(2, 8);

  await homePage.evaluate((id: string) => {
    (window as any).__TAURI_INTERNALS__.invoke("window_open_notebook", {
      filePath: `__new__s_${id}`,
    });
  }, randomId);

  await expect
    .poll(() => context.pages().length, { timeout: 15_000 })
    .toBeGreaterThan(pageCountBefore);

  // Poll for the page with matching URL (may still be at about:blank initially)
  let newPage: Page | undefined;
  await expect
    .poll(
      () => {
        newPage = context.pages().find((p) => p.url().includes(randomId));
        return !!newPage;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();

  if (!newPage) {
    throw new Error(
      `Failed to find new notebook page with ID ${randomId}`,
    );
  }

  return newPage;
}

/**
 * Find an existing notebook page or create a new one via IPC.
 * Waits for the editor to be fully loaded.
 */
export async function findOrCreateNotebook(
  homePage: Page,
  context: BrowserContext,
): Promise<Page> {
  let notebookPage = findNotebookPage(context);

  if (!notebookPage) {
    notebookPage = await createNotebookViaIPC(homePage, context);
  }

  await notebookPage.waitForLoadState("domcontentloaded", {
    timeout: 15_000,
  });
  await notebookPage.waitForFunction(
    () => document.querySelector(".cm-editor") !== null,
    { timeout: 30_000 },
  );

  return notebookPage;
}
