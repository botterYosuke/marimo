/* Copyright 2026 Marimo. All rights reserved. */

import type { PyodideInterface } from "pyodide";
import {
  createRPC,
  createRPCRequestHandler,
  createWorkerParentTransport,
  type RPCSchema,
} from "rpc-anywhere";
import type { SaveNotebookRequest } from "@/core/network/types";
import { decodeUtf8 } from "@/utils/strings";
import { prettyError } from "../../../utils/errors";
import { Logger } from "../../../utils/Logger";
import type { ParentSchema } from "../rpc";
import { TRANSPORT_ID } from "./constants";
import { WasmFileSystem } from "./fs";
import { getController } from "./getController";
import { getPyodideVersion } from "./getPyodideVersion";

/**
 * Web worker responsible for saving the notebook.
 */

declare const self: Window & {
  pyodide: PyodideInterface;
};

// Initialize
async function loadPyodideAndPackages() {
  try {
    // Import pyodide
    const marimoVersion = getMarimoVersion();
    const pyodideVersion = getPyodideVersion(marimoVersion);

    // Bootstrap the controller
    const controller = await getController(marimoVersion);
    self.controller = controller;
    self.pyodide = await controller.bootstrap({
      version: marimoVersion,
      pyodideVersion: pyodideVersion,
    });

    // Mount the filesystem
    await controller.mountFilesystem?.({
      code: "",
      filename: null,
    });

    rpc.send.initialized({});
  } catch (error) {
    Logger.error("Error bootstrapping", error);
    rpc.send.initializedError({ error: prettyError(error) });
  }
}

const pyodideReadyPromise = loadPyodideAndPackages();

// Handle RPC requests
const requestHandler = createRPCRequestHandler({
  readFile: async (filename: string) => {
    await pyodideReadyPromise; // Make sure loading is done
    const file = decodeUtf8(self.pyodide.FS.readFile(filename));
    return file;
  },
  readNotebook: async () => {
    await pyodideReadyPromise; // Make sure loading is done
    return WasmFileSystem.readNotebook(self.pyodide);
  },
  saveNotebook: async (opts: SaveNotebookRequest) => {
    await pyodideReadyPromise; // Make sure loading is done
    // Use opts.filename if provided (from save-component.tsx), otherwise use getCurrentFilename()
    // This ensures we use the filename that was determined by save-component.tsx
    const filename = opts.filename || WasmFileSystem.getCurrentFilename();
    // Ensure the file exists in the filesystem before calling save_file
    // save-worker.ts is a separate worker instance, so it may not have the same files
    // that were created in worker.ts. We need to create the file if it doesn't exist.
    const FS = self.pyodide.FS;
    try {
      // Try to read the file to check if it exists
      FS.readFile(filename);
    } catch (e) {
      // File doesn't exist, create it with empty content
      // save_file will overwrite it with the actual content
      FS.writeFile(filename, "");
    }
    const saveFile = self.pyodide.runPython(`
      from marimo._pyodide.bootstrap import save_file

      save_file
    `);
    await saveFile(JSON.stringify(opts), filename);
    await WasmFileSystem.persistFilesToRemote(self.pyodide);
  },
});

// create the iframe's schema
export type SaveWorkerSchema = RPCSchema<
  {
    messages: {
      // Emitted when the worker is ready
      ready: {};
      // Emitted when the Pyodide is initialized
      initialized: {};
      // Emitted when the Pyodide fails to initialize
      initializedError: { error: string };
    };
  },
  typeof requestHandler
>;

const rpc = createRPC<SaveWorkerSchema, ParentSchema>({
  transport: createWorkerParentTransport({
    transportId: TRANSPORT_ID,
  }),
  requestHandler,
});

rpc.send("ready", {});

function getMarimoVersion() {
  return self.name; // We store the version in the worker name
}
