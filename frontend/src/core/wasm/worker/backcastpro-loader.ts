/* Copyright 2026 Marimo. All rights reserved. */
import type { PyodideInterface } from "pyodide";
import { getFS } from "./getFS";
import { Logger } from "../../../utils/Logger";
import { WasmFileSystem } from "./fs";
import type { SupportedLocale } from "../../../components/skill-tree/i18n";

// BackcastPro data configuration
// Use the same directory as marimo home dir so files appear in FILES panel
// and are persisted to IndexedDB
const STOCKDATA_CACHE_DIR = WasmFileSystem.HOME_DIR;
// Worker runs from /assets/, so ./data resolves to /assets/data/
const DATA_BASE_URL = "./data";
// Python files are in /files/ (from public/files/) - use absolute path for both dev and prod
const FILES_BASE_URL = "/files";

// Fallback list of Python files (used when manifest.json is not available)
const FALLBACK_PYTHON_FILES = [
  "backcast.py",
  "backtest_wrapper.py",
  "board.py",
  "bridge.py",
  "chart.py",
  "full_mode.py",
  "game_setup.py",
  "headless_broadcast.py",
  "progress_manager.py",
  "pyodide.py",
  "sample_skill_triggers.py",
  "sandbox.py",
  "skill_events.py",
  "wasm-intro.py",
];

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

  // Per-stock data files (stocks_daily only)
  for (const code of STOCK_CODES) {
    files.push({
      remotePath: `${DATA_BASE_URL}/stocks_daily/${code}.duckdb`,
      localPath: `${STOCKDATA_CACHE_DIR}/stocks_daily/${code}.duckdb`,
    });
  }

  return files;
}

/**
 * DuckDBファイルが有効かどうかを検証
 * DuckDBファイルヘッダ構造:
 * - 0-7: チェックサム
 * - 8-11: マジックバイト "DUCK"
 * - 12-19: バージョン番号
 */
function isValidDuckDBFile(data: Uint8Array): boolean {
  if (data.length < 20) {
    return false;
  }
  // オフセット8から4バイトのマジックバイト "DUCK" をチェック
  const magic = new TextDecoder().decode(data.slice(8, 12));
  return magic === "DUCK";
}

async function fetchFile(url: string): Promise<Uint8Array | null> {
  try {
    Logger.log(`[BackcastPro] Fetching ${url}`);
    const response = await fetch(url);

    Logger.log(`[BackcastPro] Response status: ${response.status}`);

    if (!response.ok) {
      Logger.warn(`[BackcastPro] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    // Content-Typeチェック: text/html の場合はViteのSPAフォールバックなので拒否
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      Logger.warn(
        `[BackcastPro] Rejecting ${url}: Content-Type is text/html (likely Vite SPA fallback)`,
      );
      return null;
    }

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    // DuckDBファイルバリデーション
    if (!isValidDuckDBFile(data)) {
      Logger.warn(
        `[BackcastPro] Rejecting ${url}: Not a valid DuckDB file (magic bytes mismatch)`,
      );
      return null;
    }

    Logger.log(`[BackcastPro] Successfully fetched valid DuckDB file: ${url}`);
    return data;
  } catch (error) {
    Logger.warn(`[BackcastPro] Error fetching ${url}:`, error);
    return null;
  }
}

function ensureDirectoryExists(pyodide: PyodideInterface, path: string): void {
  const FS = getFS(pyodide);
  const parts = path.split("/").filter((p) => p.length > 0);
  let currentPath = "";

  for (const part of parts) {
    currentPath = `${currentPath}/${part}`;
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

/**
 * 既存の無効なDuckDBファイルを削除する
 * IndexedDBに以前保存された不正なファイル（HTMLなど）をクリーンアップ
 */
function removeInvalidDuckDBFiles(
  pyodide: PyodideInterface,
  files: DataFile[],
): void {
  const FS = getFS(pyodide);

  for (const file of files) {
    try {
      const existingData = FS.readFile(file.localPath);
      if (!isValidDuckDBFile(existingData)) {
        Logger.warn(
          `[BackcastPro] Removing invalid DuckDB file: ${file.localPath}`,
        );
        FS.unlink(file.localPath);
      }
    } catch {
      // ファイルが存在しない場合は無視
    }
  }
}

export async function setupBackcastProData(
  pyodide: PyodideInterface,
): Promise<void> {
  const FS = getFS(pyodide);

  Logger.log("[BackcastPro] Setting up data files...");

  // Create cache directory structure
  ensureDirectoryExists(pyodide, STOCKDATA_CACHE_DIR);
  ensureDirectoryExists(pyodide, `${STOCKDATA_CACHE_DIR}/stocks_daily`);

  // Set environment variable for BackcastPro
  pyodide.runPython(`
import os
os.environ['STOCKDATA_CACHE_DIR'] = '${STOCKDATA_CACHE_DIR}'
print(f"[BackcastPro] STOCKDATA_CACHE_DIR set to: {os.environ['STOCKDATA_CACHE_DIR']}")
  `);

  // Fetch and write data files
  const files = getDataFilesToLoad();

  // 既存の無効なDuckDBファイルを削除（IndexedDBに残っている不正ファイルをクリーンアップ）
  removeInvalidDuckDBFiles(pyodide, files);

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
cache_dir = os.environ.get('STOCKDATA_CACHE_DIR', '/tmp/backcastpro_data')
print(f"[BackcastPro] Files in cache directory:")
for root, dirs, files in os.walk(cache_dir):
    for f in files:
        filepath = os.path.join(root, f)
        size = os.path.getsize(filepath)
        print(f"  {filepath} ({size} bytes)")
    `);
  }
}

/**
 * Fetch the list of Python files from manifest.json
 * Falls back to hardcoded list if manifest is not available
 */
async function getPythonFileList(): Promise<string[]> {
  const manifestUrl = `${FILES_BASE_URL}/manifest.json`;
  try {
    Logger.log(`[BackcastPro] Fetching manifest from: ${manifestUrl}`);
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      Logger.warn(
        `[BackcastPro] Failed to fetch manifest.json (${response.status}), using fallback`,
      );
      return FALLBACK_PYTHON_FILES;
    }
    const manifest = (await response.json()) as { files?: string[] };
    const files = manifest.files || [];
    Logger.log(`[BackcastPro] Loaded ${files.length} files from manifest.json`);
    return files;
  } catch (error) {
    Logger.warn(`[BackcastPro] Error fetching manifest.json:`, error);
    return FALLBACK_PYTHON_FILES;
  }
}

/**
 * Fetch a Python file from deployed assets
 * Returns null if fetch fails (don't fail startup)
 */
async function fetchPythonFile(filename: string): Promise<string | null> {
  const url = `${FILES_BASE_URL}/${filename}`;
  try {
    Logger.log(`[BackcastPro] Fetching Python file: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      Logger.warn(`[BackcastPro] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    // Content-Type check: reject text/html (Vite SPA fallback)
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      Logger.warn(
        `[BackcastPro] Rejecting ${url}: Content-Type is text/html (likely Vite SPA fallback)`,
      );
      return null;
    }

    const content = await response.text();
    Logger.log(
      `[BackcastPro] Successfully fetched: ${url} (${content.length} bytes)`,
    );
    return content;
  } catch (error) {
    Logger.warn(`[BackcastPro] Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Get the locale-specific filename for backcast.py.
 * Returns "backcast.py" for Japanese, "backcast_{locale}.py" for others.
 */
function getBackcastFilename(locale?: SupportedLocale): string {
  if (!locale || locale === "ja") {
    return "backcast.py";
  }
  return `backcast_${locale}.py`;
}

/**
 * Copy Python files from deployed assets to virtual filesystem
 * Only copies if file doesn't exist (preserves user edits in IndexedDB)
 */
async function setupPythonFiles(
  pyodide: PyodideInterface,
  locale?: SupportedLocale,
): Promise<void> {
  const FS = getFS(pyodide);

  Logger.log("[BackcastPro] Setting up Python files...");

  // Get file list from manifest.json (or fallback)
  const pythonFiles = await getPythonFileList();

  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  // Determine locale-specific source file for backcast.py
  const backcastSourceFile = getBackcastFilename(locale);
  Logger.log(
    `[BackcastPro] Using locale file for backcast: ${backcastSourceFile}`,
  );

  // Fetch and write files in parallel
  const fetchPromises = pythonFiles.map(async (filename) => {
    const localPath = `${STOCKDATA_CACHE_DIR}/${filename}`;

    // backcast.py is always overwritten (important as initial file)
    // Other files are skipped if they exist (preserve user edits)
    if (filename !== "backcast.py") {
      try {
        FS.readFile(localPath);
        Logger.log(
          `[BackcastPro] Skipping ${filename}: already exists in IndexedDB`,
        );
        skippedCount++;
        return true;
      } catch {
        // File doesn't exist, proceed with fetch
      }
    }

    // For backcast.py, fetch the locale-specific variant instead
    const fetchFilename =
      filename === "backcast.py" ? backcastSourceFile : filename;
    let content = await fetchPythonFile(fetchFilename);

    // Fallback to original backcast.py if locale variant fetch fails
    if (content === null && fetchFilename !== filename) {
      Logger.log(
        `[BackcastPro] Locale file ${fetchFilename} not found, falling back to ${filename}`,
      );
      content = await fetchPythonFile(filename);
    }

    if (content !== null) {
      try {
        FS.writeFile(localPath, content);
        Logger.log(`[BackcastPro] Wrote ${filename} to ${localPath}`);
        successCount++;
        return true;
      } catch (error) {
        Logger.warn(`[BackcastPro] Failed to write ${localPath}:`, error);
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
    `[BackcastPro] Python files setup complete: ${successCount} copied, ${skippedCount} skipped, ${failCount} failed`,
  );
}

export { STOCKDATA_CACHE_DIR, setupPythonFiles };
