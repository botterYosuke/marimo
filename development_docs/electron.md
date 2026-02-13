# Electron Desktop App

## 進捗状況 (2026-02-14 更新)

### 完了済み

- ✅ サーバープロセス残留問題の修正 — `sync: true` による確実な kill（コミット `6b31c8b`）
- ✅ Electron起動不可問題の修正（コミット `1bf16fb`）
- ✅ 終了しない問題の修正（コミット `f9a04df`）
- ✅ Vite minifier を `oxc` → `esbuild` に変更（コミット `29139f7`）
- ✅ リファクタリング Step 1-7 全完了（コミット `647bd4a`）
  - ✅ Step 1: paths.js デッドコード削除（未使用4関数）
  - ✅ Step 2: `normalizePathForComparison` 共通化
  - ✅ Step 3: IPCハンドラ重複削除（`notebook:open` → `notebook:open-in-new-window` に統合）
  - ✅ Step 4: `createWindow` ラッパー削除
  - ✅ Step 5: ヘルスチェック関数 `checkServerHealth()` 抽出
  - ✅ Step 6: `server:restart` の待機改善（setTimeout → Promise await）
  - ✅ Step 7: `findAvailablePort` ループ化（再帰 → while + MAX_ATTEMPTS=100）
- ✅ 開発モード不具合修正（3件セット）
  - ✅ 修正1: ポート不一致 — 開発モードでポート2718固定（`main.js:141-143`）
  - ✅ 修正2: CORS回避 — `preload.js` で `window.location.origin` 使用 + Vite proxy に `/health` `/healthz` 追加
  - ✅ 修正3: skew protection — `start-server.js` に `--no-skew-protection` 追加
- ✅ ポート占有時のエラーハンドリング追加（`findAvailablePort` throw 時の graceful degradation）
  - `createNotebookWindow` に try-catch 追加 → `dialog.showErrorBox` でユーザー通知
  - IPC ハンドラ `openNotebookInNewWindow` で `null` チェック → `{ success: false }` を返す
  - 初回起動失敗時に `app.quit()` でアプリ終了
- ✅ サーバークラッシュ時の自動再起動（`main.js` exit ハンドラ改修）
  - 予期しないクラッシュ検知 → 2秒待機後に自動再起動（最大3回/30秒）
  - クラッシュループ防止カウンター付き（30秒安定でリセット）
  - 元提案: `development_docs/serene-whistling-beacon.md`

### 未着手 / 検討中

- notebook-injector.js のパーサー脆弱性（ネストされた `{}` 非対応）— 現状運用上問題なし
- main.js のモジュール分割（711行 → server-manager.js / steam.js）— 状態共有の設計が必要

---

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

### Port Management — 開発モード vs 本番モード

```
【開発モード (app.isPackaged === false)】
  ポート: 2718 固定（scripts/start-server.js がサーバーを起動済み）
  通信: Electron → Vite(:3000) → proxy → marimo(:2718)
  サーバー起動: main.js は行わない
  runtimeConfig.url: window.location.origin（= Vite dev server）

【本番モード (app.isPackaged === true)】
  ポート: findAvailablePort(nextPort) で動的確保
  通信: Electron → marimo(:port) 直接
  サーバー起動: createNotebookWindow → startServerForWindow
  runtimeConfig.url: http://localhost:${port}（= marimo サーバー直接）
```

> **重要:** 開発モードでフロントエンドが marimo サーバーに直接アクセスすると CORS エラーになる。必ず Vite proxy 経由にすること。`preload.js` の `runtimeConfig.url` で制御される。

`findAvailablePort()` は `MAX_ATTEMPTS=100` でポートスキャンし、全て占有されていた場合は throw する。この throw は `createNotebookWindow` 内で try-catch され、`dialog.showErrorBox` でユーザーに通知後 `null` を返す。呼び出し元は `null` チェックが必要：

| 呼び出し元 | null 時の動作 |
|-----------|-------------|
| `openNotebookInNewWindow()` IPC | `{ success: false, error: "..." }` を返す |
| `app.whenReady` (初回起動) | `app.quit()` でアプリ終了 |
| `app.on("activate")` | エラーダイアログ表示のみ（追加処理なし） |

### Server CWD

`spawn()` uses `cwd: path.dirname(notebookPath)` so that `os.getcwd()` in the Python server returns the notebook's directory (affects FILES panel).

### Server Process Cleanup (Windows)

Electron終了時に `marimo-server.exe` が残存する問題への対策。

**根本原因（2026-02-13 調査）:**
`window.on("closed")` → `stopServerForWindow(sync=false)` → `windows.delete()` の順で実行されるため、後続の `window-all-closed` / `before-quit` では Map が空になっており `sync: true` パスが一度も通らなかった。実際にプロセスを kill していたのは `process.on("exit")` のラストリゾート (`taskkill /im`) だった。

```
[DEBUG実測] イベント順序:
  window.on("closed")     → sync=false で taskkill spawn + windows.delete() → Map 空
  window-all-closed        → stopAllServers({sync:true}) → Map 空、何もしない
  before-quit              → stopAllServers({sync:true}) → Map 空、何もしない
  process.on("exit")       → taskkill /im marimo-server.exe /f → ★これが実際に kill
```

**修正:** `window.on("closed")` でも `sync: true` を使い、`execSync` で確実に kill してから `windows.delete()` する。

**多層防御（`electron/main.js`）:**

| 層 | イベント | 方式 | カバーするケース |
|----|---------|------|----------------|
| 1 | window `closed` | `execSync` (sync) | 個別ウィンドウ閉じ → PID指定で確実に kill |
| 2 | `window-all-closed` | `execSync` (sync) | 全ウィンドウ閉じ→quit（層1で `serverProcess=null` 済みなら no-op） |
| 3 | `before-quit` | `execSync` (sync) | Cmd+Q 等でアプリ直接終了 |
| 4 | `process.on("exit")` | `execSync` (sync, 名前ベース) | 最終手段。`taskkill /im marimo-server.exe /f` |

`stopServerForWindow(windowId, { sync })` の `sync` オプションで切り替え。shutdown パスでは `sync: true`、通常のIPC操作（`server:stop`/`server:restart`）ではデフォルト `sync: false`（メインプロセスをブロックしない）。

### Server Crash Recovery（自動再起動）

`marimo-server.exe` が予期せずクラッシュした場合、自動で再起動する仕組み。

**問題:** サーバークラッシュ時、Electron は検知するがフロントエンドに `STOPPED` を通知するだけで行き止まりになっていた。`ReconnectingWebSocket` が最大10回、`/health` ポーリングが最大25回リトライするが、サーバーが死んでいるため全て失敗する。

**設計のキーポイント — ステータス遷移を利用したクラッシュ判定:**

```
意図的な停止:  stopServerForWindow() → status = STOPPED → kill → exit イベント発火 → status は STOPPED
予期しない停止: サーバークラッシュ → exit イベント発火 → status は STARTING or RUNNING のまま
```

`stopServerForWindow()` は kill **する前に** `status = STOPPED` をセットする（`main.js:394`）。したがって exit ハンドラ内で `status !== STOPPED` であれば予期しないクラッシュと判定できる。新たなフラグ変数は不要。

**クラッシュループ防止:** `WindowInfo` に `crashCount` / `lastCrashTime` を追加。30秒以内に3回クラッシュしたら再起動を断念してエラーログのみ出力。30秒以上安定したらカウンターをリセット。

**ポート再利用の安全性:** `exit` イベントはプロセス終了後に発火するため、ポートは既に解放済み。さらに2秒の待機を入れているため確実。

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

## Development Mode (`pnpm start`)

### 起動の仕組み

```
pnpm start
  └── concurrently
        ├── pnpm dev
        │     ├── Vite dev server (:3000)    ← フロントエンド HMR
        │     └── start-server.js → marimo edit (:2718)  ← Python バックエンド
        └── pnpm start:electron
              └── wait-on :3000 + :2718 → electron .  ← 両方 ready 後に起動
```

### 開発モード固有の設定

| 設定項目 | 開発モード | 本番モード |
|---------|-----------|-----------|
| ポート決定 | `2718` 固定 | `findAvailablePort(nextPort)` |
| サーバー起動 | `start-server.js`（外部） | `startServerForWindow()`（main.js内） |
| フロントエンド配信 | Vite dev server (:3000) | `loadFile(frontend/dist/index.html)` |
| `runtimeConfig.url` | `window.location.origin` | `http://localhost:${port}` |
| skew protection | `--no-skew-protection`（start-server.js） | `--no-skew-protection`（main.js:308） |

### よくあるトラブル

1. **`Port 3000 is in use`** — 前回の Vite dev server が残留。`taskkill /f /im node.exe` で全停止
2. **Vite が 3001/3002 で起動** — `wait-on :3000` が前回の残留プロセスで成功してしまう。全プロセス停止後に再実行
3. **CORS エラー** — `preload.js` の `runtimeConfig.url` が `:2718` を直接指している可能性。`window.location.origin` を使うこと
4. **401 Unauthorized** — `start-server.js` に `--no-skew-protection` が欠落していないか確認

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
| CORS error in dev mode | preload が `runtimeConfig.url` を `:2718` に直接設定 | 開発モードでは `window.location.origin` を使用 |
| 401 Unauthorized in dev mode | `start-server.js` に `--no-skew-protection` が欠落 | spawn 引数に追加 |
| `Port 3000 is in use` | 前回の Vite dev server が残留 | `taskkill /f /im node.exe` で全プロセス停止 |
| Port mismatch (dev mode) | `findAvailablePort(2718)` が2719を返す | 開発モードでは 2718 固定 |

## Tips（他の作業者向け）

### `createNotebookWindow` の戻り値に注意
この関数はポート確保失敗時に `null` を返す。新しい呼び出し元を追加する場合は必ず `null` チェックを行うこと。

### `--no-token` と `--no-skew-protection` は両方必要
Electron では HTML テンプレート経由のトークン注入ができないため、サーバー起動引数に**両方**を指定する。片方だけだと 401 エラーになる。`start-server.js`（開発用）と `main.js:308`（本番用）の両方で設定されていることを確認。

### Vite proxy に新しいエンドポイントを追加する場合
開発モードでは Vite dev server(:3000) がフロントエンドを配信し、バックエンド(:2718) へのリクエストは Vite proxy で中継される。新しいAPIパスを追加した場合は `frontend/vite.config.mts` の proxy 設定にも追加が必要。現在のproxy対象:

```
/api, /auth, /@file, /mpl, /custom.css, /health, /healthz, /ws, /ws_sync, /lsp, /terminal/ws
```

### `sync: true` / `sync: false` の使い分け
- **shutdown パス**（`window.closed`, `window-all-closed`, `before-quit`）: `sync: true` — `execSync` でプロセス終了を保証
- **通常の IPC 操作**（`server:stop`, `server:restart`）: `sync: false` — メインプロセスをブロックしない

### exit ハンドラの status 判定パターン
`serverProcess.on("exit")` 内で `windowInfo.status !== STOPPED` を見ることで、意図的停止かクラッシュかを区別している。このパターンは `stopServerForWindow()` が kill 前に必ず `STOPPED` をセットすることに依存しているため、**`stopServerForWindow` の先頭で status を変更する順序を崩さないこと**。

### クラッシュ再起動のテスト方法
1. 本番ビルドでアプリ起動
2. タスクマネージャーで `marimo-server.exe` を手動 kill
3. ログに `Unexpected server exit ... restarting (attempt 1/3)` が出て2秒後に復帰することを確認
4. 3回連続 kill → 4回目は `crashed 4 times in 30s, giving up` でエラー停止
5. 30秒以上待ってから再度 kill → カウンターリセットされ再起動される

### ビルド後に変更が反映されない場合
`AppData\Local\Programs\marimo\` にインストール済みバージョンがあると、そちらが起動されることがある。必ずフルパス `dist-electron\win-unpacked\marimo.exe` で実行するか、`taskkill /f /im marimo.exe` で先に停止する。

### 開発モードのプロセス残留に注意
`pnpm start` を Ctrl+C で停止しても node プロセスが残ることがある。次回起動前に `taskkill /f /im node.exe` でクリーンアップするのが安全。残留プロセスがあると Vite が別ポート（3001, 3002）で起動し、`wait-on` との不整合が発生する。

## 関連ドキュメント

| ファイル | 内容 |
|---------|------|
| `development_docs/federated-launching-crab.md` | コードレビュー結果（リファクタリング項目 #1-#9） |
| `development_docs/majestic-yawning-codd.md` | 開発モード修正 + リファクタリング Step 1-7 詳細 |
| `development_docs/serene-whistling-beacon.md` | ポート占有対策案（元提案） |
