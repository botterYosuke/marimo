#!/usr/bin/env node
/**
 * Wrapper script for `pnpm tauri:dev` with automatic cleanup on exit.
 *
 * This script:
 * 1. Cleans up port 2718 before starting
 * 2. Runs the dev servers + Tauri app via concurrently
 * 3. Cleans up port 2718 when exiting (Ctrl+C or normal exit)
 *
 * Usage:
 *   node scripts/tauri-dev-with-cleanup.mjs
 */

import { spawn } from "node:child_process";
import { execSync } from "node:child_process";

const PORT = 2718;
let isCleaningUp = false;
let childProcess = null;

/**
 * Run cleanup script to kill processes on port 2718
 */
function cleanup() {
  if (isCleaningUp) {
    return; // Prevent multiple cleanup attempts
  }

  isCleaningUp = true;
  console.log('\n🧹 Cleaning up port 2718 processes...');

  try {
    execSync('node scripts/clean-processes.mjs', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    // Ignore cleanup errors - don't want to block exit
    console.log('⚠️  Cleanup completed with warnings');
  }
}

/**
 * Handle graceful shutdown
 */
function handleExit(signal) {
  console.log(`\n📡 Received ${signal}, shutting down...`);

  // Kill child process first
  if (childProcess && !childProcess.killed) {
    console.log('⏹️  Stopping dev servers and Tauri app...');

    // On Windows, use taskkill to kill the process tree
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${childProcess.pid} /T /F`, {
          stdio: 'ignore'
        });
      } catch (e) {
        // Process may have already exited
      }
    } else {
      // On Unix, send SIGTERM
      try {
        process.kill(-childProcess.pid, 'SIGTERM');
      } catch (e) {
        // Process may have already exited
      }
    }
  }

  // Run cleanup
  cleanup();

  // Exit
  process.exit(0);
}

// Register signal handlers for graceful shutdown
process.on('SIGINT', () => handleExit('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => handleExit('SIGTERM')); // Termination signal

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  cleanup();
  process.exit(1);
});

// Main execution
async function main() {
  console.log('🚀 Starting marimo Tauri dev environment...\n');

  // Initial cleanup
  console.log('🧹 Pre-flight cleanup...');
  try {
    execSync('node scripts/clean-processes.mjs', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.log('⚠️  Pre-flight cleanup completed with warnings\n');
  }

  console.log('');

  // Start concurrently with dev servers + Tauri
  // Note: Using command string instead of args array to avoid shell escaping issues on Windows
  const command = 'concurrently --kill-others --names backend,frontend,tauri --prefix-colors blue,green,magenta "pnpm run dev:backend" "pnpm run dev:frontend" "cargo tauri dev"';

  childProcess = spawn(command, [], {
    stdio: 'inherit',
    shell: true,
    // On Unix, create a new process group so we can kill all children
    ...(process.platform !== 'win32' ? { detached: false } : {})
  });

  // Handle child process exit
  childProcess.on('exit', (code, signal) => {
    if (signal) {
      console.log(`\n⚠️  Dev environment terminated by signal: ${signal}`);
    } else if (code !== 0) {
      console.log(`\n❌ Dev environment exited with code: ${code}`);
    } else {
      console.log('\n✅ Dev environment stopped');
    }

    // Cleanup and exit
    cleanup();
    process.exit(code || 0);
  });

  childProcess.on('error', (error) => {
    console.error('❌ Failed to start dev environment:', error);
    cleanup();
    process.exit(1);
  });
}

// Run main function
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  cleanup();
  process.exit(1);
});
