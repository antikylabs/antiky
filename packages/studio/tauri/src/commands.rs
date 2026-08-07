use std::ffi::c_void;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use futures_channel::oneshot;
use tauri::{AppHandle, Manager, State, WebviewWindow};

use crate::{
    DevelopmentConnection, DevelopmentHost, NativeError, NativeProjectEvent, NativeProjectSource,
    NativeRecentProject, ProjectActivationRequest, ProjectHost, ProjectValidationRequest,
    RecentProjectStore, TerminalBounds, TerminalTheme, ValidatedProjectBoundary,
    development::initialize_project,
    native,
    project_picker::{pick_project, pick_project_directory},
    read_development_connection,
};

pub(crate) struct StudioState {
    pub project: Mutex<ProjectHost>,
    pub development: Mutex<DevelopmentHost>,
    pub project_runtime: OnceLock<Result<std::path::PathBuf, NativeError>>,
    pub project_service: OnceLock<Result<std::path::PathBuf, NativeError>>,
    pub recent_projects: OnceLock<Mutex<RecentProjectStore>>,
    pub terminal_theme: OnceLock<Result<TerminalTheme, NativeError>>,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct RecentProjectRequest {
    manifest_path: PathBuf,
}

fn development_host(
    state: &StudioState,
) -> Result<std::sync::MutexGuard<'_, DevelopmentHost>, NativeError> {
    state
        .development
        .lock()
        .map_err(|_| NativeError::native_unavailable("Development state is unavailable."))
}

fn project_service(state: &StudioState) -> Result<&std::path::PathBuf, NativeError> {
    state
        .project_service
        .get()
        .ok_or_else(|| NativeError::native_unavailable("Studio resources are not initialized."))?
        .as_ref()
        .map_err(Clone::clone)
}

fn project_runtime(state: &StudioState) -> Result<&std::path::PathBuf, NativeError> {
    state
        .project_runtime
        .get()
        .ok_or_else(|| NativeError::native_unavailable("Studio resources are not initialized."))?
        .as_ref()
        .map_err(Clone::clone)
}

fn project_host(
    state: &StudioState,
) -> Result<std::sync::MutexGuard<'_, ProjectHost>, NativeError> {
    state
        .project
        .lock()
        .map_err(|_| NativeError::native_unavailable("Project state is unavailable."))
}

fn recent_projects(state: &StudioState) -> Result<MutexGuard<'_, RecentProjectStore>, NativeError> {
    state
        .recent_projects
        .get()
        .ok_or_else(|| NativeError::native_unavailable("Studio resources are not initialized."))?
        .lock()
        .map_err(|_| NativeError::native_unavailable("Recent project state is unavailable."))
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
pub(crate) async fn project_create(
    window: WebviewWindow,
    state: State<'_, StudioState>,
    name: String,
) -> Result<Option<NativeProjectSource>, NativeError> {
    if name.trim().is_empty()
        || name.chars().count() > 128
        || name.contains(['/', '\\'])
        || name.chars().any(char::is_control)
    {
        return Err(NativeError::project_creation(
            "ANTIKY_PROJECT_NAME_INVALID".into(),
            "Project name must be 1 through 128 characters and must not contain a path or control character.".into(),
        ));
    }
    let directory = run_on_main_thread(window, |_| pick_project_directory()).await?;
    let Some(directory) = directory else {
        return Ok(None);
    };
    let runtime_path = project_runtime(state.inner())?.clone();
    let worker_path = project_service(state.inner())?.clone();
    let manifest_path = tauri::async_runtime::spawn_blocking(move || {
        initialize_project(&runtime_path, &worker_path, &directory, &name)
    })
    .await
    .map_err(|_| NativeError::native_unavailable("Studio project creation was cancelled."))??;
    project_host(state.inner())?
        .stage_open(&manifest_path, false)
        .map(Some)
}

#[tauri::command]
pub(crate) fn project_recents(
    state: State<'_, StudioState>,
) -> Result<Vec<NativeRecentProject>, NativeError> {
    Ok(recent_projects(state.inner())?.list())
}

#[tauri::command]
pub(crate) fn project_open_recent(
    state: State<'_, StudioState>,
    request: RecentProjectRequest,
) -> Result<NativeProjectSource, NativeError> {
    if !recent_projects(state.inner())?.contains(&request.manifest_path) {
        return Err(NativeError::project_not_found());
    }
    project_host(state.inner())?.stage_open(&request.manifest_path, false)
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
    let mut recent_projects = recent_projects(state.inner())?;
    let boundary = project_host(state.inner())?.activate(request)?;
    let last_opened_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX);
    if let Err(error) =
        recent_projects.record(&boundary.manifest_path, &boundary.revision, last_opened_at)
    {
        eprintln!("{error}");
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn discover_development_connection(
    state: State<'_, StudioState>,
) -> Result<DevelopmentConnection, NativeError> {
    let project_directory = project_host(state.inner())?.active_project_root()?;
    read_development_connection(&project_directory)
}

#[tauri::command]
pub(crate) async fn development_start(
    app: AppHandle,
) -> Result<DevelopmentConnection, NativeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<StudioState>();
        let (manifest_path, project_revision) =
            project_host(state.inner())?.active_project_identity()?;
        let runtime_path = project_runtime(state.inner())?.clone();
        let worker_path = project_service(state.inner())?.clone();
        development_host(state.inner())?.start(
            &runtime_path,
            &worker_path,
            &manifest_path,
            &project_revision,
        )
    })
    .await
    .map_err(|_| NativeError::native_unavailable("Studio project startup was cancelled."))?
}

#[tauri::command]
pub(crate) async fn development_stop(app: AppHandle) -> Result<(), NativeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<StudioState>();
        development_host(state.inner())?.stop()
    })
    .await
    .map_err(|_| NativeError::native_unavailable("Studio project cleanup was cancelled."))?
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
