use std::fs::{create_dir_all, write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use antiky_studio_lib::{TerminalBounds, read_development_connection, resolve_project_directory};

static FIXTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn fixture_directory(label: &str) -> PathBuf {
    let sequence = FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let directory = std::env::temp_dir().join(format!(
        "antiky-studio-{label}-{}-{sequence}",
        std::process::id(),
    ));
    create_dir_all(&directory).expect("fixture directory");
    directory
}

fn write_descriptor(project: &Path, inspection_url: &str, extra: &str) {
    let directory = project.join(".antiky");
    create_dir_all(&directory).expect("descriptor directory");
    write(
        directory.join("dev-session.json"),
        format!(
            "{{\"schemaVersion\":1,\"developmentSessionId\":\"development-native-001\",\"configHash\":\"hash-001\",\"inspectionUrl\":\"{inspection_url}\",\"credential\":\"{}\",\"ownerPid\":42{extra}}}",
            "a".repeat(48),
        ),
    )
    .expect("descriptor");
}

#[test]
fn connection_discovery_accepts_only_the_bounded_loopback_descriptor() {
    let project = fixture_directory("connection");
    write_descriptor(&project, "http://127.0.0.1:3011", "");

    let connection = read_development_connection(&project).expect("valid connection");
    assert_eq!(connection.development_session_id, "development-native-001");
    assert_eq!(connection.inspection_url, "http://127.0.0.1:3011");
    assert_eq!(connection.credential.len(), 48);

    write_descriptor(&project, "https://example.com", "");
    let remote = read_development_connection(&project).expect_err("remote URL must fail");
    assert_eq!(remote.code(), "ANTIKY_SESSION_UNAVAILABLE");

    write_descriptor(&project, "http://127.0.0.1:3011", ",\"unknown\":true");
    let unknown = read_development_connection(&project).expect_err("unknown field must fail");
    assert_eq!(unknown.code(), "ANTIKY_SESSION_UNAVAILABLE");

    write(project.join(".antiky/dev-session.json"), " ".repeat(8193)).expect("oversized");
    let oversized = read_development_connection(&project).expect_err("oversized must fail");
    assert_eq!(oversized.code(), "ANTIKY_SESSION_UNAVAILABLE");

    std::fs::remove_dir_all(project).expect("fixture cleanup");
}

#[test]
fn project_resolution_prefers_npm_launch_context_and_requires_a_directory() {
    let selected = fixture_directory("selected");
    let fallback = fixture_directory("fallback");
    assert_eq!(
        resolve_project_directory(Some(selected.as_os_str()), &fallback).expect("selected project"),
        selected.canonicalize().expect("canonical selected"),
    );
    assert_eq!(
        resolve_project_directory(None, &fallback).expect("fallback project"),
        fallback.canonicalize().expect("canonical fallback"),
    );
    std::fs::remove_dir_all(selected).expect("selected cleanup");
    std::fs::remove_dir_all(fallback).expect("fallback cleanup");
}

#[test]
fn terminal_bounds_reject_non_finite_tiny_negative_and_excessive_geometry() {
    assert!(TerminalBounds::new(12.0, 80.0, 420.0, 640.0).is_ok());
    for values in [
        [f64::NAN, 0.0, 420.0, 640.0],
        [-1.0, 0.0, 420.0, 640.0],
        [0.0, 0.0, 40.0, 640.0],
        [0.0, 0.0, 420.0, 20_000.0],
    ] {
        assert!(TerminalBounds::new(values[0], values[1], values[2], values[3]).is_err());
    }
}
