#!/usr/bin/env node
/**
 * Cross-platform script to kill any running marimo processes.
 * Used before starting dev server to ensure clean state.
 */

import { execSync } from "node:child_process";
import { platform } from "node:process";

try {
  if (platform === "win32") {
    // Windows: use taskkill to force kill marimo processes and their children
    execSync("taskkill /F /IM marimo.exe /T 2>nul", { stdio: "ignore" });
  } else {
    // macOS/Linux: use pkill
    execSync("pkill -f marimo 2>/dev/null || true", { stdio: "ignore" });
  }
} catch {
  // Ignore errors - process may not exist
}
