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

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function expectValidBoundingBox(
  bb: BoundingBox | null,
): asserts bb is BoundingBox {
  expect(bb).toBeDefined();
  if (!bb) {
    throw new Error("bb is null");
  }
  expect(bb.x).toBeGreaterThan(0);
  expect(bb.y).toBeGreaterThan(0);
  expect(bb.width).toBeGreaterThan(0);
  expect(bb.height).toBeGreaterThan(0);
}

async function bbForText(page: Page, text: string) {
  const el = page.getByText(text).first();
  await expect(el).toBeVisible();
  const bb = await el.boundingBox();
  expectValidBoundingBox(bb);
  return bb;
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
 */
async function setLayoutToVertical(page: Page): Promise<void> {
  const layoutSet = await page.evaluate(() => {
    // setLayoutView is exposed via repl() as window.__marimo__setLayoutView
    const setLayoutView = (window as unknown as Record<string, unknown>)
      .__marimo__setLayoutView;
    if (typeof setLayoutView === "function") {
      try {
        (setLayoutView as (layout: string) => void)("vertical");
        return true;
      } catch (error) {
        console.warn("Failed to set layout to vertical:", error);
        return false;
      }
    } else {
      console.warn("setLayoutView is not available on window.__marimo__setLayoutView");
      return false;
    }
  });
  
  if (!layoutSet) {
    console.warn("Could not set layout to vertical, continuing anyway...");
    return;
  }
  
  // Wait a bit for the layout to update
  await page.waitForTimeout(1000);
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
  // Verify text 1 is above text 2 (vertical layout)
  let bb1 = await bbForText(page, "text 1");
  let bb2 = await bbForText(page, "text 2");
  expect(bb1.y).toBeLessThan(bb2.y);
  expect(Math.abs(bb1.x - bb2.x)).toBeLessThan(10);

  // Debug: Check if wasm_layouts flag is enabled and layout state
  const flagCheck = await page.evaluate(() => {
    // Try to access the feature flag through the config
    // We can't directly call getFeatureFlag, but we can check if layouts are working
    const layoutSelect = document.querySelector("[data-testid='layout-select']");
    // Check for grid layout indicators in the DOM
    const gridContainer = document.querySelector("[data-testid='grid-layout-container'], .grid-layout-container, [class*='grid-layout']");
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return {
      hasLayoutSelect: layoutSelect !== null,
      layoutSelectVisible: layoutSelect !== null && (layoutSelect as HTMLElement).offsetParent !== null,
      hasGridContainer: gridContainer !== null,
      hasReactGridLayout: reactGridLayout !== null,
    };
  });
  console.log("Flag check:", flagCheck);
  
  // Press Ctrl+Shift+V (or Cmd+Shift+V on Mac) to switch to grid layout
  console.log("Pressing keyboard shortcut to switch layout...");
  await pressShortcut(page, "global.switchLayout");
  
  // Wait a bit for the keyboard event to be processed
  await page.waitForTimeout(1000);
  
  // Debug: Check layout state after shortcut
  const layoutState = await page.evaluate(() => {
    // Check if there's any indication of layout change
    const cells = document.querySelectorAll(".marimo-cell, [data-testid='cell-editor']");
    const gridContainer = document.querySelector("[data-testid='grid-layout-container'], .grid-layout-container, [class*='grid-layout']");
    const reactGridLayout = document.querySelector(".react-grid-layout");
    return {
      cellCount: cells.length,
      hasGridContainer: gridContainer !== null,
      hasReactGridLayout: reactGridLayout !== null,
      bodyText: document.body.textContent?.substring(0, 200) || "",
    };
  });
  console.log("Layout state after shortcut:", layoutState);
  
  // Wait for layout transition with polling to ensure layout has changed
  await expect
    .poll(
      async () => {
        const currentBb1 = await bbForText(page, "text 1");
        const currentBb2 = await bbForText(page, "text 2");
        const yDiff = Math.abs(currentBb1.y - currentBb2.y);
        // Log for debugging
        if (yDiff >= 10) {
          console.log(`Layout not changed yet: yDiff=${yDiff}, bb1.y=${currentBb1.y}, bb2.y=${currentBb2.y}`);
        }
        return yDiff;
      },
      {
        timeout: 15000, // Increased timeout
        intervals: [200, 500, 1000],
        message: "Layout did not change to grid within 15s",
      },
    )
    .toBeLessThan(10); // Same row (within 10px)

  // Verify layout switched to grid (text 1 and text 2 should be on same row)
  bb1 = await bbForText(page, "text 1");
  bb2 = await bbForText(page, "text 2");
  // Allow some tolerance for positioning
  expect(Math.abs(bb1.y - bb2.y)).toBeLessThan(10); // Same row (within 10px)
  expect(bb1.x).toBeGreaterThan(bb2.x); // text 1 is to the right of text 2

  // Press Ctrl+Shift+V again to switch back to vertical
  await pressShortcut(page, "global.switchLayout");
  
  // Wait a bit for the keyboard event to be processed
  await page.waitForTimeout(500);
  
  // Wait for layout transition with polling to ensure layout has changed back to vertical
  await expect
    .poll(
      async () => {
        const currentBb1 = await bbForText(page, "text 1");
        const currentBb2 = await bbForText(page, "text 2");
        const isVertical = currentBb1.y < currentBb2.y && Math.abs(currentBb1.x - currentBb2.x) < 10;
        // Log for debugging
        if (!isVertical) {
          console.log(`Layout not changed back yet: bb1.y=${currentBb1.y}, bb2.y=${currentBb2.y}, bb1.x=${currentBb1.x}, bb2.x=${currentBb2.x}`);
        }
        return isVertical;
      },
      {
        timeout: 15000, // Increased timeout
        intervals: [200, 500, 1000],
        message: "Layout did not change back to vertical within 15s",
      },
    )
    .toBe(true);

  // Verify layout switched back to vertical
  bb1 = await bbForText(page, "text 1");
  bb2 = await bbForText(page, "text 2");
  expect(bb1.y).toBeLessThan(bb2.y); // text 1 is above text 2
  expect(Math.abs(bb1.x - bb2.x)).toBeLessThan(10); // Same column (within 10px)

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
