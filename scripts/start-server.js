#!/usr/bin/env node
/**
 * Development server startup script for marimo Electron app.
 *
 * This script:
 * 1. Copies the template notebook to the user's app data folder if needed
 * 2. Starts the marimo server with the correct working directory
 *
 * The --directory option is required because marimo's file browser root
 * is determined by os.getcwd(), and we want it to show the notebooks folder.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { env, platform } from "node:process";

// Determine app data path based on platform
const appData = platform === "win32"
  ? env.APPDATA
  : join(env.HOME, ".config");

// Paths
const notebookDir = join(appData, "marimo", "notebooks");
const templateSrc = join("frontend", "public", "files", "backcast.py");
const notebookDest = join(notebookDir, "backcast.py");
const projectDir = process.cwd();

// Setup: create directory and copy template if needed
if (!existsSync(notebookDest)) {
  console.log(`Setting up notebook directory: ${notebookDir}`);
  mkdirSync(notebookDir, { recursive: true });
  copyFileSync(templateSrc, notebookDest);
  console.log(`Copied template to ${notebookDest}`);
}

// Determine uv executable path
const uv = platform === "win32"
  ? join(env.USERPROFILE, ".local", "bin", "uv.exe")
  : "uv";

// Build command arguments
const args = [
  "run",
  "--directory", notebookDir,
  "--project", projectDir,
  "marimo", "edit",
  "--no-token",
  "--headless",
  "--port", "2718",
  "backcast.py"
];

console.log(`Starting marimo server...`);
console.log(`  Notebook dir: ${notebookDir}`);
console.log(`  Project dir: ${projectDir}`);

// Start the server
const server = spawn(uv, args, {
  stdio: "inherit",
  env: {
    ...env,
    BACKCASTPRO_CACHE_DIR: notebookDir
  }
});

server.on("error", (err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
