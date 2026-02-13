/* Copyright 2026 Marimo. All rights reserved. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getUserDataDir, normalizePathForComparison } from "./paths.js";
import { logInfo, logError } from "./logger.js";

const RECENT_FILES_FILENAME = "recent-files.json";
const MAX_RECENT_FILES = 10;

/**
 * Get the path to the recent files JSON file
 * @returns {string}
 */
function getRecentFilesPath() {
  return path.join(getUserDataDir(), RECENT_FILES_FILENAME);
}

/**
 * Save the recent files list to disk
 * @param {string[]} recentFiles
 */
function saveRecentFiles(recentFiles) {
  const filePath = getRecentFilesPath();

  try {
    const data = {
      version: 1,
      recentFiles,
      lastUpdated: new Date().toISOString(),
    };
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    logInfo(`Recent files saved (${recentFiles.length} entries)`);
  } catch (error) {
    logError("Failed to save recent files", error);
  }
}

/**
 * Read the recent files list from disk
 * @returns {string[]} Array of absolute file paths, most recent first
 */
export function getRecentFiles() {
  const filePath = getRecentFilesPath();

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    // Validate structure
    if (!Array.isArray(data.recentFiles)) {
      logError("Invalid recent files format, returning empty array");
      return [];
    }

    // Filter out non-existent files
    return data.recentFiles.filter((f) => existsSync(f));
  } catch (error) {
    logError("Failed to read recent files", error);
    return [];
  }
}

/**
 * Add a file to the recent files list
 * - Removes duplicates (moves to front if already exists)
 * - Limits to MAX_RECENT_FILES entries
 * @param {string} filePath - Absolute path to the notebook file
 */
export function addRecentFile(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return;
  }

  logInfo(`Adding to recent files: ${filePath}`);

  const recentFiles = getRecentFiles();

  // Remove if already exists (to move to front)
  const normalized = normalizePathForComparison(filePath);
  const filtered = recentFiles.filter(
    (f) => normalizePathForComparison(f) !== normalized
  );

  // Add to front (use original path, not normalized)
  filtered.unshift(path.normalize(filePath));

  // Limit to max entries
  const limited = filtered.slice(0, MAX_RECENT_FILES);

  // Save
  saveRecentFiles(limited);
}

/**
 * Get the most recently opened file
 * @returns {string | null} Path to the most recent file, or null if none
 */
export function getMostRecentFile() {
  const recentFiles = getRecentFiles();
  return recentFiles.length > 0 ? recentFiles[0] : null;
}
