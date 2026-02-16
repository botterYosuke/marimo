use anyhow::Result;
use log::info;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Splash HTML embedded at compile time
const SPLASH_HTML: &str = include_str!("../../splash.html");

/// Show the splash window during environment bootstrap.
pub fn show_splash_window(app: &tauri::AppHandle) -> Result<()> {
    info!("=== Attempting to show splash screen ===");

    // Create a data URL with the HTML content
    let html_escaped = SPLASH_HTML
        .replace('\\', "\\\\")
        .replace('\n', "")
        .replace('\r', "")
        .replace('"', r#"\""#);

    info!("Splash HTML prepared (length: {} chars)", html_escaped.len());

    let data_url = format!("data:text/html;charset=utf-8,{}", urlencoding::encode(&html_escaped));
    info!("Data URL created (length: {} chars)", data_url.len());

    info!("Building splash window...");
    let window = WebviewWindowBuilder::new(app, "splash", WebviewUrl::External(data_url.parse()?))
        .title("marimo - 起動中")
        .inner_size(450.0, 350.0)
        .resizable(false)
        .decorations(false)
        .center()
        .always_on_top(true)
        .visible(true)
        .build()?;

    info!("✅ Splash window created successfully: label={}", window.label());
    info!("Splash window visible: {:?}", window.is_visible());

    Ok(())
}

/// Update splash screen progress from Rust.
pub fn update_splash_progress(app: &tauri::AppHandle, message: &str, percent: u8) {
    if let Some(window) = app.get_webview_window("splash") {
        info!("Updating splash progress: {} ({}%)", message, percent);
        let msg_escaped = message.replace('\\', "\\\\").replace('\'', "\\'").replace('"', r#"\""#);
        let js = format!(
            r#"
            try {{
                const statusEl = document.getElementById('status');
                const progressEl = document.getElementById('progress');
                const percentEl = document.getElementById('percent');
                if (statusEl) statusEl.textContent = '{}';
                if (progressEl) progressEl.style.width = '{}%';
                if (percentEl) percentEl.textContent = '{}%';
            }} catch(e) {{
                console.error('Failed to update splash:', e);
            }}
            "#,
            msg_escaped, percent, percent
        );
        if let Err(e) = window.eval(&js) {
            log::error!("Failed to eval splash update script: {}", e);
        }
    } else {
        log::warn!("Splash window not found when trying to update progress");
    }
}

/// Close the splash window.
pub fn close_splash_window(app: &tauri::AppHandle) {
    info!("Attempting to close splash window...");
    if let Some(window) = app.get_webview_window("splash") {
        match window.close() {
            Ok(_) => info!("✅ Splash window closed successfully"),
            Err(e) => log::error!("Failed to close splash window: {}", e),
        }
    } else {
        log::warn!("Splash window not found when trying to close");
    }
}
