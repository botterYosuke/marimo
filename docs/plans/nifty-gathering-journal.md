# Steam Integration Plan for marimo Electron App

> **実装完了:** 2026-01-28

## Overview

Integrate Steamworks SDK into the existing marimo Electron application to enable publishing on Steam.

## User Requirements
- **App ID**: 取得済み（実際のApp IDに置き換える）
- **機能範囲**: 必須機能のみ（SDK初期化、Overlay、ユーザー認証）
- **フォールバック**: Steamなしでも動作可能（オプショナル）

## Current State

marimo already has a fully functional Electron setup:
- `electron/main.js` - Main process with Python server subprocess management
- `electron/preload.js` - IPC bridge for server communication
- `package.json` - Electron 39.2.7, electron-builder configuration
- Multi-platform builds (Windows, macOS, Linux)
- CI/CD pipeline (`.github/workflows/release-electron.yml`)

## Library Choice: steamworks.js

**Rationale over Greenworks:**
- Actively maintained (Greenworks is effectively abandoned)
- Simple npm install with pre-built binaries
- Native TypeScript support
- Modern Promise-based API
- Better Electron 39+ compatibility

## Implementation Plan

### Phase 1: Core Steam SDK Integration

**Files to modify:**
- [package.json](package.json) - Add steamworks.js dependency
- [electron/main.js](electron/main.js) - Steam initialization and callback loop

**New files to create:**
- `electron/utils/steam.js` - Steam utility functions
- `steam/steam_appid.txt` - Development App ID (480 for testing)

**Key changes to `electron/main.js`:**
```javascript
// Add command-line switches for Steam Overlay
app.commandLine.appendSwitch("in-process-gpu");
app.commandLine.appendSwitch("disable-direct-composition");

// Initialize Steam in app.whenReady()
const steamInitialized = initSteam();

// Start callback loop (Steam requires at least 1/second)
if (steamInitialized) {
  setInterval(() => runCallbacks(), 100);
}

// Enable Steam Overlay after BrowserWindow creation
if (steamInitialized) {
  steamworks.electronEnableSteamOverlay();
}
```

**Note:** Steam Overlay requires:
- `nodeIntegration: true`
- `contextIsolation: false`

### Phase 2: IPC Bridge for Steam Features

**Files to modify:**
- [electron/preload.js](electron/preload.js) - Expose Steam API to renderer
- `frontend/src/custom.d.ts` - Add TypeScript definitions

**Steam API to expose:**
- `achievements.activate(name)` / `isActivated(name)` / `getAll()`
- `cloud.save(filename, data)` / `load(filename)` / `listFiles()`
- `user.getSteamId()` / `getName()`
- `stats.get(name)` / `set(name, value)` / `store()`

### Phase 3: Frontend Steam Module (スキップ)

必須機能のみの実装のため、フロントエンドのSteamモジュールは不要。
Steam Overlayはメインプロセスで有効化され、ユーザー認証はサーバーサイドで処理可能。

### Phase 4: Build Configuration

**Files to modify:**
- [package.json](package.json) - Add Steam DLL extraResources

**Platform-specific DLLs:**
```json
"win": {
  "extraResources": [
    { "from": "node_modules/steamworks.js/dist/win64/steam_api64.dll", "to": "." }
  ]
},
"mac": {
  "extraResources": [
    { "from": "node_modules/steamworks.js/dist/osx/libsteam_api.dylib", "to": "." }
  ]
},
"linux": {
  "extraResources": [
    { "from": "node_modules/steamworks.js/dist/linux64/libsteam_api.so", "to": "." }
  ]
}
```

**New scripts:**
- `build:steam` - Build with Steam DLLs, remove steam_appid.txt
- `upload:steam` - Upload to Steam via ContentBuilder

### Phase 5: Steam ContentBuilder Setup

**New files:**
- `steam/vdf/app_build_XXXXXX.vdf` - App build configuration
- `steam/vdf/depot_build_XXXXXX.vdf` - Windows depot
- `steam/vdf/depot_build_XXXXXX_mac.vdf` - macOS depot
- `steam/vdf/depot_build_XXXXXX_linux.vdf` - Linux depot
- `scripts/prepare-steam-build.js` - Remove steam_appid.txt from production
- `scripts/upload-steam.js` - Automate ContentBuilder upload

### Phase 6: CI/CD Integration

**New file:**
- `.github/workflows/steam-upload.yml` - Automated Steam uploads

**Required GitHub Secrets:**
- `STEAM_USERNAME`
- `STEAM_PASSWORD`
- `STEAM_APP_ID`

## Feature Implementation (Scope: 必須機能のみ)

| Feature | Status | Difficulty |
|---------|--------|------------|
| SDK Initialization | 実装する | Low |
| Callback Loop | 実装する | Low |
| Steam Overlay | 実装する | Medium |
| User Authentication | 実装する | Low |
| Graceful Fallback | 実装する | Low |
| Steam Cloud | スコープ外 | - |
| Achievements | スコープ外 | - |
| Stats/Leaderboards | スコープ外 | - |
| Steam DRM | スコープ外 | - |

## File Summary

### Modified Files
1. `package.json` - Dependencies and build config
2. `electron/main.js` - Steam init, callbacks, overlay
3. `electron/preload.js` - Steam IPC bridge
4. `frontend/src/custom.d.ts` - TypeScript definitions
5. `.github/workflows/release-electron.yml` - Build pipeline

### New Files
1. `electron/utils/steam.js` - Steam utility module
2. `steam/steam_appid.txt` - Dev App ID (本番ビルドには含めない)
3. `steam/vdf/*.vdf` - ContentBuilder scripts
4. `scripts/prepare-steam-build.js` - Build preparation
5. `scripts/upload-steam.js` - Steam upload automation
6. `.github/workflows/steam-upload.yml` - CI/CD workflow

## Verification Plan

1. **Development Testing:**
   - Create `steam/steam_appid.txt` with test App ID (480)
   - Start Steam client
   - Run `pnpm start` - verify Steam initializes
   - Check console for "Steam initialized successfully"
   - Press Shift+Tab to verify Steam Overlay

2. **Build Testing:**
   - Run `pnpm dist:electron`
   - Verify Steam DLLs are in resources folder
   - Verify steam_appid.txt is NOT in production build
   - Run built app with Steam client - verify features work

3. **Steam Partner Testing:**
   - Create app in Steam Partner site
   - Configure depots and builds
   - Upload via ContentBuilder
   - Install via Steam client on beta branch
   - Verify all features work through Steam

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Steam client not running | Graceful fallback - app works without Steam |
| Overlay rendering issues | Use requestAnimationFrame loop |
| contextIsolation: false security | Only for Steam builds, validate inputs |
| Platform DLLs missing | Validate in build script |

## Prerequisites (Steam Partner Site)

**完了済み:**
- [x] Steamworks Partner アカウント作成
- [x] App ID 取得

**実装時に必要:**
1. 実際のApp IDを `steam/steam_appid.txt` と `electron/utils/steam.js` に設定
2. Steam Partner サイトでデポ（Windows/macOS/Linux）を設定
3. ストアページの準備（名前、説明、スクリーンショット等）
4. ContentBuilder の設定と初回アップロード
