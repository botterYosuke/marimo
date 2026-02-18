# Steam 対応: インストーラー廃止・ポータブルランチャー化 実装計画

作成日: 2026-02-18

---

## 現状整理

### インストーラー（NSIS）が現在行っていること

| 処理 | 担当 |
|------|------|
| ファイルを `Program Files\backcast\` に展開 | NSIS |
| WebView2 BootStrapper をダウンロード・実行 | NSIS + Tauri |
| `HKLM\...\Uninstall\backcast` レジストリ書き込み | NSIS |
| 既インストール検出 → 既存 exe 起動して終了 | `hooks.nsh` PREINSTALL |
| インストール後に exe を自動起動 | `hooks.nsh` POSTINSTALL |

### アプリ起動時（`lib.rs` setup フェーズ）がすでに行っていること

| 処理 | 担当 |
|------|------|
| データディレクトリ作成 | `setup()` |
| サンプルノートブックをコピー | `copy_sample_files_to_notebooks()` |
| `recent_files.toml` 初期作成 | `seed_recent_files()` |
| Python 探索 → なければ `uv python install 3.13` | `ensure_environment()` |
| venv 作成 (`uv venv --seed`) | `ensure_environment()` |
| marimo ソースから `uv pip install` | `ensure_environment()` |
| スプラッシュ画面でプログレス表示 | `window/splash.rs` |
| marimo サーバー起動 → ヘルスチェック | `server/lifecycle.rs` |
| メインウィンドウを開く | `window/manager.rs` |

### 結論

**Python 環境の初期化はすでにアプリ起動時に完結している。**
インストーラーで「しか」行われていない処理は次の 3 つだけ:

1. **ファイル展開** → Steam がゲームファイルを配信するため不要
2. **WebView2 インストール** → 要対処（下記参照）
3. **レジストリ書き込み** → Steam 管理のため不要

---

## 技術的実現可能性

### ✅ 可能

- Python / venv / marimo の初回セットアップはすでにアプリ内で完結している
- Steam は `steamapps/common/backcast/` にファイルを展開するだけで動く
- `uv.exe` は `resources/binaries/uv.exe` としてすでにバンドル済み
- スプラッシュ画面でセットアップ進捗を表示する仕組みも実装済み
- ポータブル動作（単一フォルダ）は `<exe_dir>/data` をデフォルトにすることで実現可能
- 別の「ランチャー exe」は不要。既存の `backcast.exe` がそのままランチャーを兼ねる

### ❌ 通常配布（NSIS + Program Files）との同居は不可

**`<exe_dir>/data` をデフォルトにすると NSIS インストール時に UAC 問題が発生する。**

NSIS の `perMachine` モードは `C:\Program Files\backcast\` に展開する。
`Program Files` 配下への一般ユーザー書き込みは UAC で拒否されるため、
`data/` フォルダの自動生成・書き込みが初回起動時に失敗する。

Steam の `steamapps/` は書き込み権限が付与されているため問題ないが、
通常配布と同じデフォルトロジックにはできない。

**採用する方針: Steam 版と通常配布版でビルドを完全に分離する**

| 配布形態 | `get_data_root()` のデフォルト動作 |
|---------|----------------------------------|
| **Steam 版** | `BACKCAST_DATA_DIR` 未設定 → `<exe_dir>/data` |
| **通常配布版（NSIS）** | `BACKCAST_DATA_DIR` 未設定 → AppData ベース（現行動作） |

これを `get_data_root()` 内でコンパイル時フラグ（`#[cfg(feature = "steam")]` 等）か、
実行時の `BACKCAST_PORTABLE` 環境変数で切り替える。
NSIS インストーラーは `BACKCAST_DATA_DIR` を設定しない（= AppData に書き込み続ける）。

### ⚠️ 注意点: WebView2

現在は NSIS 内の `downloadBootstrapper` が WebView2 を自動インストールする。
インストーラーを廃止するとこの仕組みが消える。

| 対処案 | 特徴 |
|-------|------|
| **`skip` モード（採用）** | システム WebView2 を使う。Windows 11 は標準搭載。Windows 10 も 2021 年以降の更新で搭載済み。Steam ユーザーの大多数に該当 |
| `fixedRuntime` | ~130 MB の WebView2 ランタイムをバンドル。確実だがサイズ大 |
| 起動時チェック + エラーダイアログ | WebView2 なしでは Tauri 自体が起動しないため実装困難 |

**→ `skip` モードを採用。WebView2 が存在しない場合は Tauri 標準のエラーダイアログに委ねる。**

### ⚠️ 注意点: Tauri v2 の bundle targets

Tauri v2 で有効な bundle targets は次のとおり。

| プラットフォーム | 有効な targets |
|----------------|--------------|
| Windows | `nsis`、`msi` |
| macOS | `app`（.app バンドル）、`dmg` |

`"app"` というターゲットは Tauri v2 には存在しない（v1 の名称）。
macOS の .app バンドルは `"app"` が正しいターゲット名。

---

## 変更方針

### データ保存先の決定ロジック（優先順）

```
1. 環境変数 BACKCAST_DATA_DIR が設定されている → その値を使用
2. （上記なし） → <exe のあるディレクトリ>/data を使用（ポータブルモード）
```

Steam では起動オプションに環境変数を渡す必要はない。
`<installdir>/data` がデフォルトになるためそのまま動く。

`std::env::current_exe()` で exe パスを取得し、その親ディレクトリ + `/data` を
デフォルトのルートとする。これにより `AppHandle` 初期化前（ログ設定時）でも
同じロジックを使える。

### 目標フォルダ構成

```
steamapps/common/backcast/
├── backcast.exe
├── resources/
│   ├── binaries/
│   │   └── uv.exe
│   ├── resources/
│   │   ├── marimo/          ← Python ソース（バンドル済み）
│   │   ├── files/           ← サンプルノートブック
│   │   └── pyproject.toml など
│   └── ...
└── data/                    ← 初回起動時に自動生成
    ├── marimo-env/          ← Python venv
    ├── python/              ← Python インタープリター
    ├── logs/
    │   └── marimo-desktop.log   ← Rust ログ（get_log_dir()）
    ├── cache/
    │   └── marimo/
    │       └── logs/            ← Python ログ（marimo_log_dir()）
    ├── notebooks/           ← ユーザーノートブック
    ├── state/
    │   └── recent_files.toml
    └── config/
        └── marimo/
            └── marimo.toml      ← XDG_CONFIG_HOME=data/config → data/config/marimo/marimo.toml
```

> **ログが 2 か所に分かれる理由:**
> Rust 側のログ (`get_log_dir()`) は `data/logs/` に書き込む。
> Python 側のログ (`marimo_log_dir()`) は `XDG_CACHE_HOME/marimo/logs/` = `data/cache/marimo/logs/` に書き込む。
> 同一の `data/logs/` にまとめることは現在の xdg.py の構造上困難なため、2 か所のままとする。

---

---

## 実装状況（2026-02-18 完了）

すべての実装が完了し、`cargo check` / `cargo check --features steam` 両方でコンパイル成功を確認済み。

### 実装済みタスク

| Step | ファイル | 状態 |
|------|---------|------|
| Step 1 | `src-tauri/src/paths.rs` | ✅ 完了 |
| Step 2 | `src-tauri/src/lib.rs` | ✅ 完了 |
| Step 3 | `src-tauri/src/server/lifecycle.rs` | ✅ 完了 |
| Step 4 | `src-tauri/src/environment/bootstrap.rs` | ✅ 変更不要（引数渡しで自動追従） |
| Step 5 | `marimo/_utils/xdg.py` | ✅ 完了 |
| Step 6 | `src-tauri/Cargo.toml` | ✅ 完了 |
| Step 7 | `src-tauri/tauri-steam.conf.json` | ✅ 新規作成済み |
| Step 8 | `.github/workflows/release-steam.yml` | ✅ 完了 |

### 実装の知見・Tips

#### `cargo check` vs `cargo check --features steam`
- `cfg!(feature = "steam")` はコンパイル時フラグのため、両方でチェックが必要。
- 通常の `cargo check` では `is_portable = false` パスのみが評価される。

#### `bundle/nsis/_/` パスの要事前確認
- Windows CI で `--features steam` + `--config src-tauri/tauri-steam.conf.json` でビルド後、
  `target/release/bundle/nsis/` 以下のディレクトリ構造を実際に確認すること。
- ステージングディレクトリ名はTauriバージョンによって異なる可能性がある（`_/` が正しいかを確認）。
- `if-no-files-found: error` を付けているので CI でパスが違えばすぐに検知できる。

#### macOS の公証（Notarization）
- Steam に上げる `.app` バンドルが Apple 公証を通っているか確認が必要。
- 現行 CI の macOS 署名ステップが `bundle/macos/` を対象にしていること（`bundle/dmg/` でない）を確認する。

#### MARIMO_STATE_DIR の設計理由
- Windows では `XDG_STATE_HOME` が marimo の Python 側コードで無視される（`os.name == "posix"` の分岐）。
- そのため `MARIMO_STATE_DIR` という専用環境変数でオーバーライドする方式を採用。
- `XDG_CONFIG_HOME` と `XDG_CACHE_HOME` は既存の xdg.py ロジックがそのまま追従するので変更不要。

#### ポータブルモードのトリガー条件（優先順）
1. `BACKCAST_DATA_DIR` 環境変数（任意のパスを指定可能）
2. `--features steam` でコンパイル（CI 専用）
3. `BACKCAST_PORTABLE=1` 環境変数（デバッグ・テスト用）

---

## 実装手順と変更ファイル

### Step 1: `src-tauri/src/paths.rs`

`get_data_root()` を新設し、全パス関数がこれを経由するよう変更する。
`AppHandle` が不要な時点（ログ初期化）でも使えるよう
`std::env::current_exe()` ベースのフォールバックを持たせる。

**追加: `get_data_root()`**

```rust
/// データルートディレクトリを返す。
/// 優先順:
///   1. BACKCAST_DATA_DIR 環境変数
///   2. Steam 版ビルド (feature = "steam") または BACKCAST_PORTABLE=1 →
///      <exe のディレクトリ>/data（ポータブルモード）
///   3. 通常配布版 → None を返し、呼び出し側が AppData ベースのパスを使う
pub fn get_data_root() -> Option<PathBuf> {
    // 明示的な env var が最優先
    if let Ok(dir) = std::env::var("BACKCAST_DATA_DIR") {
        if !dir.trim().is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
    // Steam 版ビルド または BACKCAST_PORTABLE=1 の場合はポータブルモード
    let is_portable = cfg!(feature = "steam")
        || std::env::var("BACKCAST_PORTABLE").as_deref() == Ok("1");
    if is_portable {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(exe_dir) = exe.parent() {
                return Some(exe_dir.join("data"));
            }
        }
    }
    None // 通常配布版: 呼び出し側が AppData を使う
}
```

> `get_data_root()` が `None` を返す場合は各パス関数が従来の AppData ベースのパスにフォールバックする。
> `AppHandle` 引数は「フォールバック時にのみ」必要なため、引数は残す。

**変更: 各パス関数を `get_data_root()` 経由にしつつ `AppHandle` は維持**

`get_data_root()` が `Some(root)` を返す場合はそこから派生し、
`None` の場合は従来の AppData ベースのパスを返す。
`&tauri::AppHandle` 引数はフォールバック用に残す。

| 関数 | Steam 版 (`Some(root)`) | 通常配布版 (`None`) |
|------|------------------------|-------------------|
| `get_env_dir(app)` | `root.join("marimo-env")` | `app_data_dir.join("marimo-env")` |
| `get_python_install_dir(app)` | `root.join("python")` | `app_data_dir.join("python")` |
| `get_log_dir(app)` | `root.join("logs")` | `app_data_dir.join("logs")` |
| `get_notebooks_dir(app)` | `root.join("notebooks")` | `config_dir/marimo/notebooks` |
| `get_recent_files_path()` | `root/state/recent_files.toml` | 従来の `~/.marimo/...` |

> **`get_uv_bin()` と `get_marimo_source()`** はリソースバンドル参照のため変更不要。
>
> **`copy_sample_files_to_notebooks()`** は `app.path().resource_dir()` でバンドルリソースを
> 参照しているため、この関数への `&AppHandle` 引数は削除しない。

---

### Step 2: `src-tauri/src/lib.rs`

**変更: `get_log_file_path()`**

`get_data_root()` が `Some` を返す場合はそこから派生し、`None`（通常配布版）の場合は
既存のプラットフォーム別ロジックにフォールバックする。

```rust
fn get_log_file_path() -> PathBuf {
    if let Some(root) = paths::get_data_root() {
        return root.join("logs").join("marimo-desktop.log");
    }
    // 通常配布版フォールバック: 既存のプラットフォーム別ロジックを維持
    #[cfg(target_os = "windows")]
    { /* 既存の APPDATA ベースのロジック */ }
    #[cfg(not(target_os = "windows"))]
    { /* 既存の HOME ベースのロジック */ }
}
```

**変更: `setup()` 内の呼び出しは引き続き `app` を渡す**

各パス関数は `AppHandle` 引数を維持するため、呼び出し側の変更は不要。
`get_log_file_path()` のみ `get_data_root()` を直接使うよう修正する（AppHandle 未初期化のため）。

---

### Step 3: `src-tauri/src/server/lifecycle.rs`

**変更: `start_server()` に XDG 環境変数を追加**

Python サブプロセスを起動する `env` HashMap を構築している箇所に追記:

```rust
if let Some(data_root) = paths::get_data_root() {
    env.insert("XDG_CONFIG_HOME".into(), data_root.join("config").to_string_lossy().into_owned());
    env.insert("XDG_CACHE_HOME".into(),  data_root.join("cache").to_string_lossy().into_owned());
    env.insert("MARIMO_STATE_DIR".into(), data_root.join("state").to_string_lossy().into_owned());
}
```

> `get_data_root()` が `None`（通常配布版）の場合は env var を注入しない。
> Python は従来どおり `AppData` / `~/.marimo` ベースのパスを使う。

これにより Python 側の `marimo_config_path()`, `marimo_cache_dir()`,
`marimo_log_dir()`, `marimo_state_dir()` がすべて `data/` 配下を指す。

---

### Step 4: `src-tauri/src/environment/bootstrap.rs`

**原則変更不要**

`ensure_environment()` は `env_dir`, `python_install_dir` などを引数として受け取るため、
`paths::*` 関数のシグネチャに依存しない。`lib.rs` の呼び出し側（Step 2）が
`get_data_root()` を通じた正しいパスを渡すため、このファイルの変更は原則不要。

**確認済み: `UV_PYTHON_INSTALL_DIR` の受け渡し**

`bootstrap.rs` の `find_python()` と `install_python()` 両方で:

```rust
.env("UV_PYTHON_INSTALL_DIR", python_install_dir)
```

が正しく設定されている。`python_install_dir` は `lib.rs` から引数として渡されるため、
`get_data_root()` ベースのパスが自動的に使われる。追加変更不要。

---

### Step 5: `marimo/_utils/xdg.py`

**変更: `MARIMO_STATE_DIR` オーバーライドを追加**

Windows では `XDG_STATE_HOME` が無視されるため専用の env var で対処:

```python
def marimo_state_dir() -> Path:
    override = os.getenv("MARIMO_STATE_DIR")
    if override and override.strip():
        return Path(override)
    if os.name == "posix":
        return xdg_state_home() / "marimo"
    else:
        return home_path() / ".marimo"
```

`XDG_CONFIG_HOME` と `XDG_CACHE_HOME` はすでに `xdg.py` で参照されているため、
Rust 側から env を設定するだけで追従する。変更不要。

---

### Step 6: `src-tauri/Cargo.toml`

**変更: `steam` feature を追加**

```toml
[features]
default = []
steam = []
```

Steam 向け CI ビルド時は `cargo tauri build --features steam` を使う。
通常配布ビルドは `cargo tauri build`（features なし）で従来動作を維持。

---

### Step 7: `src-tauri/tauri-steam.conf.json`（新規作成）

Steam 版の設定は **既存の `tauri.conf.json` を変更せず**、専用の設定ファイルを新規作成する。
これにより通常配布 CI に影響を与えない。

`tauri-steam.conf.json` は差分のみ記述し、Tauri が `tauri.conf.json` とマージする:

```json
{
  "bundle": {
    "targets": ["nsis", "app", "appimage"],
    "windows": {
      "webviewInstallMode": {
        "type": "skip"
      }
    }
  }
}
```

> **`targets` の設定理由:**
> - **Windows `nsis`**: インストーラーの生成は副産物として許容し、Steam depot には
>   ステージングディレクトリ（`bundle/nsis/_/`）の内容をアップロードする。
>   `webviewInstallMode: skip` により WebView2 BootStrapper のダウンロードは行われない。
> - **macOS `app`**: `.app` バンドル（`bundle/macos/*.app`）を生成。
>   Steam には `.app` バンドルが必要なため `dmg` でなくこちらを使う。
>   Tauri v2 では `"app"` ターゲットを指定する。
> - **Linux `appimage`**: 従来通り（変更なし）。

Steam ビルド時は `--config src-tauri/tauri-steam.conf.json` で指定する（Step 8 参照）。
通常配布 CI は既存の `tauri.conf.json` をそのまま使い続ける。

---

### Step 8: `.github/workflows/release-steam.yml`

#### 問題: 現在の workflow は NSIS インストーラーを Steam に上げている

現在の Windows アップロードパス:

```yaml
path: src-tauri/target/release/bundle/nsis/
```

このディレクトリには `backcast_x64-setup.exe`（インストーラー）が入っており、
Steam がユーザーに配信するゲーム本体のファイル群ではない。

#### 変更: Windows depot をゲームファイルで組み立てる

Tauri が NSIS ビルド時に生成するステージングディレクトリ（`bundle/nsis/_/`）には
インストーラー生成前のファイル群（`backcast.exe` + `resources/`）が展開される。
Steam depot には **このステージングディレクトリの内容**をアップロードする。

> **⚠️ 要事前確認:** `bundle/nsis/_/` の正確なパスは Tauri バージョンに依存する。
> ローカルビルドで `target/release/bundle/nsis/` 以下を確認し、`backcast.exe` が置かれる
> サブディレクトリのパスを特定してから CI に反映すること。

```yaml
# 変更前
- name: 📤 Upload Windows artifacts (Steam)
  uses: actions/upload-artifact@v4
  with:
    name: steam-windows-${{ env.MARIMO_VERSION }}
    path: src-tauri/target/release/bundle/nsis/    # ← インストーラー本体

# 変更後
- name: 📤 Upload Windows artifacts (Steam)
  uses: actions/upload-artifact@v4
  with:
    name: steam-windows-${{ env.MARIMO_VERSION }}
    path: src-tauri/target/release/bundle/nsis/_/  # ← ゲームファイル群（パス要確認）
    if-no-files-found: error
```

ビルドコマンドに `--features steam` と `--config` を追加する:

```yaml
# 変更前
- name: 🔨 Build Tauri app (Steam)
  run: cargo tauri build

# 変更後
- name: 🔨 Build Tauri app (Steam)
  run: cargo tauri build --features steam --config src-tauri/tauri-steam.conf.json
```

#### 変更: macOS のアップロードパスを .app に変更

現在は `.dmg` をアップロードしているが、Steam には `.app` バンドルが必要:

```yaml
# 変更前
path: src-tauri/target/release/bundle/dmg/

# 変更後
path: src-tauri/target/release/bundle/macos/
```

#### Linux は変更不要

`bundle/appimage/` に生成される `.AppImage` は Steam Linux Runtime で動作する。
パスはそのまま維持。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src-tauri/src/paths.rs` | `get_data_root() -> Option<PathBuf>` 追加。各パス関数に Steam/通常配布の分岐を追加（`AppHandle` 引数は維持） |
| `src-tauri/src/lib.rs` | `get_log_file_path()` を `get_data_root()` ベースに変更（`None` 時は既存ロジックにフォールバック） |
| `src-tauri/src/server/lifecycle.rs` | `start_server()` で `get_data_root()` が `Some` の場合のみ XDG env 変数を Python プロセスに注入 |
| `marimo/_utils/xdg.py` | `marimo_state_dir()` に `MARIMO_STATE_DIR` オーバーライドを追加 |
| `src-tauri/tauri-steam.conf.json` | 新規作成。`webviewInstallMode: skip`、`targets` を `["nsis", "app", "appimage"]` に設定 |
| `src-tauri/Cargo.toml` | `[features]` に `steam = []` を追加 |
| `.github/workflows/release-steam.yml` | Windows: depot パスを `bundle/nsis/_/` に変更、`--features steam` を追加。macOS: depot パスを `bundle/macos/` に変更 |

**変更しないファイル:**

- `src-tauri/nsis/hooks.nsh` — 通常配布（NSIS ビルド）のために残す
- `src-tauri/src/window/splash.rs` — 変更不要
- `src-tauri/src/state.rs` — 変更不要
- `src-tauri/src/environment/bootstrap.rs` — `ensure_environment()` は引数でパスを受け取るため変更不要

---

## 動作フロー

### 初回起動

```
Steam が steamapps/common/backcast/ にファイルを配信
        ↓
backcast.exe を起動
        ↓
paths::get_data_root() → <exe_dir>/data（BACKCAST_DATA_DIR 未設定時）
        ↓
get_log_file_path() → data/logs/marimo-desktop.log
ログディレクトリを作成して初期化
        ↓
スプラッシュ画面を表示
        ↓
ensure_environment(uv_bin, data/marimo-env/, data/python/, resources/marimo/)
  ├─ data/python/ にインストール済み Python がない
  │   → uv python install 3.13 (UV_PYTHON_INSTALL_DIR=data/python/)
  ├─ data/marimo-env/ に venv がない
  │   → uv venv --seed --python ... data/marimo-env/
  └─ marimo を pip install (uv pip install resources/marimo[game])
        ↓
copy_sample_files_to_notebooks() → data/notebooks/
seed_recent_files()              → data/state/recent_files.toml
        ↓
Python サーバー起動時に env を設定:
  XDG_CONFIG_HOME = data/config
  XDG_CACHE_HOME  = data/cache
  MARIMO_STATE_DIR = data/state
        ↓
marimo サーバー起動 → ヘルスチェック → メインウィンドウを開く
```

### 2 回目以降

```
backcast.exe を起動
        ↓
get_data_root() → data/ (既存)
        ↓
ensure_environment() → venv Python の存在確認のみ（即完了）
        ↓
marimo サーバー起動 → メインウィンドウ
```

---

## 懸念事項・リスク

| 項目 | 内容 | 対処 |
|------|------|------|
| WebView2 未インストール | `skip` モードでは Tauri 自体が起動しない | Windows 11 + Windows 10 (2021/10 以降) では搭載済みのため許容。エラー時は OS 標準ダイアログが表示される |
| `paths.rs` の変更影響範囲 | 各パス関数は `AppHandle` 引数を維持するため呼び出し側の変更は最小限。`get_log_file_path()` と XDG env 注入の 2 箇所のみ変更が必要 | 変更量は少ない |
| Python venv の再構築 | データルートが変わると既存 venv は使えない（絶対パスが埋め込まれる） | 初回は自動で再構築される。既存ユーザーのデータ移行は別タスクで対応 |
| NSIS + Program Files での書き込み失敗 | `<exe_dir>/data` をデフォルトにすると UAC で書き込み拒否される | Steam 版と通常配布版をビルド時に分離（`feature = "steam"` または `BACKCAST_PORTABLE=1`）。NSIS 版は従来の AppData ベースのまま |
| Steam Cloud 同期 | `data/marimo-env/` や `data/python/` まで同期すると巨大になる | Steam デポ設定で `data/state/` と `data/notebooks/` のみを同期対象にする |
| 初回起動時のネットワーク依存 | `uv python install 3.13` はインターネット接続が必要。Steam オフラインモードでは失敗する | スプラッシュ画面のエラーメッセージに「インターネット接続が必要です（初回のみ）」を追記する。別タスクで対応 |
| `bundle/nsis/_/` パスの不確実性 | ステージングディレクトリのパスは Tauri バージョンに依存する | ローカルビルドで `target/release/bundle/nsis/` 以下を確認してから CI に反映する（Step 8 参照） |
| macOS の公証（Notarization） | Steam に上げる `.app` は Apple の公証が要求される場合がある | 現行 CI の macOS 署名・公証ステップが `bundle/macos/` を対象にしていることを確認する |
