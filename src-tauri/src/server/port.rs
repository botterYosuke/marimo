use std::net::TcpListener;

/// Find an available port starting from `base_port`, scanning up to 100 ports.
pub fn find_available_port(base_port: u16) -> Option<u16> {
    for offset in 0..100 {
        let port = base_port + offset;
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    None
}
