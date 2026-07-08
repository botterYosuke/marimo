#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

// Copy node_modules/@github/copilot-language-server/dist/ to dist/
// Try local node_modules first, then check root node_modules (for pnpm hoisted mode)
let srcDir = path.join(
  __dirname,
  "node_modules/@github/copilot-language-server/dist",
);

if (!fs.existsSync(srcDir)) {
  // Try root node_modules (pnpm hoisted mode)
  srcDir = path.join(
    __dirname,
    "../../node_modules/@github/copilot-language-server/dist",
  );
}

const destDir = path.join(__dirname, "dist");

// Recursively copy directory
fs.cpSync(srcDir, destDir, { recursive: true, dereference: true });

// Rename language-server.js to language-server.cjs
const oldPath = path.join(destDir, "language-server.js");
const newPath = path.join(destDir, "language-server.cjs");
fs.renameSync(oldPath, newPath);

// oxlint-disable-next-line no-console -- build script
console.log("Successfully copied and renamed language-server files");
