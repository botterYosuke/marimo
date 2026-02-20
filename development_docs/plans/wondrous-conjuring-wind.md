# Fix: Intel Mac で venv の Python バージョン不一致によるインストール失敗

## Context

`UV_PYTHON_PREFERENCE=only-managed` を追加した後、Intel Mac で marimo のインストールが失敗する。

**原因**: `only-managed` 追加前に一度アプリを起動したことで、システム Python 3.9.6 で作られた古い venv が残っている。`only-managed` 追加後のコードは Python 3.13 を正しくインストールするが、既存の venv（Python 3.9.6）がそのまま再利用され、`pip install` が `Python>=3.10` 要件で失敗する。

**ログの流れ (現在のエラー)**:
1. `find_python` → None（managed Python なし）
2. `install_python` → Python 3.13.4 インストール成功
3. `find_python` → Python 3.13.4 発見
4. **`Venv already exists`** → venv 再作成をスキップ（ここが問題）
5. `uv pip install` → venv の Python 3.9.6 を使用 → 失敗

## 修正方針

[bootstrap.rs](src-tauri/src/environment/bootstrap.rs) の venv 存在チェック（L72-74）を拡張し、venv の Python バージョンを検証する。バージョンが `>=3.10` を満たさない場合、venv を削除して再作成する。

## 修正箇所

**ファイル**: [bootstrap.rs](src-tauri/src/environment/bootstrap.rs)

### 1. venv の Python バージョンチェック関数を追加

```rust
/// Check the Python version in an existing venv.
/// Returns the version string (e.g., "3.9.6") or None if check fails.
fn get_venv_python_version(venv_python: &Path) -> Option<String> {
    let mut cmd = Command::new(venv_python);
    cmd.args(["--version"]);
    no_window(&mut cmd);
    let output = cmd.output().ok()?;
    if output.status.success() {
        // Output format: "Python 3.x.y"
        let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        version_str.strip_prefix("Python ").map(|v| v.to_string())
    } else {
        None
    }
}

/// Check if a version string satisfies >=3.10
fn is_python_version_compatible(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() >= 2 {
        if let (Ok(major), Ok(minor)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
            return major > 3 || (major == 3 && minor >= 10);
        }
    }
    false
}
```

### 2. venv 存在チェックのロジックを修正 (L72-76)

既存:
```rust
let venv_python = paths::get_venv_python(env_dir);
let venv_exists = venv_python.exists();

if !venv_exists {
```

修正後:
```rust
let venv_python = paths::get_venv_python(env_dir);
let mut venv_exists = venv_python.exists();

// Check if existing venv has compatible Python version
if venv_exists {
    let needs_recreate = match get_venv_python_version(&venv_python) {
        Some(version) => {
            info!("Existing venv Python version: {}", version);
            if !is_python_version_compatible(&version) {
                info!("⚠️ Venv Python {} is < 3.10, will recreate venv", version);
                true
            } else {
                false
            }
        }
        None => {
            info!("⚠️ Could not determine venv Python version, will recreate venv");
            true
        }
    };
    if needs_recreate {
        info!("Removing incompatible venv...");
        if let Err(e) = std::fs::remove_dir_all(env_dir) {
            log::warn!("Failed to remove incompatible venv: {}", e);
        }
        venv_exists = false;
    }
}

if !venv_exists {
```

## 検証方法

1. Intel Mac で以下を確認:
   - `marimo-env` ディレクトリを手動で残した状態でアプリを起動
   - venv の Python バージョンチェックが動作し、古い venv が再作成されることを確認
2. 他のプラットフォーム（Windows, Apple Silicon Mac）で回帰がないことを確認
3. 初回起動（venv なし）のケースが正常に動作することを確認
