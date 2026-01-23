/* Copyright 2026 Marimo. All rights reserved. */
import type { PyodideInterface } from "pyodide";
import { getFS } from "./getFS";
import { Logger } from "../../../utils/Logger";
import { WasmFileSystem } from "./fs";

// BackcastPro data configuration
// Use the same directory as marimo home dir so files appear in FILES panel
// and are persisted to IndexedDB
const BACKCASTPRO_CACHE_DIR = WasmFileSystem.HOME_DIR;
const DATA_BASE_URL = "./data"; // Relative to the deployed site

// Stock codes to load (must match deploy-pages.yml)
const STOCK_CODES = [
  "7203",
  "9984",
  "6758",
  "8306",
  "9432",
  "6861",
  "7267",
  "4502",
  "6501",
  "8035",
];

interface DataFile {
  remotePath: string;
  localPath: string;
}

function getDataFilesToLoad(): DataFile[] {
  const files: DataFile[] = [];

  // listed_info.duckdb
  files.push({
    remotePath: `${DATA_BASE_URL}/listed_info.duckdb`,
    localPath: `${BACKCASTPRO_CACHE_DIR}/listed_info.duckdb`,
  });

  // Per-stock data files
  for (const code of STOCK_CODES) {
    files.push({
      remotePath: `${DATA_BASE_URL}/stocks_daily/${code}.duckdb`,
      localPath: `${BACKCASTPRO_CACHE_DIR}/stocks_daily/${code}.duckdb`,
    });
    files.push({
      remotePath: `${DATA_BASE_URL}/stocks_board/${code}.duckdb`,
      localPath: `${BACKCASTPRO_CACHE_DIR}/stocks_board/${code}.duckdb`,
    });
  }

  return files;
}

async function fetchFile(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      Logger.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    Logger.warn(`Error fetching ${url}:`, error);
    return null;
  }
}

function ensureDirectoryExists(pyodide: PyodideInterface, path: string): void {
  const FS = getFS(pyodide);
  const parts = path.split("/").filter((p) => p.length > 0);
  let currentPath = "";

  for (const part of parts) {
    currentPath += "/" + part;
    try {
      FS.mkdir(currentPath);
    } catch {
      // Directory may already exist, ignore error
    }
  }
}

function getDirectoryPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf("/");
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : "/";
}

export async function setupBackcastProData(
  pyodide: PyodideInterface,
): Promise<void> {
  const FS = getFS(pyodide);

  Logger.log("[BackcastPro] Setting up data files...");

  // Create cache directory structure
  ensureDirectoryExists(pyodide, BACKCASTPRO_CACHE_DIR);
  ensureDirectoryExists(pyodide, `${BACKCASTPRO_CACHE_DIR}/stocks_daily`);
  ensureDirectoryExists(pyodide, `${BACKCASTPRO_CACHE_DIR}/stocks_board`);

  // Set environment variable for BackcastPro
  pyodide.runPython(`
import os
os.environ['BACKCASTPRO_CACHE_DIR'] = '${BACKCASTPRO_CACHE_DIR}'
print(f"[BackcastPro] BACKCASTPRO_CACHE_DIR set to: {os.environ['BACKCASTPRO_CACHE_DIR']}")
  `);

  // Fetch and write data files
  const files = getDataFilesToLoad();
  let successCount = 0;
  let failCount = 0;

  // Fetch files in parallel for better performance
  const fetchPromises = files.map(async (file) => {
    const data = await fetchFile(file.remotePath);
    if (data) {
      try {
        // Ensure parent directory exists
        ensureDirectoryExists(pyodide, getDirectoryPath(file.localPath));
        FS.writeFile(file.localPath, data);
        successCount++;
        return true;
      } catch (error) {
        Logger.warn(`Failed to write ${file.localPath}:`, error);
        failCount++;
        return false;
      }
    } else {
      failCount++;
      return false;
    }
  });

  await Promise.all(fetchPromises);

  Logger.log(
    `[BackcastPro] Data setup complete: ${successCount} files loaded, ${failCount} failed`,
  );

  // Verify the setup by listing files
  if (successCount > 0) {
    pyodide.runPython(`
import os
cache_dir = os.environ.get('BACKCASTPRO_CACHE_DIR', '/tmp/backcastpro_data')
print(f"[BackcastPro] Files in cache directory:")
for root, dirs, files in os.walk(cache_dir):
    for f in files:
        filepath = os.path.join(root, f)
        size = os.path.getsize(filepath)
        print(f"  {filepath} ({size} bytes)")
    `);
  }
}

export { BACKCASTPRO_CACHE_DIR };
