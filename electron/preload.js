/* Copyright 2026 Marimo. All rights reserved. */

import { ipcRenderer } from "electron";

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object.
 *
 * Note: With contextIsolation: false (required for Steam Overlay),
 * we attach directly to window instead of using contextBridge.
 */
window.electronAPI = {
  /**
   * Check if running in Electron
   */
  isElectron: true,

  /**
   * Get server URL from main process
   */
  getServerURL: () => ipcRenderer.invoke("server:get-url"),

  /**
   * Get server status from main process
   */
  getServerStatus: () => ipcRenderer.invoke("server:get-status"),

  /**
   * Request server restart
   */
  restartServer: () => ipcRenderer.invoke("server:restart"),

  /**
   * Listen to server status changes
   */
  onServerStatusChange: (callback) => {
    // Create a wrapper function to maintain reference for removal
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("server:status-changed", listener);
    // Return cleanup function that removes only this specific listener
    return () => {
      ipcRenderer.removeListener("server:status-changed", listener);
    };
  },

  /**
   * Get server logs
   */
  getServerLogs: () => ipcRenderer.invoke("server:get-logs"),

  /**
   * Open a notebook file by path (opens in new window)
   * @param {string} filePath - Absolute path to the notebook file
   * @returns {Promise<{success: boolean, windowId?: number, path?: string, error?: string}>}
   */
  openNotebook: (filePath) => ipcRenderer.invoke("notebook:open", filePath),

  /**
   * Open a notebook in a new independent window
   * @param {string} filePath - Absolute path to the notebook file
   * @returns {Promise<{success: boolean, windowId?: number, path?: string, error?: string}>}
   */
  openNotebookInNewWindow: (filePath) => ipcRenderer.invoke("notebook:open-in-new-window", filePath),

  /**
   * Show a file open dialog and open the selected notebook (in new window)
   * @returns {Promise<{success: boolean, windowId?: number, path?: string, canceled?: boolean, error?: string}>}
   */
  openNotebookDialog: () => ipcRenderer.invoke("notebook:open-dialog"),

  /**
   * Get the currently open notebook path
   * @returns {Promise<string | null>}
   */
  getNotebookPath: () => ipcRenderer.invoke("notebook:get-path"),

  // ===========================================
  // Skill-tree notebook injection APIs
  // ===========================================

  /**
   * Inject cells into the current notebook (for skill completion)
   * @param {object} options - Injection options
   * @param {string} options.skillId - The completed skill ID
   * @param {Array<{name: string, code: string, config?: string, afterCell?: string}>} options.cells - Cells to add
   * @param {object} options.progressUpdate - Progress data to update
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  injectCells: (options) => ipcRenderer.invoke("notebook:inject-cells", options),

  /**
   * Read progress data from the current notebook
   * @returns {Promise<{success: boolean, progress?: object, error?: string}>}
   */
  readProgress: () => ipcRenderer.invoke("notebook:read-progress"),

  /**
   * Update the setup block in the current notebook (for mode transitions)
   * @param {string} newSetupContent - New setup block content
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  updateSetupBlock: (newSetupContent) => ipcRenderer.invoke("notebook:update-setup", newSetupContent),
};

// Remove Node.js globals injected by nodeIntegration: true
// This prevents Vite-bundled ESM code from being confused by
// the presence of module/exports/require in the global scope,
// which can cause minified code to break (e.g. "aa is not a function").
// Safe because: preload.js already imported what it needs via ESM imports,
// and the renderer uses window.electronAPI for IPC (not direct require).
delete window.module;
delete window.exports;
delete window.require;

// Inject mount configuration for the frontend
// This tells the React app where to find the marimo server
(() => {
  const params = new URLSearchParams(window.location.search);
  const port = params.get("port");
  const mountConfig = {
    filename: "",
    mode: "edit",
    version: "electron",
    config: {},
    configOverrides: {},
    appConfig: {},
    view: { showAppCode: true },
    serverToken: "",
    session: null,
    notebook: null,
    runtimeConfig: port ? [{
      url: `http://localhost:${port}`,
      lazy: false,
    }] : null,
  };
  Object.defineProperty(window, "__MARIMO_MOUNT_CONFIG__", {
    value: mountConfig,
    writable: false,
    configurable: false,
  });
})();

// Fix HTML template placeholders that the Python server would normally replace.
// In Electron, we load index.html directly via loadFile(), so {{ title }},
// {{ filename }} etc. remain as literal strings.
document.addEventListener('DOMContentLoaded', () => {
  // Fix {{ title }}
  if (document.title.includes('{{')) {
    document.title = 'marimo';
  }
  // Fix {{ filename }}
  const filenameTag = document.querySelector('marimo-filename');
  if (filenameTag && filenameTag.innerHTML.includes('{{')) {
    filenameTag.innerHTML = '';
  }
  // Set title from notebook path via IPC
  window.electronAPI.getNotebookPath().then((notebookPath) => {
    if (notebookPath) {
      const basename = notebookPath.split(/[/\\]/).pop() || 'Untitled';
      document.title = `${basename} - marimo`;
    }
  });
});
