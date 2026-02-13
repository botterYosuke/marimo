use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use serde::Serialize;
use tauri::WebviewWindow;

/// Server information stored as app state.
pub struct ServerState {
    pub port: Mutex<u16>,
    pub pid: Mutex<Option<u32>>,
    pub status: Mutex<ServerStatus>,
    pub log_buffer: Mutex<Vec<LogEntry>>,
}

/// Tracks open windows by their file path.
pub struct WindowState {
    /// Maps file path -> window label. None key = home page.
    pub windows: Mutex<HashMap<Option<PathBuf>, String>>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum ServerStatus {
    Starting,
    Running,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            port: Mutex::new(0),
            pid: Mutex::new(None),
            status: Mutex::new(ServerStatus::Stopped),
            log_buffer: Mutex::new(Vec::new()),
        }
    }

    pub fn add_log(&self, level: &str, message: &str) {
        let entry = LogEntry {
            timestamp: chrono_now(),
            level: level.to_string(),
            message: message.to_string(),
        };
        let mut buf = self.log_buffer.lock().unwrap();
        buf.push(entry);
        // Keep max 1000 entries
        if buf.len() > 1000 {
            buf.drain(0..buf.len() - 1000);
        }
    }
}

impl WindowState {
    pub fn new() -> Self {
        Self {
            windows: Mutex::new(HashMap::new()),
        }
    }
}

fn chrono_now() -> String {
    // Simple ISO-ish timestamp without chrono crate
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}
