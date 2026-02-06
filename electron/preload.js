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
