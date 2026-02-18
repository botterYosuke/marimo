use std::path::PathBuf;

/// データルートディレクトリを返す。
///
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

/// Get the path to the bundled `uv` binary.
/// In production, it's in the app's resource directory.
/// In development, we assume `uv` is on the PATH.
pub fn get_uv_bin(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        // Development: use system uv
        if cfg!(windows) {
            PathBuf::from("uv.exe")
        } else {
            PathBuf::from("uv")
        }
    } else {
        // Production: bundled uv in resources
        let resource_dir = app
            .path()
            .resource_dir()
            .expect("failed to get resource dir");
        let bin_name = if cfg!(windows) { "uv.exe" } else { "uv" };
        resource_dir.join("binaries").join(bin_name)
    }
}

/// Get the venv directory for the marimo environment.
/// Steam 版: <exe_dir>/data/marimo-env
/// 通常配布版: AppData/marimo-env
pub fn get_env_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Some(root) = get_data_root() {
        return root.join("marimo-env");
    }
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    data_dir.join("marimo-env")
}

/// Get the directory for Python installations.
/// Steam 版: <exe_dir>/data/python
/// 通常配布版: AppData/python
pub fn get_python_install_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Some(root) = get_data_root() {
        return root.join("python");
    }
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    data_dir.join("python")
}

/// Get the Python executable path inside the venv.
pub fn get_venv_python(env_dir: &std::path::Path) -> PathBuf {
    if cfg!(windows) {
        env_dir.join("Scripts").join("python.exe")
    } else {
        env_dir.join("bin").join("python")
    }
}

/// Get the log directory.
/// Steam 版: <exe_dir>/data/logs
/// 通常配布版: AppData/logs
pub fn get_log_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Some(root) = get_data_root() {
        return root.join("logs");
    }
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    data_dir.join("logs")
}

/// Get the notebooks workspace directory.
/// Steam 版: <exe_dir>/data/notebooks
/// 通常配布版: %AppData%/marimo/notebooks
pub fn get_notebooks_dir(app: &tauri::AppHandle) -> PathBuf {
    if let Some(root) = get_data_root() {
        return root.join("notebooks");
    }
    let config_dir = app
        .path()
        .config_dir()
        .expect("failed to get config dir");
    config_dir.join("marimo").join("notebooks")
}

/// Get the path to the marimo source code.
/// In production, it's in the app's bundled resources.
/// In development, use MARIMO_SOURCE_PATH env var or default to parent directory.
pub fn get_marimo_source(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        // Development: Try env var first, then fall back to relative path
        if let Ok(env_path) = std::env::var("MARIMO_SOURCE_PATH") {
            PathBuf::from(env_path)
        } else {
            // Assume marimo source is in parent directory of src-tauri
            // This works when running `cargo tauri dev` from marimo root
            PathBuf::from("..")
        }
    } else {
        // Production: Use bundled marimo from resources subdirectory
        // Tauri bundles "resources/marimo" as resource_dir/resources/marimo
        let resource_dir = app
            .path()
            .resource_dir()
            .expect("failed to get resource dir");
        resource_dir.join("resources")
    }
}

use tauri::Manager;

#[derive(serde::Deserialize)]
struct RecentFilesState {
    #[serde(default)]
    files: Vec<String>,
}

/// recent_files.toml のパスを返す。
///
/// Steam 版: <exe_dir>/data/state/recent_files.toml
/// 通常配布版: Python 側 (marimo/_utils/xdg.py) と同じパス解決ロジックを使用:
/// - Windows: {USERPROFILE}/.marimo/recent_files.toml
/// - Unix:    {XDG_STATE_HOME:-~/.local/state}/marimo/recent_files.toml
pub fn get_recent_files_path() -> Option<PathBuf> {
    // ポータブルモード (Steam 版) の場合は data/state/recent_files.toml
    if let Some(root) = get_data_root() {
        return Some(root.join("state").join("recent_files.toml"));
    }

    // 通常配布版: 既存のプラットフォーム別ロジック
    #[cfg(target_os = "windows")]
    {
        let home = std::env::var("USERPROFILE").ok()?;
        Some(PathBuf::from(home).join(".marimo").join("recent_files.toml"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let state_home = std::env::var("XDG_STATE_HOME")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                let home = std::env::var("HOME").ok()?;
                Some(PathBuf::from(home).join(".local").join("state"))
            })?;
        Some(state_home.join("marimo").join("recent_files.toml"))
    }
}

/// 最近開いたファイルのうち、最初に存在するファイルのパスを返す。
/// recent_files.toml がない、または有効なファイルがない場合は None。
pub fn get_most_recent_valid_file() -> Option<PathBuf> {
    let toml_path = get_recent_files_path()?;

    if !toml_path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&toml_path).ok()?;
    let state: RecentFilesState = toml::from_str(&content).ok()?;
    for file_str in &state.files {
        let path = PathBuf::from(file_str);
        if path.exists() {
            return Some(path);
        }
    }
    None
}
