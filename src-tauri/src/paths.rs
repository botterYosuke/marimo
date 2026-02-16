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
