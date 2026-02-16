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
  console.log('Copying LSP files to marimo/_lsp/...');

  const lspDist = path.join(__dirname, '..', 'packages', 'lsp', 'dist');
  const lspDest = path.join(__dirname, '..', 'marimo', '_lsp');

  // Copy index.cjs
  const indexSrc = path.join(lspDist, 'index.cjs');
  const indexDest = path.join(lspDest, 'index.cjs');
  if (fs.existsSync(indexSrc)) {
    fs.copyFileSync(indexSrc, indexDest);
    console.log('Copied index.cjs');
  }

  // Handle copilot directory - check for different possible locations
  const copilotDest = path.join(lspDest, 'copilot');
  fs.mkdirSync(copilotDest, { recursive: true });

  const possibleSources = [
    path.join(lspDist, 'copilot', 'dist'),
    path.join(lspDist, 'dist'),
    lspDist
  ];

  let copied = false;
  for (const src of possibleSources) {
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      console.log(`Copying from ${src} to ${copilotDest}`);
      const items = fs.readdirSync(src);
      for (const item of items) {
        // Skip index.cjs as we already copied it
        if (item === 'index.cjs') continue;
        const itemPath = path.join(src, item);
        const destPath = path.join(copilotDest, item);
        if (fs.statSync(itemPath).isDirectory() || item !== 'index.cjs') {
          copyRecursiveSync(itemPath, destPath);
        }
      }
      copied = true;
      break;
    }
  }

  if (!copied) {
    console.warn('Warning: Could not find copilot dist directory');
  }

  console.log('LSP files copied successfully');
} catch (err) {
  console.error('Error copying LSP files:', err);
  process.exit(1);
}
