use std::ffi::OsStr;
use std::fs::File;
use std::io::{Read, Take};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use url::Url;

use crate::NativeError;

const MAX_DESCRIPTOR_BYTES: u64 = 8_192;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DevelopmentConnection {
    schema_version: u8,
    pub development_session_id: String,
    project_revision: String,
    pub inspection_url: String,
    pub credential: String,
    owner_pid: u32,
}

fn read_bounded(file: File) -> Result<Vec<u8>, NativeError> {
    let mut bytes = Vec::new();
    let mut bounded: Take<File> = file.take(MAX_DESCRIPTOR_BYTES + 1);
    bounded
        .read_to_end(&mut bytes)
        .map_err(|_| NativeError::session_unavailable())?;
    if bytes.len() as u64 > MAX_DESCRIPTOR_BYTES {
        return Err(NativeError::session_unavailable());
    }
    Ok(bytes)
}

fn bounded_identifier(value: &str, maximum: usize) -> bool {
    !value.is_empty() && value.len() <= maximum && !value.chars().any(char::is_control)
}

fn valid_loopback_origin(value: &str) -> bool {
    let Ok(url) = Url::parse(value) else {
        return false;
    };
    let Some(port) = url.port() else {
        return false;
    };
    url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && url.username().is_empty()
        && url.password().is_none()
        && url.path() == "/"
        && url.query().is_none()
        && url.fragment().is_none()
        && value == format!("http://127.0.0.1:{port}")
}

impl DevelopmentConnection {
    pub(crate) fn is_valid(&self) -> bool {
        self.schema_version == 1
            && bounded_identifier(&self.development_session_id, 256)
            && bounded_identifier(&self.project_revision, 256)
            && bounded_identifier(&self.credential, 512)
            && self.credential.len() >= 32
            && self.owner_pid > 0
            && valid_loopback_origin(&self.inspection_url)
    }

    pub(crate) fn project_revision(&self) -> &str {
        &self.project_revision
    }

    pub(crate) fn owner_pid(&self) -> u32 {
        self.owner_pid
    }
}

pub fn read_development_connection(
    project_directory: &Path,
) -> Result<DevelopmentConnection, NativeError> {
    let descriptor = project_directory.join(".antiky/dev-session.json");
    let file = File::open(descriptor).map_err(|_| NativeError::session_unavailable())?;
    let connection: DevelopmentConnection = serde_json::from_slice(&read_bounded(file)?)
        .map_err(|_| NativeError::session_unavailable())?;

    if !connection.is_valid() {
        return Err(NativeError::session_unavailable());
    }
    Ok(connection)
}

pub fn resolve_project_directory(
    npm_launch_directory: Option<&OsStr>,
    fallback: &Path,
) -> Result<PathBuf, NativeError> {
    let candidate = npm_launch_directory
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| fallback.to_path_buf());
    let canonical = candidate
        .canonicalize()
        .map_err(|_| NativeError::argument_invalid("Project directory does not exist."))?;
    if !canonical.is_dir() {
        return Err(NativeError::argument_invalid(
            "Project selection must be a directory.",
        ));
    }
    Ok(canonical)
}
