mod commands;
mod connection;
mod error;
mod native;
mod terminal;
mod terminal_theme;

pub use connection::{
    DevelopmentConnection, read_development_connection, resolve_project_directory,
};
pub use error::NativeError;
pub use terminal::TerminalBounds;
pub use terminal_theme::{TerminalTheme, resolve_terminal_theme};

use commands::{
    StudioState, discover_development_connection, studio_context, terminal_close, terminal_focus,
    terminal_layout, terminal_open, terminal_status,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let fallback = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let project_directory =
        resolve_project_directory(std::env::var_os("INIT_CWD").as_deref(), &fallback)
            .expect("Antiky Studio requires a valid project directory");

    let app = tauri::Builder::default()
        .manage(StudioState { project_directory })
        .invoke_handler(tauri::generate_handler![
            studio_context,
            discover_development_connection,
            terminal_open,
            terminal_layout,
            terminal_focus,
            terminal_close,
            terminal_status,
        ])
        .build(tauri::generate_context!())
        .expect("Antiky Studio native host failed to start");

    // Tao delivers application termination from AppKit's `sendEvent:` callback. Destroying the
    // native terminal there mutates AppKit state reentrantly and aborts at the Rust/Objective-C
    // boundary. Process exit closes the PTY and reclaims the terminal; explicit terminal closes
    // still use the bounded `terminal_close` command while the application is running.
    app.run(|_, _| {});
}
