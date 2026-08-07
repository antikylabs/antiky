use std::ffi::c_void;
use std::sync::{Mutex, OnceLock};

use futures_channel::oneshot;
use tauri::{State, WebviewWindow};

use crate::{
    DevelopmentConnection, NativeError, NativeProjectEvent, NativeProjectSource,
    ProjectActivationRequest, ProjectHost, ProjectValidationRequest, TerminalBounds, TerminalTheme,
    ValidatedProjectBoundary, native, project_picker::pick_project, read_development_connection,
};

pub(crate) struct StudioState {
    pub project: Mutex<ProjectHost>,
    pub terminal_theme: OnceLock<Result<TerminalTheme, NativeError>>,
}

fn project_host(
    state: &StudioState,
) -> Result<std::sync::MutexGuard<'_, ProjectHost>, NativeError> {
    state
        .project
        .lock()
        .map_err(|_| NativeError::native_unavailable("Project state is unavailable."))
}

fn terminal_theme(state: &StudioState) -> Result<&TerminalTheme, NativeError> {
    let configured = state
        .terminal_theme
        .get()
        .ok_or_else(|| NativeError::native_unavailable("Studio resources are not initialized."))?;
    configured.as_ref().map_err(Clone::clone)
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
pub(crate) fn project_initial_event(
    state: State<'_, StudioState>,
) -> Result<Option<NativeProjectEvent>, NativeError> {
    Ok(project_host(state.inner())?.initial_event())
}

#[tauri::command]
pub(crate) async fn project_select(
    window: WebviewWindow,
    state: State<'_, StudioState>,
) -> Result<Option<NativeProjectSource>, NativeError> {
    let path = run_on_main_thread(window, |_| pick_project()).await?;
    match path {
        Some(path) => project_host(state.inner())?
            .stage_open(&path, false)
            .map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
pub(crate) fn project_validate(
    state: State<'_, StudioState>,
    request: ProjectValidationRequest,
) -> Result<ValidatedProjectBoundary, NativeError> {
    project_host(state.inner())?.validate(request)
}

#[tauri::command]
pub(crate) fn project_activate(
    state: State<'_, StudioState>,
    request: ProjectActivationRequest,
) -> Result<(), NativeError> {
    project_host(state.inner())?.activate(request)
}

#[tauri::command]
pub(crate) fn discover_development_connection(
    state: State<'_, StudioState>,
) -> Result<DevelopmentConnection, NativeError> {
    let project_directory = project_host(state.inner())?.active_project_root()?;
    read_development_connection(&project_directory)
}

#[tauri::command]
pub(crate) async fn terminal_open(
    window: WebviewWindow,
    state: State<'_, StudioState>,
    bounds: TerminalBounds,
) -> Result<(), NativeError> {
    let bounds = bounds.validate()?;
    let project_directory = project_host(state.inner())?.active_project_root()?;
    let terminal_theme = terminal_theme(state.inner())?.revalidate()?;
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
