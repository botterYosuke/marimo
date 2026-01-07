/* Copyright 2026 Marimo. All rights reserved. */
import type { PyodideInterface } from "pyodide";
import { decodeUtf8 } from "@/utils/strings";
import { getFS } from "./getFS";

const NOTEBOOK_FILENAME = "notebook.py";
const HOME_DIR = "/marimo";

// Store the current filename used in the session
let currentFilename: string | null = null;

export const WasmFileSystem = {
  NOTEBOOK_FILENAME,
  HOME_DIR,
  setCurrentFilename: (filename: string | null) => {
    currentFilename = filename;
  },
  getCurrentFilename: (): string => {
    return currentFilename || NOTEBOOK_FILENAME;
  },
  createHomeDir: (pyodide: PyodideInterface) => {
    // Create and change to the home directory
    const FS = getFS(pyodide);
    try {
      FS.mkdirTree(HOME_DIR);
    } catch {
      // Ignore if the directory already exists
    }
    FS.chdir(HOME_DIR);
  },
  mountFS: (pyodide: PyodideInterface) => {
    const FS = getFS(pyodide);
    // Mount the filesystem
    FS.mount(pyodide.FS.filesystems.IDBFS, { root: "." }, HOME_DIR);
  },
  populateFilesToMemory: async (pyodide: PyodideInterface) => {
    await syncFileSystem(pyodide, true);
  },
  persistFilesToRemote: async (pyodide: PyodideInterface) => {
    await syncFileSystem(pyodide, false);
  },
  readNotebook: (pyodide: PyodideInterface) => {
    const FS = getFS(pyodide);
    const filename = currentFilename || NOTEBOOK_FILENAME;
    const absPath = `${HOME_DIR}/${filename}`;
    return decodeUtf8(FS.readFile(absPath));
  },
  initNotebookCode: (opts: {
    pyodide: PyodideInterface;
    code: string;
    filename: string | null;
  }): { code: string; filename: string } => {
    const { pyodide, filename, code } = opts;
    const FS = getFS(pyodide);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/806ba12d-a164-41a6-8625-2def7626046a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fs.ts:43',message:'initNotebookCode: entry',data:{filename,notebookFilename:NOTEBOOK_FILENAME,codeLength:code?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    const readIfExist = (filename: string): string | null => {
      try {
        return decodeUtf8(FS.readFile(filename));
      } catch {
        return null;
      }
    };

    // If there is a filename, read the file if it exists
    // We don't want to change the contents of the file if it already exists
    if (filename && filename !== NOTEBOOK_FILENAME) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/806ba12d-a164-41a6-8625-2def7626046a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fs.ts:56',message:'initNotebookCode: checking existing file',data:{filename,notebookFilename:NOTEBOOK_FILENAME},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const existingContent = readIfExist(filename);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/806ba12d-a164-41a6-8625-2def7626046a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fs.ts:57',message:'initNotebookCode: existing file read result',data:{filename,existingContentExists:!!existingContent,existingContentLength:existingContent?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (existingContent) {
        return {
          code: existingContent,
          filename,
        };
      }
      // If filename is specified but file doesn't exist, write to that filename
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/806ba12d-a164-41a6-8625-2def7626046a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fs.ts:74',message:'initNotebookCode: writing to specified filename',data:{filename,codeLength:code?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      FS.writeFile(filename, code);
      currentFilename = filename;
      return {
        code: code,
        filename,
      };
    }

    // If there is no filename, write the code to the last used file
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/806ba12d-a164-41a6-8625-2def7626046a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'fs.ts:85',message:'initNotebookCode: writing to NOTEBOOK_FILENAME',data:{notebookFilename:NOTEBOOK_FILENAME,codeLength:code?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    FS.writeFile(NOTEBOOK_FILENAME, code);
    currentFilename = NOTEBOOK_FILENAME;
    return {
      code: code,
      filename: NOTEBOOK_FILENAME,
    };
  },
};

function syncFileSystem(
  pyodide: PyodideInterface,
  populate: boolean,
): Promise<void> {
  // Sync the filesystem. This brings IndexedDBFS up to date with the in-memory filesystem
  // `true` when starting up, `false` when shutting down
  return new Promise<void>((resolve, reject) => {
    getFS(pyodide).syncfs(populate, (err: unknown) => {
      if (err instanceof Error) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
