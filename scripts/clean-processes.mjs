#!/usr/bin/env node
/**
 * Cross-platform script to kill processes using port 2718.
 * Ensures clean state before starting marimo dev servers.
 *
 * Usage:
 *   node scripts/clean-processes.mjs
 *
 * This script is automatically run before `pnpm dev` and `pnpm tauri:dev`
 * to prevent port conflicts from stale processes left by previous runs.
 */

import { execSync } from "node:child_process";
import { platform } from "node:process";

const PORT = 2718;

try {
  if (platform === "win32") {
    // Windows: Use netstat to find processes listening on port 2718
    try {
      const netstatOutput = execSync(
        `netstat -ano | findstr ":${PORT}.*LISTENING"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      );

      // Parse PIDs from netstat output (rightmost column)
      const lines = netstatOutput.trim().split("\n");
      const pids = new Set();

      for (const line of lines) {
        // netstat output format: "  TCP    0.0.0.0:2718    0.0.0.0:0    LISTENING    12345"
        const match = line.trim().match(/\s+(\d+)\s*$/);
        if (match) {
          pids.add(match[1]);
        }
      }

      if (pids.size > 0) {
        console.log(`✓ Found ${pids.size} process(es) on port ${PORT}, cleaning up...`);

        for (const pid of pids) {
          try {
            // Kill with /f (force) and /t (kill process tree)
            execSync(`taskkill /pid ${pid} /f /t`, {
              stdio: "ignore",
            });
            console.log(`  Killed PID ${pid}`);
          } catch (killError) {
            // Process may have already exited, ignore
            console.log(`  PID ${pid} already terminated`);
          }
        }

        console.log(`✓ Port ${PORT} cleaned successfully`);
      } else {
        console.log(`✓ Port ${PORT} is clean`);
      }
    } catch (netstatError) {
      // No processes found - netstat/findstr returns non-zero when no matches
      console.log(`✓ Port ${PORT} is clean`);
    }
  } else {
    // macOS/Linux: Use lsof to find processes on port 2718
    try {
      const lsofOutput = execSync(`lsof -ti:${PORT}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });

      const pids = lsofOutput
        .trim()
        .split("\n")
        .filter((pid) => pid.length > 0);

      if (pids.length > 0) {
        console.log(`✓ Found ${pids.length} process(es) on port ${PORT}, cleaning up...`);

        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: "ignore" });
            console.log(`  Killed PID ${pid}`);
          } catch (killError) {
            // Process may have already exited, ignore
            console.log(`  PID ${pid} already terminated`);
          }
        }

        console.log(`✓ Port ${PORT} cleaned successfully`);
      } else {
        console.log(`✓ Port ${PORT} is clean`);
      }
    } catch (lsofError) {
      // No processes found - lsof returns non-zero when no matches
      console.log(`✓ Port ${PORT} is clean`);
    }
  }
} catch (error) {
  // Silent failure - don't block dev startup if cleanup fails
  console.warn(`Warning: Failed to clean port ${PORT}:`, error.message);
  process.exit(0); // Exit with success anyway
}
