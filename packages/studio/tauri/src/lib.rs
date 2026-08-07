mod commands;
mod connection;
mod development;
mod error;
mod native;
mod project;
mod project_picker;
mod recent_projects;
mod terminal;
mod terminal_theme;

pub use connection::{
    DevelopmentConnection, read_development_connection, resolve_project_directory,
};
pub(crate) use development::DevelopmentHost;
pub use development::{resolve_project_runtime, resolve_project_service};
pub use error::NativeError;
pub(crate) use project::ProjectHost;
pub use project::{
    NativeProjectEvent, NativeProjectSource, ProjectActivationRequest, ProjectValidationRequest,
    ValidatedProjectBoundary, read_project_source, validate_project_source,
};
pub use recent_projects::{NativeRecentProject, RecentProjectStore};
pub use terminal::TerminalBounds;
pub use terminal_theme::{TerminalTheme, resolve_terminal_theme};

use commands::{
    StudioState, development_restart, development_start, development_stop,
    discover_development_connection, project_activate, project_create, project_initial_event,
    project_open_recent, project_recents, project_select, project_validate, terminal_close,
    terminal_focus, terminal_layout, terminal_open, terminal_status,
};
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, Manager, RunEvent, path::BaseDirectory};

const PROJECT_OPEN_EVENT: &str = "antiky://project-open";

fn project_path_from_urls(urls: &[url::Url]) -> Result<std::path::PathBuf, NativeError> {
    if urls.len() != 1 {
        return Err(NativeError::project_ambiguous());
    }
    urls[0]
        .to_file_path()
        .map_err(|()| NativeError::project_invalid("The opened project must be a local file."))
}

fn handle_project_urls(app: &tauri::AppHandle, urls: &[url::Url]) {
    let state = app.state::<StudioState>();
    let event = match state.project.lock() {
        Ok(mut host) => match project_path_from_urls(urls) {
            Ok(path) => host.stage_event(&path),
            Err(error) => host.stage_error(error),
        },
        Err(_) => NativeProjectEvent::Error {
            error: NativeError::native_unavailable("Project state is unavailable."),
        },
    };
    let _ = app.emit(PROJECT_OPEN_EVENT, event);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(StudioState {
            project: Mutex::new(ProjectHost::default()),
            development: Mutex::new(DevelopmentHost::default()),
            project_runtime: OnceLock::new(),
            project_service: OnceLock::new(),
            recent_projects: OnceLock::new(),
            terminal_theme: OnceLock::new(),
        })
        .setup(|app| {
            let paths = app.path();
            let recent_projects = paths
                .app_data_dir()
                .map(|directory| RecentProjectStore::open(directory.join("recent-projects.json")))
                .map_err(|_| {
                    NativeError::native_unavailable("Studio application data is unavailable.")
                })?;
            app.state::<StudioState>()
                .recent_projects
                .set(Mutex::new(recent_projects))
                .map_err(|_| {
                    NativeError::native_unavailable("Studio resources are already initialized.")
                })?;
            let terminal_theme = match (
                paths.resource_dir(),
                paths.resolve(
                    terminal_theme::TERMINAL_THEME_RESOURCE_PATH,
                    BaseDirectory::Resource,
                ),
            ) {
                (Ok(resource_root), Ok(candidate)) => {
                    resolve_terminal_theme(&resource_root, &candidate)
                }
                _ => Err(NativeError::terminal_theme_invalid()),
            };
            app.state::<StudioState>()
                .terminal_theme
                .set(terminal_theme)
                .map_err(|_| {
                    NativeError::native_unavailable("Studio resources are already initialized.")
                })?;
            let project_service = match (
                paths.resource_dir(),
                paths.resolve(
                    development::PROJECT_SERVICE_RESOURCE_PATH,
                    BaseDirectory::Resource,
                ),
            ) {
                (Ok(resource_root), Ok(candidate)) => {
                    resolve_project_service(&resource_root, &candidate)
                }
                _ => Err(NativeError::native_unavailable(
                    "The Studio project service is missing or invalid.",
                )),
            };
            app.state::<StudioState>()
                .project_service
                .set(project_service)
                .map_err(|_| {
                    NativeError::native_unavailable("Studio resources are already initialized.")
                })?;
            let project_runtime = match (
                paths.resource_dir(),
                paths.resolve(
                    development::PROJECT_RUNTIME_RESOURCE_PATH,
                    BaseDirectory::Resource,
                ),
            ) {
                (Ok(resource_root), Ok(candidate)) => {
                    resolve_project_runtime(&resource_root, &candidate)
                }
                _ => Err(NativeError::native_unavailable(
                    "The Studio project service is missing or invalid.",
                )),
            };
            app.state::<StudioState>()
                .project_runtime
                .set(project_runtime)
                .map_err(|_| {
                    NativeError::native_unavailable("Studio resources are already initialized.")
                })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project_initial_event,
            project_select,
            project_create,
            project_recents,
            project_open_recent,
            project_validate,
            project_activate,
            development_start,
            development_restart,
            development_stop,
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
    app.run(|app, event| {
        if let RunEvent::Opened { urls } = event {
            handle_project_urls(app, &urls);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::project_path_from_urls;

    #[test]
    fn finder_open_requires_exactly_one_local_project_url() {
        let file = url::Url::from_file_path("/tmp/harbor.antiky").expect("file URL");
        assert_eq!(
            project_path_from_urls(&[file]).expect("one file"),
            std::path::PathBuf::from("/tmp/harbor.antiky"),
        );
        assert_eq!(
            project_path_from_urls(&[]).expect_err("zero URLs").code(),
            "ANTIKY_PROJECT_AMBIGUOUS",
        );
        let first = url::Url::from_file_path("/tmp/first.antiky").expect("first URL");
        let second = url::Url::from_file_path("/tmp/second.antiky").expect("second URL");
        assert_eq!(
            project_path_from_urls(&[first, second])
                .expect_err("multiple URLs")
                .code(),
            "ANTIKY_PROJECT_AMBIGUOUS",
        );
        assert_eq!(
            project_path_from_urls(&[
                url::Url::parse("https://example.com/game.antiky").expect("remote URL")
            ])
            .expect_err("remote URL")
            .code(),
            "ANTIKY_PROJECT_INVALID",
        );
    }
}
