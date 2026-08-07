use std::fs::{read, symlink_metadata};
use std::path::{Path, PathBuf};

use crate::NativeError;

pub const TERMINAL_THEME_RESOURCE_PATH: &str = "terminal/antiky-studio.ghostty";
const MAX_PROFILE_BYTES: usize = 4096;

const VISUAL_COLORS: [(&str, &str); 6] = [
    ("background", "#08090b"),
    ("foreground", "#f4f4f1"),
    ("cursor-color", "#8b7cff"),
    ("cursor-text", "#08090b"),
    ("selection-background", "#8b7cff"),
    ("selection-foreground", "#08090b"),
];

const ANSI_PALETTE: [&str; 16] = [
    "#08090b", "#ff6b6b", "#48c78e", "#e9b64f", "#8b7cff", "#d48cff", "#5cc8d7", "#a6a6ae",
    "#787982", "#ff9a9a", "#7eddae", "#f3d37c", "#a69bff", "#e8b3ff", "#8ce8f0", "#f4f4f1",
];

#[derive(Clone, Debug)]
pub struct TerminalTheme {
    resource_root: PathBuf,
    path: PathBuf,
}

impl TerminalTheme {
    pub fn path(&self) -> &Path {
        &self.path
    }

    pub(crate) fn revalidate(&self) -> Result<Self, NativeError> {
        resolve_terminal_theme(&self.resource_root, &self.path)
    }
}

fn invalid_theme() -> NativeError {
    NativeError::terminal_theme_invalid()
}

fn validate_profile(contents: &str) -> Result<(), NativeError> {
    if contents.is_empty() || contents.len() > MAX_PROFILE_BYTES || contents.contains('\0') {
        return Err(invalid_theme());
    }

    let mut visual_colors = [false; VISUAL_COLORS.len()];
    let mut palette = [false; ANSI_PALETTE.len()];

    for line in contents.lines().map(str::trim) {
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let (key, value) = line.split_once('=').ok_or_else(invalid_theme)?;
        let key = key.trim();
        let value = value.trim();

        if key == "palette" {
            let (index, color) = value.split_once('=').ok_or_else(invalid_theme)?;
            let index = index.trim().parse::<usize>().map_err(|_| invalid_theme())?;
            let expected_color = ANSI_PALETTE.get(index).ok_or_else(invalid_theme)?;
            if palette[index] || color.trim() != *expected_color {
                return Err(invalid_theme());
            }
            palette[index] = true;
            continue;
        }

        let Some((position, (_, expected_color))) = VISUAL_COLORS
            .iter()
            .enumerate()
            .find(|(_, (allowed_key, _))| *allowed_key == key)
        else {
            return Err(invalid_theme());
        };
        if visual_colors[position] || value != *expected_color {
            return Err(invalid_theme());
        }
        visual_colors[position] = true;
    }

    if visual_colors.into_iter().all(|present| present)
        && palette.into_iter().all(|present| present)
    {
        Ok(())
    } else {
        Err(invalid_theme())
    }
}

pub fn resolve_terminal_theme(
    resource_root: &Path,
    candidate: &Path,
) -> Result<TerminalTheme, NativeError> {
    if !resource_root.is_absolute()
        || !candidate.is_absolute()
        || candidate != resource_root.join(TERMINAL_THEME_RESOURCE_PATH)
    {
        return Err(invalid_theme());
    }

    let metadata = symlink_metadata(candidate).map_err(|_| invalid_theme())?;
    if metadata.file_type().is_symlink()
        || !metadata.is_file()
        || metadata.len() == 0
        || metadata.len() > MAX_PROFILE_BYTES as u64
    {
        return Err(invalid_theme());
    }

    let canonical_root = resource_root.canonicalize().map_err(|_| invalid_theme())?;
    let canonical_path = candidate.canonicalize().map_err(|_| invalid_theme())?;
    if canonical_path != canonical_root.join(TERMINAL_THEME_RESOURCE_PATH) {
        return Err(invalid_theme());
    }

    let bytes = read(&canonical_path).map_err(|_| invalid_theme())?;
    if bytes.len() > MAX_PROFILE_BYTES {
        return Err(invalid_theme());
    }
    let contents = std::str::from_utf8(&bytes).map_err(|_| invalid_theme())?;
    validate_profile(contents)?;

    Ok(TerminalTheme {
        resource_root: canonical_root,
        path: canonical_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROFILE: &str = include_str!("../resources/terminal/antiky-studio.ghostty");

    #[test]
    fn packaged_profile_matches_the_frozen_visual_contract() {
        validate_profile(PROFILE).expect("audited profile");
    }

    #[test]
    fn profile_validation_rejects_nonvisual_duplicate_incomplete_and_changed_values() {
        for invalid in [
            format!("{PROFILE}\ncommand = /bin/false"),
            PROFILE.replacen("background = #08090b", "background = #ffffff", 1),
            PROFILE.replacen(
                "foreground = #f4f4f1",
                "foreground = #f4f4f1\nforeground = #f4f4f1",
                1,
            ),
            PROFILE.replacen("palette = 15=#f4f4f1\n", "", 1),
            " ".repeat(MAX_PROFILE_BYTES + 1),
        ] {
            assert!(validate_profile(&invalid).is_err());
        }
    }
}
