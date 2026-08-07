use std::ffi::{CStr, c_char};
use std::path::PathBuf;

use crate::NativeError;

unsafe extern "C" {
    fn antiky_project_picker_open() -> *mut c_char;
    fn antiky_project_picker_directory() -> *mut c_char;
    fn antiky_project_picker_free(path: *mut c_char);
}

fn read_picker_path(pointer: *mut c_char) -> Result<Option<PathBuf>, NativeError> {
    if pointer.is_null() {
        return Ok(None);
    }
    let bytes = unsafe { CStr::from_ptr(pointer) }.to_bytes().to_vec();
    unsafe { antiky_project_picker_free(pointer) };
    let path = String::from_utf8(bytes).map_err(|_| {
        NativeError::project_invalid("The selected project path is not valid UTF-8.")
    })?;
    if path.is_empty() {
        return Err(NativeError::project_invalid(
            "The selected project path is empty.",
        ));
    }
    Ok(Some(PathBuf::from(path)))
}

pub(crate) fn pick_project() -> Result<Option<PathBuf>, NativeError> {
    // The command dispatches this call to AppKit's main thread before entering the bridge.
    let pointer = unsafe { antiky_project_picker_open() };
    read_picker_path(pointer)
}

pub(crate) fn pick_project_directory() -> Result<Option<PathBuf>, NativeError> {
    // The command dispatches this call to AppKit's main thread before entering the bridge.
    let pointer = unsafe { antiky_project_picker_directory() };
    read_picker_path(pointer)
}
