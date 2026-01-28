/* Copyright 2026 Marimo. All rights reserved. */

import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { spawn, ChildProcess } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initLogger, logInfo, logError } from "./utils/logger.js";
import { getAppRoot, getMarimoServerExecutable } from "./utils/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize logger
initLogger();

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
  // if (!app.isPackaged) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  logInfo("Main window created");
}

/**
 * Start the marimo Python server
 */
function startServer() {
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

  // Get the server executable path
  const serverExecutable = getMarimoServerExecutable();
  logInfo(`Server executable: ${serverExecutable}`);

  // Check if we're in production (packaged app)
  if (app.isPackaged) {
    // In production, use the PyInstaller executable
    if (!existsSync(serverExecutable)) {
      logError(`Server executable not found: ${serverExecutable}`);
      serverStatus = SERVER_STATUS.ERROR;
      if (mainWindow) {
        mainWindow.webContents.send("server:status-changed", serverStatus);
      }
      return;
    }

    // Get the startup notebook file path (backcast.py)
    // Source: bundled template (read-only)
    const templateNotebook = path.join(getAppRoot(), "frontend", "dist", "files", "backcast.py");
    // Destination: user's documents folder (writable)
    const userNotebookDir = path.join(app.getPath("documents"), "marimo-game");
    const startupNotebook = path.join(userNotebookDir, "backcast.py");

    // Copy template to writable location if not exists
    if (!existsSync(startupNotebook)) {
      logInfo(`Copying template notebook to ${startupNotebook}`);
      mkdirSync(userNotebookDir, { recursive: true });
      copyFileSync(templateNotebook, startupNotebook);
    }

    // Spawn the server process
    serverProcess = spawn(serverExecutable, [
      "edit",
      "--no-token",
      "--headless",
      "--port",
      String(SERVER_PORT),
      startupNotebook,
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Ensure PATH includes necessary directories
        PATH: process.env.PATH || "",
      },
    });
  } else {
    // In development, use the Python command directly
    // This falls back to the existing behavior for development
    logInfo("Development mode: server should be started externally");
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

// App event handlers
app.whenReady().then(async () => {
  logInfo("App ready");
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
