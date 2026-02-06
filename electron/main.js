/* Copyright 2026 Marimo. All rights reserved. */

import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { spawn, ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { initLogger, logInfo, logError } from "./utils/logger.js";
import { getAppRoot, getMarimoServerExecutable } from "./utils/paths.js";

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

let mainWindow = null;

// Server configuration
const SERVER_URL = "http://localhost:2718";
const SERVER_PORT = 2718;
const SERVER_STATUS = {
  RUNNING: "running",
  STOPPED: "stopped",
  STARTING: "starting",
  ERROR: "error",
};

let serverStatus = SERVER_STATUS.STOPPED;
let serverLogs = [];
let serverProcess = null; // Child process for the Python server

// Notebook management
let currentNotebookPath = null; // 現在開いているノートブックのパス
const DEFAULT_NOTEBOOK = "wasm-intro.py"; // 起動時のデフォルト

/**
 * Create the main application window
 */
function createWindow() {
  logInfo("Creating main window...");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true, // Required for Steam Overlay
      contextIsolation: false, // Required for Steam Overlay
      sandbox: false, // Required for preload script
    },
    icon: path.join(getAppRoot(), "frontend", "public", "logo.png"),
  });

  // Load the app
  if (app.isPackaged) {
    // Production: load from dist
    mainWindow.loadFile(path.join(getAppRoot(), "dist", "index.html"));
  } else {
    // Development: load from Vite dev server
    mainWindow.loadURL("http://localhost:3000");
  }

  // Open DevTools in development
  // if (!app.isPackaged) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  logInfo("Main window created");
}

/**
 * Get the default startup notebook path.
 * Template copying is handled by scripts/start-server.js
 */
function getDefaultNotebook() {
  const userNotebookDir = path.join(app.getPath("userData"), "notebooks");
  return path.join(userNotebookDir, DEFAULT_NOTEBOOK);
}

/**
 * Open a notebook file (internal helper)
 * @param {string} filePath - Absolute path to the notebook file
 */
async function openNotebookFile(filePath) {
  logInfo(`Opening notebook: ${filePath}`);
  currentNotebookPath = filePath;

  // Stop current server
  stopServer();

  // Wait for server to stop
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Start server with new notebook
  startServerWithNotebook(filePath);

  return { success: true, path: filePath };
}

/**
 * Start the marimo Python server with default notebook
 */
function startServer() {
  const notebookPath = getDefaultNotebook();
  currentNotebookPath = notebookPath;
  startServerWithNotebook(notebookPath);
}

/**
 * Start the marimo Python server with a specific notebook
 * @param {string} notebookPath - Absolute path to the notebook file
 */
function startServerWithNotebook(notebookPath) {
  // If server is already starting or running, don't start again
  if (serverStatus === SERVER_STATUS.STARTING || serverStatus === SERVER_STATUS.RUNNING) {
    logInfo("Server is already starting or running");
    return;
  }

  logInfo("Starting marimo server...");
  serverStatus = SERVER_STATUS.STARTING;

  // Notify the main window
  if (mainWindow) {
    mainWindow.webContents.send("server:status-changed", serverStatus);
  }

  logInfo(`Startup notebook: ${notebookPath}`);

  // Check if we're in production (packaged app)
  if (app.isPackaged) {
    // Get the server executable path
    const serverExecutable = getMarimoServerExecutable();
    logInfo(`Server executable: ${serverExecutable}`);

    // In production, use the PyInstaller executable
    if (!existsSync(serverExecutable)) {
      logError(`Server executable not found: ${serverExecutable}`);
      serverStatus = SERVER_STATUS.ERROR;
      if (mainWindow) {
        mainWindow.webContents.send("server:status-changed", serverStatus);
      }
      return;
    }

    // Get the notebook directory for BACKCASTPRO_CACHE_DIR
    const notebookDir = path.dirname(notebookPath);

    // Spawn the server process
    serverProcess = spawn(serverExecutable, [
      "edit",
      "--no-token",
      "--headless",
      "--port",
      String(SERVER_PORT),
      notebookPath,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Ensure PATH includes necessary directories
        PATH: process.env.PATH || "",
      },
    });
  } else {
    // In development, server is started externally via pnpm start:server
    // But we still need to tell it which notebook to open
    logInfo("Development mode: server should be started externally");
    logInfo(`Expected notebook path: ${notebookPath}`);
    serverStatus = SERVER_STATUS.STOPPED;
    if (mainWindow) {
      mainWindow.webContents.send("server:status-changed", serverStatus);
    }
    return;
  }

  // Handle server output
  if (serverProcess) {
    serverProcess.stdout?.on("data", (data) => {
      const message = data.toString();
      logInfo(`[Server] ${message.trim()}`);
      serverLogs.push({ timestamp: Date.now(), type: "stdout", message });

      // Limit log size
      if (serverLogs.length > 1000) {
        serverLogs.shift();
      }
    });

    serverProcess.stderr?.on("data", (data) => {
      const message = data.toString();
      logError(`[Server] ${message.trim()}`);
      serverLogs.push({ timestamp: Date.now(), type: "stderr", message });

      // Limit log size
      if (serverLogs.length > 1000) {
        serverLogs.shift();
      }
    });

    serverProcess.on("error", (error) => {
      logError("Failed to start server", error);
      serverStatus = SERVER_STATUS.ERROR;
      if (mainWindow) {
        mainWindow.webContents.send("server:status-changed", serverStatus);
      }
      serverProcess = null;
    });

    serverProcess.on("exit", (code, signal) => {
      logInfo(`Server process exited with code ${code} and signal ${signal}`);
      serverStatus = SERVER_STATUS.STOPPED;
      if (mainWindow) {
        mainWindow.webContents.send("server:status-changed", serverStatus);
      }
      serverProcess = null;
    });
  }
}

/**
 * Stop the marimo Python server
 */
function stopServer() {
  if (serverProcess) {
    logInfo("Stopping marimo server...");
    serverStatus = SERVER_STATUS.STOPPED;

    // Kill the server process
    if (process.platform === "win32") {
      // On Windows, use taskkill for a cleaner shutdown
      spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"]);
    } else {
      serverProcess.kill("SIGTERM");
    }

    serverProcess = null;

    // Notify the main window
    if (mainWindow) {
      mainWindow.webContents.send("server:status-changed", serverStatus);
    }
  }
}

// IPC Handlers
ipcMain.handle("server:get-url", () => {
  logInfo("IPC: server:get-url");
  return SERVER_URL;
});

ipcMain.handle("server:get-status", async () => {
  logInfo("IPC: server:get-status");
  // Check if server is running by making a request
  try {
    const response = await fetch(`${SERVER_URL}/healthz`);
    if (response.ok) {
      serverStatus = SERVER_STATUS.RUNNING;
    } else {
      serverStatus = SERVER_STATUS.ERROR;
    }
  } catch (error) {
    serverStatus = SERVER_STATUS.STOPPED;
  }
  return serverStatus;
});

ipcMain.handle("server:start", async () => {
  logInfo("IPC: server:start");
  startServer();
  return { success: true, message: "Server start requested" };
});

ipcMain.handle("server:stop", async () => {
  logInfo("IPC: server:stop");
  stopServer();
  return { success: true, message: "Server stop requested" };
});

ipcMain.handle("server:restart", async () => {
  logInfo("IPC: server:restart");
  stopServer();
  // Wait a bit before starting again
  setTimeout(() => {
    startServer();
  }, 1000);
  return { success: true, message: "Server restart requested" };
});

ipcMain.handle("server:get-logs", () => {
  logInfo("IPC: server:get-logs");
  return serverLogs;
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

  return await openNotebookFile(filePath);
});

ipcMain.handle("notebook:open-dialog", async () => {
  logInfo("IPC: notebook:open-dialog");

  const result = await dialog.showOpenDialog(mainWindow, {
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
  return await openNotebookFile(filePath);
});

ipcMain.handle("notebook:get-path", () => {
  logInfo("IPC: notebook:get-path");
  return currentNotebookPath;
});

// App event handlers
app.whenReady().then(async () => {
  logInfo("App ready");

  // Connect to Steam after app is ready
  connectSteam();

  createWindow();

  // Start the server automatically if packaged (production)
  if (app.isPackaged) {
    startServer();
  }

  // Check server status periodically
  setInterval(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/healthz`);
      const newStatus = response.ok
        ? SERVER_STATUS.RUNNING
        : SERVER_STATUS.ERROR;
      if (newStatus !== serverStatus && mainWindow) {
        serverStatus = newStatus;
        mainWindow.webContents.send("server:status-changed", serverStatus);
      }
    } catch (error) {
      if (serverStatus !== SERVER_STATUS.STOPPED && mainWindow) {
        serverStatus = SERVER_STATUS.STOPPED;
        mainWindow.webContents.send("server:status-changed", serverStatus);
      }
    }
  }, 5000); // Check every 5 seconds

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Stop the server when the app is closed
  stopServer();

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

  // Ensure server is stopped before quitting
  stopServer();
});

// Error handling
process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection", new Error(String(reason)));
});
