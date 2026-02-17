#!/usr/bin/env node

/**
 * Prepare resources for Tauri bundle
 * This script copies the marimo source and pyproject.toml to the src-tauri directory
 * so they can be bundled with the application.
 */

const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const rootDir = path.join(__dirname, '..');
const srcTauriDir = __dirname;
const resourcesDir = path.join(srcTauriDir, 'resources');

// Create resources directory if it doesn't exist
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

console.log('Preparing resources for Tauri bundle...');

// Copy marimo source directory
const marimoSrc = path.join(rootDir, 'marimo');
const marimoDest = path.join(resourcesDir, 'marimo');
console.log(`Copying marimo source: ${marimoSrc} -> ${marimoDest}`);
if (fs.existsSync(marimoSrc)) {
  copyRecursive(marimoSrc, marimoDest);
  console.log('✓ marimo source copied');
} else {
  console.error('✗ marimo source directory not found!');
  process.exit(1);
}

// Copy pyproject.toml
const pyprojectSrc = path.join(rootDir, 'pyproject.toml');
const pyprojectDest = path.join(resourcesDir, 'pyproject.toml');
console.log(`Copying pyproject.toml: ${pyprojectSrc} -> ${pyprojectDest}`);
if (fs.existsSync(pyprojectSrc)) {
  fs.copyFileSync(pyprojectSrc, pyprojectDest);
  console.log('✓ pyproject.toml copied');
} else {
  console.error('✗ pyproject.toml not found!');
  process.exit(1);
}

// Copy other necessary files
const otherFiles = ['LICENSE', 'README.md', 'MANIFEST.in'];
otherFiles.forEach(file => {
  const srcFile = path.join(rootDir, file);
  const destFile = path.join(resourcesDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`✓ ${file} copied`);
  }
});

// Verify static assets after copying marimo source
const staticAssetsDir = path.join(marimoDest, '_static', 'assets');
if (fs.existsSync(staticAssetsDir)) {
  const assetsCount = fs.readdirSync(staticAssetsDir).length;
  console.log(`✓ _static/assets contains ${assetsCount} files`);

  if (assetsCount < 10) {
    console.error('\n❌ CRITICAL: Too few asset files!');
    console.error(`Expected 100+ files, but found only ${assetsCount}`);
    console.error('Frontend may not be built correctly.');
    console.error('Please run: ./scripts/buildfrontend.sh');
    process.exit(1);
  }
} else {
  console.error('\n❌ CRITICAL: _static/assets directory not found!');
  console.error('Frontend has not been built.');
  console.error('Please run: ./scripts/buildfrontend.sh');
  process.exit(1);
}

// Copy src-tauri/sample-notebooks to src-tauri/resources/files
const filesSourceDir = path.join(srcTauriDir, 'sample-notebooks');
const filesDestDir = path.join(resourcesDir, 'files');
if (fs.existsSync(filesSourceDir)) {
  copyRecursive(filesSourceDir, filesDestDir);
  console.log('✅ Copied sample-notebooks/ to resources/files');
} else {
  console.error('✗ sample-notebooks/ directory not found!');
  process.exit(1);
}

console.log('\nResources prepared successfully!');
console.log(`Resources directory: ${resourcesDir}`);
