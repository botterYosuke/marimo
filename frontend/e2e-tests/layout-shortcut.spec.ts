/* Copyright 2026 Marimo. All rights reserved. */

import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { getAppUrl } from "../playwright.config.test";
import { takeScreenshot, pressShortcut } from "./helper";
import { waitForMarimoApp, safeGoto } from "./test-utils";
import { readFileSync } from "node:fs";
import LZString from "lz-string";
import path from "node:path";

const _filename = fileURLToPath(import.meta.url);

// Use environment variable if set, otherwise use default
// For manual testing with existing server, set MARIMO_TEST_URL=http://localhost:3000
// Also set MARIMO_TEST_FILE to specify the file path relative to the server root
const TEST_FILE = process.env.MARIMO_TEST_FILE || "e2e-tests/py/layout_grid.py";

// Get URL for the test file
// In WASM mode, use ?code= parameter with compressed file content
let editUrl: string;
if (process.env.MARIMO_TEST_URL) {
  // When MARIMO_TEST_URL is set, read the file and compress it
  const __dirname = path.dirname(_filename);
  const projectRoot = path.resolve(__dirname, "../../..");
  const filePath = path.join(projectRoot, TEST_FILE);
  const fileContent = readFileSync(filePath, "utf-8");
  const compressed = LZString.compressToEncodedURIComponent(fileContent);
  editUrl = `${process.env.MARIMO_TEST_URL}/?code=${compressed}`;
} else {
  // Use getAppUrl which already handles compression
  editUrl = getAppUrl("layout_grid.py");
}


async function getLayoutSelectValue(page: Page): Promise<string> {
  const layoutSelect = page.getByTestId("layout-select");
  await expect(layoutSelect).toBeVisible({ timeout: 15000 });
  // Get the current value from the Radix UI Select component
  // The Select (Root) component has a value attribute that contains the current layout
  // We can also get the text content from the SelectValue component inside SelectTrigger
  const value = await layoutSelect.evaluate((el) => {
    // First, try to get the value attribute from the Select Root component
    // The Select Root is the element with data-testid="layout-select"
    // In Radix UI, the Root component has a value prop that we can access via getAttribute
    const rootValue = el.getAttribute("value");
    if (rootValue) {
      return rootValue.toLowerCase();
    }
    
    // Fallback: Get text content from SelectTrigger/SelectValue
    // The SelectTrigger contains the SelectValue component which displays the current value
    // SelectValue is rendered as a span, and we need to extract the layout name from its text
    // Layout names are displayed as "Vertical", "Grid", "Slides" (using startCase)
    const text = el.textContent || "";
    // Remove any icon text or chevron text, keep only the layout name
    // Layout names are: "Vertical", "Grid", "Slides" (case-insensitive)
    const layoutNames = ["vertical", "grid", "slides"];
    const normalizedText = text.trim().toLowerCase();
    for (const layoutName of layoutNames) {
      if (normalizedText.includes(layoutName)) {
        return layoutName;
      }
    }
    // If no match found, return normalized text (might be empty or contain other text)
    return normalizedText;
  });
  return value || "";
}

async function waitForLayoutChange(
  page: Page,
  expectedLayout: string,
  timeout = 10000,
): Promise<void> {
  // Normalize expected layout name
  const normalizedExpected = expectedLayout.toLowerCase();
  
  await expect
    .poll(
      async () => {
        const currentValue = await getLayoutSelectValue(page);
        return currentValue.toLowerCase();
      },
      {
        timeout,
        intervals: [200, 500, 1000],
        message: `Layout did not change to ${expectedLayout} within ${timeout}ms`,
      },
    )
    .toBe(normalizedExpected);
}

/**
 * Enable wasm_layouts feature flag for WASM mode tests
 * This is needed because layouts are disabled by default in WASM mode
 */
async function enableWasmLayoutsFlag(page: Page): Promise<void> {
  const flagSet = await page.evaluate(() => {
    // setFeatureFlag is exposed via repl() as window.__marimo__setFeatureFlag
    const setFeatureFlag = (window as unknown as Record<string, unknown>)
      .__marimo__setFeatureFlag;
    if (typeof setFeatureFlag === "function") {
      try {
        (setFeatureFlag as (feature: string, value: boolean) => void)(
          "wasm_layouts",
          true,
        );
        return true;
      } catch (error) {
        console.warn("Failed to enable wasm_layouts flag:", error);
        return false;
      }
    } else {
      console.warn("setFeatureFlag is not available on window.__marimo__setFeatureFlag");
      return false;
    }
  });
  
  if (!flagSet) {
    console.warn("Could not set wasm_layouts flag, continuing anyway...");
    return;
  }
  
  // Wait for the flag to be applied and UI to update
  // In WASM mode, saveUserConfig may take time to apply
  // We wait a bit longer and then check if layouts are working
  await page.waitForTimeout(2000);
}

/**
 * Set layout to vertical to ensure initial layout is vertical
 * This is needed because is3DModeAtom defaults to true, which makes initial layout grid
 * First set is3DModeAtom to false, then set layout to vertical
 */
async function setLayoutToVertical(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    // setIs3DMode is exposed via repl() as window.__marimo__setIs3DMode
    const setIs3DMode = (window as unknown as Record<string, unknown>)
      .__marimo__setIs3DMode;
    // setLayoutView is exposed via repl() as window.__marimo__setLayoutView
    const setLayoutView = (window as unknown as Record<string, unknown>)
      .__marimo__setLayoutView;
    
    let is3DModeSet = false;
    let layoutSet = false;
    
    if (typeof setIs3DMode === "function") {
      try {
        (setIs3DMode as (value: boolean) => void)(false);
        is3DModeSet = true;
        console.log("setIs3DMode(false) called successfully");
      } catch (error) {
        console.warn("Failed to set is3DMode to false:", error);
      }
    } else {
      console.warn("setIs3DMode is not available on window.__marimo__setIs3DMode");
    }
    
    if (typeof setLayoutView === "function") {
      try {
        (setLayoutView as (layout: string) => void)("vertical");
        layoutSet = true;
        console.log("setLayoutView('vertical') called successfully");
      } catch (error) {
        console.warn("Failed to set layout to vertical:", error);
      }
    } else {
      console.warn("setLayoutView is not available on window.__marimo__setLayoutView");
    }
    
    return { is3DModeSet, layoutSet };
  });
  
  if (!result.is3DModeSet && !result.layoutSet) {
    console.warn("Could not set is3DMode or layout, continuing anyway...");
    return;
  }
  
  // Wait a bit for the layout to update and React to re-render
  await page.waitForTimeout(2000);
}

/**
 * Set layout to grid for testing
 */
async function setLayoutToGrid(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    // setLayoutView is exposed via repl() as window.__marimo__setLayoutView
    const setLayoutView = (window as unknown as Record<string, unknown>)
      .__marimo__setLayoutView;
    
    let layoutSet = false;
    
    if (typeof setLayoutView === "function") {
      try {
        (setLayoutView as (layout: string) => void)("grid");
        layoutSet = true;
        console.log("setLayoutView('grid') called successfully");
      } catch (error) {
        console.warn("Failed to set layout to grid:", error);
      }
    } else {
      console.warn("setLayoutView is not available on window.__marimo__setLayoutView");
    }
    
    return { layoutSet };
  });
  
  if (!result.layoutSet) {
    console.warn("Could not set layout to grid, continuing anyway...");
    return;
  }
  
  // Wait a bit for the layout to update and React to re-render
  await page.waitForTimeout(2000);
}

/**
 * Set layout to slides for testing (present mode only)
 */
async function setLayoutToSlides(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    // setLayoutView is exposed via repl() as window.__marimo__setLayoutView
    const setLayoutView = (window as unknown as Record<string, unknown>)
      .__marimo__setLayoutView;
    
    let layoutSet = false;
    
    if (typeof setLayoutView === "function") {
      try {
        (setLayoutView as (layout: string) => void)("slides");
        layoutSet = true;
        console.log("setLayoutView('slides') called successfully");
      } catch (error) {
        console.warn("Failed to set layout to slides:", error);
      }
    } else {
      console.warn("setLayoutView is not available on window.__marimo__setLayoutView");
    }
    
    return { layoutSet };
  });
  
  if (!result.layoutSet) {
    console.warn("Could not set layout to slides, continuing anyway...");
    return;
  }
  
  // Wait a bit for the layout to update and React to re-render
  await page.waitForTimeout(2000);
}

test("can switch layout with keyboard shortcut in edit mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical to ensure initial layout is vertical
  await setLayoutToVertical(page);
  
  // Debug: Check layout state after setLayoutToVertical
  const layoutStateAfterSetVertical = await page.evaluate(() => {
    const gridContainer = document.querySelector("[data-testid='grid-layout-container'], .grid-layout-container, [class*='grid-layout']");
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return {
      hasGridContainer: gridContainer !== null,
      hasReactGridLayout: reactGridLayout !== null,
    };
  });
  console.log("Layout state after setLayoutToVertical:", layoutStateAfterSetVertical);

  // Debug: Check if Pyodide is loaded and cells are being executed
  const debugInfo = await page.evaluate(() => {
    const hasPyodide = (window as unknown as Record<string, unknown>).Pyodide !== undefined;
    const cells = document.querySelectorAll(".marimo-cell, [data-testid='cell-editor']");
    const outputs = document.querySelectorAll(".marimo-output, [data-testid='cell-output']");
    const bodyText = document.body.textContent || "";
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get("code");
    const hash = window.location.hash;
    
    return {
      hasPyodide,
      cellCount: cells.length,
      outputCount: outputs.length,
      hasText1: bodyText.includes("text 1"),
      hasText2: bodyText.includes("text 2"),
      hasGridLayout: bodyText.includes("Grid Layout"),
      bodyTextLength: bodyText.length,
      url: window.location.href,
      hasCodeParam: codeParam !== null,
      codeParamLength: codeParam?.length || 0,
      hash: hash,
    };
  });
  console.log("Debug info:", JSON.stringify(debugInfo, null, 2));

  // Wait for cells to be executed and their output to be visible
  // This is especially important in WASM mode where Pyodide needs time to execute cells
  // Use polling to wait for cells to execute
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        if (!hasText1 || !hasText2) {
          // Log current state for debugging
          const currentInfo = await page.evaluate(() => {
            const bodyText = document.body.textContent || "";
            return {
              hasText1: bodyText.includes("text 1"),
              hasText2: bodyText.includes("text 2"),
              bodyTextPreview: bodyText.substring(0, 500),
            };
          });
          console.log("Waiting for cells...", currentInfo);
        }
        return hasText1 && hasText2;
      },
      {
        timeout: 120000, // 2 minutes for WASM mode
        intervals: [2000, 5000, 10000], // Check every 2s, then 5s, then 10s
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  // Now wait for the elements to be visible in the DOM
  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  // Wait a bit for layout to stabilize
  await page.waitForTimeout(2000);

  // Initially should be in vertical layout (default when is3DModeAtom is false)
  // Verify vertical layout is active (grid layout container should not exist)
  await expect(page.locator(".react-grid-layout")).not.toBeVisible({
    timeout: 2000,
  });

  // Press Ctrl+Shift+V (or Cmd+Shift+V on Mac) to switch to grid layout
  console.log("Pressing keyboard shortcut to switch layout...");
  await pressShortcut(page, "global.switchLayout");
  
  // Wait for grid layout to be rendered
  await expect(page.locator(".react-grid-layout")).toBeVisible({
    timeout: 5000,
  });

  // Verify layout switched to grid (grid layout container should exist)
  const gridLayoutExists = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(gridLayoutExists).toBe(true);

  // Press Ctrl+Shift+V again to switch back to vertical
  await pressShortcut(page, "global.switchLayout");
  
  // Wait for vertical layout to be active (grid layout container should not exist)
  await expect
    .poll(
      async () => {
        const hasGridLayout = await page.evaluate(() => {
          const reactGridLayout = document.querySelector(".react-grid-layout");
          return reactGridLayout !== null;
        });
        return !hasGridLayout;
      },
      {
        timeout: 5000,
        intervals: [200, 500, 1000],
        message: "Layout did not change back to vertical within 5s",
      },
    )
    .toBe(true);

  // Verify layout switched back to vertical (grid layout container should not exist)
  const gridLayoutStillExists = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(gridLayoutStillExists).toBe(false);

  await takeScreenshot(page, _filename);
});

test("can cycle through layouts with keyboard shortcut in present mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical to ensure initial layout is vertical
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  // This is especially important in WASM mode where Pyodide needs time to execute cells
  // Use polling to wait for cells to execute
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000, // 2 minutes for WASM mode
        intervals: [1000, 2000, 5000], // Check every 1s, then 2s, then 5s
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  // Now wait for the elements to be visible in the DOM
  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  // Wait a bit for page to stabilize
  await page.waitForTimeout(2000);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000); // Wait for mode transition

  // Verify we're in present mode (code should be hidden)
  await expect(page.getByText("# Grid Layout")).not.toBeVisible({
    timeout: 5000,
  });

  // Wait for layout-select to appear in present mode
  // This may take time if wasm_layouts flag needs to be applied
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000, // Increased timeout for WASM mode
  });

  // Get current layout value (may not be vertical if layout was already set)
  let layoutValue = await getLayoutSelectValue(page);
  console.log(`Current layout value: ${layoutValue}`);
  
  // If not vertical, switch to vertical first
  if (layoutValue !== "vertical") {
    // Press shortcut until we get to vertical
    while (layoutValue !== "vertical") {
      await pressShortcut(page, "global.switchLayout");
      await page.waitForTimeout(500);
      layoutValue = await getLayoutSelectValue(page);
      console.log(`Layout after switch: ${layoutValue}`);
      // Safety check to avoid infinite loop
      if (layoutValue === "vertical") {
        break;
      }
    }
  }
  
  // Verify we're now in vertical layout
  layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("vertical");

  // Press Ctrl+Shift+V (or Cmd+Shift+V on Mac) to switch to grid
  await pressShortcut(page, "global.switchLayout");
  await waitForLayoutChange(page, "grid", 5000);

  layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("grid");

  // Press Ctrl+Shift+V to switch to slides
  await pressShortcut(page, "global.switchLayout");
  await waitForLayoutChange(page, "slides", 5000);

  layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("slides");

  // Press Ctrl+Shift+V to cycle back to vertical
  await pressShortcut(page, "global.switchLayout");
  await waitForLayoutChange(page, "vertical", 5000);

  layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("vertical");

  await takeScreenshot(page, _filename);
});

test("can switch layout from vertical to grid in edit mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical to ensure initial layout is vertical
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [2000, 5000, 10000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Verify initial state is vertical layout
  const initialHasGridLayout = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(initialHasGridLayout).toBe(false);

  // Press keyboard shortcut to switch to grid layout
  await pressShortcut(page, "global.switchLayout");
  
  // Wait for grid layout to be rendered
  await expect(page.locator(".react-grid-layout")).toBeVisible({
    timeout: 5000,
  });

  // Verify layout switched to grid
  const gridLayoutExists = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(gridLayoutExists).toBe(true);

  await takeScreenshot(page, _filename);
});

test("can switch layout from grid to vertical in edit mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical first (to ensure known state)
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [2000, 5000, 10000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Switch to grid layout using keyboard shortcut
  await pressShortcut(page, "global.switchLayout");
  
  // Wait for grid layout to be rendered
  await expect(page.locator(".react-grid-layout")).toBeVisible({
    timeout: 5000,
  });

  // Verify initial state is grid layout
  const initialHasGridLayout = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(initialHasGridLayout).toBe(true);

  // Press keyboard shortcut to switch to vertical layout
  await pressShortcut(page, "global.switchLayout");
  
  // Wait for vertical layout to be active
  await expect
    .poll(
      async () => {
        const hasGridLayout = await page.evaluate(() => {
          const reactGridLayout = document.querySelector(".react-grid-layout");
          return reactGridLayout !== null;
        });
        return !hasGridLayout;
      },
      {
        timeout: 5000,
        intervals: [200, 500, 1000],
        message: "Layout did not change to vertical within 5s",
      },
    )
    .toBe(true);

  // Verify layout switched to vertical
  const gridLayoutStillExists = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(gridLayoutStillExists).toBe(false);

  await takeScreenshot(page, _filename);
});

test("can switch layout from vertical to grid in present mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical to ensure initial layout is vertical
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Wait for layout-select to appear in present mode
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Verify initial layout is vertical
  let layoutValue = await getLayoutSelectValue(page);
  if (layoutValue !== "vertical") {
    // Switch to vertical if not already
    await setLayoutToVertical(page);
    layoutValue = await getLayoutSelectValue(page);
  }
  expect(layoutValue).toBe("vertical");

  // Press keyboard shortcut to switch to grid
  await pressShortcut(page, "global.switchLayout");
  await waitForLayoutChange(page, "grid", 5000);

  // Verify layout switched to grid
  layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("grid");

  await takeScreenshot(page, _filename);
});

test("can switch layout from grid to slides in present mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical first, then switch to present mode
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Wait for layout-select to appear in present mode
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Set layout to grid (using setLayoutToGrid in present mode)
  await setLayoutToGrid(page);
  let layoutValue = await getLayoutSelectValue(page);
  if (layoutValue !== "grid") {
    // If not grid, press shortcut to get to grid
    while (layoutValue !== "grid") {
      await pressShortcut(page, "global.switchLayout");
      await page.waitForTimeout(500);
      layoutValue = await getLayoutSelectValue(page);
      if (layoutValue === "grid") {
        break;
      }
    }
  }
  expect(layoutValue).toBe("grid");

  // Press keyboard shortcut to switch to slides
  await pressShortcut(page, "global.switchLayout");
  await waitForLayoutChange(page, "slides", 5000);

  // Verify layout switched to slides
  layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("slides");

  await takeScreenshot(page, _filename);
});

test("can switch layout from slides to vertical in present mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical first, then switch to present mode
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Wait for layout-select to appear in present mode
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Set layout to slides
  await setLayoutToSlides(page);
  let layoutValue = await getLayoutSelectValue(page);
  if (layoutValue !== "slides") {
    // If not slides, press shortcut to get to slides
    while (layoutValue !== "slides") {
      await pressShortcut(page, "global.switchLayout");
      await page.waitForTimeout(500);
      layoutValue = await getLayoutSelectValue(page);
      if (layoutValue === "slides") {
        break;
      }
    }
  }
  expect(layoutValue).toBe("slides");

  // Press keyboard shortcut to switch to vertical
  await pressShortcut(page, "global.switchLayout");
  await waitForLayoutChange(page, "vertical", 5000);

  // Verify layout switched to vertical
  layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("vertical");

  await takeScreenshot(page, _filename);
});

test("can switch from edit mode (vertical) to present mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical to ensure initial layout is vertical
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [2000, 5000, 10000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Verify we're in edit mode (layout-select should not be visible)
  // In grid layout, code cells might not be visible in the same way
  await expect(page.getByTestId("layout-select")).not.toBeVisible({
    timeout: 2000,
  });

  // Verify initial layout is vertical (no grid layout container)
  const initialHasGridLayout = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(initialHasGridLayout).toBe(false);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Verify we're in present mode (code should be hidden, layout-select should be visible)
  await expect(page.getByText("# Grid Layout")).not.toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Verify layout is still vertical in present mode
  const layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("vertical");

  await takeScreenshot(page, _filename);
});

test("can switch from edit mode (grid) to present mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical first, then switch to grid
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [2000, 5000, 10000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Switch to grid layout using keyboard shortcut
  await pressShortcut(page, "global.switchLayout");
  await expect(page.locator(".react-grid-layout")).toBeVisible({
    timeout: 5000,
  });

  // Verify we're in edit mode (layout-select should not be visible)
  // In grid layout, code cells might not be visible in the same way
  await expect(page.getByTestId("layout-select")).not.toBeVisible({
    timeout: 2000,
  });

  // Verify initial layout is grid
  const initialHasGridLayout = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(initialHasGridLayout).toBe(true);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Verify we're in present mode (code should be hidden, layout-select should be visible)
  await expect(page.getByText("# Grid Layout")).not.toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Verify layout is still grid in present mode
  const layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("grid");

  await takeScreenshot(page, _filename);
});

test("can switch from present mode (vertical) to edit mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical to ensure initial layout is vertical
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Wait for layout-select to appear in present mode
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Verify we're in present mode (code should be hidden, layout-select should be visible)
  await expect(page.getByText("# Grid Layout")).not.toBeVisible({
    timeout: 5000,
  });

  // Verify layout is vertical in present mode
  let layoutValue = await getLayoutSelectValue(page);
  if (layoutValue !== "vertical") {
    await setLayoutToVertical(page);
    layoutValue = await getLayoutSelectValue(page);
  }
  expect(layoutValue).toBe("vertical");

  // Toggle back to edit mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Verify we're in edit mode (layout-select should not be visible)
  // In grid layout, code cells might not be visible in the same way
  await expect(page.getByTestId("layout-select")).not.toBeVisible({
    timeout: 2000,
  });

  // Verify layout is still vertical in edit mode (no grid layout container)
  const hasGridLayout = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(hasGridLayout).toBe(false);

  await takeScreenshot(page, _filename);
});

test("can switch from present mode (grid) to edit mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical first, then switch to present mode
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Wait for layout-select to appear in present mode
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Switch to grid layout in present mode
  await pressShortcut(page, "global.switchLayout");
  await waitForLayoutChange(page, "grid", 5000);

  // Verify we're in present mode (code should be hidden, layout-select should be visible)
  await expect(page.getByText("# Grid Layout")).not.toBeVisible({
    timeout: 5000,
  });

  // Verify layout is grid in present mode
  const layoutValue = await getLayoutSelectValue(page);
  expect(layoutValue).toBe("grid");

  // Toggle back to edit mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Verify we're in edit mode (layout-select should not be visible)
  // In grid layout, code cells might not be visible in the same way
  await expect(page.getByTestId("layout-select")).not.toBeVisible({
    timeout: 2000,
  });

  // Verify layout is still grid in edit mode
  await expect(page.locator(".react-grid-layout")).toBeVisible({
    timeout: 5000,
  });
  const hasGridLayout = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(hasGridLayout).toBe(true);

  await takeScreenshot(page, _filename);
});

test("can switch from present mode (slides) to edit mode", async ({
  page,
}) => {
  console.log("Navigating to:", editUrl);
  await safeGoto(page, editUrl, 90000);

  // Wait for marimo app to be fully loaded with longer timeout for WASM
  await waitForMarimoApp(page, 90000);

  // Enable wasm_layouts flag for WASM mode
  await enableWasmLayoutsFlag(page);
  
  // Set layout to vertical first, then switch to present mode
  await setLayoutToVertical(page);

  // Wait for cells to be executed and their output to be visible
  await expect
    .poll(
      async () => {
        const bodyText = await page.textContent("body");
        const hasText1 = bodyText?.includes("text 1") || false;
        const hasText2 = bodyText?.includes("text 2") || false;
        return hasText1 && hasText2;
      },
      {
        timeout: 120000,
        intervals: [1000, 2000, 5000],
        message: "Cells did not execute within 120s",
      },
    )
    .toBe(true);

  await expect(page.getByText("text 1").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("text 2").first()).toBeVisible({
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  // Toggle to present mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Wait for layout-select to appear in present mode
  await expect(page.getByTestId("layout-select")).toBeVisible({
    timeout: 30000,
  });

  // Switch to slides layout in present mode
  await setLayoutToSlides(page);
  let layoutValue = await getLayoutSelectValue(page);
  if (layoutValue !== "slides") {
    // If not slides, press shortcut to get to slides
    while (layoutValue !== "slides") {
      await pressShortcut(page, "global.switchLayout");
      await page.waitForTimeout(500);
      layoutValue = await getLayoutSelectValue(page);
      if (layoutValue === "slides") {
        break;
      }
    }
  }
  expect(layoutValue).toBe("slides");

  // Verify we're in present mode (code should be hidden, layout-select should be visible)
  await expect(page.getByText("# Grid Layout")).not.toBeVisible({
    timeout: 5000,
  });

  // Toggle back to edit mode using keyboard shortcut
  await pressShortcut(page, "global.hideCode");
  await page.waitForTimeout(2000);

  // Verify we're in edit mode (layout-select should not be visible)
  // In grid layout, code cells might not be visible in the same way
  await expect(page.getByTestId("layout-select")).not.toBeVisible({
    timeout: 2000,
  });

  // In edit mode, slides layout is not available, so it should fall back to vertical
  // Verify layout is vertical in edit mode (no grid layout container)
  const hasGridLayout = await page.evaluate(() => {
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return reactGridLayout !== null;
  });
  expect(hasGridLayout).toBe(false);

  await takeScreenshot(page, _filename);
});
