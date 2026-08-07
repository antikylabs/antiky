use std::ffi::OsStr;
use std::fs::{File, OpenOptions, symlink_metadata};
use std::io::{Read, Take};
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::NativeError;

pub const MAX_PROJECT_BYTES: u64 = 64 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProjectSource {
    pub schema_version: u8,
    pub selection_id: u64,
    pub manifest_path: PathBuf,
    pub project_root: PathBuf,
    pub revision: String,
    pub source: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidatedProjectBoundary {
    pub selection_id: u64,
    pub manifest_path: PathBuf,
    pub project_root: PathBuf,
    pub revision: String,
    pub development_working_directory: PathBuf,
    pub build_working_directory: PathBuf,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum NativeProjectEvent {
    Opened { project: NativeProjectSource },
    Error { error: NativeError },
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectValidationRequest {
    pub selection_id: u64,
    pub manifest_path: PathBuf,
    pub project_root: PathBuf,
    pub revision: String,
    pub development_working_directory: String,
    pub build_working_directory: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectActivationRequest {
    pub selection_id: u64,
    pub manifest_path: PathBuf,
    pub revision: String,
}

#[derive(Default)]
pub(crate) struct ProjectHost {
    next_selection_id: u64,
    pending: Option<NativeProjectSource>,
    prepared: Option<ValidatedProjectBoundary>,
    active: Option<ValidatedProjectBoundary>,
    initial_event: Option<NativeProjectEvent>,
}

impl ProjectHost {
    fn next_selection_id(&mut self) -> Result<u64, NativeError> {
        self.next_selection_id = self.next_selection_id.checked_add(1).ok_or_else(|| {
            NativeError::native_unavailable("Project selection capacity is exhausted.")
        })?;
        Ok(self.next_selection_id)
    }

    pub(crate) fn stage_open(
        &mut self,
        path: &Path,
        remember_initial: bool,
    ) -> Result<NativeProjectSource, NativeError> {
        let selection_id = self.next_selection_id()?;
        self.pending = None;
        self.prepared = None;
        let source = read_project_source(path, selection_id)?;
        self.pending = Some(source.clone());
        if remember_initial {
            self.initial_event = Some(NativeProjectEvent::Opened {
                project: source.clone(),
            });
        } else {
            self.initial_event = None;
        }
        Ok(source)
    }

    pub(crate) fn stage_event(&mut self, path: &Path) -> NativeProjectEvent {
        match self.stage_open(path, true) {
            Ok(project) => NativeProjectEvent::Opened { project },
            Err(error) => {
                let event = NativeProjectEvent::Error {
                    error: error.clone(),
                };
                self.initial_event = Some(event.clone());
                event
            }
        }
    }

    pub(crate) fn stage_error(&mut self, error: NativeError) -> NativeProjectEvent {
        let event = NativeProjectEvent::Error { error };
        self.initial_event = Some(event.clone());
        event
    }

    pub(crate) fn initial_event(&self) -> Option<NativeProjectEvent> {
        self.initial_event.clone()
    }

    pub(crate) fn validate(
        &mut self,
        request: ProjectValidationRequest,
    ) -> Result<ValidatedProjectBoundary, NativeError> {
        let source = self
            .pending
            .as_ref()
            .ok_or_else(NativeError::project_not_found)?;
        if request.selection_id != source.selection_id
            || request.manifest_path != source.manifest_path
            || request.project_root != source.project_root
            || request.revision != source.revision
        {
            return Err(NativeError::project_invalid(
                "The project changed before validation completed.",
            ));
        }
        let boundary = validate_project_source(
            source,
            &request.development_working_directory,
            &request.build_working_directory,
        )?;
        self.prepared = Some(boundary.clone());
        Ok(boundary)
    }

    pub(crate) fn activate(
        &mut self,
        request: ProjectActivationRequest,
    ) -> Result<(), NativeError> {
        let boundary = self
            .prepared
            .as_ref()
            .ok_or_else(NativeError::project_not_found)?;
        if request.selection_id != boundary.selection_id
            || request.manifest_path != boundary.manifest_path
            || request.revision != boundary.revision
        {
            return Err(NativeError::project_invalid(
                "The project changed before activation completed.",
            ));
        }
        self.active = Some(boundary.clone());
        self.pending = None;
        self.prepared = None;
        self.initial_event = None;
        Ok(())
    }

    pub(crate) fn active_project_root(&self) -> Result<PathBuf, NativeError> {
        self.active
            .as_ref()
            .map(|boundary| boundary.project_root.clone())
            .ok_or_else(NativeError::project_not_found)
    }
}

#[cfg(test)]
impl ProjectValidationRequest {
    fn from_source(
        source: &NativeProjectSource,
        development_working_directory: &str,
        build_working_directory: &str,
    ) -> Self {
        Self {
            selection_id: source.selection_id,
            manifest_path: source.manifest_path.clone(),
            project_root: source.project_root.clone(),
            revision: source.revision.clone(),
            development_working_directory: development_working_directory.into(),
            build_working_directory: build_working_directory.into(),
        }
    }
}

#[cfg(test)]
impl ProjectActivationRequest {
    fn from_boundary(boundary: &ValidatedProjectBoundary) -> Self {
        Self {
            selection_id: boundary.selection_id,
            manifest_path: boundary.manifest_path.clone(),
            revision: boundary.revision.clone(),
        }
    }
}

fn read_bounded(file: File) -> Result<Vec<u8>, NativeError> {
    let mut bytes = Vec::new();
    let mut bounded: Take<File> = file.take(MAX_PROJECT_BYTES + 1);
    bounded
        .read_to_end(&mut bytes)
        .map_err(|_| NativeError::project_invalid("The project manifest could not be read."))?;
    if bytes.len() as u64 > MAX_PROJECT_BYTES {
        return Err(NativeError::project_too_large());
    }
    Ok(bytes)
}

fn canonical_manifest(path: &Path) -> Result<PathBuf, NativeError> {
    if path.extension() != Some(OsStr::new("antiky")) {
        return Err(NativeError::project_invalid(
            "Select a file with the .antiky extension.",
        ));
    }
    let metadata = symlink_metadata(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            NativeError::project_not_found()
        } else {
            NativeError::project_invalid("The project manifest could not be inspected.")
        }
    })?;
    if metadata.file_type().is_symlink() {
        return Err(NativeError::project_path_escape(
            "The project manifest must not be a symbolic link.",
        ));
    }
    if !metadata.is_file() {
        return Err(NativeError::project_not_file());
    }
    if metadata.len() > MAX_PROJECT_BYTES {
        return Err(NativeError::project_too_large());
    }
    path.canonicalize()
        .map_err(|_| NativeError::project_invalid("The project path could not be resolved."))
}

pub fn read_project_source(
    path: &Path,
    selection_id: u64,
) -> Result<NativeProjectSource, NativeError> {
    if selection_id == 0 {
        return Err(NativeError::argument_invalid(
            "Project selection ID must be positive.",
        ));
    }
    let manifest_path = canonical_manifest(path)?;
    let project_root = manifest_path
        .parent()
        .ok_or_else(|| NativeError::project_invalid("The project root is unavailable."))?
        .canonicalize()
        .map_err(|_| NativeError::project_invalid("The project root could not be resolved."))?;
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW)
        .open(&manifest_path)
        .map_err(|_| NativeError::project_invalid("The project manifest could not be opened."))?;
    let metadata = file.metadata().map_err(|_| {
        NativeError::project_invalid("The project manifest could not be inspected.")
    })?;
    if !metadata.is_file() {
        return Err(NativeError::project_not_file());
    }
    let bytes = read_bounded(file)?;
    let source = String::from_utf8(bytes.clone())
        .map_err(|_| NativeError::project_invalid("The project manifest is not valid UTF-8."))?;
    let revision = format!("{:x}", Sha256::digest(&bytes));
    Ok(NativeProjectSource {
        schema_version: 1,
        selection_id,
        manifest_path,
        project_root,
        revision,
        source,
    })
}

fn is_portable_relative(value: &str) -> bool {
    if value.is_empty()
        || value.contains('\\')
        || value.starts_with('/')
        || value.split('/').any(str::is_empty)
        || value.as_bytes().get(1) == Some(&b':')
    {
        return false;
    }
    Path::new(value)
        .components()
        .all(|component| matches!(component, Component::Normal(_) | Component::CurDir))
}

fn canonical_working_directory(
    root: &Path,
    value: &str,
    field: &str,
) -> Result<PathBuf, NativeError> {
    if !is_portable_relative(value) {
        return Err(NativeError::project_invalid(format!(
            "{field} must be a portable relative directory.",
        )));
    }
    let candidate = root
        .join(value)
        .canonicalize()
        .map_err(|_| NativeError::project_invalid(format!("{field} does not exist.")))?;
    if !candidate.is_dir() {
        return Err(NativeError::project_invalid(format!(
            "{field} must select a directory.",
        )));
    }
    if !candidate.starts_with(root) {
        return Err(NativeError::project_path_escape(format!(
            "{field} escapes the project root.",
        )));
    }
    Ok(candidate)
}

pub fn validate_project_source(
    source: &NativeProjectSource,
    development_working_directory: &str,
    build_working_directory: &str,
) -> Result<ValidatedProjectBoundary, NativeError> {
    let development_working_directory = canonical_working_directory(
        &source.project_root,
        development_working_directory,
        "Development working directory",
    )?;
    let build_working_directory = canonical_working_directory(
        &source.project_root,
        build_working_directory,
        "Build working directory",
    )?;
    Ok(ValidatedProjectBoundary {
        selection_id: source.selection_id,
        manifest_path: source.manifest_path.clone(),
        project_root: source.project_root.clone(),
        revision: source.revision.clone(),
        development_working_directory,
        build_working_directory,
    })
}

#[cfg(test)]
mod tests {
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::{
        NativeProjectEvent, ProjectActivationRequest, ProjectHost, ProjectValidationRequest,
    };

    static SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn project_fixture(name: &str) -> (std::path::PathBuf, std::path::PathBuf) {
        let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "antiky-project-host-{name}-{}-{sequence}",
            std::process::id(),
        ));
        create_dir_all(&root).expect("project fixture");
        let manifest = root.join(format!("{name}.antiky"));
        write(&manifest, "{\"schemaVersion\":1}\n").expect("project manifest");
        (root, manifest)
    }

    #[test]
    fn host_stages_validates_and_activates_one_canonical_project() {
        let (first_root, first_manifest) = project_fixture("first");
        let (second_root, second_manifest) = project_fixture("second");
        let mut host = ProjectHost::default();

        let first = host.stage_open(&first_manifest, true).expect("stage first");
        let initial = host.initial_event().expect("cold-open event");
        assert!(matches!(
            initial,
            NativeProjectEvent::Opened { project } if project.revision == first.revision
        ));
        assert!(
            matches!(host.initial_event(), Some(NativeProjectEvent::Opened { project }) if project.revision == first.revision),
            "the cold-open event survives a frontend remount until activation",
        );
        assert!(
            host.active_project_root().is_err(),
            "validation is not activation"
        );

        let boundary = host
            .validate(ProjectValidationRequest::from_source(&first, ".", "."))
            .expect("validate first");
        assert!(
            host.active_project_root().is_err(),
            "validation never starts project work"
        );
        host.activate(ProjectActivationRequest::from_boundary(&boundary))
            .expect("activate first");
        assert!(
            host.initial_event().is_none(),
            "activation clears the cold-open event",
        );
        assert_eq!(
            host.active_project_root().expect("first root"),
            first_root.canonicalize().expect("canonical first root"),
        );

        let second = host
            .stage_open(&second_manifest, false)
            .expect("stage second");
        let invalid = ProjectValidationRequest {
            revision: "0".repeat(64),
            ..ProjectValidationRequest::from_source(&second, ".", ".")
        };
        assert!(host.validate(invalid).is_err());
        assert_eq!(
            host.active_project_root()
                .expect("first project remains active"),
            first_root.canonicalize().expect("canonical first root"),
        );

        let second_boundary = host
            .validate(ProjectValidationRequest::from_source(&second, ".", "."))
            .expect("validate second");
        host.activate(ProjectActivationRequest::from_boundary(&second_boundary))
            .expect("activate second");
        assert_eq!(
            host.active_project_root().expect("second root"),
            second_root.canonicalize().expect("canonical second root"),
        );

        remove_dir_all(first_root).expect("first cleanup");
        remove_dir_all(second_root).expect("second cleanup");
    }

    #[test]
    fn newer_invalid_selection_supersedes_an_older_pending_candidate() {
        let (root, manifest) = project_fixture("pending");
        let mut host = ProjectHost::default();
        let pending = host.stage_open(&manifest, false).expect("pending project");

        let event = host.stage_event(&root.join("missing.antiky"));
        assert!(matches!(event, NativeProjectEvent::Error { .. }));
        assert!(
            host.validate(ProjectValidationRequest::from_source(&pending, ".", "."))
                .is_err(),
            "an older candidate must not activate after a newer invalid selection",
        );

        remove_dir_all(root).expect("fixture cleanup");
    }
}
