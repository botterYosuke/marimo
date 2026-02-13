use std::path::PathBuf;

use tauri::Manager;

use crate::error::AppError;
use crate::state::{LogEntry, ServerState, ServerStatus};
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
pub fn window_open_notebook(
    app: tauri::AppHandle,
    file_path: Option<String>,
) -> Result<(), AppError> {
    let path = file_path.map(PathBuf::from);
    window::manager::open_window(&app, path.as_deref())
        .map_err(|e| AppError::Window(e.to_string()))
}

#[tauri::command]
pub fn window_open_home(app: tauri::AppHandle) -> Result<(), AppError> {
    window::manager::open_window(&app, None).map_err(|e| AppError::Window(e.to_string()))
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
        let path_buf = path.path;
        window::manager::open_window(&app, Some(&path_buf))
            .map_err(|e| AppError::Window(e.to_string()))?;
    }

    Ok(())
}
