use serde::{Deserialize, Serialize};

use crate::NativeError;

const MIN_WIDTH: f64 = 80.0;
const MIN_HEIGHT: f64 = 40.0;
const MAX_GEOMETRY: f64 = 16_384.0;

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl TerminalBounds {
    pub fn new(x: f64, y: f64, width: f64, height: f64) -> Result<Self, NativeError> {
        let values = [x, y, width, height];
        if values
            .iter()
            .any(|value| !value.is_finite() || *value < 0.0)
            || width < MIN_WIDTH
            || height < MIN_HEIGHT
            || values.iter().any(|value| *value > MAX_GEOMETRY)
            || x + width > MAX_GEOMETRY
            || y + height > MAX_GEOMETRY
        {
            return Err(NativeError::argument_invalid(
                "Terminal bounds are outside the supported window geometry.",
            ));
        }
        Ok(Self {
            x,
            y,
            width,
            height,
        })
    }

    pub(crate) fn validate(self) -> Result<Self, NativeError> {
        Self::new(self.x, self.y, self.width, self.height)
    }
}
