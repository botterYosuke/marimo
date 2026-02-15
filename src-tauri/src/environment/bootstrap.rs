use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use anyhow::{anyhow, Result};
use log::info;

use crate::paths;

/// Apply CREATE_NO_WINDOW flag so child processes don't spawn a console window.
#[cfg(windows)]
fn no_window(cmd: &mut Command) -> &mut Command {
    cmd.creation_flags(0x08000000)
}

#[cfg(not(windows))]
fn no_window(cmd: &mut Command) -> &mut Command {
    cmd
}


/// Check if the environment is ready (venv Python exists).
pub fn is_environment_ready(env_dir: &Path) -> bool {
    paths::get_venv_python(env_dir).exists()
}

/// Ensure the Python + marimo environment is set up.
/// This is called at startup. On first run, it will:
/// 1. Find or install Python via `uv python`
/// 2. Create a venv
/// 3. Install marimo into the venv
///
/// On subsequent runs, it will only upgrade marimo if the version changed
/// (uv's cache makes this fast when already up to date).
pub fn ensure_environment(
    uv_bin: &Path,
    env_dir: &Path,
    python_install_dir: &Path,
    marimo_source: &Path,
    on_progress: &dyn Fn(&str),
) -> Result<()> {
    // 1. Find Python
    on_progress("Checking Python...");
    let python_path = find_python(uv_bin, python_install_dir);

    let python_path = match python_path {
        Some(p) => {
            info!("Found Python at: {}", p);
            p
        }
        None => {
            on_progress("Installing Python (this may take a minute)...");
            install_python(uv_bin, python_install_dir)?;
            find_python(uv_bin, python_install_dir).ok_or_else(|| anyhow!("Python installation failed"))?
        }
    };

    // 2. Create venv if it doesn't exist
    if !env_dir.exists() {
        on_progress("Creating environment...");
        info!("Creating venv at: {}", env_dir.display());
        let mut cmd = Command::new(uv_bin);
        cmd.args([
                "venv",
                "--seed",
                "--python",
                &python_path,
                &env_dir.to_string_lossy(),
            ]);
        no_window(&mut cmd);
        let status = cmd
            .status()
            .map_err(|e| anyhow!("Failed to create venv: {}", e))?;

        if !status.success() {
            return Err(anyhow!("venv creation failed with status: {}", status));
        }
    }

    // 3. Install/update marimo from bundled source
    // Desktop-specific patches are included:
    // - SelectorEventLoop for Windows (distributor.py add_reader fix)
    // - register_allowed_file on LazyListOfFilesAppFileRouter
    // - HTTPException handler in ws_endpoint
    on_progress("Installing marimo from bundled source...");
    let venv_python = paths::get_venv_python(env_dir);
    info!(
        "Installing marimo from {} into venv (python: {})",
        marimo_source.display(),
        venv_python.display()
    );

    let mut cmd = Command::new(uv_bin);
    cmd.args([
            "pip",
            "install",
            "--python",
            &venv_python.to_string_lossy(),
            &format!("{}[game]", marimo_source.display()),
        ]);
    no_window(&mut cmd);
    let status = cmd
        .status()
        .map_err(|e| anyhow!("Failed to install marimo: {}", e))?;

    if !status.success() {
        return Err(anyhow!("marimo installation failed with status: {}", status));
    }

    on_progress("Ready");
    Ok(())
}

/// Find Python via `uv python find`.
fn find_python(uv_bin: &Path, python_install_dir: &Path) -> Option<String> {
    let mut cmd = Command::new(uv_bin);
    cmd.args(["python", "find"])
        .env("UV_PYTHON_INSTALL_DIR", python_install_dir);
    no_window(&mut cmd);
    let output = cmd
        .output()
        .ok()?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
}

/// Install Python 3.13 via `uv python install`.
fn install_python(uv_bin: &Path, python_install_dir: &Path) -> Result<()> {
    info!("Installing Python 3.13 via uv into {}...", python_install_dir.display());

    // Ensure the install directory exists
    std::fs::create_dir_all(python_install_dir)
        .map_err(|e| anyhow!("Failed to create Python install directory: {}", e))?;

    let mut cmd = Command::new(uv_bin);
    cmd.args(["python", "install", "3.13"])
        .env("UV_PYTHON_INSTALL_DIR", python_install_dir);
    no_window(&mut cmd);
    let status = cmd
        .status()
        .map_err(|e| anyhow!("Failed to install Python: {}", e))?;

    if !status.success() {
        return Err(anyhow!("Python installation failed with status: {}", status));
    }
    Ok(())
}
