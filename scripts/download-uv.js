#!/usr/bin/env node
/**
 * Download the uv binary for the current platform.
 * Places it in src-tauri/binaries/ for bundling with the Tauri app.
 *
 * Usage:
 *   node scripts/download-uv.js
 *
 * The script auto-detects the platform and downloads the appropriate binary
 * from the official uv GitHub releases.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// uv version to download
const UV_VERSION = "0.7.12";

// Platform mapping: { [nodejs_platform-arch]: { archive, binary } }
const PLATFORMS = {
  "win32-x64": {
    archive: `uv-x86_64-pc-windows-msvc.zip`,
    binary: "uv.exe",
  },
  "win32-arm64": {
    archive: `uv-aarch64-pc-windows-msvc.zip`,
    binary: "uv.exe",
  },
  "darwin-x64": {
    archive: `uv-x86_64-apple-darwin.tar.gz`,
    binary: "uv",
  },
  "darwin-arm64": {
    archive: `uv-aarch64-apple-darwin.tar.gz`,
    binary: "uv",
  },
  "linux-x64": {
    archive: `uv-x86_64-unknown-linux-musl.tar.gz`,
    binary: "uv",
  },
  "linux-arm64": {
    archive: `uv-aarch64-unknown-linux-musl.tar.gz`,
    binary: "uv",
  },
};

function getPlatformKey() {
  const platform = os.platform();
  const arch = process.env.UV_ARCH || os.arch();
  return `${platform}-${arch}`;
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const handler = (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location;
        const protocol = redirectUrl.startsWith("https") ? https : http;
        protocol.get(redirectUrl, handler).on("error", reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    };

    https.get(url, handler).on("error", reject);
  });
}

async function extractTarGz(buffer, destDir, binaryName) {
  // Write to temp file and extract using tar
  const tmpFile = path.join(os.tmpdir(), `uv-${Date.now()}.tar.gz`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    execSync(`tar -xzf "${tmpFile}" -C "${destDir}"`, { stdio: "pipe" });

    // Find the binary in extracted files (may be in a subdirectory)
    const files = fs.readdirSync(destDir, { recursive: true });
    for (const file of files) {
      const filePath = path.join(destDir, file.toString());
      if (path.basename(filePath) === binaryName && fs.statSync(filePath).isFile()) {
        // Move to destDir root if in subdirectory
        const targetPath = path.join(destDir, binaryName);
        if (filePath !== targetPath) {
          fs.renameSync(filePath, targetPath);
        }
        // Make executable
        fs.chmodSync(targetPath, 0o755);
        return targetPath;
      }
    }
    throw new Error(`Binary "${binaryName}" not found in archive`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

async function extractZip(buffer, destDir, binaryName) {
  // Write to temp file and extract using PowerShell (Windows)
  const tmpFile = path.join(os.tmpdir(), `uv-${Date.now()}.zip`);
  const tmpExtract = path.join(os.tmpdir(), `uv-extract-${Date.now()}`);
  fs.writeFileSync(tmpFile, buffer);
  fs.mkdirSync(tmpExtract, { recursive: true });

  try {
    execSync(
      `powershell -Command "Expand-Archive -Path '${tmpFile}' -DestinationPath '${tmpExtract}' -Force"`,
      { stdio: "pipe" }
    );

    // Find the binary in extracted files
    const files = fs.readdirSync(tmpExtract, { recursive: true });
    for (const file of files) {
      const filePath = path.join(tmpExtract, file.toString());
      if (path.basename(filePath) === binaryName && fs.statSync(filePath).isFile()) {
        const targetPath = path.join(destDir, binaryName);
        fs.copyFileSync(filePath, targetPath);
        return targetPath;
      }
    }
    throw new Error(`Binary "${binaryName}" not found in archive`);
  } finally {
    fs.unlinkSync(tmpFile);
    fs.rmSync(tmpExtract, { recursive: true, force: true });
  }
}

async function main() {
  const platformKey = getPlatformKey();
  const config = PLATFORMS[platformKey];

  if (!config) {
    console.error(`Unsupported platform: ${platformKey}`);
    console.error(`Supported platforms: ${Object.keys(PLATFORMS).join(", ")}`);
    process.exit(1);
  }

  const destDir = path.resolve(__dirname, "..", "src-tauri", "binaries");
  fs.mkdirSync(destDir, { recursive: true });

  const url = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${config.archive}`;
  console.log(`Downloading uv ${UV_VERSION} for ${platformKey}...`);
  console.log(`  URL: ${url}`);

  const buffer = await downloadFile(url);
  console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  let binaryPath;
  if (config.archive.endsWith(".zip")) {
    binaryPath = await extractZip(buffer, destDir, config.binary);
  } else {
    binaryPath = await extractTarGz(buffer, destDir, config.binary);
  }

  console.log(`  Extracted to: ${binaryPath}`);

  // Clean up extracted subdirectories (tar creates them)
  const entries = fs.readdirSync(destDir);
  for (const entry of entries) {
    const entryPath = path.join(destDir, entry);
    if (fs.statSync(entryPath).isDirectory()) {
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
  }

  console.log(`Done! uv binary ready at: ${destDir}/${config.binary}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
