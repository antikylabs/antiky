use serde::Serialize;
use std::fmt::{Display, Formatter};

#[derive(Clone, Debug, Serialize)]
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

    pub(crate) fn terminal_theme_invalid() -> Self {
        Self {
            code: "ANTIKY_TERMINAL_THEME_INVALID",
            message: "The Antiky Studio terminal theme is missing or invalid.".into(),
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

#[cfg(test)]
mod tests {
    use super::NativeError;

    #[test]
    fn terminal_theme_error_has_one_stable_serialized_shape() {
        let value = serde_json::to_value(NativeError::terminal_theme_invalid())
            .expect("serializable terminal theme error");
        assert_eq!(value["code"], "ANTIKY_TERMINAL_THEME_INVALID");
        assert_eq!(
            value["message"],
            "The Antiky Studio terminal theme is missing or invalid."
        );
        assert_eq!(value.as_object().expect("error object").len(), 2);
    }
}
