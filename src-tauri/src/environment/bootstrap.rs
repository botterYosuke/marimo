use std::path::Path;
use std::process::Command;

use anyhow::{anyhow, Result};
use log::info;

use crate::paths;
use super::version::MARIMO_VERSION;

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
    on_progress: &dyn Fn(&str),
) -> Result<()> {
    // 1. Find Python
    on_progress("Checking Python...");
    let python_path = find_python(uv_bin);

    let python_path = match python_path {
        Some(p) => {
            info!("Found Python at: {}", p);
            p
        }
        None => {
            on_progress("Installing Python (this may take a minute)...");
            install_python(uv_bin)?;
            find_python(uv_bin).ok_or_else(|| anyhow!("Python installation failed"))?
        }
    };

    // 2. Create venv if it doesn't exist
    if !env_dir.exists() {
        on_progress("Creating environment...");
        info!("Creating venv at: {}", env_dir.display());
        let status = Command::new(uv_bin)
            .args([
                "venv",
                "--seed",
                "--python",
                &python_path,
                &env_dir.to_string_lossy(),
            ])
            .status()
            .map_err(|e| anyhow!("Failed to create venv: {}", e))?;

        if !status.success() {
            return Err(anyhow!("venv creation failed with status: {}", status));
        }
    }

    // 3. Install/update marimo
    on_progress(&format!("Installing marimo {}...", MARIMO_VERSION));
    let venv_python = paths::get_venv_python(env_dir);
    info!(
        "Installing marimo {} into venv (python: {})",
        MARIMO_VERSION,
        venv_python.display()
    );

    let status = Command::new(uv_bin)
        .args([
            "pip",
            "install",
            "--python",
            &venv_python.to_string_lossy(),
            &format!("marimo=={}", MARIMO_VERSION),
        ])
        .status()
        .map_err(|e| anyhow!("Failed to install marimo: {}", e))?;

    if !status.success() {
        return Err(anyhow!("marimo installation failed with status: {}", status));
    }

    on_progress("Ready");
    Ok(())
}

/// Find Python via `uv python find`.
fn find_python(uv_bin: &Path) -> Option<String> {
    let output = Command::new(uv_bin)
        .args(["python", "find"])
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
fn install_python(uv_bin: &Path) -> Result<()> {
    info!("Installing Python 3.13 via uv...");
    let status = Command::new(uv_bin)
        .args(["python", "install", "3.13"])
        .status()
        .map_err(|e| anyhow!("Failed to install Python: {}", e))?;

    if !status.success() {
        return Err(anyhow!("Python installation failed with status: {}", status));
    }
    Ok(())
}
