# Issue: ゲームリセット時に .backcast.progress.json が残りスキル再発火を阻害

**作成日**: 2026-02-20
**重要度**: Medium
**カテゴリ**: Game / Developer Experience
**ステータス**: ✅ 修正済み（unnamed テンプレート方式で解決）

---

## 概要

`src-tauri/sample-notebooks/` を `notebooks/` にコピーしてゲームをリセットしても、`.backcast.progress.json` が残存するため `_triggered_skills` が前回の完了スキルで初期化され、スキルが再発火しない。

**現象**:
1. `backcast.py` を含むサンプルファイルを notebooks にコピーしてリセット
2. ページを開いてセルを実行してもスキルのトースト通知が表示されない
3. ブラウザコンソールに `[SkillHandler]` メッセージが出ない
4. ステータスバーは `Progress: 0.0%` のままで Equity も増えない

---

## 根本原因

`skill_events.py` のモジュールロード時に `progress_manager.load_progress()` で進捗ファイルを読み込み、`_triggered_skills` を初期化している。

```python
# skill_events.py — モジュールロード時に実行される
_triggered_skills: set[str] = set(load_progress().get("completed_skills", []))
```

進捗ファイルはノートブック名に紐づく（`backcast.py` → `.backcast.progress.json`）。ゲームリセットでノートブックファイルだけをコピーしても `.backcast.progress.json` は残存する。

```
ゲームリセット（ファイルコピー）
  → .backcast.progress.json は削除されない
  → skill_events.py ロード時に _triggered_skills が前回完了スキルで初期化
  → bt.chart() → emit_skill("SANDBOX_001") → _triggered_skills に含まれるためスキップ
  → フロントエンドへのイベント送信なし → スキル完了なし
```

---

## ✅ 採用した解決策: unnamed テンプレート方式

### 設計思想

**核心**: 新しいノートブックを unnamed（ファイル名未定）で開き、`backcast.py` の内容をテンプレートとして読み込む。ファイル名がないため進捗ファイルも存在せず、クリーンな状態で開始できる。保存時にユーザーがファイル名を決定する。

```
New Notebook 作成時:
  filename = None (unnamed)
  → progress_manager: _get_progress_path() が None を返す → 進捗保存なし
  → セル内容は backcast.py のテンプレートから読み込み済み
  → スキルはすべて未完了状態 → 正常に発火する

Ctrl+S で保存時:
  filename = "my_game.py" (ユーザーが命名)
  → .my_game.progress.json が新規作成される（クリーン状態）
```

**却下した代替案**:
- オプション A（`bt.reset()` 関数）: Python 側の変更が必要、ユーザーが手動で呼ぶ必要がある
- オプション B（`.gitignore` / 手動削除）: 手順として直感的でない
- オプション C（リセット UI ボタン）: フロントエンド変更が大きい
- オプション D（ファイルコピー方式）: Rust 側でファイルをコピーして実ファイルとして開く案。動作するが notebooks ディレクトリにファイルが増殖する問題がある

### データフローの全体像

```
[ユーザーが "New Notebook" クリック]
  ↓
[Rust] lib.rs: file_key = "__new__menu_{timestamp}" を生成
  → commands::window_open_notebook(app, file_key)
    → manager::open_window(app, Some("__new__menu_..."))
      → URL: http://localhost:{port}/?file=__new__menu_...
        ↓
[Python] session_manager.create_session(file_key="__new__menu_...")
  → file_router.get_file_manager("__new__menu_...")
    → resolve_file_path() → None  (key.startswith("__new__"))
    → notebooks ディレクトリ内の backcast.py をテンプレートとして検出
    → AppFileManager(filename=None, template="...notebooks/backcast.py")
      → _load_app(template_path)
        → load.load_app("backcast.py") でセル内容を読み込み
        → result._app._filename = None でファイル名をクリア（テンプレート上書き防止）
```

---

## 実装詳細（6ファイル）

### Rust 側（3ファイル）

#### `src-tauri/src/lib.rs` — メニューハンドラのユニークキー生成

`"__new__"` 固定だとウィンドウハッシュが同一 → 2回目以降は既存ウィンドウにフォーカスしてしまう。タイムスタンプで一意にする。

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

#### `src-tauri/src/window/manager.rs` — タイトル表示

`__new__menu_1234` がそのままタイトルに出るのを防止。`__new__` プレフィックスを検出して "New Notebook" に差し替え。

```rust
let title = match file_path {
    Some(path) => {
        let name = path.to_string_lossy();
        if name.starts_with("__new__") {
            "backcast - New Notebook".to_string()
        } else { /* 通常のファイル名表示 */ }
    }
    None => "backcast".to_string(),
};
```

#### `src-tauri/src/server/lifecycle.rs` — PYTHONPATH 追加

unnamed ノートブックには `sys.path` にディレクトリが入らないため、`import game_setup` が失敗する。notebooks ディレクトリを `PYTHONPATH` に追加して解決。

```rust
let delimiter = if cfg!(windows) { ";" } else { ":" };
let current_pythonpath = env.get("PYTHONPATH").cloned().unwrap_or_default();
if !current_pythonpath.contains(&notebooks_dir_str) {
    env.insert("PYTHONPATH".into(), /* notebooks_dir_str を先頭に追加 */);
}
```

### Python 側（2ファイル）

#### `marimo/_server/file_router.py` — テンプレート解決

`LazyListOfFilesAppFileRouter.get_file_manager()` で `__new__` キーを検出し、notebooks ディレクトリ内の `backcast.py` をテンプレートとして `AppFileManager` に渡す。

```python
if resolved_path is None:
    template = None
    if key.startswith(AppFileRouter.NEW_FILE):
        candidate = os.path.join(self._directory, "backcast.py")
        if os.path.exists(candidate):
            template = candidate
    return AppFileManager(None, defaults=defaults, template=template)
```

#### `marimo/_session/notebook/file_manager.py` — template パラメータ

`AppFileManager.__init__()` に `template` パラメータを追加。テンプレートからセル内容を読み込むが `_filename` は `None` のまま維持する。

**`_filename` クリアが必須な理由**: `load.load_app(template_path)` → `App(_filename=filepath)` でテンプレートのパスが `_filename` にセットされる。クリアしないと保存時にテンプレート（`backcast.py`）を上書きしてしまう。

```python
# __init__: テンプレートからロード
load_path = (
    template
    if filename is None and template and os.path.exists(template)
    else self.path
)
self.app = self._load_app(load_path)

# _load_app: ファイル名クリア
if self._is_unnamed():
    result._app._filename = None
```

### dev 環境（1ファイル）

#### `package.json` — dev:backend に PYTHONPATH 追加

prod では `lifecycle.rs` が PYTHONPATH を設定するが、dev モード (`pnpm dev`) では外部サーバーのため使われない。`dev:backend` スクリプトに環境変数を前置して解決。

```json
"dev:backend": "set \"PYTHONPATH=%APPDATA%\\marimo\\notebooks\" && .venv\\Scripts\\python.exe -m marimo edit ..."
```

prod/dev ともに「PYTHONPATH 環境変数」戦略で統一。

---

## 変更しないもの

| ファイル | 理由 |
|---|---|
| `src-tauri/src/commands.rs` | `open_window` シグネチャ不変のため変更不要 |
| `marimo/_server/session_manager.py` | テンプレートは file_router 内で完結 |
| `frontend/src/utils/urls.ts` | `__new__<sessionId>` 形式は既に正しい |
| `progress_manager.py` | `filename=None` で自動的にデフォルト値を返す |
| `skill_events.py` | unnamed 時は進捗が空 → `_triggered_skills` も空 → 変更不要 |

---

## `__new__` プレフィックスの規約

- `AppFileRouter.NEW_FILE = "__new__"` が定数定義 (`file_router.py` L32)
- Python 側は `key.startswith("__new__")` で判定 → `__new__`, `__new__menu_123`, `__new__<sessionId>` 全てマッチ
- Rust 側も `name.starts_with("__new__")` で同じロジック
- 新しい `__new__` バリアントを追加する場合はこのプレフィックス規約に従うこと

---

## フォールバック設計

- `backcast.py` が notebooks ディレクトリに存在しない場合: `template=None` → 空ノートブック（従来動作）
- テンプレート読み込みに失敗した場合: `load.load_app()` が `None` を返す → 空ノートブック作成

---

## 関連ファイル

| ファイル | 役割 | 変更 |
|---|---|---|
| `src-tauri/src/lib.rs` | メニューハンドラ | ✅ ユニークキー生成 |
| `src-tauri/src/window/manager.rs` | ウィンドウタイトル | ✅ `__new__` プレフィックス処理 |
| `src-tauri/src/server/lifecycle.rs` | サーバー起動 | ✅ PYTHONPATH 追加 |
| `marimo/_server/file_router.py` | ファイルルーティング | ✅ テンプレート解決 |
| `marimo/_session/notebook/file_manager.py` | ノートブック管理 | ✅ template パラメータ + `_filename` クリア |
| `package.json` | dev スクリプト | ✅ PYTHONPATH 環境変数追加 |
| `skill_events.py` | スキル発火管理 | 変更なし |
| `progress_manager.py` | 進捗ファイル管理 | 変更なし |
