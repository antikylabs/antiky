use std::ffi::c_void;
use std::path::PathBuf;

use futures_channel::oneshot;
use serde::Serialize;
use tauri::{State, WebviewWindow};

use crate::{
    DevelopmentConnection, NativeError, TerminalBounds, TerminalTheme, native,
    read_development_connection,
};

pub(crate) struct StudioState {
    pub project_directory: PathBuf,
    pub terminal_theme: Result<TerminalTheme, NativeError>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StudioContext {
    project_directory: String,
    project_name: String,
}

fn context_from_state(state: &StudioState) -> StudioContext {
    StudioContext {
        project_directory: state.project_directory.to_string_lossy().into_owned(),
        project_name: state
            .project_directory
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Project")
            .to_owned(),
    }
}

async fn run_on_main_thread<T, F>(window: WebviewWindow, operation: F) -> Result<T, NativeError>
where
    T: Send + 'static,
    F: FnOnce(&WebviewWindow) -> Result<T, NativeError> + Send + 'static,
{
    let operation_window = window.clone();
    let (sender, receiver) = oneshot::channel();
    window
        .run_on_main_thread(move || {
            let _ = sender.send(operation(&operation_window));
        })
        .map_err(|_| NativeError::native_unavailable("Native main thread is unavailable."))?;
    receiver
        .await
        .map_err(|_| NativeError::native_unavailable("Native operation was cancelled."))?
}

#[tauri::command]
pub(crate) fn studio_context(state: State<'_, StudioState>) -> StudioContext {
    context_from_state(state.inner())
}

#[tauri::command]
pub(crate) fn discover_development_connection(
    state: State<'_, StudioState>,
) -> Result<DevelopmentConnection, NativeError> {
    read_development_connection(&state.project_directory)
}

#[tauri::command]
pub(crate) async fn terminal_open(
    window: WebviewWindow,
    state: State<'_, StudioState>,
    bounds: TerminalBounds,
) -> Result<(), NativeError> {
    let bounds = bounds.validate()?;
    let project_directory = state.project_directory.clone();
    let terminal_theme = state
        .terminal_theme
        .as_ref()
        .map_err(|error| error.clone())?
        .revalidate()?;
    run_on_main_thread(window, move |window| {
        let parent = window
            .ns_view()
            .map_err(|_| NativeError::native_unavailable("Studio window is unavailable."))?;
        native::open(
            parent.cast::<c_void>(),
            &project_directory,
            terminal_theme.path(),
            bounds,
        )
    })
    .await
}

#[tauri::command]
pub(crate) async fn terminal_layout(
    window: WebviewWindow,
    bounds: Option<TerminalBounds>,
) -> Result<(), NativeError> {
    let bounds = bounds.map(TerminalBounds::validate).transpose()?;
    run_on_main_thread(window, move |_| match bounds {
        Some(bounds) => native::layout(bounds),
        None => native::hide(),
    })
    .await
}

#[tauri::command]
pub(crate) async fn terminal_focus(window: WebviewWindow) -> Result<(), NativeError> {
    run_on_main_thread(window, |_| native::focus()).await
}

#[tauri::command]
pub(crate) async fn terminal_close(window: WebviewWindow) -> Result<(), NativeError> {
    run_on_main_thread(window, |_| {
        native::close();
        Ok(())
    })
    .await
}

#[tauri::command]
pub(crate) async fn terminal_status(
    window: WebviewWindow,
) -> Result<native::TerminalStatus, NativeError> {
    run_on_main_thread(window, |_| Ok(native::status())).await
}
