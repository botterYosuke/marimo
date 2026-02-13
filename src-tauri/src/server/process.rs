use std::io::{BufRead, BufReader};
use std::process::{Child, ChildStderr, ChildStdout, Stdio};
use log::{error, info};

/// Capture stdout/stderr from a child process into log callbacks.
pub fn capture_output(
    stdout: Option<ChildStdout>,
    stderr: Option<ChildStderr>,
    on_line: impl Fn(&str, &str) + Send + 'static + Clone,
) {
    if let Some(stdout) = stdout {
        let on_line_clone = on_line.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        info!("[marimo stdout] {}", line);
                        on_line_clone("info", &line);
                    }
                    Err(e) => {
                        error!("[marimo stdout read error] {}", e);
                        break;
                    }
                }
            }
        });
    }

    if let Some(stderr) = stderr {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        // marimo logs to stderr by default
                        info!("[marimo stderr] {}", line);
                        on_line("info", &line);
                    }
                    Err(e) => {
                        error!("[marimo stderr read error] {}", e);
                        break;
                    }
                }
            }
        });
    }
}
