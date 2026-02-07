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
import { cpSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env, platform } from "node:process";

// Determine app data path based on platform
const appData = platform === "win32"
  ? env.APPDATA
  : join(env.HOME, ".config");

// Paths
const notebookDir = join(appData, "marimo", "notebooks");
const templateDir = join("frontend", "public", "files");
const projectDir = process.cwd();

// Setup: copy all template files (skip files that already exist)
console.log(`Syncing templates to ${notebookDir}`);
mkdirSync(notebookDir, { recursive: true });
cpSync(templateDir, notebookDir, { recursive: true, force: false });

// Get the most recent file from recent-files.json
const DEFAULT_NOTEBOOK = "wasm-intro.py";
const recentFilesPath = join(appData, "marimo", "recent-files.json");

function getMostRecentFile() {
  if (!existsSync(recentFilesPath)) {
    return null;
  }
  try {
    const content = readFileSync(recentFilesPath, "utf-8");
    const data = JSON.parse(content);
    if (!Array.isArray(data.recentFiles) || data.recentFiles.length === 0) {
      return null;
    }
    // Return the first file that exists
    for (const filePath of data.recentFiles) {
      if (existsSync(filePath)) {
        return filePath;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to read recent files:", error.message);
    return null;
  }
}

const mostRecent = getMostRecentFile();
const notebookFile = mostRecent || join(notebookDir, DEFAULT_NOTEBOOK);
console.log(`Opening notebook: ${notebookFile}`);

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
  notebookFile
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
