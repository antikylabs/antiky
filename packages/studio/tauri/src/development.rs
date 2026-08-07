use std::fs::symlink_metadata;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdout, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use serde::Deserialize;

use crate::{DevelopmentConnection, NativeError};

pub const PROJECT_SERVICE_RESOURCE_PATH: &str = "project-service/project-service.mjs";
pub const PROJECT_RUNTIME_RESOURCE_PATH: &str = "project-service/node";
const PROJECT_SERVICE_FILE: &str = "project-service.mjs";
const PROJECT_RUNTIME_FILE: &str = "node";
const MAX_WORKER_MESSAGE_BYTES: u64 = 8_192;
const WORKER_START_TIMEOUT: Duration = Duration::from_secs(15);
const WORKER_STOP_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
enum WorkerMessage {
    Ready { connection: DevelopmentConnection },
    Error { error: WorkerError },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct WorkerError {
    code: String,
    message: String,
}

#[derive(Default)]
pub(crate) struct DevelopmentHost {
    child: Option<Child>,
    connection: Option<DevelopmentConnection>,
    manifest_path: Option<PathBuf>,
    project_revision: Option<String>,
}

fn invalid_project_service() -> NativeError {
    NativeError::native_unavailable("The Studio project service is missing or invalid.")
}

pub fn resolve_project_service(
    resource_root: &Path,
    candidate: &Path,
) -> Result<PathBuf, NativeError> {
    if candidate.file_name().and_then(|value| value.to_str()) != Some(PROJECT_SERVICE_FILE) {
        return Err(invalid_project_service());
    }
    let metadata = symlink_metadata(candidate).map_err(|_| invalid_project_service())?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(invalid_project_service());
    }
    let root = resource_root
        .canonicalize()
        .map_err(|_| invalid_project_service())?;
    let path = candidate
        .canonicalize()
        .map_err(|_| invalid_project_service())?;
    if !path.starts_with(&root) {
        return Err(invalid_project_service());
    }
    Ok(path)
}

pub fn resolve_project_runtime(
    resource_root: &Path,
    candidate: &Path,
) -> Result<PathBuf, NativeError> {
    if candidate.file_name().and_then(|value| value.to_str()) != Some(PROJECT_RUNTIME_FILE) {
        return Err(invalid_project_service());
    }
    let metadata = symlink_metadata(candidate).map_err(|_| invalid_project_service())?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(invalid_project_service());
    }
    let root = resource_root
        .canonicalize()
        .map_err(|_| invalid_project_service())?;
    let path = candidate
        .canonicalize()
        .map_err(|_| invalid_project_service())?;
    if !path.starts_with(&root) {
        return Err(invalid_project_service());
    }
    Ok(path)
}

fn read_worker_message(stdout: ChildStdout) -> Result<WorkerMessage, NativeError> {
    let mut bytes = Vec::new();
    let mut reader = BufReader::new(stdout).take(MAX_WORKER_MESSAGE_BYTES + 1);
    reader
        .read_until(b'\n', &mut bytes)
        .map_err(|_| NativeError::session_unavailable())?;
    if bytes.is_empty()
        || bytes.len() as u64 > MAX_WORKER_MESSAGE_BYTES
        || bytes.last() != Some(&b'\n')
    {
        return Err(NativeError::session_unavailable());
    }
    serde_json::from_slice(&bytes).map_err(|_| NativeError::session_unavailable())
}

fn wait_for_exit(child: &mut Child, timeout: Duration) -> Result<bool, NativeError> {
    let deadline = Instant::now() + timeout;
    loop {
        if child
            .try_wait()
            .map_err(|_| NativeError::session_unavailable())?
            .is_some()
        {
            return Ok(true);
        }
        if Instant::now() >= deadline {
            return Ok(false);
        }
        thread::sleep(Duration::from_millis(20));
    }
}

fn stop_child(child: &mut Child) -> Result<(), NativeError> {
    if let Some(input) = child.stdin.as_mut() {
        let _ = input.write_all(b"{\"type\":\"stop\"}\n");
        let _ = input.flush();
    }
    if wait_for_exit(child, WORKER_STOP_TIMEOUT)? {
        return Ok(());
    }
    child
        .kill()
        .map_err(|_| NativeError::session_unavailable())?;
    child
        .wait()
        .map_err(|_| NativeError::session_unavailable())?;
    Ok(())
}

impl DevelopmentHost {
    pub(crate) fn start(
        &mut self,
        runtime_path: &Path,
        worker_path: &Path,
        manifest_path: &Path,
        project_revision: &str,
    ) -> Result<DevelopmentConnection, NativeError> {
        if self.manifest_path.as_deref() == Some(manifest_path)
            && self.project_revision.as_deref() == Some(project_revision)
        {
            if let (Some(child), Some(connection)) = (&mut self.child, &self.connection) {
                if child
                    .try_wait()
                    .map_err(|_| NativeError::session_unavailable())?
                    .is_none()
                {
                    return Ok(connection.clone());
                }
            }
        }
        self.stop()?;

        let mut child = Command::new(runtime_path)
            .arg(worker_path)
            .arg(manifest_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|_| {
                NativeError::native_unavailable(
                    "Node.js could not start the Studio project service.",
                )
            })?;
        let child_id = child.id();
        let stdout = child
            .stdout
            .take()
            .ok_or_else(NativeError::session_unavailable)?;
        let (sender, receiver) = mpsc::sync_channel(1);
        thread::spawn(move || {
            let _ = sender.send(read_worker_message(stdout));
        });
        let message = match receiver.recv_timeout(WORKER_START_TIMEOUT) {
            Ok(message) => message,
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(NativeError::session_unavailable());
            }
        };
        let connection = match message {
            Ok(WorkerMessage::Ready { connection })
                if connection.is_valid()
                    && connection.project_revision() == project_revision
                    && connection.owner_pid() == child_id =>
            {
                connection
            }
            Ok(WorkerMessage::Error { error }) => {
                let _ = (&error.code, &error.message);
                let _ = stop_child(&mut child);
                return Err(NativeError::session_unavailable());
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(NativeError::session_unavailable());
            }
        };
        self.connection = Some(connection.clone());
        self.manifest_path = Some(manifest_path.to_path_buf());
        self.project_revision = Some(project_revision.to_owned());
        self.child = Some(child);
        Ok(connection)
    }

    pub(crate) fn stop(&mut self) -> Result<(), NativeError> {
        let result = match self.child.as_mut() {
            Some(child) => stop_child(child),
            None => Ok(()),
        };
        self.child = None;
        self.connection = None;
        self.manifest_path = None;
        self.project_revision = None;
        result
    }
}

impl Drop for DevelopmentHost {
    fn drop(&mut self) {
        if let Some(child) = self.child.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::path::Path;
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::DevelopmentHost;

    static SEQUENCE: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn native_host_starts_reuses_and_stops_the_structured_project_service() {
        let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let directory = std::env::temp_dir().join(format!(
            "antiky-development-host-{}-{sequence}",
            std::process::id(),
        ));
        create_dir_all(&directory).expect("worker fixture directory");
        let worker = directory.join("project-service.mjs");
        let manifest = directory.join("game.antiky");
        write(&manifest, "{}\n").expect("manifest fixture");
        write(
            &worker,
            r#"
process.stdout.write(`${JSON.stringify({
  type: 'ready',
  connection: {
    schemaVersion: 1,
    developmentSessionId: 'development-rust-worker-001',
    projectRevision: 'revision-001',
    inspectionUrl: 'http://127.0.0.1:49101',
    credential: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ownerPid: process.pid,
  },
})}\n`);
process.stdin.resume();
process.stdin.once('data', () => process.exit(0));
"#,
        )
        .expect("worker fixture");

        let mut host = DevelopmentHost::default();
        let first = host
            .start(Path::new("node"), &worker, &manifest, "revision-001")
            .expect("start project service");
        let second = host
            .start(Path::new("node"), &worker, &manifest, "revision-001")
            .expect("reuse project service");
        assert_eq!(first.development_session_id, second.development_session_id,);
        host.stop().expect("stop project service");
        host.stop().expect("repeat stop");

        remove_dir_all(directory).expect("worker fixture cleanup");
    }
}
