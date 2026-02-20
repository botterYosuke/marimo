# Plan: Unnamed Notebook (New Notebook をファイル名未定で開始)

## 進捗状況

| # | ファイル | 変更内容 | 状態 |
|---|---------|---------|------|
| 1 | `src-tauri/src/lib.rs` | メニューハンドラのユニークキー生成 | ✅ 実装済 |
| 2 | `src-tauri/src/window/manager.rs` | `__new__` プレフィックスのタイトル処理 | ✅ 実装済 |
| 3 | `src-tauri/src/server/lifecycle.rs` | PYTHONPATH に notebooks ディレクトリ追加 | ✅ 実装済 |
| 4 | `marimo/_server/file_router.py` | テンプレート解決ロジック追加 | ✅ 実装済 |
| 5 | `marimo/_session/notebook/file_manager.py` | template パラメータ追加 + `_filename` クリア | ✅ 実装済 |
| 6 | `package.json` | dev:backend に PYTHONPATH 環境変数追加 | ✅ 実装済 |
| - | ビルド & 動作確認 | 検証手順の実行 | 🔲 未実施 |

---

## Context

現在の Tauri 版「New Notebook」は `__new__` を Python に渡し、空の unnamed ノートブックを開く。しかしセルは空であり、`backcast.py` のテンプレート内容が読み込まれない。

ブラウザ版と同じく **ファイル名未定（unnamed）** のまま、かつ **`backcast.py` のテンプレート内容を持った状態で** 作業を開始し、保存時にファイル名を決定する設計に変更する。

## 設計思想と背景

### なぜ Python 側でテンプレートを解決するのか

`LazyListOfFilesAppFileRouter` は既に `self._directory`（= notebooks ディレクトリ）を知っている。`__new__` 検出時に、Python 側がそのディレクトリ内の `backcast.py` を直接テンプレートとして使う。

**却下した代替案:**
- Rust → URL クエリパラメータ → Python でテンプレートパス伝搬: 不必要に複雑、URL 設計への副作用
- フロントエンドでテンプレート内容を注入: WebSocket 経由で追加メッセージが必要、タイミング問題

**採用した方針:** Python 側の file_router が `__new__` を検出したら `backcast.py` を自動探索。Rust 側は一切テンプレートを意識しない。

### `_filename` クリアが必須な理由（重要な知見）

`load.load_app(template_path)` を呼ぶと内部で:
```
load_app(path) → load_notebook_ir(notebook_ir) → App(_filename=filepath)
```
と辿り、`App.__init__` (app.py L263) で `self._filename = kwargs.get("_filename", None)` により **テンプレートのパスが `_filename` にセットされる**。

これをクリアしないと保存時にテンプレートファイル（`backcast.py`）を上書きしてしまう。
→ `_load_app()` 内で `self._is_unnamed()` チェック後に `result._app._filename = None` でクリア。

### progress.json の動作（変更不要）
- unnamed 時: `progress_manager.py` の `_get_progress_path()` が `ctx.filename=None` → `None` を返す → 進捗保存なし
- 保存後: ファイル名確定 → `.<name>.progress.json` が自然に作成される

### sys.path の対策
- **prod**: `lifecycle.rs` で `PYTHONPATH` に notebooks ディレクトリを追加
- **dev**: `session_manager.py` で file_router のディレクトリを `sys.path` に追加（**延期判断: 後述**）

---

## 変更ファイル詳細（5ファイル）

### Rust 側（3ファイル）

#### ✅ 1. `src-tauri/src/lib.rs`

**メニューハンドラ** (L453付近): ユニークキーを生成して重複ウィンドウ防止:
```rust
"new_notebook" => {
    let app_clone = app.clone();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let file_key = format!("__new__menu_{}", ts);
    tauri::async_runtime::spawn(async move {
        if let Err(e) = commands::window_open_notebook(
            app_clone, Some(file_key),
        ).await {
            log::error!("Failed to open new notebook: {}", e);
        }
    });
}
```

**なぜ必要か:** 現状は毎回 `"__new__"` 固定 → `manager.rs` の `simple_hash()` が同一ハッシュを返す → 同一ウィンドウラベル → 2回目以降は既存ウィンドウにフォーカスしてしまう。タイムスタンプで一意にする。

#### ✅ 2. `src-tauri/src/window/manager.rs`

**タイトル** (L85付近): `__new__` プレフィックスのタイトル処理を追加:
```rust
let title = match file_path {
    Some(path) => {
        let name = path.to_string_lossy();
        if name.starts_with("__new__") {
            "backcast - New Notebook".to_string()
        } else {
            let basename = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Notebook".to_string());
            format!("backcast - {}", basename)
        }
    }
    None => "backcast".to_string(),
};
```

**なぜ必要か:** `path.file_name()` で `__new__menu_1234` がそのままタイトルに出る。`__new__` プレフィックスを検出して「New Notebook」に差し替え。

> **注**: `open_window()` のシグネチャは変更しない。`commands.rs` も変更不要。

#### ✅ 3. `src-tauri/src/server/lifecycle.rs`

env 構築部分 (L114付近、`notebooks_dir_str` 直後) に PYTHONPATH 追加:
```rust
// notebooks ディレクトリを PYTHONPATH に追加（unnamed ノートブックでもゲームモジュールをインポート可能に）
let delimiter = if cfg!(windows) { ";" } else { ":" };
let current_pythonpath = env.get("PYTHONPATH").cloned().unwrap_or_default();
if !current_pythonpath.contains(&notebooks_dir_str) {
    env.insert(
        "PYTHONPATH".into(),
        if current_pythonpath.is_empty() {
            notebooks_dir_str.clone()
        } else {
            format!("{}{}{}", notebooks_dir_str, delimiter, current_pythonpath)
        },
    );
}
```

**なぜ必要か:** 通常のノートブックは自身のディレクトリが `sys.path` に入るが、unnamed ノートブック (`filename=None`) にはディレクトリがない。テンプレート内の `import game_setup` が `ModuleNotFoundError` になる。prod では `PYTHONPATH` 経由で解決する。

---

### Python 側（2ファイル）

#### ✅ 4. `marimo/_server/file_router.py`

**`LazyListOfFilesAppFileRouter.get_file_manager()`** (L323付近): `__new__` 時にテンプレートを探す:
```python
def get_file_manager(
    self,
    key: MarimoFileKey,
    defaults: Optional[AppDefaults] = None,
) -> AppFileManager:
    defaults = defaults or AppDefaults()
    resolved_path = self.resolve_file_path(key)
    if resolved_path is None:
        # __new__ の場合: backcast.py をテンプレートとして渡す
        template = None
        if key.startswith(AppFileRouter.NEW_FILE):
            candidate = os.path.join(self._directory, "backcast.py")
            if os.path.exists(candidate):
                template = candidate
        return AppFileManager(None, defaults=defaults, template=template)
    return AppFileManager(resolved_path, defaults=defaults)
```

> **スコープ**: base class `AppFileRouter.get_file_manager()` と `ListOfFilesAppFileRouter.get_file_manager()` は変更不要。Tauri 版で使われるのは `LazyListOfFilesAppFileRouter` のみ。他のルーターでは `__new__` 時に空ノートブックが開く（既存動作のまま）。

#### ✅ 5. `marimo/_session/notebook/file_manager.py`

**`__init__()`** (L55付近): template パラメータ追加:
```python
def __init__(
    self,
    filename: Optional[str | Path],
    *,
    storage: Optional[StorageInterface] = None,
    defaults: Optional[AppDefaults] = None,
    template: Optional[str] = None,
) -> None:
    self._filename = _maybe_path(filename)
    self.storage = storage or FilesystemStorage()
    self._defaults = defaults or AppDefaults()

    # テンプレートが指定された場合、テンプレートからコンテンツを読み込むが filename は None のまま
    load_path = (
        template
        if filename is None and template and os.path.exists(template)
        else self.path
    )
    self.app = self._load_app(load_path)
    self._last_saved_content = None
```

**`_load_app()`** (L260付近): テンプレートから読み込んだ場合に filename をクリア:
```python
    result = InternalApp(app)
    result.cell_manager.ensure_one_cell()

    # テンプレートから読み込んだ場合（filename=None だが app に内容がある）、
    # app 内部のファイル名をクリアして unnamed を維持
    if self._is_unnamed():
        result._app._filename = None

    return result
```

---

## 変更しないもの

| ファイル | 理由 |
|---|---|
| `src-tauri/src/commands.rs` | `open_window` シグネチャ不変のため変更不要 |
| `marimo/_server/api/endpoints/assets.py` | テンプレートは Python 側で自動解決のため変更不要 |
| `marimo/_server/session_manager.py` | テンプレートは file_router 内で完結のため変更不要 |
| `frontend/src/utils/urls.ts` | `__new__<sessionId>` 形式は既に正しい |
| `progress_manager.py` | `filename=None` で自動的にデフォルト値を返す |
| `copy_sample_files_to_notebooks()` | game_setup.py 等のサポートファイル配置に必要 |
| ブラウザ版の動作 | `LazyListOfFilesAppFileRouter` 以外のルーターは既存動作のまま |

---

## ✅ 解決済: dev モードの sys.path 対策

当初 `session_manager.py` に Python コードで `sys.path` を操作する案があったが、
`package.json` の `dev:backend` スクリプトに `PYTHONPATH` 環境変数を追加するだけで解決した。

```json
"dev:backend": "set \"PYTHONPATH=%APPDATA%\\marimo\\notebooks\" && .venv\\Scripts\\python.exe -m marimo edit ..."
```

**なぜこちらが良いか:**
- Python ランタイムへの侵入的な変更（`sys.path.insert`）が不要
- `session_manager.py` への変更が不要 → 変更ファイル数が増えない
- prod の `lifecycle.rs` と同じ戦略（PYTHONPATH 環境変数）で一貫性がある

---

## Tips（作業者向け）

### データフローの全体像
```
[Rust] lib.rs "new_notebook" メニュー
  → commands::window_open_notebook(app, "__new__menu_{ts}")
    → manager::open_window(app, Some("__new__menu_..."))
      → URL: http://localhost:{port}/?file=__new__menu_...
        → [Python] session_manager.create_session(file_key="__new__menu_...")
          → file_router.get_file_manager("__new__menu_...")
            → resolve_file_path() → None  (key.startswith("__new__"))
            → backcast.py をテンプレートとして AppFileManager に渡す
              → _load_app(template_path) → App の内容はテンプレート、_filename は None
```

### `import game_setup` の PYTHONPATH 戦略
- **prod** (`cargo tauri build`): `lifecycle.rs` が `PYTHONPATH` に notebooks ディレクトリを追加
- **dev** (`pnpm dev`): `package.json` の `dev:backend` で `set PYTHONPATH=...` を前置
- 両方とも同じ「PYTHONPATH 環境変数」戦略で統一されている

### テスト時の注意点
- `backcast.py` が notebooks ディレクトリに存在しないとテンプレートは `None` → 空ノートブック（従来動作にフォールバック）
- `import game_setup` のテストは prod (`cargo tauri dev`) と dev (`pnpm dev`) の両方で可能
- ウィンドウの重複テスト: メニューから「New Notebook」を素早く連打しても、ミリ秒タイムスタンプにより別ウィンドウになることを確認

### `__new__` プレフィックスの規約
- `AppFileRouter.NEW_FILE = "__new__"` が定数定義 (`file_router.py` L32)
- Python 側は `key.startswith("__new__")` で判定 → `__new__`, `__new__menu_123`, `__new__<sessionId>` 全てマッチ
- Rust 側も `name.starts_with("__new__")` で同じロジック
- 新しい `__new__` バリアントを追加する場合はこのプレフィックス規約に従うこと

### `_filename` クリアの安全性
- `_is_unnamed()` は `self._filename is None` をチェック（`file_manager.py` L474-480）
- テンプレートからではない通常の `_load_app()` 呼び出しでは `self._filename` にパスが入っているため `_is_unnamed()` は `False` → クリアされない → 既存動作に影響なし

---

## 検証手順

1. `cargo tauri dev` でアプリ起動
2. ホームページの「Create a new notebook」クリック
3. 確認:
   - タイトルが「backcast - New Notebook」
   - セルに backcast.py のテンプレート内容が表示
   - `import game_setup as bt` が正常動作
   - notebooks ディレクトリに新規 `.py` ファイルなし
   - `.progress.json` ファイルなし
4. Ctrl+S → ファイル名入力ダイアログ表示
5. ファイル名入力して保存 → `.py` と `.progress.json` が作成される
6. メニュー > New Notebook を複数回 → 毎回新しいウィンドウ
