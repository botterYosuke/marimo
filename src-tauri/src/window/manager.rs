use std::path::Path;

use anyhow::Result;
use log::info;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

use crate::state::{ServerState, WindowState};

/// Create a new window for a notebook or the home page.
/// - `file_path = None` → home page
/// - `file_path = Some(path)` → notebook at that path
pub fn open_window(
    app: &tauri::AppHandle,
    file_path: Option<&Path>,
) -> Result<()> {
    let window_state = app.state::<WindowState>();
    let server_state = app.state::<ServerState>();

    let port = *server_state.port.lock().unwrap();
    let key = file_path.map(|p| p.to_path_buf());

    // Check for duplicate window
    {
        let windows = window_state.windows.lock().unwrap();
        if let Some(label) = windows.get(&key) {
            // Try to focus existing window
            if let Some(win) = app.get_webview_window(label) {
                let _ = win.set_focus();
                info!("Focused existing window: {}", label);
                return Ok(());
            }
            // Window handle is gone, remove stale entry
        }
    }

    // Build URL
    let base_url = if cfg!(debug_assertions) {
        // Use devUrl from tauri.conf.json in development for HMR
        app.config()
            .build
            .dev_url
            .as_ref()
            .map(|url| url.to_string())
            .unwrap_or_else(|| {
                log::warn!("devUrl not set in tauri.conf.json, falling back to http://localhost:3000");
                "http://localhost:3000".to_string()
            })
    } else {
        // Use marimo backend server in production
        format!("http://localhost:{}", port)
    };

    // Ensure base_url doesn't end with a slash to avoid double slashes
    let base_url = base_url.trim_end_matches('/');

    let url = match file_path {
        Some(path) => {
            let path_str = path.to_string_lossy();
            let encoded = urlencoding::encode(&path_str);
            format!("{}/?file={}", base_url, encoded)
        }
        None => format!("{}/", base_url),
    };

    // Generate unique window label
    let label = match file_path {
        Some(path) => {
            let hash = simple_hash(&path.to_string_lossy());
            format!("notebook-{}", hash)
        }
        None => {
            let existing = window_state.windows.lock().unwrap();
            let home_count = existing
                .keys()
                .filter(|k| k.is_none())
                .count();
            if home_count == 0 {
                "main".to_string()
            } else {
                format!("home-{}", home_count)
            }
        }
    };

    let title = match file_path {
        Some(path) => {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Notebook".to_string());
            format!("backcast - {}", name)
        }
        None => "backcast".to_string(),
    };

    // DEBUG: Log server status before creating window
    info!("About to create home window with URL: {}", url);
    let current_status = server_state.status.lock().unwrap().clone();
    info!("Current app state - server status: {:?}", current_status);

    info!("Creating window '{}' → {}", label, url);
    info!("Creating WebviewWindow: label='{}', url='{}'", label, url);

    let window_result = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url.parse()?))
        .title(&title)
        .inner_size(1200.0, 800.0)
        .min_inner_size(600.0, 400.0)
        .initialization_script(LINK_INTERCEPT_JS)
        .build();

    match &window_result {
        Ok(_) => {
            info!("WebviewWindow created successfully: {}", label);
            // DEBUG: Check if window exists
            info!("Home window created and shown successfully");
            info!("Checking if window is visible...");
            if let Some(_window) = app.get_webview_window(&label) {
                info!("Main window exists in app handle");
            } else {
                log::error!("Main window NOT found in app handle after creation!");
            }
        },
        Err(e) => {
            log::error!("WebviewWindow creation failed: {}", e);
            log::error!("Error details: {:?}", e);
        }
    }

    let _window = window_result?;

    // Register navigation handler to intercept external links
    // Note: target-based link interception is done via JS injection in on_page_load

    // Track the window
    {
        let mut windows = window_state.windows.lock().unwrap();
        windows.insert(key.clone(), label.clone());
    }

    Ok(())
}

/// Remove a window from tracking when it's destroyed.
pub fn on_window_destroyed(app: &tauri::AppHandle, label: &str) {
    let window_state = app.state::<WindowState>();
    let mut windows = window_state.windows.lock().unwrap();
    windows.retain(|_, v| v != label);
    info!("Window '{}' destroyed, remaining: {}", label, windows.len());
}

/// Get the number of tracked windows.
pub fn window_count(app: &tauri::AppHandle) -> usize {
    let window_state = app.state::<WindowState>();
    let windows = window_state.windows.lock().unwrap();
    windows.len()
}

/// Simple hash for generating window labels from paths.
fn simple_hash(s: &str) -> u64 {
    let mut hash: u64 = 5381;
    for byte in s.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
    }
    hash
}

/// JavaScript to inject into each page load for link interception.
/// This handles `<a target="...">` links by converting them to
/// Tauri IPC calls that open new windows.
pub const LINK_INTERCEPT_JS: &str = r#"
(function() {
    if (window.__marimo_link_intercept_installed) return;
    window.__marimo_link_intercept_installed = true;

    // Block F11 from WebView2's native fullscreen handler and
    // toggle fullscreen via Tauri IPC instead. The menu accelerator
    // cannot receive F11 because WebView2 captures it first.
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F11') {
            e.preventDefault();
            if (window.__TAURI_INTERNALS__) {
                window.__TAURI_INTERNALS__.invoke('window_toggle_fullscreen')
                    .catch(function(err) { console.error('[marimo] fullscreen toggle failed:', err); });
            }
        }
    }, true);

    document.addEventListener('click', function(e) {
        const anchor = e.target.closest('a[target]');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        const target = anchor.getAttribute('target');
        if (!href || !target) return;

        // Skip same-window targets
        if (target === '_self') return;

        // Parse the URL
        let url;
        try {
            url = new URL(href, window.location.origin);
        } catch {
            return;
        }

        // Only intercept same-origin links
        if (url.origin !== window.location.origin) {
            // External link → open in system browser
            e.preventDefault();
            e.stopPropagation();
            if (window.__TAURI_INTERNALS__) {
                window.__TAURI_INTERNALS__.invoke('plugin:shell|open', { path: url.href })
                    .catch(err => console.error('[marimo-link-intercept] shell open failed:', err));
            } else {
                console.warn('[marimo-link-intercept] __TAURI_INTERNALS__ not available');
            }
            return;
        }

        // Same-origin with target → open in new window
        e.preventDefault();
        e.stopPropagation();
        const filePath = url.searchParams.get('file');

        if (window.__TAURI_INTERNALS__) {
            window.__TAURI_INTERNALS__.invoke('window_open_notebook', {
                filePath: filePath || null
            }).catch(err => console.error('[marimo-link-intercept] window_open_notebook failed:', err));
        } else {
            console.warn('[marimo-link-intercept] __TAURI_INTERNALS__ not available');
        }
    }, true);

    // Also intercept window.open calls
    const originalOpen = window.open;
    window.open = function(url, target, features) {
        if (url && typeof url === 'string') {
            try {
                const parsed = new URL(url, window.location.origin);
                if (parsed.origin === window.location.origin) {
                    const filePath = parsed.searchParams.get('file');
                    if (window.__TAURI_INTERNALS__) {
                        window.__TAURI_INTERNALS__.invoke('window_open_notebook', {
                            filePath: filePath || null
                        });
                    }
                    return null;
                }
            } catch {}
        }
        return originalOpen.call(this, url, target, features);
    };
})();
"#;
