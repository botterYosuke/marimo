# marimo Tauri 2.0 デスクトップアプリ追加計画

## Context

marimo はブラウザベースのリアクティブ Python ノートブックアプリ。現在はブラウザでのみ動作する。Tauri 2.0 でデスクトップアプリ版を追加し、ネイティブウィンドウでの利用を可能にする。バイナリサイズ ~10MB、システム WebView 利用で軽量。

**起点ブランチ: `sasa/main`**（Electron コードは存在しない。完全に新規実装）

## アーキテクチャ概要

```
Tauri Main Process (Rust)
  └── marimo server (1 process, dynamic port)
       ├── Window 1: http://localhost:PORT/            (ホームページ)
       ├── Window 2: http://localhost:PORT/?file=a.py  (ノートブック)
       └── Window 3: http://localhost:PORT/?file=b.py  (ノートブック)
```

- **1 Server + Multi-Window 構成**: 全ウィンドウが同一 marimo サーバーを共有
- **HTTP 配信**: 全ウィンドウが `http://localhost:PORT` をロード（Tauri カスタムプロトコル不使用）
- サーバーが HTML テンプレートに mount config を注入（`templates.py:98-138`）→ `initialization_script` 不要
- ファイル引数なしでサーバー起動 → ホームページ（最近のファイル一覧、実行中ノートブック管理）が利用可能
- marimo の `SessionManager` によるセッション管理をそのまま活用
- **ランタイム sandbox**: `uv` バイナリのみ同梱し、初回起動時に Python + marimo の venv を自動構築（PyInstaller 不使用）

ブラウザ版との対応:
| ブラウザ版 | Tauri 版 |
|-----------|----------|
| ブラウザタブ | WebviewWindow |
| `<a target="...">` で新タブ | リンクインターセプトで新ウィンドウ |
| 1サーバーが複数セッション管理 | 同じ (変更なし) |
| `http://localhost:PORT` | 同じ (file:// は使わない) |

## 重要な設計判断

1. **1サーバー + マルチウィンドウ** — marimo の `SessionManager` がセッション管理を行い、ホームページ・最近のファイル・実行中ノートブック一覧がそのまま動作する
2. **HTTP 配信 (frontendDist 不使用)** — 常に `http://localhost:PORT` を参照。CORS 問題なし、localStorage のオリジンがブラウザ版と同一、テンプレートプレースホルダ問題なし
3. **ランタイム sandbox (PyInstaller 廃止)** — `uv` バイナリのみ同梱し、初回起動時に `uv venv` + `uv pip install marimo` で venv を構築。通常の Python 環境で marimo を実行するため、`sys.executable`, `importlib.resources`, `multiprocessing` 等の PyInstaller 固有の問題がすべて解消。marimo の Python 側コード変更が不要
4. **リンクインターセプト** — `initialization_script` で JS を注入し、`<a target>` リンクの click イベントを capture phase で補足。`window.__TAURI_INTERNALS__.invoke()` で Rust 側の `window_open_notebook` を呼び新 WebviewWindow を生成。`e.stopPropagation()` で `tauri-plugin-shell` の競合ハンドラをブロック
5. **メニュー accelerator 最小化** — marimo のホットキーシステム (`hotkeys.ts`) との競合を回避

## 参照すべき既存コード

| ファイル | 役割 |
|---------|------|
| `marimo/_server/api/endpoints/assets.py:193-231` | `/` ルートハンドラ — `?file=` の有無でホーム/ノートブック判定、mount config 注入 |
| `marimo/_server/templates/templates.py:46-138` | `_get_mount_config()`, `home_page_template()` — mount config の生成・HTML 埋め込み |
| `frontend/src/components/pages/home-page.tsx:69-72, 329-330, 414` | `tabTarget()` + `<a target>` — リンクインターセプトの対象 |
| `frontend/src/core/packages/useInstallPackage.ts` | パッケージインストール UI → HTTP API |
| `marimo/_server/api/endpoints/packages.py:31-60` | パッケージインストール API |
| `frontend/src/mount.tsx:135-253` | マウント設定の zod スキーマ |
| `frontend/src/main.tsx` | `window.__MARIMO_MOUNT_CONFIG__` を読むエントリ |
| `frontend/src/core/runtime/runtime.ts` | RuntimeManager — `runtimeConfig.url` でサーバー接続 |
| `frontend/src/core/runtime/config.ts` | `DEFAULT_RUNTIME_CONFIG`, `runtimeConfigAtom` |
| `frontend/vite.config.mts:20-77` | `htmlDevPlugin()` — 開発モードでサーバー HTML を取得してマージ |
| `marimo/_server/start.py` | バックエンド起動ロジック |
| `marimo/_server/session_manager.py` | セッション管理 (複数ノートブック) |
| `marimo/_utils/uv.py` | `find_uv_bin()` — `UV` 環境変数で uv バイナリパスを制御 |
| `marimo/_cli/sandbox.py:502-600` | `build_sandbox_venv()` — 参考にした sandbox パターン |
| `frontend/src/components/editor/controls/shutdown-button.tsx:28` | `sendShutdown()` → `window.close()` — Shutdown ボタン |
| `frontend/src/core/hotkeys/hotkeys.ts` | marimo 独自ホットキーシステム — メニュー accelerator との競合に注意 |
| `frontend/src/utils/download.ts` | `URL.createObjectURL(blob)` + `<a download>` — Blob URL ダウンロード |

---

## Phase 1: Tauri プロジェクト初期設定 ✅

### 1.1 `src-tauri/` ディレクトリ作成

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── build.rs
├── capabilities/
│   └── default.json
├── binaries/                  # ビルド時に uv バイナリを配置
├── icons/                     # アプリアイコン（Tauri デフォルト）
└── src/
    ├── main.rs
    └── lib.rs
```

### 1.2 `src-tauri/tauri.conf.json` ✅ 実装済み (実際の値)

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "marimo",
  "version": "0.1.0",
  "identifier": "com.marimo.desktop",
  "build": {
    "frontendDist": "../frontend/dist",
    "devUrl": "http://localhost:2718",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "security": {
      "csp": "default-src http://localhost:* ws://localhost:*; script-src http://localhost:* 'unsafe-inline' 'unsafe-eval'; style-src http://localhost:* 'unsafe-inline'; img-src http://localhost:* data: blob:; font-src http://localhost:* data:; connect-src http://localhost:* ws://localhost:* blob: data:; media-src http://localhost:* blob:; worker-src http://localhost:* blob:; frame-src http://localhost:* blob:"
    },
    "withGlobalTauri": true
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg", "appimage"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "resources": [],
    "windows": {
      "webviewInstallMode": { "type": "downloadBootstrapper" },
      "nsis": { "installMode": "perMachine" }
    }
  }
}
```

- `frontendDist: "../frontend/dist"` — 文字列型必須（`false` や `null` は不可）。本番ビルドで使用。dev モードでは使用されない
- `"withGlobalTauri": true` — `window.__TAURI_INTERNALS__` を公開。`LINK_INTERCEPT_JS` の `invoke()` に必須
- `app.windows` は **定義しない** — `setup` フック内で `WebviewWindowBuilder` を使い手動生成（`initialization_script` 注入のため）
- CSP に `blob:`, `data:` を各ディレクティブに追加（marimo の Blob URL ダウンロード、data URI、Service Worker 等に必要）
- `resources` は開発時は空リスト（本番ビルド時に `["binaries/uv*"]` に変更）

### 1.3 `src-tauri/Cargo.toml`

```toml
[package]
name = "marimo-desktop"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
log = "0.4"
env_logger = "0.11"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

### 1.4 `src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "description": "Default capabilities for marimo desktop",
  "windows": ["main", "notebook-*"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-open",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file"
  ]
}
```

---

## Phase 2: ランタイム sandbox 環境構築 ✅

PyInstaller を使わず、`uv` バイナリのみ同梱して初回起動時に Python + marimo の venv を自動構築する。
marimo の `sandbox.py:502-600` (`build_sandbox_venv()`) と同じパターン。

### 2.1 `environment/` モジュール

```
src-tauri/src/environment/
├── mod.rs
├── bootstrap.rs       # Python DL + venv + marimo install
└── version.rs         # MARIMO_VERSION 管理
```

### 2.2 uv バイナリの同梱

ビルド時に `scripts/download-uv` で対象プラットフォームの `uv` をダウンロードし `src-tauri/binaries/` に配置:
- Windows: `binaries/uv.exe`
- macOS/Linux: `binaries/uv`

`tauri.conf.json` の `bundle.resources` でバンドル。

### 2.3 `environment/bootstrap.rs` — 環境構築

```rust
const MARIMO_VERSION: &str = "0.13.0"; // Tauri リリースに合わせて固定

pub fn get_venv_python(env_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        env_dir.join("Scripts").join("python.exe")
    } else {
        env_dir.join("bin").join("python")
    }
}

pub fn is_environment_ready(env_dir: &Path) -> bool {
    get_venv_python(env_dir).exists()
}

pub async fn ensure_environment(uv_bin: &Path, env_dir: &Path, on_progress: impl Fn(&str)) -> Result<()> {
    // 1. Python の確保
    on_progress("Checking Python...");
    let python = uv_python_find(uv_bin);
    if python.is_none() {
        on_progress("Installing Python (this may take a minute)...");
        uv_python_install(uv_bin, "3.13")?;
    }
    let python = uv_python_find(uv_bin)
        .ok_or_else(|| anyhow!("Python installation failed"))?;

    // 2. venv の作成 (なければ)
    if !env_dir.exists() {
        on_progress("Creating environment...");
        Command::new(uv_bin)
            .args(["venv", "--seed", "--python", &python, env_dir.to_str().unwrap()])
            .status()?;
    }

    // 3. marimo のインストール/更新
    on_progress("Installing marimo...");
    let venv_python = get_venv_python(env_dir);
    Command::new(uv_bin)
        .args(["pip", "install", "--python", venv_python.to_str().unwrap(),
               &format!("marimo=={}", MARIMO_VERSION)])
        .status()?;

    on_progress("Ready");
    Ok(())
}
```

### 2.4 marimo バージョン管理

`MARIMO_VERSION` を `environment/version.rs` に定義。
Tauri アプリのアップデート時に marimo も自動更新:
- `ensure_environment()` は毎回 `uv pip install marimo=={VERSION}` を実行
- uv のキャッシュにより、既にインストール済みなら即座に完了
- バージョン変更時のみ実際のダウンロード/インストールが発生

### 2.5 初回起動時のスプラッシュ画面

Tauri のスプラッシュウィンドウで進捗を表示:
- "Checking Python..." → "Installing Python..." → "Creating environment..." → "Installing marimo..." → "Starting server..."

---

## Phase 3: Rust サーバーライフサイクル管理 ✅

### 3.1 ファイル構成

```
src-tauri/src/
├── main.rs               # エントリーポイント
├── lib.rs                # Tauri Builder 設定、コマンド登録
├── state.rs              # AppState (サーバー情報 + ウィンドウ一覧)
├── commands.rs           # #[tauri::command] IPC ハンドラ
├── error.rs              # エラー型
├── paths.rs              # uv, venv Python パス解決 (dev vs production)
├── server/
│   ├── mod.rs
│   ├── lifecycle.rs      # ServerInfo: start(), stop(), check_health()
│   ├── port.rs           # find_available_port() - TcpListener で空きポート検索
│   └── process.rs        # stdout/stderr キャプチャ、ログバッファ (最大 1000 件)
├── window/
│   ├── mod.rs
│   ├── manager.rs        # マルチウィンドウ管理 + リンクインターセプト + 重複防止
│   └── menu.rs           # メニュー設定（ホットキー競合回避）
└── environment/
    ├── mod.rs
    ├── bootstrap.rs      # Python DL + venv + marimo install
    └── version.rs        # MARIMO_VERSION 管理
```

### 3.2 起動シーケンス

```
app.whenReady()
  → ensure_environment(on_progress)   ← Python DL + venv 作成 + marimo インストール
  → find_available_port()
  → server.start(port)                ← venv_python -m marimo edit --headless ...
  → health_check_wait()
  → create_window(None)               ← ホームページ
  → 5秒間隔のヘルスチェック開始
```

### 3.3 Tauri IPC コマンド（`commands.rs`）

| Tauri Command | 概要 |
|---|---|
| `server_get_url` | `http://localhost:{port}` を返す |
| `server_get_status` | `/healthz` をポーリングして状態を返す |
| `server_start` | Python サーバーを spawn（ファイル引数なし → ホームページ付き） |
| `server_stop` | サーバープロセスを kill |
| `server_restart` | stop → start |
| `server_get_logs` | stdout/stderr ログバッファを返す |
| `window_open_notebook` | 新ウィンドウ (`http://localhost:PORT/?file=path`) で開く（**サーバーは共有**） |
| `window_open_home` | ホームページウィンドウを開く |
| `window_open_dialog` | ファイル選択ダイアログ → 新ウィンドウで開く |

### 3.4 サーバー起動

```
{venv_python} -m marimo edit --no-token --no-skew-protection --headless --port {port}
```

- **ファイル引数なし** → ホームページ付きサーバー
- **開発モード**: 外部で手動起動（port 2718 固定）。Tauri は spawn しない
- **プロダクション**: venv 内の Python から marimo を実行。動的ポート割り当て
- **uv PATH 注入**: サーバー spawn 時に同梱 `uv` のディレクトリを `PATH` 環境変数に追加。marimo 内部のパッケージ管理が同梱 `uv` を使えるようにする:
  ```rust
  let mut env = std::env::vars().collect::<HashMap<_, _>>();
  if is_production() {
      env.insert("PATH".into(), format!("{}{}{}", uv_dir, DELIMITER, env["PATH"]));
      env.insert("UV".into(), uv_bin.to_string());  // marimo の find_uv_bin() が参照
  }
  Command::new(venv_python).args(["-m", "marimo", "edit", ...]).envs(env).spawn();
  ```

### 3.5 プロセス管理

- **ポート検索**: `TcpListener::bind(("127.0.0.1", port))` で 100 ポート範囲を試行
- **ヘルスチェック**: `reqwest::get(format!("http://localhost:{port}/healthz"))` を 5秒間隔でポーリング
- **クラッシュリカバリ**: 30秒以内に最大3回リトライ。`tokio::spawn` で `child.wait()` を非同期監視
- **残留プロセスクリーンアップ**: 起動前に残留 marimo プロセスを確認・停止
  - Windows: `tasklist` で確認 → `taskkill /pid PID /f /t`
  - Unix: `pgrep -f marimo` → `kill`
- **クリーンアップ**:
  - Windows: `taskkill /pid {pid} /f /t`（プロセスツリーごと kill）
  - macOS/Linux: `child.kill()` (SIGKILL)
  - `on_window_event(Destroyed)`: ウィンドウ一覧から除去。全ウィンドウが閉じたらサーバー停止 → アプリ終了
  - アプリ終了時に全サーバープロセスを停止
- **ログ**: `env_logger` + ファイルベースログ (`{app_data}/logs/marimo-{timestamp}.log`)

---

## Phase 4: マルチウィンドウ管理 ✅

### 4.1 ウィンドウ URL

- 開発 (パターンA, 推奨): `http://localhost:2718` + `?file=path` (marimo server 直接)
- 開発 (パターンB): `http://localhost:3000` + `?file=path` (Vite → proxy → marimo)。`TAURI_DEV_URL` 環境変数で切り替え
- 本番: `http://localhost:PORT` + `?file=path` (marimo server 直接、動的ポート)
- `filePath = null` → ホームページ (`http://localhost:PORT/`)
- `filePath = "xxx.py"` → ノートブック (`http://localhost:PORT/?file=xxx.py`)
- `filePath = "__new__s_XXXXXX"` → 新規ノートブック（フロントエンドが `__new__` プレフィックスでセッション生成）

### 4.2 リンクインターセプト (`window/manager.rs`)

marimo ホームページのリンク構造:
```html
<!-- 既存ノートブックを開く (home-page.tsx:329-330, 414) -->
<a href="?file=path" target="{sessionId}-{encodedPath}">

<!-- 新規ノートブック作成 (home-page.tsx:508-526, utils/urls.ts:24-28) -->
<a href="http://localhost:PORT/?file=__new__s_XXXXXX" target="_blank" rel="noreferrer">
```

**「Create a new notebook」のフロー**:
1. `newNotebookURL()` が `?file=__new__${generateSessionId()}` の完全 URL を生成
2. `<a target="_blank">` なので通常ブラウザは新タブで開く
3. Tauri では `LINK_INTERCEPT_JS` が click を capture phase で補足
4. `e.preventDefault()` + `e.stopPropagation()` でデフォルト動作と shell plugin をブロック
5. `invoke('window_open_notebook', { filePath: '__new__s_XXXXXX' })` で Rust IPC 呼び出し
6. Rust 側 `open_window()` が `http://localhost:PORT/?file=__new__s_XXXXXX` で新 WebviewWindow 作成
7. marimo サーバーが `__new__` プレフィックスを認識し、新しいノートブックセッションを開始

**実装方式: `initialization_script` による JS 注入**:
```rust
// WebviewWindowBuilder で全ウィンドウに LINK_INTERCEPT_JS を注入
WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
    .initialization_script(LINK_INTERCEPT_JS)  // ← ページロード前に自動注入
    .build()?;
```

**イベント伝播モデル**:
```
Click on <a target="_blank">
  ↓ capture phase (document)
  → LINK_INTERCEPT_JS 発火: preventDefault() + stopPropagation() + invoke()
  ✕ bubble phase (body) ← stopPropagation() によりここに到達しない
  ✕ tauri-plugin-shell の handler はスキップされる
```

**注意: `on_navigation` は不使用**。Tauri 2.0 の `on_navigation` は同一ウィンドウ内ナビゲーションのみで `target` 付きリンクは補足できない。JS 注入 + IPC 方式を採用。

### 4.3 重複ウィンドウ防止

```rust
// HashMap<PathBuf, WebviewWindow> で開いているノートブックを追跡
pub fn open_notebook(&mut self, file_path: &Path) -> Result<()> {
    if let Some(existing) = self.windows.get(file_path) {
        existing.set_focus()?;
        return Ok(());
    }
    // 新しいウィンドウを作成
    let window = self.create_window(Some(file_path))?;
    self.windows.insert(file_path.to_path_buf(), window);
    Ok(())
}
```

### 4.4 メニュー (`window/menu.rs`)

marimo フロントエンドは独自のホットキーシステム (`frontend/src/core/hotkeys/hotkeys.ts`) を持つ。Tauri メニューの accelerator と競合するとフロントエンド側が動作しなくなるため、accelerator は最小限にする:

- File → New Notebook / Open... / Home Page / Quit (Ctrl+Q のみ accelerator 設定)
- View → Reload (F5) / DevTools (F12) / Fullscreen (F11)

**理由**: Ctrl+N, Ctrl+O 等を accelerator に設定すると、marimo のエディタ内ホットキーが奪われる。メニュー項目は残すが accelerator は付けず、click ハンドラで Tauri コマンド経由の処理にする。

### 4.5 Shutdown ボタン連携

フロントエンドの shutdown-button (`shutdown-button.tsx:28`) は `sendShutdown()` → `window.close()` を実行する。Tauri ではこの `window.close()` がウィンドウを閉じるため、`on_window_event(Destroyed)` と連携する。

ホームページの「Server Shutdown」で全ウィンドウが閉じた場合:
- 全ウィンドウの `Destroyed` イベント → サーバー停止 → アプリ終了

### 4.6 macOS 固有処理

- `RunEvent::Reopen` イベント（ドックアイコンクリック）→ ウィンドウがなければ `create_window(None)` でホームページを表示
- macOS メニューバーのアプリ名設定

### 4.7 WebView パーミッション

marimo が使用する WebView パーミッション:
- マイク（音声入力関連）
- クリップボード読み取り/書き込み（セル間コピー&ペースト、カスタム MIME タイプ `web application/x-marimo-cell`）

Tauri 2.0 の WebView パーミッション設定で許可する。

### 4.8 ダウンロード処理

フロントエンド (`frontend/src/utils/download.ts`) は `URL.createObjectURL(blob)` + `<a download>` クリックでダウンロードを実行する。Tauri WebView での Blob URL ダウンロードの動作を検証し、必要に応じて Tauri コマンド経由のフォールバックを実装。

**方針**: まず既存コードのまま検証し、動作しなかった場合にのみ最小限のフォールバックを追加する。フロントエンドへの `@tauri-apps/api` 依存や Tauri 検出コードの導入はこの検証結果次第。

**テスト必須**: CSV/JSON エクスポート、画像保存、ノートブックダウンロード等で Blob URL ダウンロードが正常に動作するか確認する。

---

## Phase 5: ビルド・開発ワークフロー ✅

### 5.1 開発フロー

**パターンA (推奨): marimo server 直接接続**
```powershell
# ターミナル1: Python バックエンド
uv run marimo edit --no-token --headless --port 2718

# ターミナル2: Tauri dev (PowerShell)
cd src-tauri
$env:CARGO_TARGET_DIR="C:\Users\sasai\cargo-target-marimo"; cargo tauri dev
# → WebView が http://localhost:2718 をロード (marimo server 直接)
```

**パターンB: Vite HMR が必要な場合**
```powershell
# ターミナル1: Python バックエンド
uv run marimo edit --no-token --headless --port 2718

# ターミナル2: Vite dev server
pnpm dev
# → port 3000 で起動、/api/*, /ws を port 2718 にプロキシ

# ターミナル3: Tauri dev
cd src-tauri
$env:TAURI_DEV_URL="http://localhost:3000"; $env:CARGO_TARGET_DIR="C:\Users\sasai\cargo-target-marimo"; cargo tauri dev
```

**⚠️ dev モードのプロセス管理 (Windows)**:
- `cargo tauri dev` 再実行前に前回の `marimo-desktop.exe` を必ず終了すること
- ファイルロックエラー (`os error 5`) が出た場合: `powershell -Command "Stop-Process -Name 'marimo-desktop' -Force"`
- ポート 2718 が使用中の場合: `powershell -Command "Get-NetTCPConnection -LocalPort 2718 | Select OwningProcess"` で PID を確認して kill

### 5.2 プロダクションビルド

```bash
# 1. uv バイナリをダウンロード
# Windows: vendor/uv.exe → src-tauri/binaries/uv.exe
# macOS: vendor/uv → src-tauri/binaries/uv
# Linux: vendor/uv → src-tauri/binaries/uv

# 2. Tauri ビルド
cd src-tauri && cargo tauri build
# → uv バイナリが resources としてバンドル
# → frontend/dist は不要（marimo サーバーが配信）
# → 初回起動時に uv が Python + marimo を自動セットアップ
# → Windows: NSIS, macOS: DMG, Linux: AppImage
```

### 5.3 npm スクリプト追加（ルート `package.json`）

```json
{
  "tauri:dev": "cargo tauri dev",
  "tauri:build": "cargo tauri build",
  "download:uv": "node scripts/download-uv.js"
}
```

### 5.4 Makefile ターゲット追加

```makefile
tauri-dev:
	cd src-tauri && cargo tauri dev

tauri-build:
	cd src-tauri && cargo tauri build
```

---

## ブラウザ機能の保全状況

### 自動的に動作する機能 (HTTP API 経由でバックエンドが処理)
- **パッケージ管理** (pip/uv/pixi) — `/api/packages/add` → `PackageManager.install()`
- **ターミナル** — `/terminal/ws` WebSocket PTY
- **エクスポート** — `/api/export/*` (HTML/PDF/Markdown/Script)
- **ファイルエクスプローラ** — `/api/files/*`
- **AI/チャット** — `/api/ai/*`
- **LSP** — `/lsp` WebSocket
- **共同編集 (RTC)** — `/ws` WebSocket + Loro CRDT
- **設定管理** — `/api/config/*` → `~/.marimo/config.toml`
- **最近のファイル** — `/api/home/recent_files` → `RecentFilesManager`

### リンクインターセプトで対応
- **ホームページからのノートブック開封** — `on_navigation` + 新ウィンドウ
- **新規ノートブック作成** — `?file=__new__...` URL → 新ウィンドウ
- **外部リンク** — `tauri-plugin-shell::open()` でシステムブラウザ

### Tauri 固有の対応が必要
- **マイク権限** — WebView パーミッション設定で `media` を許可
- **ファイルダウンロード** — Blob URL ダウンロードの動作検証 + フォールバック
- **クリップボード** — WebView パーミッション設定で clipboard を許可
- **localStorage** — `http://localhost:PORT` オリジンで正常動作

### 残りの注意事項
- **PDF エクスポート**: `playwright` ベースの WebPDF が動作するか検証が必要
- **初回起動時間**: Python 未インストール環境では `uv python install` に 1〜3 分かかる。スプラッシュスクリーンで進捗表示
- **ディスク容量**: uv 管理の Python (~100MB) + marimo + deps (~200MB)。ユーザーへの事前告知が望ましい
- **Notification API**: `dynamic-favicon.tsx` でセル実行完了時のデスクトップ通知を使用。Tauri の Web Notification API で動作するが、改善は後回し
- **window.print()**: `useNotebookActions.tsx:263` で印刷機能あり。WebView でも動作する。低優先度
- **WebSocket 再接続**: ウィンドウ最小化→復帰時の再接続はフロントエンドの既存ロジック (`frontend/src/core/websocket/`) で動作するはず。テストで確認

### ⚠️ ギャップ分析で判明した追加対応項目 (Electron プラン比較)

1. **ファイルアップロード (ドラッグ&ドロップ)**: Tauri WebView でのドラッグ&ドロップ動作確認が必要。テスト項目に追加
2. **`beforeDevCommand` の設定**: 空のままだと Vite dev server が起動しない。`cd frontend && pnpm dev` を設定するか、開発フロー要明確化
3. **Vite proxy 設定**: 開発モードで `/api/*`, `/ws`, `/terminal/ws`, `/lsp` を port 2718 にプロキシする既存設定の確認・言及
4. **target 属性付きリンク捕捉の具体化**: Tauri 2.0 では `on_navigation` は同一ウィンドウのみ。`target` 付きリンクは **JS 注入でリンクの click イベントをフック** し、`window.__TAURI__.invoke()` で Rust 側の `window_open_notebook` コマンドを呼ぶ方式を採用
5. **Edit メニュー (macOS)**: macOS では Edit メニューがないと Cmd+C/V が WebView 内で動作しない。空の Edit メニューを追加する
6. **終了シーケンス詳細化**: `RunEvent::ExitRequested` → サーバー sync 停止 → `RunEvent::Exit` の流れ
7. **WebView2 ランタイム (Windows)**: `bundle.windows.webviewInstallMode: "downloadBootstrapper"` を設定し、古い Windows 10 対応
8. **Linux WebKitGTK**: Chromium ベースではないため一部 Web API の互換性注意。Linux は低優先度
9. **WebView パーミッション**: `capabilities/default.json` は Tauri IPC の権限。WebView のブラウザパーミッション (getUserMedia, clipboard) は別途 `WebviewWindowBuilder` 設定が必要
10. **自動更新**: `tauri-plugin-updater` を将来的に検討 (Phase 1 では不要)
12. **ファイルアソシエーション**: `.py` ファイルのダブルクリック対応は将来検討

---

## 実装順序

1. ✅ **Phase 1** → `src-tauri/` 基盤（tauri.conf.json, Cargo.toml, main.rs, lib.rs, build.rs）
2. ✅ **Phase 2** → ランタイム sandbox 環境構築（environment/bootstrap.rs, version.rs）
3. ✅ **Phase 3** → サーバーライフサイクル（server/, state.rs, commands.rs, paths.rs, error.rs）
4. ✅ **Phase 4** → マルチウィンドウ管理（window/manager.rs, menu.rs, リンクインターセプト）
5. ✅ **Phase 5** → ビルドワークフロー（package.json, Makefile, scripts/）
6. 🔄 **Phase 6** → 手動テスト・バグ修正（進行中: リンクインターセプト bugfix 完了、動作テスト継続）

---

## 変更対象ファイル一覧

### 新規作成
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/build.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/icons/` (Tauri デフォルトアイコン)
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/state.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/error.rs`
- `src-tauri/src/paths.rs`
- `src-tauri/src/server/mod.rs`
- `src-tauri/src/server/lifecycle.rs`
- `src-tauri/src/server/port.rs`
- `src-tauri/src/server/process.rs`
- `src-tauri/src/window/mod.rs`
- `src-tauri/src/window/manager.rs`
- `src-tauri/src/window/menu.rs`
- `src-tauri/src/environment/mod.rs`
- `src-tauri/src/environment/bootstrap.rs`
- `src-tauri/src/environment/version.rs`
- `scripts/download-uv.js`

### 既存ファイル修正
- ルート `package.json` — `tauri:dev`, `tauri:build`, `download:uv` スクリプト追加
- `Makefile` — `tauri-dev`, `tauri-build` ターゲット追加

### フロントエンド側の変更 — 不要

Tauri ブリッジ (`frontend/src/core/tauri/`) は不要。理由:
- 全ウィンドウが `http://localhost:PORT` を参照するため、フロントエンドは Tauri 環境かどうかを意識する必要がない
- リンクインターセプトは Rust 側から JS を注入 (`LINK_INTERCEPT_JS`) して `window.__TAURI_INTERNALS__.invoke()` を直接呼ぶ
- `@tauri-apps/api` の追加も不要

### Python 側の変更 — 不要

ランタイム sandbox 方式では、marimo は通常の Python venv 内で実行される。
そのため以下の PyInstaller 対策は**すべて不要**:

- ~~`frozen.py` (is_frozen, find_real_python)~~ — `sys.executable` が正常な Python を指す
- ~~`PY_EXE` の修正 (package_manager.py, pypi_package_manager.py)~~ — 同上
- ~~フォーマッタ・LSP の修正 (formatter.py, lsp.py)~~ — 同上
- ~~`importlib.resources` 対策 (paths.py)~~ — 通常の Python なので動作する
- ~~`multiprocessing.freeze_support()` (__main__.py)~~ — frozen ではないので不要
- ~~`copy_metadata` (entry_points)~~ — 通常の pip install なのでメタデータがある

唯一の連携: `marimo/_utils/uv.py` の `find_uv_bin()` が `os.environ.get("UV", "uv")` を返すため、
Rust 側で `env.UV = bundled_uv_path` を設定すれば、marimo 内部のパッケージ管理も同梱 uv を使用する。

---

## 検証方法

### 開発モード
```bash
# ターミナル1: Python バックエンド
marimo edit --no-token --headless --port 2718

# ターミナル2: Tauri + Vite
cd src-tauri && cargo tauri dev
# → ホームページが表示される
```

### 本番ビルド
```bash
# uv ダウンロード + Tauri パッケージング
scripts/download-uv && cd src-tauri && cargo tauri build
# → Windows: NSIS, macOS: DMG, Linux: AppImage
# → marimo-server は含まれない（uv のみ同梱）
# → 初回起動時に uv が Python + marimo を自動セットアップ
```

### テスト項目
- [ ] 起動時にホームページが表示され、最近のファイル・実行中ノートブック一覧が見える
- [ ] ホームページからノートブッククリックで新しいウィンドウが開く
- [ ] 「Create new notebook」で新しいウィンドウが開く
- [ ] ノートブックの編集・セル実行が動作する
- [ ] パッケージパネルから pip/uv/pixi でライブラリをインストールできる
- [ ] ターミナルパネルが動作する
- [ ] ファイルエクスプローラが動作する
- [ ] ファイルダウンロード (CSV/JSON エクスポート等) で保存ダイアログが表示される
- [ ] HTML/Markdown/Script エクスポートが動作する
- [ ] AI/チャット機能が動作する
- [ ] ファイルダイアログからノートブックを開ける
- [ ] 同じノートブックを2回開くと既存ウィンドウにフォーカスする
- [ ] ウィンドウ1つを閉じても他のウィンドウとサーバーは動作し続ける
- [ ] 全ウィンドウを閉じるとサーバー停止・アプリ終了する
- [ ] サーバークラッシュ時に自動再起動する
- [ ] 外部リンクがシステムブラウザで開く
- [ ] セル間のコピー&ペースト (カスタム MIME タイプ `web application/x-marimo-cell`) が動作する
- [ ] ウィンドウ最小化→復帰後に WebSocket が自動再接続する
- [ ] コードフォーマット (ruff) が動作する
- [ ] LSP 補完が動作する
- [ ] メニューのショートカットが marimo エディタのホットキーと競合しない
- [ ] ホームページの「Server Shutdown」で全ウィンドウが閉じてアプリが終了する
- [x] 初回起動時に Python 未インストール環境で自動セットアップが完了する → ✅ プロダクションビルド手動テスト PASS
- [ ] 初回起動時にスプラッシュ画面で進捗が表示される
- [x] 2回目以降の起動が高速（venv 再構築なし）→ ✅ プロダクションビルド手動テスト PASS
- [ ] marimo バージョン更新時に自動的に新バージョンがインストールされる
- [x] venv 内の Python で pip/uv パッケージインストールが正常に動作する → ✅ プロダクションビルド手動テスト PASS
- [ ] macOS ドックアイコンクリックでウィンドウ復帰する
- [ ] クロスプラットフォーム: Windows/macOS/Linux でビルド・起動が成功する
- [ ] ファイルアップロード (ドラッグ&ドロップ) が動作する (ギャップ分析 #1)
- [ ] multiprocessing が正常に動作する (edit モードでカーネル spawn 確認) (ギャップ分析 #12)
- [ ] macOS で Cmd+C/V が WebView 内で動作する (Edit メニュー) (ギャップ分析 #5)

---

## 実装進捗ログ

### Phase 1〜4: Rust コード全体 (一括実装)
- **状況**: ✅ コンパイルエラー修正完了 (`cargo check` 通過)

**実施した修正**:
- ✅ **tauri.conf.json**: `windows` 配列を削除 (メインウィンドウの自動生成を停止)
- ✅ **lib.rs**: メインウィンドウを手動生成するように変更 (config 削除に伴う対応)
- ✅ **manager.rs**: `initialization_script` でリンクインターセプト用 JS を注入するように修正 (v2 対応)
- ✅ **commands.rs**: `FilePath` からのパス抽出ロジックを修正
- ✅ **state.rs/manager.rs**: Borrow checker エラーとライフタイムエラーを修正

**解決済みのビルド構成/環境問題**:
- ✅ **Windows ファイルロック**: `CARGO_TARGET_DIR` を OneDrive 管理外のフォルダ (`C:\Users\sasai\cargo-target-marimo`) に変更して回避
- ✅ **Tauri v2 Config**: `frontendDist` には `null` や `false` ではなく実在するパス (例: `"../frontend/dist"`) が必要
- ✅ **Bundle Resources**: `binaries/uv*` が存在しないとエラーになるため一時的に空リストに変更 (後にダミーまたは実物を配置)
- ✅ **Metadata**: `Cargo.toml` に `[package.metadata.bundle]` と `[package.metadata.tauri-winres]` が必須
- ✅ **Icon**: `tauri-build` には `src-tauri/icons/icon.ico` が必須 (frontend からコピー済)

**作成済みファイル**:
- ✅ `src-tauri/Cargo.toml` — 依存: tauri 2, tauri-plugin-{shell,dialog,fs}, tokio, reqwest, urlencoding, thiserror
- ✅ `src-tauri/tauri.conf.json` — `frontendDist: false`, CSP に blob:/data: 追加, `webviewInstallMode: downloadBootstrapper`
- ✅ `src-tauri/build.rs`
- ✅ `src-tauri/capabilities/default.json` — windows pattern に `home-*` も追加
- ✅ `src-tauri/src/main.rs`
- ✅ `src-tauri/src/lib.rs` — Tauri Builder + setup + メニューイベント + ウィンドウイベント + RunEvent
- ✅ `src-tauri/src/state.rs` — ServerState, WindowState
- ✅ `src-tauri/src/commands.rs` — 全 IPC コマンド
- ✅ `src-tauri/src/error.rs` — thiserror + Serialize
- ✅ `src-tauri/src/paths.rs` — uv/venv/python/log パス解決
- ✅ `src-tauri/src/server/{mod,lifecycle,port,process}.rs`
- ✅ `src-tauri/src/window/{mod,manager,menu}.rs`
- ✅ `src-tauri/src/environment/{mod,bootstrap,version}.rs`

**設計知見 (Tips)**:
1. **フロントエンドブリッジ不要**: `http://localhost:PORT` 配信なのでフロントエンドは Tauri を意識しない。リンクインターセプトは `on_page_load` で JS を注入し `window.__TAURI_INTERNALS__.invoke()` を直接呼ぶ
2. **CSP に blob:/data: が必要**: marimo は Blob URL ダウンロード (`download.ts`) や data URI (画像埋め込み等) を使うため、`img-src`, `connect-src`, `media-src`, `worker-src` に `blob:` を許可
3. **Edit メニュー必須 (macOS)**: AppKit の制約で Edit メニューがないと Cmd+C/V が WebView 内で効かない。`SubmenuBuilder::new("Edit").undo().redo().cut().copy().paste().select_all()` で空メニューを作成
4. **Windows ファイルロック問題**: `cargo check` 中にウイルス対策ソフトが `.o` ファイルをロックする。`target/` を除外設定するか、`codegen-units = 256` でファイル数を減らす対策を検討
5. **開発モードのポート**: dev は port 2718 固定 (外部 marimo server)。Vite dev server は port 3000 (既存の proxy 設定がそのまま使える)
6. **`on_navigation` vs JS 注入**: Tauri 2.0 の `on_navigation` は同一ウィンドウ内ナビゲーションのみ。`target` 付きリンクは `document.addEventListener('click')` で捕捉し、`window.open` もオーバーライドする
7. **Windows ファイルロック回避 (重要)**: Windows Defender との競合回避のため、`Documents` フォルダ以下の `target` ディレクトリを使用せず、環境変数 `CARGO_TARGET_DIR` で外部ディレクトリを指定するのが最も確実。
8. **Tauri v2 ビルド要件**: `tauri.conf.json` の `frontendDist` は文字列型必須。`Cargo.toml` には `bundle` 識別子と `tauri-winres` メタデータセクションが無いとエラーになる。また、`icon.ico` が所定の位置にないとビルドが即死する。
9. **Tauri v2 Window Creation**: `tauri.conf.json` で `windows` を定義すると `initialization_script` を動的に注入するのが難しい（`on_page_load` フックは v2 で仕様変更あり）。リンクインターセプト用 JS を確実に注入するため、config からは `windows` を削除し、`setup` フック内で `WebviewWindowBuilder` を使って手動生成する設計に変更した。

### Warning 修正 & 最終調整 (Phase 1〜4 完了後)
- **状況**: ✅ `cargo check` が warning ゼロ・エラーゼロで通過

**実施した修正**:
- ✅ **全ファイルの未使用 import 削除**: `ServerStatus`, `Path`, `Child`, `Stdio`, `WebviewWindow`, `PathBuf`, `anyhow`, `Url`, `Manager` (menu.rs)
- ✅ **未使用変数修正**: `state_clone` (lifecycle.rs) を削除、`window` (manager.rs) を `_window` に
- ✅ **noop clone 修正**: `ServerState` は Clone 未実装なので `.inner().clone()` は意味がない → 削除
- ✅ **lib.rs にメニュー統合**: `.menu(|app| window::menu::build_menu(app))` を Builder に追加。`build_menu` が実際にアプリメニューとして使われるようになった
- ✅ **tauri.conf.json 最終調整**:
  - CSP に `frame-src http://localhost:* blob:` 追加 (iframe 対応)
  - CSP の `connect-src` に `data:` 追加
  - `"withGlobalTauri": true` 追加 — `window.__TAURI_INTERNALS__` をグローバルに公開し、`LINK_INTERCEPT_JS` が IPC 呼び出しできるようにする
  - `bundle.windows.nsis.installMode: "perMachine"` 追加

### Phase 5: ビルド・開発ワークフロー
- **状況**: ✅ 完了

**作成・修正したファイル**:
- ✅ `scripts/download-uv.js` — Node.js スクリプト。uv の GitHub リリースから現在のプラットフォーム用バイナリをダウンロードし `src-tauri/binaries/` に配置。Windows (zip), macOS/Linux (tar.gz) の両方に対応。UV_VERSION = "0.7.12"
- ✅ ルート `package.json` — `tauri:dev`, `tauri:build`, `download:uv` スクリプト追加
- ✅ `Makefile` — `tauri-dev`, `tauri-build`, `download-uv` ターゲット追加

**設計知見 (Tips)**:
10. **`withGlobalTauri: true` が必須**: `tauri.conf.json` の `app.withGlobalTauri` を `true` にしないと `window.__TAURI_INTERNALS__` が undefined になり、`LINK_INTERCEPT_JS` 内の `invoke()` 呼び出しが失敗する。HTTP 配信 + JS 注入方式では `@tauri-apps/api` を使わないため、このフラグが唯一の IPC アクセス手段
11. **メニューの Builder 統合**: Tauri v2 では `.menu(|app| ...)` で Builder にメニューを渡す。`setup` 内での `app.set_menu()` よりもこちらが推奨（すべてのウィンドウにデフォルト適用される）
12. **`cargo tauri dev` 実行時の注意**: `--manifest-path` オプションで `src-tauri/Cargo.toml` を指定可能。ルート `package.json` のスクリプトから呼ぶ場合はこれを使う
13. **uv ダウンロードスクリプト**: Node.js の `https` モジュールで GitHub リリースのリダイレクトを追従。`tar` コマンド (Unix) と `Expand-Archive` (Windows PowerShell) で展開。クロスプラットフォーム対応

### 開発モード動作確認
- **状況**: ✅ 初回起動成功 (Windows)

**実行手順**:
```powershell
# ターミナル1: marimo サーバー
marimo edit --no-token --headless --port 2718

# ターミナル2: Tauri dev (PowerShell)
cd src-tauri
$env:CARGO_TARGET_DIR="C:\Users\sasai\cargo-target-marimo"; cargo tauri dev

# ターミナル2: Tauri dev (bash / Git Bash)
cd src-tauri && CARGO_TARGET_DIR="C:\Users\sasai\cargo-target-marimo" cargo tauri dev
```

**確認結果**:
- ✅ `cargo tauri dev` がビルド完了 (461 crates, ~1分30秒 for incremental)
- ✅ `marimo-desktop.exe` が起動し、プロセスが安定動作 (PID 確認)
- ✅ marimo サーバー (`/healthz` → 200) が正常応答
- ✅ WebView ウィンドウが開き、marimo ホームページが表示される

**実施した設計変更**:
- ✅ **dev モードの URL を port 2718 直接接続に変更**: `manager.rs` の dev base URL を `http://localhost:3000` (Vite) から `http://localhost:{port}` (= 2718, marimo 直接) に変更。Vite HMR が必要な場合は環境変数 `TAURI_DEV_URL=http://localhost:3000` で切り替え可能
- ✅ **`tauri.conf.json` の `devUrl` を port 2718 に変更**: `http://localhost:2718` (Tauri CLI 自身は使わないが整合性のため)

**設計知見 (Tips)**:
14. **dev モードの 2つのパターン**:
    - **パターンA (推奨)**: marimo server (port 2718) に直接接続。Tauri + Rust コードのデバッグに集中する場合。3プロセスの管理が不要で簡単
    - **パターンB**: Vite dev server (port 3000) → proxy → marimo (port 2718)。フロントエンドコードの HMR が必要な場合。`TAURI_DEV_URL=http://localhost:3000` を設定し、別途 `pnpm dev` を起動
15. **Windows での `CARGO_TARGET_DIR`**: `cargo tauri dev` 実行時にも `CARGO_TARGET_DIR` を環境変数として設定する必要がある。OneDrive 管理下のフォルダでは Windows Defender のファイルロックが発生する。**PowerShell では `$env:CARGO_TARGET_DIR="C:\Users\sasai\cargo-target-marimo"; cargo tauri dev`** と書く（bash 形式の `VAR=value command` は使えない）
16. **初回ビルド時間**: `cargo tauri dev` の初回ビルドは全 461 crates のコンパイルが必要で約5〜10分。2回目以降は incremental で ~30秒
17. **`cargo install tauri-cli --version "^2"`**: tauri-cli v2 のインストールに約8分（902 crates）。初回セットアップ時に実行が必要

### リンクインターセプト bugfix: `stopPropagation` 追加
- **状況**: ✅ 修正完了 (cargo check pass)
- **問題**: 「Create a new notebook」クリックで空白ページが表示される
- **原因**: `tauri-plugin-shell` が自動注入する JS (`init-iife.js`) が `<body>` に bubble-phase の click listener を登録し、`<a target="_blank">` リンクをシステムブラウザで開こうとする。我々の `LINK_INTERCEPT_JS` は `document` に capture-phase で登録するため先に発火するが、`stopPropagation()` を呼んでいなかったため、shell plugin の listener も発火し、同じ URL がブラウザでも開かれる（ダブル処理）
- **修正内容** (`window/manager.rs`):
  - `e.stopPropagation()` を全インターセプト箇所に追加（same-origin + external 両方）
  - capture phase (our code) → `stopPropagation()` → bubble phase (shell plugin) に到達しない
  - `invoke` の `.catch()` でエラーログを追加（サイレント失敗防止）
  - `__TAURI_INTERNALS__` 不在時の `console.warn` を追加

**設計知見 (Tips)**:
18. **`tauri-plugin-shell` の hidden JS injection**: shell plugin は初期化時に `<a target="_blank">` 用の click handler を `<body>` に注入する。このハンドラは `defaultPrevented` チェックをしない。カスタムリンクインターセプトを行う場合は `stopPropagation()` が必須。参照: `tauri-plugin-shell/src/init-iife.js`
19. **wry のデフォルト `NewWindowRequested` 動作**: wry は `new_window_req_handler` が未設定の場合、`SetHandled(true)` で新ウィンドウリクエストを無条件にブロックする。JS の `preventDefault()` が成功しない場合のフォールバックとして `WebviewWindowBuilder::on_new_window()` の利用を検討（Tauri 2.x の新しい API）
20. **`invoke` の camelCase 変換**: Tauri 2.0 の `#[tauri::command]` マクロは serde で `camelCase` → `snake_case` の自動変換を行う。Rust の `file_path` は JS から `filePath` として渡す

### 全体進捗サマリー

| Phase | 状況 | 備考 |
|-------|------|------|
| Phase 1: プロジェクト初期設定 | ✅ 完了 | 17 Rust ファイル作成済み |
| Phase 2: ランタイム sandbox | ✅ 完了 | uv bootstrap 実装済み |
| Phase 3: サーバーライフサイクル | ✅ 完了 | dev/prod 両モード対応 |
| Phase 4: マルチウィンドウ管理 | ✅ 完了 | リンクインターセプト bugfix 済み |
| Phase 5: ビルド・開発ワークフロー | ✅ 完了 | download-uv.js, Makefile, package.json |
| Phase 6: 手動テスト・バグ修正 | ✅ 完了 | 新規ノートブック作成の E2E テスト PASS |
| Phase 7: Playwright E2E テスト基盤 | ✅ 完了 | CDP 接続方式、Tauri 専用 config |

**コンパイル状況**: `cargo check` — ✅ エラーゼロ、warning ゼロ
**dev モード動作**: ✅ Windows で起動確認済み（ホームページ表示成功）
**E2E テスト**: ✅ Playwright CDP 経由で「Create a new notebook」の自動テスト PASS (3.2秒)

### テスト結果 (手動テスト + 自動テスト)
- [x] ホームページが表示されるか → ✅ 表示確認済み
- [x] メニュー (File/Edit/View) が表示されるか → ✅ スクリーンショットで確認済み
- [x] 「Create a new notebook」で新しいウィンドウが開くか → ✅ Playwright E2E テスト PASS
- [x] ノートブッククリックで新しいウィンドウが開くか (リンクインターセプト動作) → ✅ 手動テスト PASS
- [x] セル実行が動作するか → ✅ E2E テスト PASS (`cell-execution.spec.ts`)
- [x] ホットキー競合がないか (Ctrl+S, Ctrl+Enter 等がエディタに届くか) → ✅ セル実行テストで Ctrl+Enter 検証 PASS
- [x] 全ウィンドウ閉じるとアプリが終了するか → ✅ 手動テスト PASS
- [x] 外部リンク (Documentation, GitHub, Community 等) がシステムブラウザで開くか → ✅ E2E テスト PASS (`external-links.spec.ts`)
- [x] F12 で DevTools が開くか → ✅ 手動テスト PASS
- [x] F5 でページリロードが動作するか → ✅ E2E テスト PASS (`reload.spec.ts`)
- [x] F11 フルスクリーン → 削除済み（WebView2 との F11 キー競合のため機能自体を削除。View メニューから Toggle Fullscreen も削除）
- [x] ウィンドウ重複排除（同一パスで既存ウィンドウにフォーカス）→ ✅ E2E テスト PASS (`window-deduplication.spec.ts`)
- [x] 異なるパスで別ウィンドウが作成される → ✅ E2E テスト PASS (`window-deduplication.spec.ts`)

### dev モードでのトラブルシューティング

**ポート 2718 が使用中**:
```powershell
# PID を確認して kill
powershell -Command "Get-NetTCPConnection -LocalPort 2718 | Select OwningProcess -Unique"
powershell -Command "Stop-Process -Id <PID> -Force"
```

**`marimo-desktop.exe` がロックされている (os error 5)**:
```powershell
# 前回のプロセスが残っている場合
powershell -Command "Stop-Process -Name 'marimo-desktop' -Force"
```

**`cargo tauri dev` のリビルドが遅い場合**:
- `CARGO_TARGET_DIR` が正しく設定されていることを確認（OneDrive 外のディレクトリ）
- incremental build は ~30秒、フルビルドは ~5分

### Phase 7: Playwright E2E テスト基盤構築
- **状況**: ✅ 完了 (テスト PASS)

E2E テストの過程で 2 つの重大バグを発見・修正した。

#### バグ修正 1: IPC コマンドのデッドロック (`commands.rs`)
- **問題**: 「Create a new notebook」クリック後、`invoke('window_open_notebook')` が永久にハングする
- **原因**: `window_open_notebook` が同期コマンド (`fn`) だったため、メインスレッドで実行される。`WebviewWindowBuilder::build()` もメインスレッドへのアクセスを必要とするため、同一スレッドの再入でデッドロックが発生
- **修正**: `fn` → `async fn` に変更し、`app.run_on_main_thread()` でウィンドウ作成をメインスレッドにディスパッチ
- **対象ファイル**: `src-tauri/src/commands.rs` — `window_open_notebook`, `window_open_home`

```rust
// 修正前（デッドロック）
#[tauri::command]
pub fn window_open_notebook(app: tauri::AppHandle, ...) -> Result<(), AppError> {
    window::manager::open_window(&app, ...);  // メインスレッドが必要 → デッドロック
}

// 修正後（正常動作）
#[tauri::command]
pub async fn window_open_notebook(app: tauri::AppHandle, ...) -> Result<(), AppError> {
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        window::manager::open_window(&app_clone, ...);
    }).map_err(...)
}
```

#### バグ修正 2: dev モードの新ウィンドウ URL ポート不一致 (`manager.rs`)
- **問題**: 新ウィンドウが `http://localhost:3000` に接続しようとするが、marimo サーバーは port 2718 で動作しているため空白ページになる
- **原因**: `manager.rs` の `debug_assertions` ブランチで `base_url` が `http://localhost:3000` にハードコードされていた（Vite dev server 向けの旧設定）
- **修正**: `http://localhost:3000` → `http://localhost:2718` に変更
- **対象ファイル**: `src-tauri/src/window/manager.rs:37-38`

#### バグ修正 3: `LINK_INTERCEPT_JS` に `stopPropagation()` 追加 (`manager.rs`)
- **問題**: 記述上は修正済みとされていたが（Tip 18 参照）、実コードに未反映だった
- **修正**: same-origin / external 両方の分岐に `e.stopPropagation()` + `.catch()` + `console.warn` を追加
- **対象ファイル**: `src-tauri/src/window/manager.rs` — `LINK_INTERCEPT_JS`

#### E2E テスト基盤

Playwright の CDP (Chrome DevTools Protocol) 接続を使い、Tauri の WebView2 に対して DOM 操作・クリック・検証を行う自動テスト基盤を構築した。

**作成したファイル**:
- ✅ `frontend/playwright-tauri.config.ts` — Tauri テスト専用の Playwright 設定（`webServer`/`globalSetup` なし）
- ✅ `frontend/e2e-tests/tauri/new-notebook.spec.ts` — 「Create a new notebook」の E2E テスト
- ✅ `frontend/e2e-tests/tauri/README.md` — 実行方法、アーキテクチャ、Tips の詳細ドキュメント

**テスト実行方法と詳細ドキュメント**: `frontend/e2e-tests/tauri/README.md` を参照

**設計知見 (Tips)**:
21. **Tauri v2 の同期コマンドとメインスレッドのデッドロック**: `#[tauri::command]` の同期 (`fn`) コマンドはメインスレッドで実行される。その中で `WebviewWindowBuilder::build()` や GUI 操作を行うとデッドロックする。**ウィンドウを作成/操作する IPC コマンドは必ず `async fn` + `app.run_on_main_thread()` パターンを使うこと**。これは Tauri 2.0 で最も陥りやすい罠の1つ
22. **CDP 接続で Tauri アプリをテスト**: WebView2 は Chromium ベースのため、環境変数 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"` を設定すると CDP エンドポイントが有効になる。Playwright の `chromium.connectOverCDP()` で接続し、各 Tauri ウィンドウを `Page` オブジェクトとして操作可能
23. **`context.waitForEvent("page")` は不安定**: Tauri の新ウィンドウは CDP で `about:blank` → 実 URL の 2 段階で検出される。`waitForEvent("page")` では `about:blank` の段階でイベントが発火し、実 URL のナビゲーション完了前に検証が走る。`expect.poll(() => context.pages().length)` でページ数をポーリングし、その後 URL パターンマッチで目的のページを探す方式が安定する
24. **dev モードのポート戦略**: `tauri.conf.json` の `devUrl` (初期ウィンドウ) と `manager.rs` の `base_url` (新規ウィンドウ) は **同じポートを指す必要がある**。Vite HMR が不要な開発では port 2718（marimo server 直接）に統一。Vite HMR が必要な場合のみ `TAURI_DEV_URL=http://localhost:3000` で切り替え

### Phase 8: 包括的テスト・バグ修正の継続

- **状況**: 進行中

#### バグ修正 4: `window_open_dialog` デッドロック (`commands.rs`)

- **問題**: File → Open... メニューでファイル選択後、`open_window()` が Tokio スレッドから直接呼ばれるためデッドロックする
- **原因**: `window_open_dialog` は `async fn`（Tokio スレッドで実行）だが、`blocking_pick_file()` 後に `open_window()` を `run_on_main_thread()` なしで直接呼んでいた。`WebviewWindowBuilder::build()` はメインスレッドアクセスが必要なためデッドロック
- **修正**: `window_open_notebook` / `window_open_home` と同じパターンを適用 — `app.run_on_main_thread()` でウィンドウ作成をメインスレッドにディスパッチ
- **対象ファイル**: `src-tauri/src/commands.rs:73-90`

```rust
// 修正前（デッドロック）
if let Some(path) = file_path {
    let path_buf = path.into_path().unwrap();
    window::manager::open_window(&app, Some(&path_buf))  // Tokio thread → deadlock
        .map_err(|e| AppError::Window(e.to_string()))?;
}

// 修正後（正常動作）
if let Some(path) = file_path {
    let path_buf = path.into_path().unwrap();
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        if let Err(e) = window::manager::open_window(&app_clone, Some(&path_buf)) {
            log::error!("Failed to open dialog-selected notebook: {}", e);
        }
    })
    .map_err(|e| AppError::Window(e.to_string()))?;
}
```

#### E2E テスト追加 (5 ファイル、7 テスト) — 全 PASS (17.6秒)

共通ヘルパー (`helpers.ts`) を新設し、テスト間でウィンドウが残存しても安定動作するパターンを確立。

**作成したファイル**:
- ✅ `frontend/e2e-tests/tauri/helpers.ts` — 共通ヘルパー: `findHomePage`, `findOrCreateNotebook`, `createNotebookViaIPC`
- ✅ `frontend/e2e-tests/tauri/cell-execution.spec.ts` — セル実行 (Ctrl+Enter) が動作し出力 `2` が表示されることを検証。ホットキー競合テストも兼ねる
- ✅ `frontend/e2e-tests/tauri/external-links.spec.ts` — 外部リンク (docs.marimo.io) クリック時に新 Tauri ウィンドウが作られないことを検証
- ✅ `frontend/e2e-tests/tauri/window-deduplication.spec.ts` — 3 テスト: ホームページ重複排除 + 同一パス重複排除 + 異なるパスで別ウィンドウ
- ✅ `frontend/e2e-tests/tauri/reload.spec.ts` — F5 でページリロード後にエディタが再レンダリングされることを検証
- ✅ `frontend/e2e-tests/tauri/new-notebook.spec.ts` — IPC 経由でノートブック作成 + エディタ表示を検証（ヘルパー使用に改修）

**設計知見 (Tips)**:
25. **`blocking_pick_file()` と `run_on_main_thread()` の組み合わせ**: `tauri-plugin-dialog` の `blocking_pick_file()` は async context 内で使用可能（Tokio スレッドをブロックするだけ）。ただし、その後のウィンドウ作成は必ず `run_on_main_thread()` でラップすること。**全ての `open_window()` 呼び出しが `run_on_main_thread()` 経由であることを確認するのが鉄則**
26. **メニュー accelerator の安全性検証**: Tauri メニューで accelerator を設定したのは `Ctrl+Q` (Quit), `F5` (Reload), `F11` (Fullscreen), `F12` (DevTools) のみ。`Ctrl+S`, `Ctrl+Enter`, `Ctrl+D`, `Ctrl+M` 等の marimo フロントエンドホットキー (`frontend/src/core/hotkeys/hotkeys.ts`) は accelerator を設定していないため、WebView 側のハンドラが優先される。E2E テスト (`cell-execution.spec.ts`) で `Ctrl+Enter` が正常にセル実行に届くことを検証
27. **「Create a new notebook」リンクはセッション中固定 URL**: ホームページの「Create a new notebook」リンクは `?file=__new__s_XXXXXX` という固定 href を持つ。同セッションで複数回クリックしてもウィンドウマネージャーが重複排除するため、E2E テストで毎回新ウィンドウが必要な場合は IPC (`window_open_notebook`) を直接呼び出し一意のランダム ID を渡すこと
28. **サイドバーパネルによるクリック遮断**: ノートブックの FILES サイドバーが開いている場合、`.cm-editor` 上のクリックが `data-panel-group` に遮られる。`.cm-content` をターゲットにして `{ force: true }` を使うことで回避
29. **CDP ページ URL の遷移タイミング**: 新ウィンドウは CDP 上で `about:blank` → 実 URL の 2 段階で出現する。`expect.poll()` でページ数増加を待った後、さらに `expect.poll()` で URL にランダム ID が含まれるページを待つ 2 段階ポーリングが安定
