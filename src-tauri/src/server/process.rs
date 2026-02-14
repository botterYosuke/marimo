use std::io::{BufRead, BufReader, Read};
use std::process::{ChildStderr, ChildStdout};
use log::{error, info};

/// Read lines from a byte stream with lossy UTF-8 conversion.
/// Unlike BufReader::lines(), this does not fail on invalid UTF-8.
fn read_lines_lossy<R: Read>(reader: R) -> impl Iterator<Item = String> {
    let buf_reader = BufReader::new(reader);
    let mut bytes = Vec::new();
    let mut inner = buf_reader;

    std::iter::from_fn(move || {
        bytes.clear();
        match inner.read_until(b'\n', &mut bytes) {
            Ok(0) => None, // EOF
            Ok(_) => {
                // Remove trailing newline characters
                while bytes.last() == Some(&b'\n') || bytes.last() == Some(&b'\r') {
                    bytes.pop();
                }
                Some(String::from_utf8_lossy(&bytes).into_owned())
            }
            Err(e) => {
                error!("[read_lines_lossy] IO error: {}", e);
                None
            }
        }
    })
}

/// Capture stdout/stderr from a child process into log callbacks.
pub fn capture_output(
    stdout: Option<ChildStdout>,
    stderr: Option<ChildStderr>,
    on_line: impl Fn(&str, &str) + Send + 'static + Clone,
) {
    if let Some(stdout) = stdout {
        let on_line_clone = on_line.clone();
        std::thread::spawn(move || {
            for line in read_lines_lossy(stdout) {
                info!("[marimo stdout] {}", line);
                on_line_clone("info", &line);
            }
        });
    }

    if let Some(stderr) = stderr {
        std::thread::spawn(move || {
            for line in read_lines_lossy(stderr) {
                // marimo logs to stderr by default
                info!("[marimo stderr] {}", line);
                on_line("info", &line);
            }
        });
    }
}
