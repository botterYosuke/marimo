# Tauri: 起動時にサンプルファイルを notebooks ディレクトリにコピー

## 概要

marimo の Tauri デスクトップアプリ（`src-tauri/`）を起動するたびに、`src-tauri/sample-notebooks/` 内のサンプル Python ファイルを作業フォルダ（notebooks ディレクトリ）に自動コピーする機能。

---

## 仕様

- 起動のたびに毎回実行する
- **既に存在するファイルは上書きしない**（存在しないファイルのみコピー）
- ファイルの種別は問わない（全拡張子対象）
- コピー先: `%APPDATA%\marimo\notebooks`（Windows）/ `~/Library/Preferences/com.marimo.desktop/marimo/notebooks`（macOS）

---

## コピー元ファイル一覧

`src-tauri/sample-notebooks/` に含まれるサンプルファイル：

| ファイル名 | 内容 |
|-----------|------|
| `backcast.py` | Backcast フレームワーク サンプル |
| `backcast_en.py` / `backcast_zh.py` | 多言語版 |
| `backtest_wrapper.py` | バックテストユーティリティ |
| `board.py` | ボード/ゲームロジック |
| `bridge.py` | ブリッジモジュール |
| `chart.py` | チャート可視化 |
| `full_mode.py` | フルモードサンプル |
| `game_setup.py` | ゲームセットアップ |
| `headless_broadcast.py` | ブロードキャストユーティリティ |
| `progress_manager.py` | 進捗管理 |
| `pyodide.py` | WASM/Pyodide 連携 |
| `sample_skill_triggers.py` | スキルトリガーサンプル |
| `sandbox.py` | サンドボックスユーティリティ |
| `skill_events.py` | スキルイベント処理 |
| `wasm-intro.py` | WASM 入門 |

---

## 実装

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src-tauri/sample-notebooks/` | サンプルファイルの格納場所（旧 `frontend/public/files/`） |
| `src-tauri/prepare-resources.js` | ビルド時に `src-tauri/sample-notebooks/` を `src-tauri/resources/files/` へコピー |
| `src-tauri/tauri.conf.json` | `bundle.resources` に `"resources/files"` を追加 |
| `src-tauri/src/lib.rs` | `copy_sample_files_to_notebooks()` 関数追加 + 起動時呼び出し |

---

### `src-tauri/prepare-resources.js`

既存の `copyRecursive` 関数を流用して末尾に追加。ビルド・dev 起動時に `resources/files/` を生成する。

```js
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
```

---

### `src-tauri/tauri.conf.json`

```json
"resources": [
  "binaries/uv*",
  "resources/marimo",
  "resources/files",   // ← 追加
  ...
]
```

プロダクションバンドル時に `resources/files/` が実行ファイルに同梱される。

---

### `src-tauri/src/lib.rs`

#### `copy_sample_files_to_notebooks()` 関数（`run()` の前に追加）

dev/prod でコピー元パスを切り替える：

| モード | コピー元 |
|--------|---------|
| Dev（`debug_assertions`） | `env!("CARGO_MANIFEST_DIR")/sample-notebooks`（= `src-tauri/sample-notebooks/`） |
| Prod | `resource_dir/resources/files` |

`env!("CARGO_MANIFEST_DIR")` はコンパイル時に `Cargo.toml` があるディレクトリ（`src-tauri/`）に展開されるため、CWD に依存せず常に正しいパスが解決される。

```rust
fn copy_sample_files_to_notebooks(app: &tauri::AppHandle) {
    let src_dir = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sample-notebooks")
    } else {
        app.path()
            .resource_dir()
            .expect("failed to get resource dir")
            .join("resources").join("files")
    };
    let dst_dir = paths::get_notebooks_dir(app);

    // dst_dir がなければ作成
    if let Err(e) = std::fs::create_dir_all(&dst_dir) { ... }

    for entry in entries.flatten() {
        let dst = dst_dir.join(name);
        if !dst.exists() {   // ← 既存ファイルはスキップ
            std::fs::copy(&src, &dst)?;
        }
    }
}
```

#### 呼び出し箇所（`.setup()` クロージャ内、L123）

```rust
std::fs::create_dir_all(&data_dir).ok();
let log_dir = paths::get_log_dir(&app_handle);
std::fs::create_dir_all(&log_dir).ok();

copy_sample_files_to_notebooks(&app_handle);  // ← 追加

info!("marimo desktop starting...");
```

---

## パス解決

`get_notebooks_dir()` は既存の `paths.rs` の関数をそのまま使用：

| OS | notebooks ディレクトリ |
|----|----------------------|
| Windows | `%APPDATA%\marimo\notebooks` |
| macOS | `~/Library/Preferences/com.marimo.desktop/marimo/notebooks` |
| Linux | `~/.config/marimo/notebooks` |

Dev モードのコピー元パスは `env!("CARGO_MANIFEST_DIR")` で解決：
- コンパイル時マクロで `src-tauri/` の絶対パスに展開
- CWD や環境変数に依存しない（旧実装の `PathBuf::from("..")` より堅牢）

---

## 動作確認

1. `pnpm tauri:dev` を実行後、`%APPDATA%\marimo\notebooks` にサンプル `.py` ファイルが存在することを確認
2. **上書きなし確認**: 一部ファイルを手動編集して再起動 → 内容が保持されていることを確認
3. **復元確認**: 一部ファイルを削除して再起動 → 削除分のみ再生成されることを確認
4. **ログ確認**:
   - Windows: `%APPDATA%\com.marimo.desktop\logs\marimo-desktop.log`
   - `Seeded notebook: <filename>` の出力を確認

---

## 関連ファイル

| ファイル | 内容 |
|---------|------|
| `src-tauri/sample-notebooks/` | コピー元サンプルファイル群 |
| `src-tauri/src/lib.rs` | `copy_sample_files_to_notebooks()` 実装・呼び出し |
| `src-tauri/src/paths.rs` | `get_notebooks_dir()` |
| `src-tauri/prepare-resources.js` | ビルド時リソース準備スクリプト |
| `src-tauri/tauri.conf.json` | バンドルリソース設定 |
