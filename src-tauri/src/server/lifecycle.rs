use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use anyhow::{anyhow, Result};
use log::{error, info, warn};
use tauri::Manager;

use crate::paths;
use crate::state::{ServerState, ServerStatus};

/// Apply CREATE_NO_WINDOW flag so child processes don't spawn a console window.
#[cfg(windows)]
fn no_window(cmd: &mut Command) -> &mut Command {
    cmd.creation_flags(0x08000000)
}

#[cfg(not(windows))]
fn no_window(cmd: &mut Command) -> &mut Command {
    cmd
}

/// Start the marimo server process.
/// In dev mode, the server is expected to be started externally.
/// In production, we spawn `venv_python -m marimo edit --headless ...`.
pub async fn start_server(app: &tauri::AppHandle, port: u16) -> Result<()> {
    let server_state = app.state::<ServerState>();

    // Update status
    {
        let mut status = server_state.status.lock().unwrap();
        *status = ServerStatus::Starting;
    }
    {
        let mut p = server_state.port.lock().unwrap();
        *p = port;
    }

    if cfg!(debug_assertions) {
        // Dev mode: server is started externally, just check health
        info!("Dev mode: expecting marimo server on port {}", port);
        server_state.add_log("info", &format!("Dev mode: expecting server on port {}", port));

        // Wait for external server to be ready
        wait_for_health(port, Duration::from_secs(30)).await?;

        let mut status = server_state.status.lock().unwrap();
        *status = ServerStatus::Running;
        server_state.add_log("info", "Server is running (external)");
        return Ok(());
    }

    // Production mode: spawn the server
    info!("=== Production Mode: Spawning Server ===");
    let env_dir = paths::get_env_dir(app);
    let venv_python = paths::get_venv_python(&env_dir);
    let uv_bin = paths::get_uv_bin(app);

    info!("Env dir: {}", env_dir.display());
    info!("Venv Python: {}", venv_python.display());
    info!("Venv Python exists: {}", venv_python.exists());
    info!("UV bin: {}", uv_bin.display());
    info!("UV bin exists: {}", uv_bin.exists());

    if !venv_python.exists() {
        error!("Python venv not found at {}", venv_python.display());
        return Err(anyhow!(
            "Python venv not found at {}. Run environment bootstrap first.",
            venv_python.display()
        ));
    }
    info!("Venv verification passed");

    // Build environment variables
    let mut env: HashMap<String, String> = std::env::vars().collect();

    // Inject bundled uv into PATH and UV env var
    if let Some(uv_dir) = uv_bin.parent() {
        let delimiter = if cfg!(windows) { ";" } else { ":" };
        let current_path = env.get("PATH").cloned().unwrap_or_default();
        env.insert(
            "PATH".into(),
            format!("{}{}{}", uv_dir.display(), delimiter, current_path),
        );
    }
    env.insert("UV".into(), uv_bin.to_string_lossy().into_owned());
    // Force Python to use UTF-8 for stdio to avoid encoding issues
    // when stdout/stderr are piped (no console in Windows GUI apps)
    env.insert("PYTHONIOENCODING".into(), "utf-8".into());
    env.insert("PYTHONUNBUFFERED".into(), "1".into());

    // Use a dedicated notebooks directory as the workspace so that
    // marimo doesn't scan the entire HOME directory (which causes timeout).
    // %APPDATA%/marimo/notebooks — same location as other marimo settings.
    let notebooks_dir = paths::get_notebooks_dir(app);
    std::fs::create_dir_all(&notebooks_dir).ok();
    let notebooks_dir_str = notebooks_dir.to_string_lossy().to_string();

    // Use the user's home directory as cwd to avoid Python importing
    // a local `marimo/` package from the current working directory
    let home_dir = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_else(|_| ".".to_string()));

    info!("Notebooks dir: {}", notebooks_dir_str);
    info!("Notebooks dir exists: {}", notebooks_dir.exists());
    info!("Working directory: {}", home_dir);
    info!("Starting marimo server: {} -m marimo edit {} --no-token --headless --port {}",
        venv_python.display(), notebooks_dir_str, port);
    server_state.add_log("info", &format!("Starting server on port {}", port));

    let mut cmd = Command::new(&venv_python);
    cmd.args([
            "-m",
            "marimo",
            "edit",
            &notebooks_dir_str,
            "--no-token",
            "--headless",
            "--port",
            &port.to_string(),
        ])
        .current_dir(&home_dir)
        .envs(&env)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    no_window(&mut cmd);

    // DEBUG: Log command details
    info!("Server command: {:?}", cmd);
    info!("Server working directory: {:?}", home_dir);
    info!("Server environment: PATH={:?}, UV={:?}",
        env.get("PATH"),
        env.get("UV"));

    info!("Spawning server process...");
    let mut child = cmd
        .spawn()
        .map_err(|e| {
            error!("Failed to spawn server process: {}", e);
            anyhow!("Failed to spawn marimo server: {}", e)
        })?;

    let pid = child.id();
    {
        let mut pid_lock = server_state.pid.lock().unwrap();
        *pid_lock = Some(pid);
    }
    info!("Server process spawned with PID {}", pid);

    // Capture output
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_handle = app.clone();
    super::process::capture_output(stdout, stderr, move |level, msg| {
        let server_state = app_handle.state::<ServerState>();
        server_state.add_log(level, msg);
    });

    // Monitor process exit in background
    let app_handle = app.clone();
    let start_time = std::time::Instant::now();
    tokio::spawn(async move {
        let exit_status = tokio::task::spawn_blocking(move || child.wait()).await;
        match exit_status {
            Ok(Ok(status)) => {
                warn!("marimo server exited with status: {}", status);
                // DEBUG: Log more details about the exit
                warn!("Server stopped unexpectedly. Last known status: Running");
                warn!("Server ran for approximately {:?}", start_time.elapsed());
                let server_state = app_handle.state::<ServerState>();
                let mut s = server_state.status.lock().unwrap();
                *s = ServerStatus::Stopped;
                server_state.add_log("warn", &format!("Server exited: {}", status));
            }
            Ok(Err(e)) => {
                error!("Error waiting for server process: {}", e);
                let server_state = app_handle.state::<ServerState>();
                let mut s = server_state.status.lock().unwrap();
                *s = ServerStatus::Error(e.to_string());
            }
            Err(e) => {
                error!("Task join error: {}", e);
            }
        }
    });

    // Wait for health check
    info!("Starting health check (timeout: 30s)...");
    match wait_for_health(port, Duration::from_secs(30)).await {
        Ok(_) => info!("Health check passed"),
        Err(e) => {
            error!("Health check failed: {}", e);
            return Err(e);
        }
    }

    {
        let mut status = server_state.status.lock().unwrap();
        *status = ServerStatus::Running;
    }
    server_state.add_log("info", "Server is running");
    info!("Server fully started and healthy");

    Ok(())
}

/// Stop the marimo server process.
pub fn stop_server(app: &tauri::AppHandle) {
    let server_state = app.state::<ServerState>();
    let pid = {
        let mut pid_lock = server_state.pid.lock().unwrap();
        pid_lock.take()
    };

    if let Some(pid) = pid {
        info!("Stopping marimo server (PID {})", pid);
        server_state.add_log("info", &format!("Stopping server (PID {})", pid));
        kill_process(pid);
    }

    let mut status = server_state.status.lock().unwrap();
    *status = ServerStatus::Stopped;
}

/// Wait for the server to respond to health checks.
async fn wait_for_health(port: u16, timeout: Duration) -> Result<()> {
    let url = format!("http://localhost:{}/healthz", port);
    info!("Health check URL: {}", url);
    let start = std::time::Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()?;

    let mut attempt = 0;
    loop {
        attempt += 1;
        let elapsed = start.elapsed();

        if elapsed > timeout {
            error!("Health check timed out after {:?} ({} attempts)", elapsed, attempt);
            return Err(anyhow!("Server health check timed out after {:?}", timeout));
        }

        if attempt % 5 == 1 {  // Log every 5th attempt to reduce noise
            info!("Health check attempt {}, elapsed: {:?}", attempt, elapsed);
        }

        match client.get(&url).send().await {
            Ok(resp) => {
                if attempt % 5 == 1 || resp.status().is_success() {
                    info!("Health check response: status={}", resp.status());
                }
                if resp.status().is_success() {
                    info!("Server health check passed on port {} after {} attempts", port, attempt);
                    return Ok(());
                }
            }
            Err(e) => {
                if attempt % 5 == 1 {
                    info!("Health check request failed: {}", e);
                }
            }
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

/// Kill a process by PID. Platform-specific.
fn kill_process(pid: u32) {
    #[cfg(windows)]
    {
        // Use taskkill with /T to kill the process tree
        let mut cmd = Command::new("taskkill");
        cmd.args(["/pid", &pid.to_string(), "/f", "/t"])
            .creation_flags(0x08000000);

        match cmd.output() {
            Ok(output) => {
                if !output.status.success() {
                    error!(
                        "Failed to kill process {}: {}",
                        pid,
                        String::from_utf8_lossy(&output.stderr)
                    );
                }
            }
            Err(e) => {
                error!("Failed to execute taskkill for PID {}: {}", pid, e);
            }
        }
    }

    #[cfg(unix)]
    {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
        // Give it a moment, then force kill
        std::thread::sleep(Duration::from_secs(2));
        unsafe {
            libc::kill(pid as i32, libc::SIGKILL);
        }
    }
}

/// Check if the server is healthy right now.
pub async fn check_health(port: u16) -> bool {
    let url = format!("http://localhost:{}/healthz", port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    matches!(client.get(&url).send().await, Ok(resp) if resp.status().is_success())
}
