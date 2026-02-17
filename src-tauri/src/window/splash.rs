use anyhow::Result;
use log::info;
use tauri::{menu::Menu, Manager, WebviewUrl, WebviewWindowBuilder};

/// Show the splash window during environment bootstrap.
pub fn show_splash_window(app: &tauri::AppHandle) -> Result<()> {
    info!("┌────────────────────────────────────────┐");
    info!("│   🚀 SHOWING SPLASH SCREEN             │");
    info!("└────────────────────────────────────────┘");

    // Use WebviewUrl::App to load static HTML file from frontend/dist
    info!("Loading splash.html from App protocol...");

    // Create empty menu to hide menu bar
    let empty_menu = Menu::new(app)?;

    let window = WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash.html".into()))
        .title("backcast - 🚀 起動準備中...")
        .inner_size(500.0, 200.0)
        .resizable(false)
        .decorations(true)
        .menu(empty_menu)
        .center()
        .always_on_top(false)
        .visible(true)
        .build()?;

    info!("✅ Splash window created successfully: label={}", window.label());
    info!("✅ Splash window visible: {:?}", window.is_visible());

    // Update title to show loading status
    if let Err(e) = window.set_title("backcast - 読み込み中...") {
        log::error!("❌ Failed to set initial splash title: {}", e);
    } else {
        info!("✅ Splash window title set: backcast - 読み込み中...");
    }

    Ok(())
}

/// Update splash screen progress from Rust.
pub fn update_splash_progress(app: &tauri::AppHandle, message: &str, percent: u8) {
    // Log progress update to file
    info!("🔵 SPLASH PROGRESS: [{}%] {}", percent, message);

    if let Some(window) = app.get_webview_window("splash") {
        // Update window title (always works, even if HTML isn't ready)
        let title = format!("backcast - [{}%] {}", percent, message);
        if let Err(e) = window.set_title(&title) {
            log::error!("❌ Failed to update splash title: {}", e);
        } else {
            info!("✅ Splash title updated: {}", title);
        }

        // Also try to update HTML content
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
            log::error!("❌ Failed to update splash UI: {}", e);
            // Even if JS eval fails, title is still updated, so we're ok
        } else {
            info!("✅ Splash UI updated successfully: {} ({}%)", message, percent);
        }
    } else {
        log::warn!("⚠️ Splash window not found when trying to update progress");
        // Window not found - nothing we can do
    }
}

/// Show error message on splash screen.
pub fn show_splash_error(app: &tauri::AppHandle, error_message: &str) {
    log::error!("🔴 SPLASH ERROR: {}", error_message);

    if let Some(window) = app.get_webview_window("splash") {
        // Update window title with error
        let title = format!("backcast - エラー: {}", error_message);
        if let Err(e) = window.set_title(&title) {
            log::error!("❌ Failed to update splash title with error: {}", e);
        }

        let msg_escaped = error_message
            .replace('\\', "\\\\")
            .replace('\'', "\\'")
            .replace('"', r#"\""#)
            .replace('\n', "\\n");

        let js = format!(
            r#"
            try {{
                const statusEl = document.getElementById('status');
                const progressEl = document.getElementById('progress');
                const errorEl = document.getElementById('error');

                // Hide progress
                if (progressEl) progressEl.parentElement.style.display = 'none';

                // Show error
                if (statusEl) statusEl.textContent = 'エラーが発生しました';
                if (errorEl) {{
                    errorEl.textContent = '{}';
                    errorEl.style.display = 'block';
                }}
            }} catch(e) {{
                console.error('Failed to show error:', e);
            }}
            "#,
            msg_escaped
        );

        if let Err(e) = window.eval(&js) {
            log::error!("❌ Failed to show error on splash: {}", e);
        } else {
            info!("✅ Error displayed on splash screen");
        }
    } else {
        log::warn!("⚠️ Splash window not found when trying to show error");
    }
}

/// Close the splash window.
pub fn close_splash_window(app: &tauri::AppHandle) {
    info!("┌────────────────────────────────────────┐");
    info!("│   🏁 CLOSING SPLASH SCREEN             │");
    info!("└────────────────────────────────────────┘");

    if let Some(window) = app.get_webview_window("splash") {
        // Update title before closing
        if let Err(e) = window.set_title("backcast - 🏁 起動完了") {
            log::error!("❌ Failed to set closing splash title: {}", e);
        } else {
            info!("✅ Splash closing title set: backcast - 🏁 起動完了");
        }

        match window.close() {
            Ok(_) => info!("✅ Splash window closed successfully"),
            Err(e) => log::error!("❌ Failed to close splash window: {}", e),
        }
    } else {
        log::warn!("⚠️ Splash window not found when trying to close");
    }
}
