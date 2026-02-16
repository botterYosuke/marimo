use std::path::PathBuf;

use log::info;
use tauri::Manager;

use crate::error::AppError;
use crate::state::{BootstrapState, LogEntry, ServerState};
use crate::window;

#[tauri::command]
pub fn server_get_url(app: tauri::AppHandle) -> Result<String, AppError> {
    let server_state = app.state::<ServerState>();
    let port = *server_state.port.lock().unwrap();
    Ok(format!("http://localhost:{}", port))
}

#[tauri::command]
pub async fn server_get_status(app: tauri::AppHandle) -> Result<String, AppError> {
    let server_state = app.state::<ServerState>();
    let status = server_state.status.lock().unwrap().clone();
    let json = serde_json::to_string(&status).unwrap();
    Ok(json)
}

#[tauri::command]
pub fn server_get_logs(app: tauri::AppHandle) -> Result<Vec<LogEntry>, AppError> {
    let server_state = app.state::<ServerState>();
    let logs = server_state.log_buffer.lock().unwrap().clone();
    Ok(logs)
}

#[tauri::command]
pub async fn server_restart(app: tauri::AppHandle) -> Result<String, AppError> {
    let server_state = app.state::<ServerState>();
    let port = *server_state.port.lock().unwrap();

    // Stop current server
    crate::server::lifecycle::stop_server(&app);

    // Start new server
    crate::server::lifecycle::start_server(&app, port)
        .await
        .map_err(|e| AppError::Server(e.to_string()))?;

    Ok("Server restarted".to_string())
}

#[tauri::command]
pub async fn window_open_notebook(
    app: tauri::AppHandle,
    file_path: Option<String>,
) -> Result<(), AppError> {
    // Don't resolve paths here — the Python backend handles all path resolution.
    // Its LazyListOfFilesAppFileRouter resolves relative paths against its own
    // directory, and recognizes __new__ prefixes for new notebooks.
    let path = file_path.map(PathBuf::from);
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        if let Err(e) = window::manager::open_window(&app_clone, path.as_deref()) {
            log::error!("Failed to open notebook window: {}", e);
        }
    })
    .map_err(|e| AppError::Window(e.to_string()))
}

#[tauri::command]
pub async fn window_open_home(app: tauri::AppHandle) -> Result<(), AppError> {
    let app_clone = app.clone();
    app.run_on_main_thread(move || {
        if let Err(e) = window::manager::open_window(&app_clone, None) {
            log::error!("Failed to open home window: {}", e);
        }
    })
    .map_err(|e| AppError::Window(e.to_string()))
}

#[tauri::command]
pub fn window_toggle_fullscreen(app: tauri::AppHandle) -> Result<(), AppError> {
    let windows = app.webview_windows();
    let win = windows
        .values()
        .find(|w| w.is_focused().unwrap_or(false))
        .or_else(|| windows.values().next());
    if let Some(win) = win {
        let is_fullscreen = win.is_fullscreen().unwrap_or(false);
        let _ = win.set_fullscreen(!is_fullscreen);
    }
    Ok(())
}

#[tauri::command]
pub async fn window_open_dialog(app: tauri::AppHandle) -> Result<(), AppError> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .add_filter("Python files", &["py"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let path_buf = path.into_path().unwrap();
        let app_clone = app.clone();
        app.run_on_main_thread(move || {
            if let Err(e) = window::manager::open_window(&app_clone, Some(&path_buf)) {
                log::error!("Failed to open dialog-selected notebook: {}", e);
            }
        })
        .map_err(|e| AppError::Window(e.to_string()))?;
    }

    Ok(())
}

/// Response for bootstrap progress queries.
#[derive(serde::Serialize)]
pub struct BootstrapProgress {
    pub status: String,
    pub current_step: String,
    pub progress_percent: u8,
}

#[tauri::command]
pub fn bootstrap_get_progress(app: tauri::AppHandle) -> Result<BootstrapProgress, AppError> {
    let bootstrap_state = app.state::<BootstrapState>();
    let status = bootstrap_state.status.lock().unwrap().clone();
    let current_step = bootstrap_state.current_step.lock().unwrap().clone();
    let progress_percent = *bootstrap_state.progress_percent.lock().unwrap();

    let status_str = match status {
        crate::state::BootstrapStatus::NotStarted => "NotStarted",
        crate::state::BootstrapStatus::InProgress => "InProgress",
        crate::state::BootstrapStatus::Completed => "Completed",
        crate::state::BootstrapStatus::Error(_) => "Error",
    }
    .to_string();

    Ok(BootstrapProgress {
        status: status_str,
        current_step,
        progress_percent,
    })
}
