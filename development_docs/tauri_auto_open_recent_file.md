# Tauri: 起動時に最近開いたファイルを自動で開く

## 概要

marimo の Tauri デスクトップアプリ（`src-tauri/`）を起動したとき、ホーム画面をスキップして最近開いたファイルを直接開く機能。有効なファイルがない場合はホーム画面にフォールバックする。

---

## 仕様

- `recent_files.toml` の先頭から順に、実際にディスク上に存在するファイルを探す
- 最初に見つかったファイルを `/?file=<path>` で開く
- `recent_files.toml` が存在しない、またはすべてのファイルが無効な場合はホーム画面を開く

---

## 実装

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src-tauri/Cargo.toml` | `toml = "0.8"` 追加 |
| `src-tauri/src/paths.rs` | `get_most_recent_valid_file()` 追加 |
| `src-tauri/src/lib.rs` | 起動時ウィンドウ生成箇所を修正 |

### `src-tauri/src/paths.rs`

`get_most_recent_valid_file()` 関数を追加。Python 側（`marimo/_utils/xdg.py`）と同じパス解決ロジックを使用。

**`recent_files.toml` のパス:**

| OS | パス |
|----|------|
| Windows | `%USERPROFILE%\.marimo\recent_files.toml` |
| Linux/macOS | `$XDG_STATE_HOME/marimo/recent_files.toml`（未設定時: `~/.local/state/marimo/`） |

### `src-tauri/src/lib.rs`

起動フロー内でサーバー起動後にウィンドウを生成する箇所（旧 line 306）を変更：

```rust
// Before
match window::manager::open_window(&app_handle_clone, None) { ... }

// After
let recent_file = paths::get_most_recent_valid_file();
info!("Opening initial window, recent file: {:?}", recent_file);
match window::manager::open_window(&app_handle_clone, recent_file.as_deref()) { ... }
```

`open_window(app, None)` はホーム画面、`open_window(app, Some(path))` は `/?file=<encoded_path>` で開く。`recent_file` が `None` の場合は従来通りホーム画面。

---

## recent_files.toml フォーマット

```toml
files = [
  "C:\\Users\\user\\notebooks\\file1.py",
  "C:\\Users\\user\\notebooks\\file2.py",
]
```

Python 側の `RecentFilesManager`（`marimo/_server/recents.py`）が書き込む。最大 5 件保持。

---

## 関連ファイル

| ファイル | 内容 |
|---------|------|
| `src-tauri/src/paths.rs` | `get_most_recent_valid_file()` 実装 |
| `src-tauri/src/lib.rs` | 起動フロー（ウィンドウ生成箇所） |
| `src-tauri/src/window/manager.rs` | `open_window()` — `None`/`Some(path)` でホーム/ノートブック切替 |
| `marimo/_server/recents.py` | `RecentFilesManager` — `recent_files.toml` の読み書き |
| `marimo/_utils/xdg.py` | `marimo_state_dir()` — OS 別パス解決ロジック |

---

## 動作確認

1. `C:\Users\<user>\.marimo\recent_files.toml` に有効なファイルパスが記録されていることを確認
2. Tauri アプリを起動 → ホーム画面をスキップしてそのファイルが直接開かれることを確認
3. `recent_files.toml` を削除、または全パスを存在しないパスに変更して起動 → ホーム画面が開くことを確認
4. ログで動作を確認:
   - Windows: `%APPDATA%\com.marimo.desktop\logs\marimo-desktop.log`
   - `Opening initial window, recent file: Some(...)` または `None` の出力を確認
