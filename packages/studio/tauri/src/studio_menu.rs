use std::path::{Path, PathBuf};

use tauri::{
    AppHandle, Emitter, Manager,
    menu::{IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
};

use crate::{
    NativeError, NativeProjectEvent, NativeRecentProject, PROJECT_OPEN_EVENT,
    commands::StudioState, project_picker::pick_project, recent_projects::MAX_RECENT_PROJECTS,
};

const OPEN_PROJECT_MENU_ID: &str = "studio.open-project";
const RECENT_PROJECTS_MENU_ID: &str = "studio.recent-projects";
const RECENT_PROJECT_MENU_ID_PREFIX: &str = "studio.recent-project.";
const EMPTY_RECENT_PROJECTS_MENU_ID: &str = "studio.recent-projects.empty";

#[derive(Debug, Eq, PartialEq)]
struct RecentProjectMenuEntry {
    enabled: bool,
    label: String,
}

fn menu_unavailable() -> NativeError {
    NativeError::native_unavailable("The Studio application menu is unavailable.")
}

fn project_label(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.is_empty())
        .unwrap_or("Untitled Project")
        .to_owned()
}

fn recent_project_menu_entries(projects: &[NativeRecentProject]) -> Vec<RecentProjectMenuEntry> {
    projects
        .iter()
        .take(MAX_RECENT_PROJECTS)
        .map(|project| {
            let mut label = project_label(&project.manifest_path);
            if !project.available {
                label.push_str(" (Missing)");
            }
            RecentProjectMenuEntry {
                enabled: project.available,
                label,
            }
        })
        .collect()
}

fn recent_project_menu_id(index: usize) -> String {
    format!("{RECENT_PROJECT_MENU_ID_PREFIX}{index}")
}

fn recent_project_index(id: &str) -> Option<usize> {
    id.strip_prefix(RECENT_PROJECT_MENU_ID_PREFIX)
        .and_then(|index| index.parse::<usize>().ok())
        .filter(|index| *index < MAX_RECENT_PROJECTS)
}

fn recent_projects(app: &AppHandle) -> Result<Vec<NativeRecentProject>, NativeError> {
    app.state::<StudioState>()
        .recent_projects
        .get()
        .ok_or_else(|| NativeError::native_unavailable("Studio resources are not initialized."))?
        .lock()
        .map_err(|_| NativeError::native_unavailable("Recent project state is unavailable."))
        .map(|store| store.list())
}

fn file_submenu<R: tauri::Runtime>(menu: &Menu<R>) -> tauri::Result<Option<Submenu<R>>> {
    for item in menu.items()? {
        if let Some(submenu) = item.as_submenu()
            && submenu.text()? == "File"
        {
            return Ok(Some(submenu.clone()));
        }
    }
    Ok(None)
}

pub(crate) fn build(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::default(app)?;
    let Some(file) = file_submenu(&menu)? else {
        return Ok(menu);
    };
    let open_project = MenuItem::with_id(
        app,
        OPEN_PROJECT_MENU_ID,
        "Open Project…",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let no_recent_projects = MenuItem::with_id(
        app,
        EMPTY_RECENT_PROJECTS_MENU_ID,
        "No Recent Projects",
        false,
        None::<&str>,
    )?;
    let recent_projects = Submenu::with_id_and_items(
        app,
        RECENT_PROJECTS_MENU_ID,
        "Recent Projects",
        true,
        &[&no_recent_projects],
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let project_items: [&dyn IsMenuItem<tauri::Wry>; 3] =
        [&open_project, &recent_projects, &separator];
    file.prepend_items(&project_items)?;
    Ok(menu)
}

fn recent_projects_submenu(app: &AppHandle) -> Result<Submenu<tauri::Wry>, NativeError> {
    let menu = app.menu().ok_or_else(menu_unavailable)?;
    let file = file_submenu(&menu)
        .map_err(|_| menu_unavailable())?
        .ok_or_else(menu_unavailable)?;
    file.get(RECENT_PROJECTS_MENU_ID)
        .and_then(|item| item.as_submenu().cloned())
        .ok_or_else(menu_unavailable)
}

fn append_recent_project_items(
    app: &AppHandle,
    menu: &Submenu<tauri::Wry>,
    entries: &[RecentProjectMenuEntry],
) -> Result<(), NativeError> {
    if entries.is_empty() {
        let empty = MenuItem::with_id(
            app,
            EMPTY_RECENT_PROJECTS_MENU_ID,
            "No Recent Projects",
            false,
            None::<&str>,
        )
        .map_err(|_| menu_unavailable())?;
        return menu.append(&empty).map_err(|_| menu_unavailable());
    }
    for (index, entry) in entries.iter().enumerate() {
        let item = MenuItem::with_id(
            app,
            recent_project_menu_id(index),
            &entry.label,
            entry.enabled,
            None::<&str>,
        )
        .map_err(|_| menu_unavailable())?;
        menu.append(&item).map_err(|_| menu_unavailable())?;
    }
    Ok(())
}

pub(crate) fn refresh_recent_projects(app: &AppHandle) -> Result<(), NativeError> {
    let entries = recent_project_menu_entries(&recent_projects(app)?);
    let menu = recent_projects_submenu(app)?;
    let item_count = menu.items().map_err(|_| menu_unavailable())?.len();
    for _ in 0..item_count {
        menu.remove_at(0).map_err(|_| menu_unavailable())?;
    }
    append_recent_project_items(app, &menu, &entries)
}

fn recent_project_path(app: &AppHandle, index: usize) -> Result<PathBuf, NativeError> {
    let project = recent_projects(app)?
        .into_iter()
        .nth(index)
        .ok_or_else(NativeError::project_not_found)?;
    if !project.available {
        return Err(NativeError::project_not_found());
    }
    Ok(project.manifest_path)
}

fn stage_menu_project(
    app: &AppHandle,
    selected: Result<Option<PathBuf>, NativeError>,
) -> Option<NativeProjectEvent> {
    let selected = match selected {
        Ok(Some(path)) => path,
        Ok(None) => return None,
        Err(error) => {
            return Some(match app.state::<StudioState>().project.lock() {
                Ok(mut project) => project.stage_error(error),
                Err(_) => NativeProjectEvent::Error {
                    error: NativeError::native_unavailable("Project state is unavailable."),
                },
            });
        }
    };
    Some(match app.state::<StudioState>().project.lock() {
        Ok(mut project) => project.stage_event(&selected),
        Err(_) => NativeProjectEvent::Error {
            error: NativeError::native_unavailable("Project state is unavailable."),
        },
    })
}

fn emit_project_selection(app: &AppHandle, selected: Result<Option<PathBuf>, NativeError>) {
    let Some(event) = stage_menu_project(app, selected) else {
        return;
    };
    let _ = app.emit(PROJECT_OPEN_EVENT, event);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub(crate) fn handle_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    if id == OPEN_PROJECT_MENU_ID {
        emit_project_selection(app, pick_project());
    } else if let Some(index) = recent_project_index(id) {
        emit_project_selection(app, recent_project_path(app, index).map(Some));
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::NativeRecentProject;

    use super::{recent_project_index, recent_project_menu_entries};

    fn recent(path: &str, available: bool) -> NativeRecentProject {
        let manifest_path = PathBuf::from(path);
        NativeRecentProject {
            available,
            last_opened_at: 1,
            project_root: manifest_path
                .parent()
                .expect("recent project parent")
                .to_path_buf(),
            manifest_path,
        }
    }

    #[test]
    fn recent_project_menu_is_bounded_ordered_and_marks_missing_projects() {
        let entries = recent_project_menu_entries(&[
            recent("/projects/harbor/harbor.antiky", true),
            recent("/projects/forest/forest.antiky", false),
        ]);

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].label, "harbor");
        assert!(entries[0].enabled);
        assert_eq!(entries[1].label, "forest (Missing)");
        assert!(!entries[1].enabled);

        let oversized = (0..22)
            .map(|index| recent(&format!("/projects/{index}/{index}.antiky"), true))
            .collect::<Vec<_>>();
        assert_eq!(recent_project_menu_entries(&oversized).len(), 20);
    }

    #[test]
    fn recent_project_event_ids_accept_only_bounded_exact_indexes() {
        assert_eq!(recent_project_index("studio.recent-project.0"), Some(0));
        assert_eq!(recent_project_index("studio.recent-project.19"), Some(19));
        assert_eq!(recent_project_index("studio.recent-project.20"), None);
        assert_eq!(recent_project_index("studio.recent-project.-1"), None);
        assert_eq!(recent_project_index("studio.recent-project.1.extra"), None);
        assert_eq!(recent_project_index("other.1"), None);
    }
}
