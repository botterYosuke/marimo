use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};

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
    info!("=== Python Detection ===");
    info!("UV binary: {}", uv_bin.display());
    info!("Python install dir: {}", python_install_dir.display());

    let python_path = find_python(uv_bin, python_install_dir);
    info!("Python search result: {:?}", python_path);

    let python_path = match python_path {
        Some(p) => {
            info!("Found existing Python at: {}", p);
            p
        }
        None => {
            info!("No existing Python found, installing...");
            on_progress("Installing Python (this may take a minute)...");
            install_python(uv_bin, python_install_dir)?;
            let found = find_python(uv_bin, python_install_dir);
            info!("Post-install Python search: {:?}", found);
            found.ok_or_else(|| anyhow!("Python installation failed"))?
        }
    };
    info!("Final Python path: {}", python_path);

    // 2. Create venv if it doesn't exist, is broken, or has an incompatible Python version
    let venv_python = paths::get_venv_python(env_dir);

    let should_create_venv = if !venv_python.exists() {
        true
    } else {
        match get_venv_python_version(&venv_python) {
            Some((major, minor)) if (major, minor) >= (3, 10) => {
                info!("Venv Python version: {}.{} - OK", major, minor);
                false
            }
            Some((major, minor)) => {
                info!(
                    "⚠️ Venv Python {}.{} is too old (need >=3.10), will recreate",
                    major, minor
                );
                true
            }
            None => {
                info!("⚠️ Could not determine venv Python version, will recreate");
                true
            }
        }
    };

    if should_create_venv {
        // Remove existing venv directory (broken, outdated, or missing)
        if env_dir.exists() {
            info!("Removing existing venv...");
            if let Err(e) = std::fs::remove_dir_all(env_dir) {
                log::warn!("Failed to remove venv: {}", e);
            }
        }

        on_progress("Creating environment...");
        info!("=== Creating venv ===");
        info!("Env dir: {}", env_dir.display());
        info!("Python: {}", python_path);

        let mut cmd = Command::new(uv_bin);
        cmd.args([
            "venv",
            "--seed",
            "--python",
            &python_path,
            &env_dir.to_string_lossy(),
        ]);
        no_window(&mut cmd);

        info!(
            "Running: uv venv --seed --python {} {}",
            python_path,
            env_dir.display()
        );
        let output = cmd
            .output()
            .map_err(|e| anyhow!("Failed to execute venv command: {}", e))?;

        info!("Venv command exit status: {}", output.status);
        if !output.stdout.is_empty() {
            info!("Venv stdout: {}", String::from_utf8_lossy(&output.stdout));
        }
        if !output.stderr.is_empty() {
            info!("Venv stderr: {}", String::from_utf8_lossy(&output.stderr));
        }

        if !output.status.success() {
            return Err(anyhow!(
                "venv creation failed with status: {}",
                output.status
            ));
        }
        info!("Venv created successfully");
    } else {
        info!("Venv already exists at: {}", env_dir.display());
    }

    // 3. Install/update marimo from bundled source
    // Desktop-specific patches are included:
    // - SelectorEventLoop for Windows (distributor.py add_reader fix)
    // - register_allowed_file on LazyListOfFilesAppFileRouter
    // - HTTPException handler in ws_endpoint
    on_progress("Installing marimo from bundled source...");
    info!("=== Installing marimo ===");
    let venv_python = paths::get_venv_python(env_dir);
    info!("Venv Python: {}", venv_python.display());
    info!("Venv Python exists: {}", venv_python.exists());
    info!("Marimo source: {}", marimo_source.display());

    let install_path = format!("{}[game]", marimo_source.display());
    info!("Install path: {}", install_path);

    let mut cmd = Command::new(uv_bin);
    cmd.args([
        "pip",
        "install",
        "--python",
        &venv_python.to_string_lossy(),
        &install_path,
    ]);
    no_window(&mut cmd);

    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    info!(
        "Running: uv pip install --python {} {}",
        venv_python.display(),
        install_path
    );
    let mut child = cmd
        .spawn()
        .map_err(|e| anyhow!("Failed to spawn pip install: {}", e))?;

    let stderr = child.stderr.take().expect("stderr is piped");
    let reader = BufReader::new(stderr);

    // Read stderr line by line on the main thread and forward to on_progress
    for line in reader.lines().flatten() {
        info!("pip stderr: {}", line);
        if let Some(msg) = parse_pip_progress(&line) {
            on_progress(&msg);
        }
    }

    // stderr closed = process finished
    let status = child
        .wait()
        .map_err(|e| anyhow!("pip install wait failed: {}", e))?;
    info!("Pip install exit status: {}", status);

    if !status.success() {
        return Err(anyhow!(
            "marimo installation failed with status: {}",
            status
        ));
    }
    info!("Marimo installed successfully");

    // DEBUG: Verify marimo installation and location
    info!("Verifying marimo installation...");
    let mut verify_cmd = Command::new(&venv_python);
    verify_cmd.args(&["-c", "import marimo; print(marimo.__file__)"]);
    no_window(&mut verify_cmd);
    if let Ok(output) = verify_cmd.output() {
        info!(
            "Marimo location: {}",
            String::from_utf8_lossy(&output.stdout).trim()
        );

        // Verify _static directory exists in installed marimo
        let mut verify_static_cmd = Command::new(&venv_python);
        verify_static_cmd.args(&["-c", "import marimo, os; print(os.path.exists(os.path.join(os.path.dirname(marimo.__file__), '_static')))"]);
        no_window(&mut verify_static_cmd);
        if let Ok(static_output) = verify_static_cmd.output() {
            info!(
                "Installed marimo has _static directory: {}",
                String::from_utf8_lossy(&static_output.stdout).trim()
            );
        }
    }

    on_progress("Ready");
    Ok(())
}

/// Parse a line from `uv pip install` stderr and return a progress message if relevant.
fn parse_pip_progress(line: &str) -> Option<String> {
    const KEYWORDS: &[&str] = &[
        "Resolved",
        "Building",
        "Prepared",
        "Uninstalled",
        "Installed",
        "Downloading",
    ];
    let line = line.trim();
    if KEYWORDS.iter().any(|k| line.starts_with(k)) {
        Some(format!("[pip] {}", line))
    } else {
        None
    }
}

/// Get the Python version from a venv by running `python --version`.
/// Returns `(major, minor)` on success, or `None` if the version cannot be determined.
fn get_venv_python_version(venv_python: &Path) -> Option<(u32, u32)> {
    let mut cmd = Command::new(venv_python);
    cmd.args(["--version"]);
    no_window(&mut cmd);

    let output = cmd.output().ok()?;
    // `python --version` prints to stdout on Python 3, e.g. "Python 3.9.6"
    let version_str = String::from_utf8_lossy(&output.stdout);
    let version_str = version_str.trim();
    info!("Venv python --version: {}", version_str);

    let version = version_str.strip_prefix("Python ")?;
    let mut parts = version.split('.');
    let major: u32 = parts.next()?.parse().ok()?;
    let minor: u32 = parts.next()?.parse().ok()?;
    Some((major, minor))
}

/// Find Python via `uv python find`.
fn find_python(uv_bin: &Path, python_install_dir: &Path) -> Option<String> {
    info!(
        "Finding Python: uv_bin={}, install_dir={}",
        uv_bin.display(),
        python_install_dir.display()
    );

    let mut cmd = Command::new(uv_bin);
    cmd.args(["python", "find"])
        .env("UV_PYTHON_INSTALL_DIR", python_install_dir);
    no_window(&mut cmd);

    let output = cmd.output().ok()?;
    info!("uv python find exit status: {}", output.status);
    if !output.stdout.is_empty() {
        info!(
            "uv python find stdout: {}",
            String::from_utf8_lossy(&output.stdout)
        );
    }
    if !output.stderr.is_empty() {
        info!(
            "uv python find stderr: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            info!("Found Python: {}", path);
            return Some(path);
        }
    }
    info!("No Python found");
    None
}

/// Install Python 3.13 via `uv python install`.
fn install_python(uv_bin: &Path, python_install_dir: &Path) -> Result<()> {
    info!("=== Installing Python 3.13 ===");
    info!("UV binary: {}", uv_bin.display());
    info!("Install dir: {}", python_install_dir.display());

    // Ensure the install directory exists
    std::fs::create_dir_all(python_install_dir)
        .map_err(|e| anyhow!("Failed to create Python install directory: {}", e))?;
    info!("Install directory created");

    let mut cmd = Command::new(uv_bin);
    cmd.args(["python", "install", "3.13"])
        .env("UV_PYTHON_INSTALL_DIR", python_install_dir);
    no_window(&mut cmd);

    info!("Running: uv python install 3.13");
    let output = cmd
        .output()
        .map_err(|e| anyhow!("Failed to execute python install: {}", e))?;

    info!("Python install exit status: {}", output.status);
    if !output.stdout.is_empty() {
        info!(
            "Python install stdout: {}",
            String::from_utf8_lossy(&output.stdout)
        );
    }
    if !output.stderr.is_empty() {
        info!(
            "Python install stderr: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    if !output.status.success() {
        return Err(anyhow!(
            "Python installation failed with status: {}",
            output.status
        ));
    }
    info!("Python 3.13 installed successfully");
    Ok(())
}
