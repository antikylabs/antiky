use std::fs::{create_dir_all, write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use antiky_studio_lib::{
    TerminalBounds, read_development_connection, resolve_project_directory, resolve_terminal_theme,
};

const TERMINAL_THEME: &str = include_str!("../resources/terminal/antiky-studio.ghostty");

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

fn write_terminal_theme(resource_root: &Path, contents: &str) -> PathBuf {
    let path = resource_root.join("terminal/antiky-studio.ghostty");
    create_dir_all(path.parent().expect("theme parent")).expect("theme directory");
    write(&path, contents).expect("theme fixture");
    path
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

#[test]
fn terminal_theme_resolves_in_source_and_built_resource_layouts() {
    let source_resources = fixture_directory("terminal-theme-source");
    let source_theme = write_terminal_theme(&source_resources, TERMINAL_THEME);
    let source = resolve_terminal_theme(&source_resources, &source_theme).expect("source theme");
    assert_eq!(
        source.path(),
        source_theme.canonicalize().expect("source path")
    );

    let bundle = fixture_directory("terminal-theme-bundle");
    let bundle_resources = bundle.join("Antiky Studio.app/Contents/Resources");
    let bundle_theme = write_terminal_theme(&bundle_resources, TERMINAL_THEME);
    let bundled = resolve_terminal_theme(&bundle_resources, &bundle_theme).expect("bundled theme");
    assert_eq!(
        bundled.path(),
        bundle_theme.canonicalize().expect("bundle path")
    );

    std::fs::remove_dir_all(source_resources).expect("source cleanup");
    std::fs::remove_dir_all(bundle).expect("bundle cleanup");
}

#[test]
fn terminal_theme_rejects_missing_non_file_unexpected_and_unsafe_resources() {
    let missing_root = fixture_directory("terminal-theme-missing");
    let missing = missing_root.join("terminal/antiky-studio.ghostty");
    assert_eq!(
        resolve_terminal_theme(&missing_root, &missing)
            .expect_err("missing theme must fail")
            .code(),
        "ANTIKY_TERMINAL_THEME_INVALID",
    );

    let directory_root = fixture_directory("terminal-theme-directory");
    let directory = directory_root.join("terminal/antiky-studio.ghostty");
    create_dir_all(&directory).expect("non-file theme fixture");
    assert!(resolve_terminal_theme(&directory_root, &directory).is_err());

    let unexpected_root = fixture_directory("terminal-theme-unexpected");
    let unexpected = unexpected_root.join("terminal/other.ghostty");
    create_dir_all(unexpected.parent().expect("unexpected parent")).expect("unexpected directory");
    write(&unexpected, TERMINAL_THEME).expect("unexpected fixture");
    assert!(resolve_terminal_theme(&unexpected_root, &unexpected).is_err());

    let unsupported_root = fixture_directory("terminal-theme-unsupported");
    let unsupported = write_terminal_theme(
        &unsupported_root,
        &format!("{TERMINAL_THEME}\ncommand = echo unsafe"),
    );
    assert!(resolve_terminal_theme(&unsupported_root, &unsupported).is_err());

    let oversized_root = fixture_directory("terminal-theme-oversized");
    let oversized = write_terminal_theme(&oversized_root, &" ".repeat(4097));
    assert!(resolve_terminal_theme(&oversized_root, &oversized).is_err());

    let invalid_utf8_root = fixture_directory("terminal-theme-invalid-utf8");
    let invalid_utf8 = invalid_utf8_root.join("terminal/antiky-studio.ghostty");
    create_dir_all(invalid_utf8.parent().expect("invalid UTF-8 parent"))
        .expect("invalid UTF-8 directory");
    write(&invalid_utf8, [0xff]).expect("invalid UTF-8 fixture");
    assert!(resolve_terminal_theme(&invalid_utf8_root, &invalid_utf8).is_err());

    let symlink_root = fixture_directory("terminal-theme-symlink");
    let symlink_target = symlink_root.join("audited.ghostty");
    write(&symlink_target, TERMINAL_THEME).expect("symlink target");
    let symlink = symlink_root.join("terminal/antiky-studio.ghostty");
    create_dir_all(symlink.parent().expect("symlink parent")).expect("symlink directory");
    std::os::unix::fs::symlink(&symlink_target, &symlink).expect("theme symlink");
    assert!(resolve_terminal_theme(&symlink_root, &symlink).is_err());

    for directory in [
        missing_root,
        directory_root,
        unexpected_root,
        unsupported_root,
        oversized_root,
        invalid_utf8_root,
        symlink_root,
    ] {
        std::fs::remove_dir_all(directory).expect("fixture cleanup");
    }
}
