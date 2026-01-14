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

// App event handlers
app.whenReady().then(async () => {
  logInfo("App ready");
  createWindow();

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
