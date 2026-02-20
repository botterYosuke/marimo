/* Copyright 2026 Marimo. All rights reserved. */
/** biome-ignore-all lint/suspicious/noConsole: for debugging */

import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function globalTeardown() {
  console.log("🧹 Cleaning up test environment...");

  try {
    // Kill any remaining marimo processes
    try {
      await execAsync("pkill -f 'marimo.*--headless' || true");
      console.log("✅ Cleaned up marimo processes");
    } catch {
      // Ignore errors - processes might not exist
      console.log("⚠️  No marimo processes to clean up");
    }

    // Restore game_test.py to committed state to prevent test contamination.
    // z-python-e2e tests add Python cells to game_test.py via emitSkillViaPython().
    // These cells accumulate across runs; restoring prevents stale cells from
    // affecting the next test run（知見 40）.
    try {
      const projectRoot = path.resolve(import.meta.dirname, "../..");
      await execAsync("git restore frontend/e2e-tests/py/game_test.py", {
        cwd: projectRoot,
      });
      console.log("✅ Restored game_test.py to committed state");
    } catch {
      console.log("⚠️  Could not restore game_test.py (non-fatal)");
    }

    // Small delay to ensure cleanup completes
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("🎉 Cleanup complete!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    // Don't throw - we don't want cleanup failures to fail the test run
  }
}

export default globalTeardown;
