#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  console.log('Copying frontend files to marimo/_static/...');

  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  const staticDest = path.join(__dirname, '..', 'marimo', '_static');

  // Copy all files from frontend/dist to marimo/_static
  copyRecursiveSync(frontendDist, staticDest);

  // Remove wasm-intro.py if it exists
  const wasmIntroPath = path.join(staticDest, 'files', 'wasm-intro.py');
  if (fs.existsSync(wasmIntroPath)) {
    fs.unlinkSync(wasmIntroPath);
  }

  // Copy CLAUDE.md documentation
  const claudeMdSrc = path.join(__dirname, '..', 'docs', '_static', 'CLAUDE.md');
  const claudeMdDest = path.join(staticDest, 'CLAUDE.md');
  if (fs.existsSync(claudeMdSrc)) {
    fs.copyFileSync(claudeMdSrc, claudeMdDest);
    console.log('Copied CLAUDE.md documentation');
  }

  console.log('Frontend files copied successfully');
} catch (err) {
  console.error('Error copying frontend files:', err);
  process.exit(1);
}
