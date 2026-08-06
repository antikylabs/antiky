# Feedback 09 plan: Theme the embedded terminal

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` until Feedback 08 sets the final terminal surface |
| Feedback source | [Slice 00 feedback, line 9](slice-feedback.txt) |
| Outcome | The real Ghostty terminal opens with an Antiky Studio visual profile and the user's normal shell behavior |
| Owner input | The source feedback selects the Studio visual language and the existing ADRs preserve agent choice |
| Architecture decisions | [Studio 0001](../../../adr/studio/0001-ai-integrations_H.md) and [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md) |
| Depends on | [Feedback 08](feedback-08-website-layout-plan.md) |
| Alignment revision | `0cf02f51dff72f0c22681cb5a3af890173c32b00` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-09/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-09-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-09-terminal-theme-plan.md until complete
```

## Feedback

> terminal startup should be themed and more aligned with our studio than basic terminal

## Outcome

The embedded native terminal looks like part of Studio from its first visible frame. Antiky owns the
terminal surface colors, cursor colors, selection colors, and ANSI palette. The user continues to own the
shell, prompt, profile, font family, commands, environment, history, and coding agent.

### Observable behavior

- The terminal background matches Studio's media surface before and after Ghostty opens.
- Default terminal text, selection, cursor, and ANSI colors use the Antiky visual language.
- The terminal has no unthemed white or mismatched black flash during startup.
- The real login shell starts in the current project directory.
- Existing shell profiles and prompts run normally.
- Antiky does not print a fake prompt, fake `antiky dev` output, or a product banner into the PTY.
- Antiky does not add a command to shell history.
- A missing or invalid Studio terminal profile produces one clear in-panel error. Studio remains usable.
- Control keys, Command shortcuts, Unicode, clipboard, focus, resize, and close behavior remain intact.

### Theme ownership

Validate one audited Antiky visual profile in an isolated Ghostty configuration. Load the user's Ghostty
configuration. Then load the validated profile before Ghostty configuration finalization. The Antiky
profile may override only these visual key families:

- `background`
- `foreground`
- `cursor-color`
- `cursor-text`
- `selection-background`
- `selection-foreground`
- `palette`

The profile must not set `command`, `initial-command`, `input`, `shell-integration`, `keybind`, font family,
working directory, window behavior, clipboard behavior, background images, or another config file. User
configuration keeps its current authority outside the allowlist. This work does not add another override
for the existing surface-owned font size or project working directory.

The profile uses Studio's `#08090b` media background, `#f4f4f1` primary text, `#8b7cff` accent,
`#48c78e` success, `#e9b64f` warning, and `#ff6b6b` error as its anchors. CP-00 records the complete
16-color palette and contrast results before native integration.

### Non-goals

- Do not replace libghostty with a web terminal or terminal imitation.
- Do not customize `PS1`, install Starship, install shell plugins, or write a shell profile.
- Do not start `antiky dev`, Codex, Claude, or another process in the terminal.
- Do not parse, capture, retain, or decorate the terminal transcript.
- Do not force a bundled monospace font family in this feedback item.
- Do not add a terminal settings screen or general theme system.
- Do not change CLI, Framework, MCP, inspection, event sourcing, or renderer behavior.

## Chosen shape

Store one small Ghostty configuration resource in the Tauri package. Resolve its trusted packaged path in
the native host. Pass that path across the existing bounded Rust-to-Objective-C bridge. Validate the file
with a separate Ghostty configuration. Load it into the application configuration after default and
recursive user configuration and before `ghostty_config_finalize`.

```text
Ghostty defaults
      -> user Ghostty config and included files
      -> independently validated Antiky visual profile
      -> finalize
      -> real user shell in the active project
```

Reject diagnostics from the isolated Antiky profile validation. Keep the existing handling of diagnostics
from the user's Ghostty configuration. Do not report an unrelated user warning as an Antiky profile failure.

### Options considered

- **Audited Ghostty visual profile — selected.** It themes the real terminal at its supported configuration
  boundary and leaves the PTY and shell unchanged.
- **Injected shell greeting or startup command — rejected.** It changes shell behavior and can pollute
  history, execute unintended input, or fail across shells.
- **React terminal overlay or transcript decorator — rejected.** It can cover the native view, misrepresent
  output, and create a second source of terminal state.
- **Ignore user Ghostty configuration — rejected.** It would discard useful keyboard, shell, accessibility,
  and terminal preferences that do not conflict with Studio's visual identity.

## Required reading

- [Source feedback](slice-feedback.txt)
- [Feedback 08](feedback-08-website-layout-plan.md)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Website design language](../../../../packages/website/DESIGN.md)
- [Website terminal reference](../../../../packages/website/src/app/studio/page.tsx)
- [Development harness research](../../general-stuff/DEV_HARNESS_RESEARCH_A.md) and
  [inspection tooling direction](../../general-stuff/INSPECTION_TOOLING_A.md)
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [Studio 0001](../../../adr/studio/0001-ai-integrations_H.md) and
  [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md) in full
- [Studio getting started](../../../user-facing-docs/studio/getting-started.md)
- [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Ghostty configuration](https://ghostty.org/docs/config) loads later conflicting values over earlier
  values. It also supports explicit configuration files.
- [Ghostty themes](https://ghostty.org/docs/features/theme) use normal configuration syntax. Ghostty warns
  that a theme can set any configuration key. Antiky therefore uses an exact visual-key allowlist.
- [Ghostty's option reference](https://ghostty.org/docs/config/reference) defines the selected color keys.
  It also documents that startup input can execute shell programs. Antiky does not use startup input.
- [Ghostty shell integration](https://ghostty.org/docs/features/shell-integration) supplies terminal
  behavior without requiring Antiky to change the user's prompt.
- [VS Code terminal appearance](https://code.visualstudio.com/docs/terminal/appearance) treats terminal
  color, cursor, font, and prompt as separate concerns. Antiky themes color and cursor only.
- The shared development-harness and inspection research forbids terminal-text parsing as an engine-state
  source. The theme does not capture, classify, or interpret the transcript.
- The pinned libghostty C API exposes `ghostty_config_load_file`, configuration finalization, and
  diagnostics. The current bridge already loads user defaults and recursive files.
- BroMetal `0.15.0` is installed. `npm view brometal version` reports `0.15.0` on `2026-08-06`.
  Terminal presentation does not touch BroMetal, shaders, WebGPU, or renderer data.
- The full `UNDER_REVIEW_A.md` review found no decision that this work must settle. The profile is a
  private native presentation resource. It does not need an ADR.

## Current state

- The native terminal loads default and recursive Ghostty files, then finalizes the result.
- Studio does not load a product-owned Ghostty profile.
- The surface forces a 13-point font size and the active project working directory.
- The terminal mount uses `#08090b`, but the native view can use unrelated user or Ghostty colors.
- The bridge does not inspect configuration diagnostics.
- The website illustration uses Antiky colors, but its transcript is static sample content.

## Deliverables

- Add one reviewed terminal visual-profile resource to the Tauri package.
- Add an automated allowlist check that rejects any nonvisual profile key.
- Package the profile for both source-development and later release builds.
- Resolve the profile path in Rust. Reject missing, non-file, or unexpected resource paths.
- Extend the native terminal-open boundary with the trusted profile path.
- Load user configuration, then the Antiky profile, then finalize Ghostty configuration.
- Validate the Antiky profile independently and return one bounded stable error for its diagnostics.
- Align the React terminal mount, loading state, and error state with the same background and spacing.
- Keep profile constants in one focused module or resource. Do not grow the terminal bridge into a theme
  catalog.
- Update general Studio terminal documentation. Do not add tests that only inspect prose.
- Keep temporary verification code inside this slice directory. Do not add permanent root scripts.

## Safe behavior

- Accept only the application-owned profile path. Do not load a path from web content or the game.
- Keep the profile under a strict key allowlist and a bounded file-size limit.
- Do not place credentials, project paths, commands, input, or environment values in the profile.
- Do not convert user configuration diagnostics into Antiky profile diagnostics.
- Keep the PTY, shell, profile, history, and transcript outside React state.
- Preserve the previous verified libghostty setup as the rollback point.
- Stop and show a clear terminal-panel error if the packaged profile is missing or invalid.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Freeze the complete palette, allowed keys, and current unthemed evidence | Contrast report, profile fixture, and failing load assertion | `Define the Studio terminal theme` |
| `CP-01` | Add and package the audited Ghostty profile | Resource and allowlist tests in dev and build layouts | `Package the Studio terminal theme` |
| `CP-02` | Load the profile through the bounded native bridge | Load-order, path, diagnostic, and native tests | `Apply the Studio terminal theme` |
| `CP-03` | Align startup, loading, and error presentation | First-frame, shell, resize, focus, and visual evidence | `Polish Studio terminal startup` |
| `CP-04` | Update docs and record complete evidence | Full checks, owner review, and receipt | `Document the Studio terminal theme` |

## Test plan

- Add a failing native regression first. It must prove that the current bridge does not load an Antiky
  profile.
- Test the exact allowed key set, bounded profile size, complete palette, and absence of command or input
  keys.
- Test that the Antiky visual keys override conflicting user colors and that unrelated user keys remain.
- Test missing profile, invalid path, malformed value, unsupported key, and new Ghostty diagnostic behavior.
- Test that pre-existing user diagnostics do not become Antiky profile failures.
- Test source-development and built-resource path resolution.
- Launch a real zsh shell with a fixture profile marker. Confirm that the marker runs once and Antiky adds
  no prompt text, command, banner, or history entry.
- Run an ANSI color sample, Unicode sample, long output, selection, clipboard, Control-C, Command shortcut,
  resize, zoom, focus, close, and reopen check.
- Confirm that startup has no white frame, mismatched background, duplicate terminal, or duplicate window.
- Use Computer Use to capture the real native terminal before input, at a prompt, with ANSI output, and in
  an error state. Automated tests alone cannot approve appearance.
- Run Studio app tests, Studio Tauri tests, Studio builds, and `npm run check`.

## Completion checks

- [ ] The embedded Ghostty surface matches the Antiky Studio visual language from its first frame.
- [ ] The audited profile contains only approved visual keys.
- [ ] User shell, prompt, profile, font family, keybindings, history, and commands remain user-owned.
- [ ] Antiky injects no startup input and prints no fake terminal content.
- [ ] Profile packaging, precedence, diagnostics, and failure behavior pass.
- [ ] Native input, focus, clipboard, resize, close, and reopen regressions pass.
- [ ] Actual native captures pass owner review.
- [ ] Tests, builds, general docs, receipt, and slice summary pass.

## Run and evidence rule

- Write temporary checks under `docs/objectives/studio/slice-00/verification/feedback-09/`.
- Write run evidence under `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-09-{run-id}/`.
- Record commands, exit codes, Ghostty revision, profile digest, diagnostics, contrast results, and captures.
- Record the user-config fixture and prove that Antiky added no shell command or PTY input.
- Do not mark this feedback complete from config tests alone. The owner must approve actual native evidence.
