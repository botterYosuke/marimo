# marimo Tauri デスクトップアプリケーション - アーキテクチャ

## 概要

このディレクトリには、marimoのTauriデスクトップアプリケーションのRust実装が含まれています。
自己完結型のPython環境を内蔵し、marimoサーバーのライフサイクル管理、マルチウィンドウサポート、クロスプラットフォーム対応を実現しています。

## ポート検索とフロントエンド連携の仕組み

### 基本的な動作フロー

```
1. アプリケーション起動（lib.rs::run()）
   ↓
2. ポート番号の決定
   - 開発モード: ポート 2718 固定
   - 本番モード: find_available_port(2718) で空きポートを探索
   ↓
3. ポート番号を ServerState に保存
   ↓
4. Python marimoサーバーを起動
   - コマンド: marimo edit --port <決定したポート> --headless --no-token
   ↓
5. ヘルスチェック（/healthz）でサーバー起動を確認
   ↓
6. ウィンドウを作成
   - URL: http://localhost:<決定したポート>
   - WebView でこのURLを開く
   ↓
7. フロントエンド（JavaScript）が起動
   - document.baseURI から自動的にサーバーURLを取得
   - WebSocket接続を確立（同じポート）
```

### 重要なポイント

**🔑 Tauri環境判定は不要**

- Rust側が既に正しいポート番号で WebView の URL を構築
- フロントエンドは `document.baseURI` で自動的に正しいURLを取得
- IPCで明示的にポート番号を取得する必要はない（通常の動作では）

**例:**
```rust
// Rust側（window/manager.rs）
let port = 2719;  // find_available_port() で決定
let url = format!("http://localhost:{}", port);
WebviewUrl::External(url.parse()?)  // WebViewでこのURLを開く
```

```typescript
// フロントエンド側（frontend/src/core/runtime/config.ts）
function getBaseURI(): string {
  const url = new URL(document.baseURI);  // "http://localhost:2719" が自動的に取得される
  url.search = "";
  url.hash = "";
  return url.toString();
}
```

### ポートが埋まっている場合の動作

1. **ポート2718が空いている場合**
   ```
   find_available_port(2718) → 2718
   → marimoサーバーがポート2718で起動
   → WebViewが http://localhost:2718 を開く
   → フロントエンドが http://localhost:2718 に接続
   ```

2. **ポート2718が埋まっている場合**
   ```
   find_available_port(2718) → 2719 (次の空きポート)
   → marimoサーバーがポート2719で起動
   → WebViewが http://localhost:2719 を開く
   → フロントエンドが http://localhost:2719 に接続
   ```

3. **最大100ポートまでスキャン**
   ```rust
   // server/port.rs
   pub fn find_available_port(base_port: u16) -> Option<u16> {
       for offset in 0..100 {
           let port = base_port + offset;
           if TcpListener::bind(("127.0.0.1", port)).is_ok() {
               return Some(port);
           }
       }
       None
   }
   ```

## ディレクトリ構造と機能

### コアファイル

- **[lib.rs](lib.rs)** - アプリケーションのメインロジック
  - Tauriビルダー設定
  - プラグイン初期化（shell、dialog、fs）
  - 開発/本番モードの切り替え
  - サーバー起動とヘルスチェック
  - メニューイベント処理
  - ウィンドウライフサイクル管理

- **[main.rs](main.rs)** - エントリポイント
  - Windows用コンソールウィンドウ非表示
  - `marimo_desktop::run()` の呼び出し

- **[error.rs](error.rs)** - エラー型定義
- **[state.rs](state.rs)** - アプリケーション状態管理
  - `ServerState`: ポート、PID、ステータス、ログ
  - `WindowState`: 開いているウィンドウの追跡

### モジュール

#### Commands (`commands.rs`)
フロントエンド向けIPCコマンド

- `server_get_url()` - サーバーURLの取得
- `server_get_status()` - サーバーステータスの取得
- `server_get_logs()` - サーバーログの取得
- `server_restart()` - サーバー再起動
- `window_open_notebook()` - ノートブックウィンドウを開く
- `window_open_home()` - ホームページウィンドウを開く
- `window_open_dialog()` - ファイル選択ダイアログ
- `window_toggle_fullscreen()` - フルスクリーントグル

#### Environment (`environment/`)
Python環境管理

- **[bootstrap.rs](environment/bootstrap.rs)** - 環境セットアップ
  - Python 3.13の検出/インストール（`uv python`）
  - venv作成（`uv venv`）
  - marimo[game]のインストール
  - Windows用の`CREATE_NO_WINDOW`フラグ

- **[version.rs](environment/version.rs)** - バージョン定数

#### Server (`server/`)
サーバー管理

- **[lifecycle.rs](server/lifecycle.rs)** - サーバーライフサイクル
  - `start_server()` - marimoサーバーの起動
  - `stop_server()` - プロセス終了
  - `wait_for_health()` - ヘルスチェック待機
  - `check_health()` - 即座のヘルスチェック
  - `kill_process()` - プラットフォーム固有のプロセス終了

- **[port.rs](server/port.rs)** - ポート管理
  - `find_available_port()` - 空きポート検索

- **[process.rs](server/process.rs)** - プロセス出力処理
  - `capture_output()` - stdout/stderrのキャプチャ

#### Window (`window/`)
ウィンドウ管理

- **[manager.rs](window/manager.rs)** - ウィンドウマネージャー
  - `open_window()` - ウィンドウ作成と重複チェック
  - URL構築とパラメータ処理
  - リンクインターセプト用JavaScriptの注入

- **[menu.rs](window/menu.rs)** - アプリケーションメニュー
  - File、Edit、Viewメニュー
  - marimoのホットキーとの競合回避

#### Paths (`paths.rs`)
パスユーティリティ

- `get_uv_bin()` - uvバイナリパス
- `get_env_dir()` - venv ディレクトリ
- `get_python_install_dir()` - Python インストールディレクトリ
- `get_venv_python()` - venv内のPython実行ファイル
- `get_log_dir()` - ログディレクトリ
- `get_notebooks_dir()` - ノートブックワークスペース
- `get_marimo_source()` - marimoソースコードパス

## 開発モード vs 本番モード

### 開発モード (`cfg!(debug_assertions)`)

```rust
let port = 2718;  // 固定ポート
// 外部で起動したmarimoサーバーを使用（`marimo edit`を手動で実行）
```

### 本番モード (リリースビルド)

```rust
let port = find_available_port(2718).unwrap_or(2718);
// 環境ブートストラップ（Python + marimo インストール）
// 内蔵のmarimoサーバーを自動起動
```

## マルチウィンドウ対応

- `WindowState` で開いているウィンドウを追跡
- ファイルパス → ウィンドウラベルのマッピング
- 重複ウィンドウの防止（既存ウィンドウをフォーカス）
- すべてのウィンドウが同じ `ServerState` を共有

```rust
// 同じノートブックを開こうとした場合
if let Some(existing_label) = window_state.windows.lock().unwrap().get(&path) {
    // 既存ウィンドウをフォーカス
    app.get_webview_window(existing_label)?.set_focus()?;
    return Ok(());
}
```

## ヘルスチェックとプロセス監視

### サーバー起動時のヘルスチェック

```rust
wait_for_health(port).await  // 最大30秒待機
```

### 定期ヘルスチェック（5秒間隔）

```rust
loop {
    tokio::time::sleep(Duration::from_secs(5)).await;
    let healthy = check_health(port).await;
    if !healthy {
        // サーバークラッシュ検出
        *status = ServerStatus::Error("Health check failed".to_string());
    }
}
```

## プラットフォーム固有の処理

### Windows

- `CREATE_NO_WINDOW` フラグでコンソールウィンドウ非表示
- `taskkill /pid /f /t` でプロセスツリー全体を終了
- `Scripts\python.exe` パス

### macOS

- Dockアイコンクリックでウィンドウ再オープン
- Edit メニューが必須（Cmd+C/V/X用）
- `bin/python` パス

### Linux

- `SIGTERM` → `SIGKILL` でプロセス終了
- `bin/python` パス

## 環境変数の設定

サーバー起動時に以下の環境変数を設定：

```rust
env.insert("UV", uv_bin);
env.insert("PATH", ...);  // uv bin をPATHに追加
env.insert("PYTHONIOENCODING", "utf-8");
env.insert("PYTHONUNBUFFERED", "1");
env.insert("UV_PYTHON_INSTALL_DIR", python_install_dir);
```

## よくある質問

### Q: フロントエンドはどうやってポート番号を知るのか？

A: **document.baseURI から自動取得**します。Rust側が WebView を開く際に正しいURLを指定するため、フロントエンドは特別な処理なしで正しいポート番号を取得できます。

### Q: IPCコマンド `server_get_url()` は必要？

A: 通常の動作では不要です。以下の高度な用途で使用します：
- サーバー再起動時の動的な再接続
- デバッグ情報の取得
- サーバーステータスの監視

### Q: ポートが100個埋まっていたら？

A: `find_available_port()` が `None` を返し、デフォルトポート2718で起動を試みます。起動に失敗した場合はエラー状態になります。

### Q: 複数のmarimoアプリを同時に起動できる？

A: はい。それぞれが異なるポートを使用します：
- 1つ目: ポート2718
- 2つ目: ポート2719
- 3つ目: ポート2720
- ...

## トラブルシューティング

### ポート2718で起動できない

```bash
# ポート2718を占有しているプロセスを確認
# Windows
netstat -ano | findstr :2718

# macOS/Linux
lsof -i :2718
```

### サーバーが起動しない

1. ログディレクトリを確認: `%APPDATA%\marimo-desktop\logs`
2. Rustログを確認: `RUST_LOG=info`
3. Python環境を確認: `%APPDATA%\marimo-desktop\marimo-env`

### フロントエンドが接続できない

1. ブラウザDevToolsで `document.baseURI` を確認
2. サーバーステータスを確認: IPCコマンド `server_get_status()`
3. ヘルスチェックエンドポイントを確認: `http://localhost:<port>/healthz`

## 参考リンク

- [CONTRIBUTING.md](../../../CONTRIBUTING.md) - 開発セットアップ
- [AGENTS.md](../../../AGENTS.md) - プロジェクト全体のアーキテクチャ
- [Tauri Documentation](https://tauri.app/v1/guides/)
