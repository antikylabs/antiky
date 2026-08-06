# Feedback 09 confirmation checks

Run: `studio-s00-feedback-09-20260806T222222Z`

## Native visual review

Owner approval is pending for these actual packaged-app captures:

- [Fresh terminal before input after reopen](captures/themed-reopened.png)
- [ANSI palette and Unicode](captures/themed-ansi-unicode.png)
- [Clipboard paste and focus boundary](captures/themed-clipboard-focus.png)
- [Control-C interrupt](captures/themed-control-c.png)
- [Resized terminal](captures/themed-resized.png)

The captures show the real embedded Ghostty surface. They do not use a React terminal imitation. The
terminal background matches Studio's `#08090b` media surface, the cursor and focus boundary use the
Studio accent, and the ANSI colors remain distinct.

## Passed checks

- The profile contains only the six approved color keys and the 16-entry palette.
- Rust accepts only the canonical packaged path and revalidates the file before each open.
- Ghostty validates the Studio profile in isolation.
- Ghostty loads user defaults and included files before the Studio profile.
- User diagnostics do not become Studio-profile diagnostics.
- The source and debug-bundle profiles have the same SHA-256 digest.
- A packaged on-off-on SSPS preference check reopens the terminal after each reload.
- Unicode, clipboard paste, focus, Control-C, resize, close, reopen, and the one-window invariant pass.
- Studio app tests, Tauri tests, both Studio builds, and `npm run check` pass.
- The new captures are Git LFS objects.

## Pending checks

- Owner approval of the native captures above.
- One authorized isolated-zsh fixture launch that records one profile marker and no Antiky history entry.
- One authorized native missing-profile capture that shows the stable in-panel error while Studio remains
  usable.
- One authorized native pass for long output, mouse selection and copy, and page zoom.

The environment denied the two additional launch variants. The verifier keeps the receipt incomplete
until those checks and owner approval pass. No alternate launch mechanism or synthetic error capture is
claimed.
