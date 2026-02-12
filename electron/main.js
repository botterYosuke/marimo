/* Copyright 2026 Marimo. All rights reserved. */

import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { initLogger, logInfo, logError } from "./utils/logger.js";
import { getAppRoot, getMarimoServerExecutable } from "./utils/paths.js";
import { injectCells, readProgress, updateSetupBlock } from "./utils/notebook-injector.js";
import { getMostRecentFile, addRecentFile } from "./utils/recent-files.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
initLogger();

// Steam integration (CommonJS module loaded via createRequire)
const require = createRequire(import.meta.url);
let steamworks = null;
let steamClient = null;
let steamInitialized = false;

// Steam App ID - configurable via environment variable
const STEAM_APP_ID = parseInt(process.env.STEAM_APP_ID, 10) || 4228740;

/**
 * Initialize Steam SDK
 * Must be called before app.whenReady() for overlay support
 */
function initSteam() {
  try {
    steamworks = require("steamworks.js");

    // Enable Steam Overlay before windows are created
    // This adds command-line switches and sets up frame invalidation
    steamworks.electronEnableSteamOverlay();

    logInfo("Steam Overlay enabled");
    return true;
  } catch (error) {
    logError("Failed to load steamworks.js", error);
    return false;
  }
}

/**
 * Connect to Steam after app is ready
 */
function connectSteam() {
  if (!steamworks) {
    logInfo("Steam SDK not loaded, skipping connection");
    return false;
  }

  try {
    steamClient = steamworks.init(STEAM_APP_ID);
    steamInitialized = true;

    const playerName = steamClient.localplayer?.getName() || "Unknown";
    const steamId = steamClient.localplayer?.getSteamId()?.steamId64 || "Unknown";

    logInfo(`Steam initialized successfully`);
    logInfo(`Player: ${playerName} (${steamId})`);
    logInfo(`Steam App ID: ${STEAM_APP_ID}`);

    return true;
  } catch (error) {
    logError("Steam initialization failed", error);
    logInfo("Running in non-Steam mode");
    steamInitialized = false;
    return false;
  }
}

// Initialize Steam early (before app.whenReady)
initSteam();

// Multi-window support: Map<windowId, WindowInfo>
// WindowInfo = { window, serverProcess, serverPort, notebookPath, status, logs }
const windows = new Map();
let nextWindowId = 1;
let nextPort = 2718;

/**
 * Find an available port starting from the given port
 * @param {number} startPort - The port to start searching from
 * @returns {Promise<number>} An available port
 */
async function findAvailablePort(startPort) {
  const net = await import("node:net");
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      // Port is in use, try next one
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

/**
 * Normalize file path for comparison (handles Windows case-insensitivity and slashes)
 * @param {string} filePath - The file path to normalize
 * @returns {string} Normalized path
 */
function normalizePathForComparison(filePath) {
  const normalized = path.normalize(filePath);
  // On Windows, paths are case-insensitive
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

// Server status constants
const SERVER_STATUS = {
  RUNNING: "running",
  STOPPED: "stopped",
  STARTING: "starting",
  ERROR: "error",
};

// Notebook management
const DEFAULT_NOTEBOOK = "wasm-intro.py"; // 起動時のデフォルト

/**
 * Create a new notebook window with its own server
 * @param {string} notebookPath - Path to the notebook file (optional, uses default if not provided)
 * @returns {Promise<number>} windowId
 */
async function createNotebookWindow(notebookPath = null) {
  const windowId = nextWindowId++;
  const port = await findAvailablePort(nextPort);
  nextPort = port + 1; // Update for next window
  const actualNotebookPath = notebookPath || getDefaultNotebook();

  // Add to recent files history
  addRecentFile(actualNotebookPath);

  logInfo(`Creating window ${windowId} for notebook: ${actualNotebookPath}`);

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true, // Required for Steam Overlay
      contextIsolation: false, // Required for Steam Overlay
      sandbox: false, // Required for preload script
    },
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icon.png")
      : path.join(__dirname, "..", "frontend", "public", "android-chrome-512x512.png"),
  });

  // Store window info
  const windowInfo = {
    window,
    serverProcess: null,
    serverPort: port,
    notebookPath: actualNotebookPath,
    status: SERVER_STATUS.STOPPED,
    logs: [],
  };
  windows.set(windowId, windowInfo);

  // Load the app with windowId and port as query params
  if (app.isPackaged) {
    // Production: load from frontend/dist inside the asar
    window.loadFile(path.join(app.getAppPath(), "frontend", "dist", "index.html"), {
      query: { windowId: String(windowId), port: String(port) },
    });
  } else {
    // Development: load from Vite dev server
    window.loadURL(`http://localhost:3000?windowId=${windowId}&port=${port}`);
  }

  // Start server for this window (production only)
  if (app.isPackaged) {
    startServerForWindow(windowId, actualNotebookPath);
  }

  // Set window title with notebook name
  const notebookName = path.basename(actualNotebookPath);
  window.setTitle(`${notebookName} - marimo`);

  // Handle window close - cleanup this window only
  window.on("closed", () => {
    logInfo(`Window ${windowId} closed, cleaning up...`);
    stopServerForWindow(windowId);
    windows.delete(windowId);
  });

  logInfo(`Window ${windowId} created on port ${port}`);
  return windowId;
}

/**
 * Legacy createWindow function for backwards compatibility
 */
async function createWindow() {
  return await createNotebookWindow(null);
}

/**
 * Get the default startup notebook path.
 * Priority:
 * 1. Most recently opened file (if exists)
 * 2. Default template notebook (wasm-intro.py)
 */
function getDefaultNotebook() {
  // Try to get the most recently opened file
  const mostRecent = getMostRecentFile();
  if (mostRecent && existsSync(mostRecent)) {
    logInfo(`Using most recent file: ${mostRecent}`);
    return mostRecent;
  }

  // Fallback to default notebook
  const userNotebookDir = path.join(app.getPath("userData"), "notebooks");
  return path.join(userNotebookDir, DEFAULT_NOTEBOOK);
}

/**
 * Open a notebook file in a new window
 * @param {string} filePath - Absolute path to the notebook file
 * @returns {Promise<{success: boolean, windowId?: number, path?: string, error?: string, alreadyOpen?: boolean}>}
 */
async function openNotebookInNewWindow(filePath) {
  logInfo(`Opening notebook in new window: ${filePath}`);

  // Check if already open (with path normalization for Windows)
  const normalizedPath = normalizePathForComparison(filePath);
  for (const [windowId, info] of windows) {
    const normalizedNotebookPath = normalizePathForComparison(info.notebookPath);
    if (normalizedNotebookPath === normalizedPath) {
      // Already open - focus existing window
      if (info.window && !info.window.isDestroyed()) {
        info.window.focus();
        logInfo(`Notebook already open in window ${windowId}, focusing`);
        return { success: true, windowId, path: filePath, alreadyOpen: true };
      }
    }
  }

  // Create new window
  const windowId = await createNotebookWindow(filePath);
  return { success: true, windowId, path: filePath };
}

/**
 * Start the marimo Python server for a specific window
 * @param {number} windowId - The window ID
 * @param {string} notebookPath - Absolute path to the notebook file
 */
function startServerForWindow(windowId, notebookPath) {
  const windowInfo = windows.get(windowId);
  if (!windowInfo) {
    logError(`Window ${windowId} not found`);
    return;
  }

  // If server is already starting or running, don't start again
  if (windowInfo.status === SERVER_STATUS.STARTING || windowInfo.status === SERVER_STATUS.RUNNING) {
    logInfo(`Server for window ${windowId} is already starting or running`);
    return;
  }

  logInfo(`Starting marimo server for window ${windowId}...`);
  windowInfo.status = SERVER_STATUS.STARTING;

  // Notify the window
  if (windowInfo.window && !windowInfo.window.isDestroyed()) {
    windowInfo.window.webContents.send("server:status-changed", windowInfo.status);
  }

  logInfo(`Window ${windowId} notebook: ${notebookPath}, port: ${windowInfo.serverPort}`);

  // Get the server executable path
  const serverExecutable = getMarimoServerExecutable();
  logInfo(`Server executable: ${serverExecutable}`);

  // In production, use the PyInstaller executable
  if (!existsSync(serverExecutable)) {
    logError(`Server executable not found: ${serverExecutable}`);
    windowInfo.status = SERVER_STATUS.ERROR;
    if (windowInfo.window && !windowInfo.window.isDestroyed()) {
      windowInfo.window.webContents.send("server:status-changed", windowInfo.status);
    }
    return;
  }

  // Spawn the server process
  const serverProcess = spawn(serverExecutable, [
    "edit",
    "--no-token",
    "--headless",
    "--port",
    String(windowInfo.serverPort),
    notebookPath,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PATH: process.env.PATH || "",
    },
  });

  windowInfo.serverProcess = serverProcess;

  // Handle server output
  serverProcess.stdout?.on("data", (data) => {
    const message = data.toString();
    logInfo(`[Server ${windowId}] ${message.trim()}`);
    windowInfo.logs.push({ timestamp: Date.now(), type: "stdout", message });

    // Limit log size
    if (windowInfo.logs.length > 1000) {
      windowInfo.logs.shift();
    }
  });

  serverProcess.stderr?.on("data", (data) => {
    const message = data.toString();
    logError(`[Server ${windowId}] ${message.trim()}`);
    windowInfo.logs.push({ timestamp: Date.now(), type: "stderr", message });

    // Limit log size
    if (windowInfo.logs.length > 1000) {
      windowInfo.logs.shift();
    }
  });

  serverProcess.on("error", (error) => {
    logError(`Failed to start server for window ${windowId}`, error);
    windowInfo.status = SERVER_STATUS.ERROR;
    if (windowInfo.window && !windowInfo.window.isDestroyed()) {
      windowInfo.window.webContents.send("server:status-changed", windowInfo.status);
    }
    windowInfo.serverProcess = null;
  });

  serverProcess.on("exit", (code, signal) => {
    logInfo(`Server for window ${windowId} exited with code ${code} and signal ${signal}`);
    windowInfo.status = SERVER_STATUS.STOPPED;
    if (windowInfo.window && !windowInfo.window.isDestroyed()) {
      windowInfo.window.webContents.send("server:status-changed", windowInfo.status);
    }
    windowInfo.serverProcess = null;
  });
}

/**
 * Stop the marimo Python server for a specific window
 * @param {number} windowId - The window ID
 */
function stopServerForWindow(windowId) {
  const windowInfo = windows.get(windowId);
  if (!windowInfo || !windowInfo.serverProcess) {
    return;
  }

  logInfo(`Stopping marimo server for window ${windowId}...`);
  windowInfo.status = SERVER_STATUS.STOPPED;

  // Kill the server process
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(windowInfo.serverProcess.pid), "/f", "/t"]);
  } else {
    windowInfo.serverProcess.kill("SIGTERM");
  }

  windowInfo.serverProcess = null;

  // Notify the window
  if (windowInfo.window && !windowInfo.window.isDestroyed()) {
    windowInfo.window.webContents.send("server:status-changed", windowInfo.status);
  }
}

/**
 * Stop all servers
 */
function stopAllServers() {
  for (const [windowId] of windows) {
    stopServerForWindow(windowId);
  }
}

/**
 * Get window info by window ID from IPC event
 * @param {Electron.IpcMainInvokeEvent} event
 * @returns {{windowId: number, windowInfo: object} | null}
 */
function getWindowFromEvent(event) {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) return null;

  for (const [windowId, windowInfo] of windows) {
    if (windowInfo.window === senderWindow) {
      return { windowId, windowInfo };
    }
  }
  return null;
}

// IPC Handlers
ipcMain.handle("server:get-url", (event) => {
  const ctx = getWindowFromEvent(event);
  if (ctx) {
    const url = `http://localhost:${ctx.windowInfo.serverPort}`;
    logInfo(`IPC: server:get-url (window ${ctx.windowId}) -> ${url}`);
    return url;
  }
  // Fallback for first window
  const firstWindow = windows.values().next().value;
  const url = firstWindow ? `http://localhost:${firstWindow.serverPort}` : "http://localhost:2718";
  logInfo(`IPC: server:get-url (fallback) -> ${url}`);
  return url;
});

ipcMain.handle("server:get-status", async (event) => {
  const ctx = getWindowFromEvent(event);
  const port = ctx ? ctx.windowInfo.serverPort : 2718;
  logInfo(`IPC: server:get-status (port ${port})`);

  try {
    const response = await fetch(`http://localhost:${port}/healthz`);
    const status = response.ok ? SERVER_STATUS.RUNNING : SERVER_STATUS.ERROR;
    if (ctx) {
      ctx.windowInfo.status = status;
    }
    return status;
  } catch (error) {
    if (ctx) {
      ctx.windowInfo.status = SERVER_STATUS.STOPPED;
    }
    return SERVER_STATUS.STOPPED;
  }
});

ipcMain.handle("server:start", async (event) => {
  const ctx = getWindowFromEvent(event);
  if (ctx) {
    logInfo(`IPC: server:start (window ${ctx.windowId})`);
    startServerForWindow(ctx.windowId, ctx.windowInfo.notebookPath);
  }
  return { success: true, message: "Server start requested" };
});

ipcMain.handle("server:stop", async (event) => {
  const ctx = getWindowFromEvent(event);
  if (ctx) {
    logInfo(`IPC: server:stop (window ${ctx.windowId})`);
    stopServerForWindow(ctx.windowId);
  }
  return { success: true, message: "Server stop requested" };
});

ipcMain.handle("server:restart", async (event) => {
  const ctx = getWindowFromEvent(event);
  if (ctx) {
    logInfo(`IPC: server:restart (window ${ctx.windowId})`);
    stopServerForWindow(ctx.windowId);
    setTimeout(() => {
      startServerForWindow(ctx.windowId, ctx.windowInfo.notebookPath);
    }, 1000);
  }
  return { success: true, message: "Server restart requested" };
});

ipcMain.handle("server:get-logs", (event) => {
  const ctx = getWindowFromEvent(event);
  if (ctx) {
    logInfo(`IPC: server:get-logs (window ${ctx.windowId})`);
    return ctx.windowInfo.logs;
  }
  return [];
});

// Notebook IPC handlers
ipcMain.handle("notebook:open", async (_event, filePath) => {
  logInfo(`IPC: notebook:open ${filePath}`);

  // Validate file path
  if (!filePath || typeof filePath !== "string") {
    return { success: false, error: "Invalid file path" };
  }

  // Check file extension
  if (!filePath.endsWith(".py")) {
    return { success: false, error: "File must be a .py notebook file" };
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  // Open in a new window
  return await openNotebookInNewWindow(filePath);
});

// New IPC handler for opening notebook in new window
ipcMain.handle("notebook:open-in-new-window", async (_event, filePath) => {
  logInfo(`IPC: notebook:open-in-new-window ${filePath}`);

  // Validate file path
  if (!filePath || typeof filePath !== "string") {
    return { success: false, error: "Invalid file path" };
  }

  // Check file extension
  if (!filePath.endsWith(".py")) {
    return { success: false, error: "File must be a .py notebook file" };
  }

  // Check if file exists
  if (!existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  return await openNotebookInNewWindow(filePath);
});

ipcMain.handle("notebook:open-dialog", async (event) => {
  logInfo("IPC: notebook:open-dialog");

  const ctx = getWindowFromEvent(event);
  const parentWindow = ctx ? ctx.windowInfo.window : null;

  const result = await dialog.showOpenDialog(parentWindow, {
    title: "Open Notebook",
    filters: [
      { name: "Python Notebooks", extensions: ["py"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  return await openNotebookInNewWindow(filePath);
});

ipcMain.handle("notebook:get-path", (event) => {
  const ctx = getWindowFromEvent(event);
  if (ctx) {
    logInfo(`IPC: notebook:get-path (window ${ctx.windowId})`);
    return ctx.windowInfo.notebookPath;
  }
  return null;
});

// Skill-tree notebook injection handlers
ipcMain.handle("notebook:inject-cells", async (event, options) => {
  logInfo(`IPC: notebook:inject-cells for skill ${options.skillId}`);

  const ctx = getWindowFromEvent(event);
  if (!ctx || !ctx.windowInfo.notebookPath) {
    return { success: false, error: "No notebook is currently open" };
  }

  return injectCells(ctx.windowInfo.notebookPath, options);
});

ipcMain.handle("notebook:read-progress", async (event) => {
  logInfo("IPC: notebook:read-progress");

  const ctx = getWindowFromEvent(event);
  if (!ctx || !ctx.windowInfo.notebookPath) {
    return { success: false, error: "No notebook is currently open" };
  }

  return readProgress(ctx.windowInfo.notebookPath);
});

ipcMain.handle("notebook:update-setup", async (event, newSetupContent) => {
  logInfo("IPC: notebook:update-setup");

  const ctx = getWindowFromEvent(event);
  if (!ctx || !ctx.windowInfo.notebookPath) {
    return { success: false, error: "No notebook is currently open" };
  }

  return updateSetupBlock(ctx.windowInfo.notebookPath, newSetupContent);
});

// App event handlers
app.whenReady().then(async () => {
  logInfo("App ready");

  // Connect to Steam after app is ready
  connectSteam();

  // Create the first window (server starts inside createNotebookWindow for production)
  await createWindow();

  // Check server status periodically for all windows
  setInterval(async () => {
    for (const [windowId, windowInfo] of windows) {
      if (!windowInfo.window || windowInfo.window.isDestroyed()) continue;

      try {
        const response = await fetch(`http://localhost:${windowInfo.serverPort}/healthz`);
        const newStatus = response.ok ? SERVER_STATUS.RUNNING : SERVER_STATUS.ERROR;
        if (newStatus !== windowInfo.status) {
          windowInfo.status = newStatus;
          windowInfo.window.webContents.send("server:status-changed", newStatus);
        }
      } catch (error) {
        if (windowInfo.status !== SERVER_STATUS.STOPPED) {
          windowInfo.status = SERVER_STATUS.STOPPED;
          windowInfo.window.webContents.send("server:status-changed", SERVER_STATUS.STOPPED);
        }
      }
    }
  }, 5000); // Check every 5 seconds

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Stop all servers when all windows are closed
  stopAllServers();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Shutdown Steam client
  if (steamClient && steamInitialized) {
    try {
      steamClient.runCallbacks(); // Flush pending callbacks
      logInfo("Steam client shutdown");
    } catch (e) {
      // Ignore errors during shutdown
    }
    steamClient = null;
    steamInitialized = false;
  }

  // Ensure all servers are stopped before quitting
  stopAllServers();
});

// Error handling
process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection", new Error(String(reason)));
});
