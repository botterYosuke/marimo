pub mod commands;
pub mod environment;
pub mod error;
pub mod paths;
pub mod server;
pub mod state;
pub mod window;

use log::info;
use tauri::Manager;

use state::{ServerState, WindowState};

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ServerState::new())
        .manage(WindowState::new())
        .invoke_handler(tauri::generate_handler![
            commands::server_get_url,
            commands::server_get_status,
            commands::server_get_logs,
            commands::server_restart,
            commands::window_open_notebook,
            commands::window_open_home,
            commands::window_open_dialog,
        ])
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
                let uv_bin = paths::get_uv_bin(&app_handle);
                let env_dir = paths::get_env_dir(&app_handle);

                info!("Bootstrapping environment...");
                // TODO: Show splash screen with progress
                if let Err(e) = environment::bootstrap::ensure_environment(
                    &uv_bin,
                    &env_dir,
                    &|msg| {
                        info!("Bootstrap: {}", msg);
                    },
                ) {
                    log::error!("Environment bootstrap failed: {}", e);
                    // Continue anyway in case the environment was partially set up
                }
            }

            // Start server
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) =
                    server::lifecycle::start_server(&app_handle_clone, port).await
                {
                    log::error!("Failed to start server: {}", e);
                    let server_state = app_handle_clone.state::<ServerState>();
                    let mut status = server_state.status.lock().unwrap();
                    *status = state::ServerStatus::Error(e.to_string());
                    return;
                }

                // Server is up — open home page window with the server URL
                let server_state = app_handle_clone.state::<ServerState>();
                let actual_port = *server_state.port.lock().unwrap();

                // Navigate the initial (hidden) main window to the server URL
                if let Some(main_window) = app_handle_clone.get_webview_window("main") {
                    let url = if cfg!(debug_assertions) {
                        "http://localhost:3000/".to_string()
                    } else {
                        format!("http://localhost:{}/", actual_port)
                    };
                    info!("Navigating main window to: {}", url);

                    // Inject link intercept JS on page load
                    let app_for_eval = app_handle_clone.clone();
                    main_window.on_page_load(move |webview, payload| {
                        if matches!(
                            payload.event(),
                            tauri::WebviewEvent::Loaded
                        ) {
                            // Inject link intercept script
                            let _ = webview.eval(window::manager::LINK_INTERCEPT_JS);
                        }
                    });

                    let _ = main_window.navigate(url.parse().unwrap());
                    let _ = main_window.show();

                    // Track the main window
                    let window_state = app_handle_clone.state::<WindowState>();
                    let mut windows = window_state.windows.lock().unwrap();
                    windows.insert(None, "main".to_string());
                }

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
                    if let Some(win) = app.get_focused_window() {
                        if let Some(webview) = app.get_webview_window(win.label()) {
                            let _ = webview.eval("location.reload()");
                        }
                    }
                }
                "devtools" => {
                    if let Some(win) = app.get_focused_window() {
                        if let Some(webview) = app.get_webview_window(win.label()) {
                            webview.open_devtools();
                        }
                    }
                }
                "fullscreen" => {
                    if let Some(win) = app.get_focused_window() {
                        if let Ok(is_fullscreen) = win.is_fullscreen() {
                            let _ = win.set_fullscreen(!is_fullscreen);
                        }
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
                if window::manager::window_count(app) == 0 {
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
