use std::ffi::{CStr, CString, c_char, c_void};
use std::path::Path;

use serde::Serialize;

use crate::{NativeError, TerminalBounds};

const ERROR_CAPACITY: usize = 256;

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
    fn antiky_terminal_focus(error: *mut c_char, error_capacity: usize) -> i32;
    fn antiky_terminal_close();
    fn antiky_terminal_status() -> BridgeStatus;
}

fn bridge_result(code: i32, error: &[c_char; ERROR_CAPACITY]) -> Result<(), NativeError> {
    if code == 0 {
        return Ok(());
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
    bounds: TerminalBounds,
) -> Result<(), NativeError> {
    let directory = working_directory
        .to_str()
        .ok_or_else(|| NativeError::argument_invalid("Project path must be valid Unicode."))?;
    let directory = CString::new(directory)
        .map_err(|_| NativeError::argument_invalid("Project path contains a null byte."))?;
    let mut error = [0; ERROR_CAPACITY];
    let code = unsafe {
        antiky_terminal_open(
            parent_view,
            directory.as_ptr(),
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
