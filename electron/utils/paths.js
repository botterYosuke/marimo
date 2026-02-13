/* Copyright 2026 Marimo. All rights reserved. */

import { app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the application root directory
 */
export function getAppRoot() {
  if (app.isPackaged) {
    // In production, app.getAppPath() returns the asar path (resources/app.asar)
    return path.join(app.getAppPath(), "..");
  }
  // In development, return the project root
  return path.join(__dirname, "../..");
}

/**
 * Get the user data directory
 */
export function getUserDataDir() {
  return app.getPath("userData");
}

/**
 * Get the PyInstaller executable path for the marimo server
 * This is the standalone executable created by PyInstaller
 */
export function getMarimoServerExecutable() {
  const appRoot = getAppRoot();
  if (process.platform === "win32") {
    return path.join(appRoot, "marimo-server.exe");
  }
  return path.join(appRoot, "marimo-server");
}

/**
 * Normalize file path for comparison (handles Windows case-insensitivity and slashes)
 * @param {string} filePath - The file path to normalize
 * @returns {string} Normalized path
 */
export function normalizePathForComparison(filePath) {
  const normalized = path.normalize(filePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
