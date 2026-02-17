pub mod commands;
pub mod environment;
pub mod error;
pub mod paths;
pub mod server;
pub mod state;
pub mod window;

use log::info;
use simplelog::*;
use std::fs::File;
use std::path::PathBuf;
use tauri::Manager;

use state::{BootstrapState, BootstrapStatus, ServerState, WindowState};

fn get_log_file_path() -> PathBuf {
    // Get log directory path before Tauri app starts
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let log_dir = PathBuf::from(appdata)
                .join("com.marimo.desktop")
                .join("logs");
            return log_dir.join("marimo-desktop.log");
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let log_dir = PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("com.marimo.desktop")
                .join("logs");
            return log_dir.join("marimo-desktop.log");
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let log_dir = PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("com.marimo.desktop")
                .join("logs");
            return log_dir.join("marimo-desktop.log");
        }
    }

    // Fallback to temp directory
    if let Ok(temp_dir) = std::env::var("TEMP") {
        PathBuf::from(temp_dir).join("marimo-desktop.log")
    } else {
        PathBuf::from("marimo-desktop.log")
    }
}

pub fn run() {
    // Initialize logging to file in APPDATA directory
    let log_file_path = get_log_file_path();

    // Ensure log directory exists
    if let Some(parent) = log_file_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let _ = CombinedLogger::init(vec![
        TermLogger::new(
            LevelFilter::Info,
            Config::default(),
            TerminalMode::Mixed,
            ColorChoice::Auto,
        ),
        WriteLogger::new(
            LevelFilter::Info,
            Config::default(),
            File::create(&log_file_path).unwrap_or_else(|e| {
                eprintln!("Failed to create log file: {}", e);
                panic!("Cannot create log file");
            }),
        ),
    ]);

    info!("=== marimo Desktop Starting ===");
    info!("Build: {}", if cfg!(debug_assertions) { "DEBUG" } else { "RELEASE" });
    info!("Platform: {}", std::env::consts::OS);
    info!("Log file: {}", log_file_path.display());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ServerState::new())
        .manage(WindowState::new())
        .manage(BootstrapState::new())
        .invoke_handler(tauri::generate_handler![
            commands::server_get_url,
            commands::server_get_status,
            commands::server_get_logs,
            commands::server_restart,
            commands::window_open_notebook,
            commands::window_open_home,
            commands::window_open_dialog,
            commands::window_toggle_fullscreen,
            commands::bootstrap_get_progress,
        ])
        .menu(|app| window::menu::build_menu(app))
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Ensure data directories exist
            let data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            let log_dir = paths::get_log_dir(&app_handle);
            std::fs::create_dir_all(&log_dir).ok();

            info!("marimo desktop starting...");
            info!("Data dir: {}", data_dir.display());
            info!("App data dir exists: {}", data_dir.exists());
            info!("Log dir: {}", log_dir.display());
            info!("Log dir exists: {}", log_dir.exists());

            // Determine port
            let port = if cfg!(debug_assertions) {
                // Dev mode: use fixed port 2718 (external server)
                2718
            } else {
                // Production: find available port
                server::port::find_available_port(2718).unwrap_or(2718)
            };

            info!("Using port: {}", port);

            // In production, bootstrap the environment first
            if !cfg!(debug_assertions) {
                info!("=== PRODUCTION MODE: Showing splash screen ===");
                // Show splash window FIRST before any other operations
                match window::splash::show_splash_window(&app_handle) {
                    Ok(_) => info!("✅ Splash screen display initiated successfully"),
                    Err(e) => {
                        log::error!("❌ FAILED to show splash window: {}", e);
                        log::error!("Error details: {:?}", e);
                    }
                }

                // Initialize bootstrap state
                let bootstrap_state = app_handle.state::<BootstrapState>();
                *bootstrap_state.status.lock().unwrap() = BootstrapStatus::InProgress;

                info!("=== Resource Verification ===");
                let resource_dir = app_handle.path().resource_dir();
                match resource_dir {
                    Ok(ref dir) => {
                        info!("Resource dir: {}", dir.display());
                        info!("Resource dir exists: {}", dir.exists());
                    }
                    Err(e) => {
                        log::error!("Failed to get resource dir: {}", e);
                    }
                }

                let uv_bin = paths::get_uv_bin(&app_handle);
                info!("UV binary path: {}", uv_bin.display());
                info!("UV binary exists: {}", uv_bin.exists());

                let env_dir = paths::get_env_dir(&app_handle);
                info!("Env dir path: {}", env_dir.display());

                let python_install_dir = paths::get_python_install_dir(&app_handle);
                info!("Python install dir: {}", python_install_dir.display());

                let marimo_source = paths::get_marimo_source(&app_handle);
                info!("Marimo source path: {}", marimo_source.display());
                info!("Marimo source exists: {}", marimo_source.exists());

                // Check for key marimo files
                let marimo_init = marimo_source.join("marimo").join("__init__.py");
                info!("Marimo __init__.py exists: {}", marimo_init.exists());

                let pyproject = marimo_source.join("pyproject.toml");
                info!("pyproject.toml exists: {}", pyproject.exists());

                // DEBUG: Check if marimo static assets exist
                let marimo_assets_path = marimo_source.join("marimo").join("_static");
                info!("Checking marimo assets at: {:?}", marimo_assets_path);
                info!("Marimo assets exist: {}", marimo_assets_path.exists());
                if marimo_assets_path.exists() {
                    if let Ok(entries) = std::fs::read_dir(&marimo_assets_path) {
                        let count = entries.count();
                        info!("Marimo assets directory contains {} items", count);
                    }
                } else {
                    log::error!("❌ CRITICAL: Marimo static assets NOT FOUND at {:?}", marimo_assets_path);
                }

                info!("=== Environment Bootstrap Starting ===");
                info!("Bootstrapping environment...");
                info!("Marimo source: {}", marimo_source.display());

                // Bootstrap environment with progress updates
                if let Err(e) = environment::bootstrap::ensure_environment(
                    &uv_bin,
                    &env_dir,
                    &python_install_dir,
                    &marimo_source,
                    &|msg| {
                        info!("Bootstrap: {}", msg);

                        // Map messages to progress percentages
                        let percent = if msg.contains("Checking Python") {
                            10
                        } else if msg.contains("Installing Python") {
                            25
                        } else if msg.contains("Creating environment") {
                            50
                        } else if msg.contains("Installing marimo") || msg.starts_with("[pip]") {
                            75
                        } else if msg.contains("Ready") {
                            100
                        } else {
                            5
                        };

                        // Update state
                        let bootstrap_state = app_handle.state::<BootstrapState>();
                        bootstrap_state.update(msg, percent);

                        // Update splash screen UI directly
                        window::splash::update_splash_progress(&app_handle, msg, percent);
                    },
                ) {
                    log::error!("Environment bootstrap failed: {}", e);
                    let bootstrap_state = app_handle.state::<BootstrapState>();
                    bootstrap_state.error(&e.to_string());

                    // Show error on splash screen
                    let log_dir = paths::get_log_dir(&app_handle);
                    let log_file = log_dir.join("marimo-desktop.log");
                    window::splash::show_splash_error(
                        &app_handle,
                        &format!(
                            "環境構築エラー:\n{}\n\nログファイル:\n{}",
                            e,
                            log_file.display()
                        )
                    );
                    return Ok(()); // Don't continue if bootstrap failed
                } else {
                    let bootstrap_state = app_handle.state::<BootstrapState>();
                    bootstrap_state.complete();
                }
                info!("=== Environment Bootstrap Complete ===");
            }

            // Start server
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                // Update splash: Starting server
                if !cfg!(debug_assertions) {
                    window::splash::update_splash_progress(&app_handle_clone, "Starting marimo server...", 90);
                }

                if let Err(e) =
                    server::lifecycle::start_server(&app_handle_clone, port).await
                {
                    log::error!("Failed to start server: {}", e);
                    let server_state = app_handle_clone.state::<ServerState>();
                    let mut status = server_state.status.lock().unwrap();
                    *status = state::ServerStatus::Error(e.to_string());

                    // Show error on splash screen
                    if !cfg!(debug_assertions) {
                        let log_dir = paths::get_log_dir(&app_handle_clone);
                        let log_file = log_dir.join("marimo-desktop.log");
                        window::splash::show_splash_error(
                            &app_handle_clone,
                            &format!(
                                "サーバー起動エラー:\n{}\n\nログファイル:\n{}",
                                e,
                                log_file.display()
                            )
                        );
                    }
                    return;
                }

                // Server is up — create main window FIRST, then close splash
                info!("Server started, creating home window first...");

                // Update splash: Opening window
                if !cfg!(debug_assertions) {
                    window::splash::update_splash_progress(&app_handle_clone, "Opening window...", 98);
                }

                match window::manager::open_window(&app_handle_clone, None) {
                    Ok(_) => info!("Home window created successfully"),
                    Err(e) => {
                        log::error!("Failed to create home window: {}", e);
                        log::error!("Error details: {:?}", e);
                    }
                }

                // Small delay to ensure main window is fully ready before closing splash
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;

                // Now safe to close splash - main window is already created
                info!("Closing splash window now that main window is ready...");
                window::splash::close_splash_window(&app_handle_clone);

                // Start periodic health check
                let app_for_health = app_handle_clone.clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        let server_state = app_for_health.state::<ServerState>();
                        let port = *server_state.port.lock().unwrap();
                        let healthy = server::lifecycle::check_health(port).await;

                        let current_status = server_state.status.lock().unwrap().clone();
                        if !healthy
                            && current_status == state::ServerStatus::Running
                        {
                            log::warn!("Health check failed, server may have crashed");
                            let mut status = server_state.status.lock().unwrap();
                            *status = state::ServerStatus::Error(
                                "Health check failed".to_string(),
                            );
                        }
                    }
                });
            });

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "new_notebook" => {
                    // Open home page to create new notebook
                    let _ = window::manager::open_window(app, None);
                }
                "open_file" => {
                    let app_clone = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ =
                            commands::window_open_dialog(app_clone).await;
                    });
                }
                "home_page" => {
                    let _ = window::manager::open_window(app, None);
                }
                "reload" => {
                    let windows = app.webview_windows();
                    let win = windows.values()
                        .find(|w| w.is_focused().unwrap_or(false))
                        .or_else(|| windows.values().next());
                    if let Some(win) = win {
                        let _ = win.eval("location.reload()");
                    }
                }
                "devtools" => {
                    let windows = app.webview_windows();
                    let win = windows.values()
                        .find(|w| w.is_focused().unwrap_or(false))
                        .or_else(|| windows.values().next());
                    if let Some(win) = win {
                        win.open_devtools();
                    }
                }
                "fullscreen" => {
                    let windows = app.webview_windows();
                    let win = windows.values()
                        .find(|w| w.is_focused().unwrap_or(false))
                        .or_else(|| windows.values().next());
                    if let Some(win) = win {
                        let is_fullscreen = win.is_fullscreen().unwrap_or(false);
                        let _ = win.set_fullscreen(!is_fullscreen);
                    }
                }
                _ => {}
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let label = window.label().to_string();

                window::manager::on_window_destroyed(app, &label);

                // If all windows are closed, stop server and exit
                let remaining = window::manager::window_count(app);
                if remaining == 0 {
                    info!("All windows closed, stopping server and exiting");
                    server::lifecycle::stop_server(app);
                    app.exit(0);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { .. } => {
                    // Clean up server on exit
                    server::lifecycle::stop_server(app_handle);
                }
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } => {
                    if !has_visible_windows {
                        // macOS dock icon click with no windows → open home
                        let _ = window::manager::open_window(app_handle, None);
                    }
                }
                _ => {}
            }
        });
}
