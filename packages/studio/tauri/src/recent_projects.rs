use std::ffi::OsStr;
use std::fs::{OpenOptions, create_dir_all, remove_file, rename, symlink_metadata};
use std::io::{Read, Write};
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};

use crate::NativeError;

const MAX_RECENT_PROJECTS: usize = 20;
const MAX_RECENT_STORE_BYTES: usize = 64 * 1024;
static TEMPORARY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredRecentProject {
    manifest_path: PathBuf,
    revision: String,
    last_opened_at: u64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecentProjectFile {
    schema_version: u8,
    projects: Vec<StoredRecentProject>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRecentProject {
    pub available: bool,
    pub last_opened_at: u64,
    pub manifest_path: PathBuf,
    pub project_root: PathBuf,
}

pub struct RecentProjectStore {
    path: PathBuf,
    projects: Vec<StoredRecentProject>,
}

fn valid_manifest_path(path: &Path) -> bool {
    path.is_absolute() && path.extension() == Some(OsStr::new("antiky"))
}

fn valid_revision(revision: &str) -> bool {
    revision.len() == 64 && revision.bytes().all(|value| value.is_ascii_hexdigit())
}

fn read_projects(path: &Path) -> Option<Vec<StoredRecentProject>> {
    let metadata = symlink_metadata(path).ok()?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() > MAX_RECENT_STORE_BYTES as u64
    {
        return None;
    }
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW)
        .open(path)
        .ok()?;
    let mut bytes = Vec::new();
    file.take(MAX_RECENT_STORE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() > MAX_RECENT_STORE_BYTES {
        return None;
    }
    let file: RecentProjectFile = serde_json::from_slice(&bytes).ok()?;
    if file.schema_version != 1 || file.projects.len() > MAX_RECENT_PROJECTS {
        return None;
    }
    let mut paths = std::collections::HashSet::new();
    if file.projects.iter().any(|project| {
        !valid_manifest_path(&project.manifest_path)
            || !valid_revision(&project.revision)
            || !paths.insert(project.manifest_path.clone())
    }) {
        return None;
    }
    Some(file.projects)
}

fn recent_store_unavailable() -> NativeError {
    NativeError::native_unavailable("Studio could not save its recent-project list.")
}

impl RecentProjectStore {
    pub fn open(path: PathBuf) -> Self {
        let projects = read_projects(&path).unwrap_or_default();
        Self { path, projects }
    }

    pub fn contains(&self, manifest_path: &Path) -> bool {
        self.projects
            .iter()
            .any(|project| project.manifest_path == manifest_path)
    }

    pub fn list(&self) -> Vec<NativeRecentProject> {
        self.projects
            .iter()
            .map(|project| {
                let available = symlink_metadata(&project.manifest_path)
                    .map(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
                    .unwrap_or(false);
                NativeRecentProject {
                    available,
                    last_opened_at: project.last_opened_at,
                    project_root: project
                        .manifest_path
                        .parent()
                        .unwrap_or(Path::new("/"))
                        .to_path_buf(),
                    manifest_path: project.manifest_path.clone(),
                }
            })
            .collect()
    }

    pub fn record(
        &mut self,
        manifest_path: &Path,
        revision: &str,
        last_opened_at: u64,
    ) -> Result<(), NativeError> {
        if !valid_manifest_path(manifest_path) || !valid_revision(revision) {
            return Err(NativeError::argument_invalid(
                "Recent project identity is invalid.",
            ));
        }
        let previous = self.projects.clone();
        self.projects
            .retain(|project| project.manifest_path != manifest_path);
        self.projects.insert(
            0,
            StoredRecentProject {
                manifest_path: manifest_path.to_path_buf(),
                revision: revision.to_owned(),
                last_opened_at,
            },
        );
        self.projects.truncate(MAX_RECENT_PROJECTS);
        if let Err(error) = self.persist() {
            self.projects = previous;
            return Err(error);
        }
        Ok(())
    }

    fn persist(&self) -> Result<(), NativeError> {
        let parent = self.path.parent().ok_or_else(recent_store_unavailable)?;
        create_dir_all(parent).map_err(|_| recent_store_unavailable())?;
        let sequence = TEMPORARY_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let temporary = parent.join(format!(
            ".recent-projects-{}-{sequence}.tmp",
            std::process::id(),
        ));
        let source = serde_json::to_vec(&RecentProjectFile {
            schema_version: 1,
            projects: self.projects.clone(),
        })
        .map_err(|_| recent_store_unavailable())?;
        let result = (|| {
            let mut file = OpenOptions::new()
                .create_new(true)
                .write(true)
                .mode(0o600)
                .custom_flags(libc::O_NOFOLLOW)
                .open(&temporary)
                .map_err(|_| recent_store_unavailable())?;
            file.write_all(&source)
                .and_then(|()| file.sync_all())
                .map_err(|_| recent_store_unavailable())?;
            rename(&temporary, &self.path).map_err(|_| recent_store_unavailable())
        })();
        if result.is_err() {
            let _ = remove_file(&temporary);
        }
        result
    }
}
