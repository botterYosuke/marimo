/* Copyright 2026 Marimo. All rights reserved. */
import { Logger } from "./Logger";
import { asURL } from "./url";

/**
 * Open a notebook in a new window/tab.
 * In Electron: Opens in a new independent Electron window with its own server.
 * In browser: Opens in a new browser tab.
 * @param path - The absolute path to the notebook file.
 */
export async function openNotebook(path: string) {
  // Check if running in Electron with the new API
  if (window.electronAPI?.openNotebookInNewWindow) {
    const result = await window.electronAPI.openNotebookInNewWindow(path);
    if (!result.success) {
      Logger.error("Failed to open notebook in new window:", result.error);
      // Fallback to browser behavior if IPC fails
      window.open(asURL(`?file=${path}`).toString(), "_blank");
    }
    return;
  }

  // Non-Electron or legacy: use browser window.open
  // There is no leading `/` in the path in order to work when marimo is at a subpath.
  window.open(asURL(`?file=${path}`).toString(), "_blank");
}
