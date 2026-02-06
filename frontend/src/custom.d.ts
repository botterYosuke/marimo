/* Copyright 2026 Marimo. All rights reserved. */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "*.svg" {
  const content: string | undefined;
  export default content;
}

// Stricter lib types
interface Body {
  json<T = unknown>(): Promise<T>;
}

// Stricter lib types
interface JSON {
  parse(
    text: string,
    reviver?: (this: any, key: string, value: any) => any,
  ): unknown;

  rawJSON(value: string): unknown;
}

// Improve type inference for Array.filter with BooleanConstructor
interface Array<T> {
  filter(predicate: BooleanConstructor): NonNullable<T>[];
}

// Electron API types
interface ElectronOpenNotebookResult {
  success: boolean;
  windowId?: number;
  path?: string;
  error?: string;
  canceled?: boolean;
  alreadyOpen?: boolean;
}

interface ElectronServerLog {
  timestamp: number;
  type: "stdout" | "stderr";
  message: string;
}

interface ElectronInjectCellsOptions {
  skillId: string;
  cells: Array<{
    name: string;
    code: string;
    config?: string;
    afterCell?: string;
  }>;
  progressUpdate: Record<string, unknown>;
}

interface ElectronAPI {
  isElectron: boolean;
  getServerURL: () => Promise<string>;
  getServerStatus: () => Promise<"running" | "stopped" | "starting" | "error">;
  restartServer: () => Promise<{ success: boolean; message: string }>;
  onServerStatusChange: (
    callback: (status: "running" | "stopped" | "starting" | "error") => void,
  ) => () => void;
  getServerLogs: () => Promise<ElectronServerLog[]>;
  openNotebook: (filePath: string) => Promise<ElectronOpenNotebookResult>;
  openNotebookInNewWindow: (
    filePath: string,
  ) => Promise<ElectronOpenNotebookResult>;
  openNotebookDialog: () => Promise<ElectronOpenNotebookResult>;
  getNotebookPath: () => Promise<string | null>;
  injectCells: (
    options: ElectronInjectCellsOptions,
  ) => Promise<{ success: boolean; error?: string }>;
  readProgress: () => Promise<{
    success: boolean;
    progress?: Record<string, unknown>;
    error?: string;
  }>;
  updateSetupBlock: (
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
