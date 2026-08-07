use std::ffi::{CStr, CString, c_char, c_void};
use std::path::Path;

use serde::Serialize;

use crate::{NativeError, TerminalBounds};

const ERROR_CAPACITY: usize = 256;
const TERMINAL_THEME_INVALID: i32 = 2;

#[repr(C)]
struct BridgeStatus {
    is_open: u8,
    process_exited: u8,
    renderer_healthy: u8,
    columns: u16,
    rows: u16,
    width_px: u32,
    height_px: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TerminalStatus {
    pub is_open: bool,
    pub process_exited: bool,
    pub renderer_healthy: bool,
    pub columns: u16,
    pub rows: u16,
    pub width_px: u32,
    pub height_px: u32,
}

unsafe extern "C" {
    fn antiky_terminal_open(
        parent_view: *mut c_void,
        working_directory: *const c_char,
        terminal_profile: *const c_char,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        error: *mut c_char,
        error_capacity: usize,
    ) -> i32;
    fn antiky_terminal_layout(
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        error: *mut c_char,
        error_capacity: usize,
    ) -> i32;
    fn antiky_terminal_hide(error: *mut c_char, error_capacity: usize) -> i32;
    fn antiky_terminal_focus(error: *mut c_char, error_capacity: usize) -> i32;
    #[cfg(test)]
    fn antiky_terminal_validate_profile(
        terminal_profile: *const c_char,
        error: *mut c_char,
        error_capacity: usize,
    ) -> i32;
    fn antiky_terminal_close();
    fn antiky_terminal_status() -> BridgeStatus;
}

fn bridge_result(code: i32, error: &[c_char; ERROR_CAPACITY]) -> Result<(), NativeError> {
    if code == 0 {
        return Ok(());
    }
    if code == TERMINAL_THEME_INVALID {
        return Err(NativeError::terminal_theme_invalid());
    }
    let message = unsafe { CStr::from_ptr(error.as_ptr()) }
        .to_str()
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or("The native terminal operation failed.");
    Err(NativeError::native_unavailable(message))
}

pub(crate) fn open(
    parent_view: *mut c_void,
    working_directory: &Path,
    terminal_profile: &Path,
    bounds: TerminalBounds,
) -> Result<(), NativeError> {
    let directory = working_directory
        .to_str()
        .ok_or_else(|| NativeError::argument_invalid("Project path must be valid Unicode."))?;
    let directory = CString::new(directory)
        .map_err(|_| NativeError::argument_invalid("Project path contains a null byte."))?;
    let terminal_profile = terminal_profile
        .to_str()
        .ok_or_else(NativeError::terminal_theme_invalid)?;
    let terminal_profile =
        CString::new(terminal_profile).map_err(|_| NativeError::terminal_theme_invalid())?;
    let mut error = [0; ERROR_CAPACITY];
    let code = unsafe {
        antiky_terminal_open(
            parent_view,
            directory.as_ptr(),
            terminal_profile.as_ptr(),
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            error.as_mut_ptr(),
            error.len(),
        )
    };
    bridge_result(code, &error)
}

pub(crate) fn layout(bounds: TerminalBounds) -> Result<(), NativeError> {
    let mut error = [0; ERROR_CAPACITY];
    let code = unsafe {
        antiky_terminal_layout(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            error.as_mut_ptr(),
            error.len(),
        )
    };
    bridge_result(code, &error)
}

pub(crate) fn hide() -> Result<(), NativeError> {
    let mut error = [0; ERROR_CAPACITY];
    let code = unsafe { antiky_terminal_hide(error.as_mut_ptr(), error.len()) };
    bridge_result(code, &error)
}

pub(crate) fn focus() -> Result<(), NativeError> {
    let mut error = [0; ERROR_CAPACITY];
    let code = unsafe { antiky_terminal_focus(error.as_mut_ptr(), error.len()) };
    bridge_result(code, &error)
}

pub(crate) fn close() {
    unsafe { antiky_terminal_close() };
}

pub(crate) fn status() -> TerminalStatus {
    let status = unsafe { antiky_terminal_status() };
    TerminalStatus {
        is_open: status.is_open != 0,
        process_exited: status.process_exited != 0,
        renderer_healthy: status.renderer_healthy != 0,
        columns: status.columns,
        rows: status.rows,
        width_px: status.width_px,
        height_px: status.height_px,
    }
}

#[cfg(test)]
mod tests {
    use std::ffi::{CString, c_char, c_void};
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::{ERROR_CAPACITY, antiky_terminal_validate_profile, bridge_result};

    static FIXTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    #[repr(C)]
    #[derive(Debug, PartialEq)]
    struct ConfigColor {
        r: u8,
        g: u8,
        b: u8,
    }

    unsafe extern "C" {
        fn ghostty_config_new() -> *mut c_void;
        fn ghostty_config_free(config: *mut c_void);
        fn ghostty_config_load_file(config: *mut c_void, path: *const c_char);
        fn ghostty_config_load_recursive_files(config: *mut c_void);
        fn ghostty_config_finalize(config: *mut c_void);
        fn ghostty_config_diagnostics_count(config: *mut c_void) -> u32;
        fn ghostty_config_get(
            config: *mut c_void,
            value: *mut c_void,
            key: *const u8,
            key_length: usize,
        ) -> bool;
    }

    fn fixture_directory() -> PathBuf {
        let sequence = FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let directory = std::env::temp_dir().join(format!(
            "antiky-studio-native-theme-{}-{sequence}",
            std::process::id(),
        ));
        create_dir_all(&directory).expect("theme fixture directory");
        directory
    }

    fn validate_profile(path: &std::path::Path) -> Result<(), crate::NativeError> {
        let path = CString::new(path.to_string_lossy().as_bytes()).expect("profile path");
        let mut error = [0; ERROR_CAPACITY];
        let code = unsafe {
            antiky_terminal_validate_profile(path.as_ptr(), error.as_mut_ptr(), error.len())
        };
        bridge_result(code, &error)
    }

    #[test]
    fn ghostty_validates_the_profile_and_applies_it_after_unrelated_user_values() {
        let directory = fixture_directory();
        let profile = directory.join("antiky-studio.ghostty");
        write(
            &profile,
            include_str!("../resources/terminal/antiky-studio.ghostty"),
        )
        .expect("profile fixture");
        validate_profile(&profile).expect("valid profile");

        let invalid_profile = directory.join("invalid.ghostty");
        write(&invalid_profile, "background = definitely-not-a-color\n")
            .expect("invalid profile fixture");
        let invalid = validate_profile(&invalid_profile).expect_err("diagnostic must fail");
        assert_eq!(invalid.code(), "ANTIKY_TERMINAL_THEME_INVALID");

        let included_user = directory.join("user-included.ghostty");
        write(
            &included_user,
            "background = #112233\nbackground-opacity = 0.37\nnot-a-real-key = true\n",
        )
        .expect("included user config");
        let user = directory.join("user.ghostty");
        write(
            &user,
            format!(
                "background = #ffffff\nbackground-opacity = 0.42\nconfig-file = {}\n",
                included_user.display(),
            ),
        )
        .expect("user config");

        let user = CString::new(user.to_string_lossy().as_bytes()).expect("user path");
        let profile = CString::new(profile.to_string_lossy().as_bytes()).expect("profile path");
        let config = unsafe { ghostty_config_new() };
        assert!(!config.is_null());
        unsafe {
            ghostty_config_load_file(config, user.as_ptr());
            ghostty_config_load_recursive_files(config);
            ghostty_config_load_file(config, profile.as_ptr());
            ghostty_config_finalize(config);
        }

        let mut background = ConfigColor { r: 0, g: 0, b: 0 };
        let background_key = b"background";
        let background_found = unsafe {
            ghostty_config_get(
                config,
                (&mut background as *mut ConfigColor).cast(),
                background_key.as_ptr(),
                background_key.len(),
            )
        };
        assert!(background_found);
        assert_eq!(background, ConfigColor { r: 8, g: 9, b: 11 });

        let mut opacity = 0.0_f64;
        let opacity_key = b"background-opacity";
        let opacity_found = unsafe {
            ghostty_config_get(
                config,
                (&mut opacity as *mut f64).cast(),
                opacity_key.as_ptr(),
                opacity_key.len(),
            )
        };
        assert!(opacity_found);
        assert!((opacity - 0.37).abs() < f64::EPSILON);
        assert!(unsafe { ghostty_config_diagnostics_count(config) } >= 1);

        unsafe { ghostty_config_free(config) };
        remove_dir_all(directory).expect("theme fixture cleanup");
    }
}
