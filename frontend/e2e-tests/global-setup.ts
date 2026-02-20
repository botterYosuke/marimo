/* Copyright 2026 Marimo. All rights reserved. */
/** biome-ignore-all lint/suspicious/noConsole: for debugging */

import { chromium, type FullConfig } from "@playwright/test";
import { copyFile, access, unlink } from "node:fs/promises";
import { type ApplicationNames, getAppUrl } from "../playwright.config";

const BACKCAST_PATH =
  "C:\\Users\\sasac\\AppData\\Roaming\\marimo\\notebooks\\backcast.py";
const BACKCAST_BACKUP_PATH = BACKCAST_PATH + ".test-backup";

async function globalSetup(_config: FullConfig) {
  // Start a browser to test server connectivity
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test some apps to ensure they're ready
  const criticalApps: ApplicationNames[] = ["components.py"];

  console.log("🔧 Testing server connectivity...");

  for (const app of criticalApps) {
    try {
      const url = getAppUrl(app);
      console.log(`Testing ${app} at ${url}`);

      // Wait for server to be ready with retries
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto(url, {
            waitUntil: "networkidle",
            timeout: 15_000,
          });
          console.log(`✅ ${app} ready`);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            console.error(`❌ ${app} failed to start:`, error);
            throw error;
          }
          console.log(`⏳ Retrying ${app} (${retries} attempts left)`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error(`Failed to connect to ${app}:`, error);
      throw error;
    }
  }

  await browser.close();
  console.log("🎉 All servers ready!");

  // Back up backcast.py before tests start so teardown can restore it.
  // backcast-integration tests add cells to backcast.py via runNewCellInGrid();
  // this backup ensures the file is restored to the pre-test state after each
  // test run, preventing cell accumulation（知見 41）.
  //
  // If a stale backup already exists (from a crashed previous run), restore
  // from it first so we start from a clean state, then delete the stale backup.
  try {
    await access(BACKCAST_BACKUP_PATH);
    // Stale backup found — restore it to backcast.py, then remove the stale copy
    await copyFile(BACKCAST_BACKUP_PATH, BACKCAST_PATH);
    await unlink(BACKCAST_BACKUP_PATH);
    console.log("✅ Restored stale backcast.py backup before creating new one");
  } catch {
    // No stale backup — this is the normal case
  }
  try {
    await access(BACKCAST_PATH);
    await copyFile(BACKCAST_PATH, BACKCAST_BACKUP_PATH);
    console.log(`✅ Backed up backcast.py to ${BACKCAST_BACKUP_PATH}`);
  } catch {
    console.log("⚠️  Could not back up backcast.py (non-fatal)");
  }
}

export default globalSetup;
