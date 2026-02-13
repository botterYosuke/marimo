use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Server error: {0}")]
    Server(String),
    #[error("Environment error: {0}")]
    Environment(String),
    #[error("Window error: {0}")]
    Window(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
