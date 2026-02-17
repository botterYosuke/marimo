use std::path::PathBuf;

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
/// Located in the app's data directory.
pub fn get_env_dir(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    data_dir.join("marimo-env")
}

/// Get the directory for Python installations.
/// Located in the app's data directory.
pub fn get_python_install_dir(app: &tauri::AppHandle) -> PathBuf {
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
pub fn get_log_dir(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    data_dir.join("logs")
}

/// Get the notebooks workspace directory.
/// Uses %APPDATA%/marimo/notebooks (same location as other marimo settings).
pub fn get_notebooks_dir(app: &tauri::AppHandle) -> PathBuf {
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

/// 最近開いたファイルのうち、最初に存在するファイルのパスを返す。
/// recent_files.toml がない、または有効なファイルがない場合は None。
///
/// Python 側 (marimo/_utils/xdg.py) と同じパス解決ロジックを使用:
/// - Windows: {USERPROFILE}/.marimo/recent_files.toml
/// - Unix:    {XDG_STATE_HOME:-~/.local/state}/marimo/recent_files.toml
pub fn get_most_recent_valid_file() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let toml_path = {
        let home = std::env::var("USERPROFILE").ok()?;
        PathBuf::from(home).join(".marimo").join("recent_files.toml")
    };
    #[cfg(not(target_os = "windows"))]
    let toml_path = {
        let state_home = std::env::var("XDG_STATE_HOME")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                let home = std::env::var("HOME").ok()?;
                Some(PathBuf::from(home).join(".local").join("state"))
            })?;
        state_home.join("marimo").join("recent_files.toml")
    };

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
