/* Copyright 2026 Marimo. All rights reserved. */

import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initLogger, logInfo, logError } from "./utils/logger.js";
import { getAppRoot } from "./utils/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
initLogger();

let mainWindow = null;

// Server configuration
const SERVER_URL = "http://localhost:2718";
const SERVER_STATUS = {
  RUNNING: "running",
  STOPPED: "stopped",
  STARTING: "starting",
  ERROR: "error",
};

let serverStatus = SERVER_STATUS.STOPPED;
let serverLogs = [];

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
      nodeIntegration: false,
      contextIsolation: true,
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
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  logInfo("Main window created");
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

ipcMain.handle("server:restart", async () => {
  logInfo("IPC: server:restart");
  // Note: Server is managed externally via package.json scripts
  // This is a placeholder for future server management
  serverStatus = SERVER_STATUS.STARTING;
  if (mainWindow) {
    mainWindow.webContents.send("server:status-changed", serverStatus);
  }
  // In a real implementation, you would restart the server process here
  return { success: true, message: "Server restart requested" };
});

ipcMain.handle("server:get-logs", () => {
  logInfo("IPC: server:get-logs");
  return serverLogs;
});

// App event handlers
app.whenReady().then(async () => {
  logInfo("App ready");
  createWindow();

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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Error handling
process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection", new Error(String(reason)));
});
