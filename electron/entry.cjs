/* Copyright 2026 Marimo. All rights reserved. */

// When launched from environments like VS Code's integrated terminal,
// ELECTRON_RUN_AS_NODE=1 may be inherited from the parent process.
// This forces the Electron binary to run as plain Node.js — no GUI,
// no built-in 'electron' module, and the app silently exits.
//
// The env var is checked at Electron startup (before user code runs),
// so simply deleting it here is too late. We must re-launch the process
// without the variable so Electron initializes in normal GUI mode.

if (process.env.ELECTRON_RUN_AS_NODE) {
  const { spawn } = require("node:child_process");

  // Remove the offending variable
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  // Re-launch ourselves as a proper Electron app
  const child = spawn(process.execPath, process.argv.slice(1), {
    env,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  process.exit(0);
}

// Normal Electron mode — dynamically import the ESM entry point.
import("./main.js");
