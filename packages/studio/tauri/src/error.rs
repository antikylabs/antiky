use serde::Serialize;
use std::fmt::{Display, Formatter};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeError {
    code: &'static str,
    message: String,
}

impl NativeError {
    pub(crate) fn session_unavailable() -> Self {
        Self {
            code: "ANTIKY_SESSION_UNAVAILABLE",
            message: "No valid local Antiky development session is available.".into(),
        }
    }

    pub(crate) fn argument_invalid(message: impl Into<String>) -> Self {
        Self {
            code: "ANTIKY_ARGUMENT_INVALID",
            message: message.into(),
        }
    }

    pub(crate) fn native_unavailable(message: impl Into<String>) -> Self {
        Self {
            code: "ANTIKY_NATIVE_UNAVAILABLE",
            message: message.into(),
        }
    }

    pub fn code(&self) -> &'static str {
        self.code
    }
}

impl Display for NativeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for NativeError {}
