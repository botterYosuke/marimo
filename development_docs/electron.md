# Electron Desktop App

## Architecture

```
marimo.exe (Electron)
  ├── electron/entry.cjs       # CJS entry (ELECTRON_RUN_AS_NODE workaround)
  ├── electron/main.js         # Main process (ESM): window mgmt, server spawn
  ├── electron/preload.js      # IPC bridge + DOM fixups + mount config injection
  ├── frontend/dist/           # React frontend (Vite build)
  └── resources/marimo-server.exe  # Python server (PyInstaller one-file)
```

**Flow:** `entry.cjs` → `main.js` → `createNotebookWindow()` → `loadFile(index.html, {notebookPath, port})` + `startServerForWindow({cwd})` → preload injects `__MARIMO_MOUNT_CONFIG__` → frontend connects to `http://localhost:{port}`

## Key Design Decisions

### Template Placeholder Handling

Python server normally renders `index.html` via Jinja (`{{ filename }}`, `{{ mount_config }}`). Electron loads HTML directly via `loadFile()`, so placeholders remain as literals.

**Solution (preload.js):**
1. `__MARIMO_MOUNT_CONFIG__` injected via `Object.defineProperty` (writable: false) — survives HTML inline script overwrite
2. `notebookPath` passed as URL query param (synchronous) — async IPC is too late for module-level `getFilenameFromDOM()`
3. `readystatechange` (`interactive`) clears `{{ }}` before module scripts execute (`DOMContentLoaded` is too late)

### Server CWD

`spawn()` uses `cwd: path.dirname(notebookPath)` so that `os.getcwd()` in the Python server returns the notebook's directory (affects FILES panel).

### Server Process Cleanup (Windows)

Electron終了時に `marimo-server.exe` が残存する問題への対策。`spawn("taskkill", ...)` は非同期のため、`app.quit()` が先に完了してしまう。

**多層防御（`electron/main.js`）:**

| 層 | イベント | 方式 | カバーするケース |
|----|---------|------|----------------|
| 1 | window `closed` | `spawn` (async) | 個別ウィンドウ閉じ（アプリ継続中） |
| 2 | `window-all-closed` | `execSync` (sync) | 全ウィンドウ閉じ→quit ※ただし層1で `serverProcess=null` 済みの場合は no-op |
| 3 | `before-quit` | `execSync` (sync) | Cmd+Q 等でアプリ直接終了 |
| 4 | `process.on("exit")` | `execSync` (sync, 名前ベース) | 最終手段。`taskkill /im marimo-server.exe /f` |

`stopServerForWindow(windowId, { sync })` の `sync` オプションで切り替え。shutdown パスでは `sync: true`、通常のIPC操作（`server:stop`/`server:restart`）ではデフォルト `sync: false`（メインプロセスをブロックしない）。

### Steam Overlay

Requires `nodeIntegration: true` + `contextIsolation: false`. preload.js deletes `window.module/exports/require` to prevent Vite ESM/CJS conflicts.

## Building

```bash
# 1. Python deps (first time)
uv sync --extra electron

# 2. PyInstaller (when marimo/__main__.py or marimo.spec changes)
uv run python -m PyInstaller --clean --noconfirm marimo.spec

# 3. Frontend
pushd frontend && CI=true pnpm run build && popd

# 4. Electron package
pnpm exec electron-builder --win --x64 --dir   # unpacked (dev)
pnpm exec electron-builder --win --x64         # installer

# 5. Run (kill old processes first)
taskkill /f /im marimo.exe 2>nul
taskkill /f /im marimo-server.exe 2>nul
"dist-electron\win-unpacked\marimo.exe"
```

## PyInstaller Notes

- Entry point: `marimo/__main__.py` (must have `multiprocessing.freeze_support()` before Click)
- `marimo.spec` requires explicit `hiddenimports` for dynamically loaded modules:
  - `msgspec` (4 submodules) — serialization
  - `pymdownx` (43 submodules) — Markdown extensions loaded via `marimo/_output/md.py`
  - `markdown.extensions.md_in_html`
- Spawn flags: `--no-token --no-skew-protection --headless` (Electron can't receive tokens via HTML templates)

## Debugging

- Logs: `C:\Users\sasai\AppData\Roaming\marimo\logs\backcast-*.log`
- DevTools: Ctrl+Shift+I
- asar inspect: `npx asar extract dist-electron/win-unpacked/resources/app.asar ./extracted`
- Full debug history: `electron/ELECTRON-DEBUG-LOG.md`

## Common Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| exe exits silently | `ELECTRON_RUN_AS_NODE=1` (VS Code terminal) | `entry.cjs` detects and respawns |
| `aa is not a function` | `vite-plugin-top-level-await` + `nodeIntegration` | Remove the plugin (native TLA works) |
| "untitled" notebook name | `mountConfig.filename` is empty | Pass `notebookPath` via URL query param |
| FILES shows wrong dir | `spawn()` missing `cwd` | Set `cwd: path.dirname(notebookPath)` |
| `ModuleNotFoundError` | PyInstaller misses dynamic imports | Add to `hiddenimports` in `marimo.spec` |
| `marimo-server.exe` remains after quit | async `taskkill` not completing before `app.quit()` | `sync: true` in shutdown paths + `process.on("exit")` last resort |
| Old code runs after rebuild | Installed version at `AppData\Local\Programs\` | Kill all processes, use full path to unpacked exe |
