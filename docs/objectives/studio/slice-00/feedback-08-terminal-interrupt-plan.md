# Feedback 08 plan: Route Ctrl-C to the terminal job

## Control

| Field | Value |
| --- | --- |
| Status | `READY` |
| Feedback source | [Slice 00 feedback, line 8](slice-feedback.txt) |
| Outcome | Ctrl-C in the focused Studio terminal affects its foreground terminal job and does not close Studio |
| Owner input | The source feedback supplies the product direction |
| Architecture decisions | [Studio 0001](../../../adr/studio/0001-ai-integrations_H.md), [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md), and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md) |
| Depends on | Completed Studio Slice 00 |
| Alignment revision | `63271d5dc70c491f5c9de5303eacc36fb2c870a9` |
| Review date | `2026-08-06` |
| Complete check | `node docs/objectives/studio/slice-00/verification/feedback-08/verify.mjs` |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-08-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-08-terminal-interrupt-plan.md until complete
```

## Feedback

> ctrl+c in the terminal in the app should not kill the whole app it should be passsed to the terminal.

## Outcome

When the native terminal owns keyboard focus, Studio sends Ctrl-C to the active Ghostty surface
exactly once. Ghostty and the PTY decide how the terminal program receives the input. Studio does not
treat Ctrl-C as an application shutdown command.

### Observable behavior

- Ctrl-C interrupts a normal foreground terminal job. The shell prompt returns and Studio stays open.
- A terminal program in raw mode receives Ctrl-C according to its terminal settings. Studio does not
  force a signal around the program.
- The terminal receives no key when the canvas, a text field, or another Studio area owns focus.
- A stopped terminal job does not stop the native window, the editor app, or an independently managed
  development host.
- If the user started `antiky dev` in the terminal, Ctrl-C can stop that command. Studio then shows the
  normal disconnected state, but the Studio application remains open.

### Non-goals

- Do not add a global Studio signal command or a JavaScript Ctrl-C listener.
- Do not send `SIGINT` to a saved child PID from Studio.
- Do not capture, parse, persist, or display terminal transcripts.
- Do not change project loading, development-host supervision, or terminal working-directory rules.
- Do not add new terminal tabs, terminal persistence, or cross-platform terminal support.

## Chosen shape

Keep input ownership in the native view. When `AntikyGhosttyView` is the first responder, its AppKit
key-equivalent and key-event handlers translate the native event and call `ghostty_surface_key`.
Ghostty writes the correct terminal input to the PTY. The terminal line discipline then decides
whether the input becomes a signal for the foreground process group or data for the active program.

```text
focused native terminal -> AppKit control-key route -> Ghostty key event -> PTY
                                                                      -> foreground job

other focused area ------> that area's input route
Studio application ------> never receives terminal Ctrl-C as a shutdown signal
```

Do not hard-code Ctrl-C as `kill(pid, SIGINT)`. In normal POSIX terminal mode, the configured `VINTR`
character and `ISIG` flag cause the terminal driver to signal the current foreground process group.
In raw mode, a program can ask to receive the input as data. The PTY also knows which shell job is in
the foreground. Studio does not know these facts and must not guess.

Use the pinned Ghostty AppKit surface as the implementation reference. Port only the focus and
control-key routing that the Antiky adapter needs. Do not copy unrelated Ghostty window, split,
search, menu, or input-method code.

The first regression must identify the broken boundary before implementation starts. The current
adapter already forwards `keyDown:` to Ghostty, and Ghostty starts its PTY child in a separate
session. The failure can still be in AppKit key-equivalent routing, duplicate delivery, native app
lifecycle, or launch supervision. Fix the boundary that the red regression proves. Do not add
`performKeyEquivalent:` only because it exists in upstream Ghostty.

### Options considered

- **Forward the native key event to Ghostty — selected.** This preserves terminal job control, raw
  mode, user key bindings, nested shells, SSH, and terminal applications.
- **Call `kill` or `killpg` from Studio — rejected.** Studio can target the wrong job and bypass the
  terminal's current mode, configured interrupt character, and foreground process group.
- **Handle Ctrl-C in React and invoke Tauri — rejected.** The native terminal is a sibling native view.
  A web listener does not own its focus or complete AppKit event path.
- **Make Ctrl-C an application shortcut — rejected.** Terminal input must not share the Studio window's
  close or quit behavior.

## Required reading

- [Source feedback](slice-feedback.txt)
- [Studio objective guidance](../AGENTS.md) and [slice workflow](../../antiky-town/SLICE_WORKFLOW_A.md)
- [Studio architecture](../../../architecture/studio/overview_A.md)
- [Studio 0001](../../../adr/studio/0001-ai-integrations_H.md), [Studio 0002](../../../adr/studio/0002-tauri-portable-web-editor_H.md), and [Studio 0004](../../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [Feedback 04](feedback-04-auto-start-development-plan.md) and [Feedback 05](feedback-05-terminal-project-directory-plan.md)
- [Current native bridge](../../../../packages/studio/tauri/src/native/terminal_bridge.m) and the
  [pinned Ghostty AppKit surface](https://github.com/ghostty-org/ghostty/blob/f948d4207655f31ae9b95fa039e73524df43cd13/macos/Sources/Ghostty/Surface%20View/SurfaceView_AppKit.swift)
- [Studio getting started](../../../user-facing-docs/studio/getting-started.md) and
  [development connection](../../../user-facing-docs/studio/development-connection.md)
- [ADRs under review](../../../adr/UNDER_REVIEW_A.md), [website design](../../../../packages/website/DESIGN.md),
  and [Good Engineering](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- The [POSIX terminal interface](https://pubs.opengroup.org/onlinepubs/007904975/basedefs/xbd_chap11.html)
  assigns signal-generating input to the terminal's foreground process group. `VINTR` generates
  `SIGINT` only when `ISIG` is active. This is the authority that Studio must preserve.
- [Apple's key-event guide](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/EventOverview/HandlingKeyEvents/HandlingKeyEvents.html)
  states that AppKit offers Control-key events through `performKeyEquivalent:` before `keyDown:`.
  A custom native terminal view must own both focused paths.
- The pinned and [current Ghostty AppKit surface](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Ghostty/Surface%20View/SurfaceView_AppKit.swift)
  use focus-aware key-equivalent handling, Ghostty modifier translation, and `ghostty_surface_key`.
  Antiky's smaller adapter should preserve the same boundary.
- [Ghostty key bindings](https://ghostty.org/docs/config/keybind) apply to the focused terminal surface.
  Studio must allow Ghostty and the user's configuration to consume or forward a key.
- [VS Code's integrated terminal](https://code.visualstudio.com/docs/terminal/advanced) separates
  editor shortcuts from keys sent to the shell. It exposes explicit custom-signal commands instead
  of redefining normal terminal input. Antiky does not need a custom signal command for Ctrl-C.
- [Unity](https://docs.unity3d.com/Manual/GameView.html) routes pointer and keyboard input by
  Game-view focus. [Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/using-editor-viewports-in-unreal-engine)
  documents viewport commands as focused actions. These editors support the rule that one focused
  area owns a key at a time.
- [Godot](https://docs.godotengine.org/en/latest/tutorials/editor/command_line_tutorial.html) separates
  editor startup from project execution. [Phaser](https://phaser.io/tutorials/create-game-app) and
  [Bevy](https://bevy.org/learn/quick-start/getting-started/setup/) use normal project terminals for
  development commands. Users keep the shell's standard job-control behavior inside an embedded
  terminal.
- `npm ls brometal` reports BroMetal `0.15.0`. The same-date registry review in
  [Feedback 01](feedback-01-open-project-plan.md) reports `0.15.0` as latest. This change has no shader,
  render-loop, GPU, or CPU-to-GPU effect.
- `UNDER_REVIEW_A.md` candidate 5 is not required. This plan changes native terminal input routing. It
  does not change where engine authority or the Studio development connection runs.
- No new ADR is necessary. Accepted Studio ADRs already place native terminal details in Tauri and
  keep terminal execution separate from engine services.

## Current state

- `AntikyGhosttyView` accepts first-responder focus and forwards `keyDown:`, `keyUp:`, and
  `flagsChanged:` events to `ghostty_surface_key`.
- The view does not implement the Control-key `performKeyEquivalent:` path that AppKit uses before
  `keyDown:`. This difference from Ghostty is a candidate cause, not a confirmed cause.
- Pinned Ghostty calls `setsid()` before it gives the child its controlling PTY. A correctly created
  terminal session cannot send its foreground-job `SIGINT` to the Studio process group. The
  regression must prove that the embedded path preserves this behavior.
- The bridge filters control characters from the text field so Ghostty can encode them. Keep this
  behavior and test it.
- Native tests cover bounds and dependency pinning. App tests cover terminal layout. No automated
  test proves Ctrl-C routing, PTY foreground ownership, or native-window survival.
- The user guide tells the user to stop a terminal-started development host with Ctrl-C. It does not
  explain that the terminal command can stop while Studio stays open.

## Deliverables

- Add the reported failing regression before the fix.
- Identify whether the failure is in focused AppKit routing, duplicate delivery, PTY ownership, or
  application lifecycle. Record the result in the checkpoint evidence.
- Correct the confirmed native boundary. Add focused `performKeyEquivalent:` handling only if the
  regression proves that AppKit intercepts the Control-key event before `keyDown:`.
- Preserve Ghostty modifier translation, configured key bindings, and control-character encoding.
- Prove that the Studio process group is not the PTY foreground process group.
- Keep the shell usable after a foreground job receives Ctrl-C.
- Keep the app, canvas, and independently managed development host outside the terminal input path.
- Update the general Studio guide with the terminal interrupt and disconnected-state behavior.

## Safe behavior

- Forward each focused key press once. Do not deliver the same event through both
  `performKeyEquivalent:` and `keyDown:`.
- Check native focus before the terminal handles a key equivalent.
- Let Ghostty apply terminal key bindings before input reaches the PTY.
- Let the PTY and shell select the foreground process group. Do not cache a PID for Ctrl-C.
- Preserve raw mode, changed `VINTR` settings, nested shells, SSH, and full-screen terminal programs.
- Keep Command-C copy behavior distinct from Control-C terminal input.
- Keep Studio open when a terminal child exits, rejects input, or closes during a key event.
- Close the PTY once when the user closes Studio or switches projects. Do not leave a child process.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Add the failing Ctrl-C ownership and survival regression | Red native terminal test | `Specify terminal interrupt routing` |
| `CP-01` | Correct the proven native input or lifecycle boundary and preserve PTY job control | Native, PTY, app, and regression tests | `Route interrupts to terminal jobs` |
| `CP-02` | Update general docs and complete actual native interaction evidence | Native usability run and receipt | `Verify terminal interrupts` |

## Test plan

- Add a regression that expects the Studio process and window to survive. Focus the embedded
  terminal, run a bounded foreground job, and press Ctrl-C. Run it against the current code and save
  the failing result before the fix.
- After the fix, repeat the same case. Assert that the foreground job receives the interrupt, the shell
  returns, the Studio PID stays alive, the window responds, and a second terminal command runs.
- Record the Studio PID, terminal shell PID, PTY name, foreground PID, and process-group IDs. Do not
  record terminal contents or add transcript capture to the product.
- Test a normal `ISIG` terminal, raw mode, a changed `VINTR` character, a nested shell, a repeated key,
  and Ctrl-C while the terminal closes.
- Test terminal focus, canvas focus, text-field focus, focus transfer, and app deactivation. Only the
  focused owner receives the key.
- Test Command-C, configured Ghostty bindings, Unicode input, IME input, resize, reopen, child exit,
  and application cleanup for regressions.
- If `antiky dev` runs in the user terminal, confirm that Ctrl-C stops that command and Studio enters
  its disconnected state without closing. When Feedback 04 is present, confirm that Ctrl-C in the
  user terminal does not stop the Studio-managed development host.
- Use Computer Use or an owner-reviewed native capture for the real key press and recovery flow.
- Run Studio app tests, Rust tests, the native build, and `npm run check`.

## Completion checks

- [ ] The reported regression fails before the fix and passes after it.
- [ ] Ctrl-C reaches the focused Ghostty surface exactly once.
- [ ] Normal terminal mode interrupts only the PTY foreground process group.
- [ ] Raw mode and configured terminal bindings keep their own Ctrl-C behavior.
- [ ] Studio stays open and usable after the terminal job stops or exits.
- [ ] The canvas, text fields, and managed development host do not receive terminal input.
- [ ] Command-C, Unicode, IME, focus, resize, reopen, and cleanup behavior still work.
- [ ] Actual native usability evidence, user-facing docs, tests, and the complete check pass.
- [ ] The receipt validates and the slice summary records the change.

## Run and evidence rule

- Use a disposable project outside the repository and bounded test jobs. Do not use a real user game
  or coding-agent session for automated signal tests.
- Record process identity and exit status only. Redact paths and do not store terminal text.
- Keep the current terminal embed commit as the rollback point.
- Roll back if Ctrl-C can close Studio, one key is delivered twice, an unfocused area receives the key,
  raw mode breaks, or a terminal child remains after Studio closes.
- Studio native maintainers own terminal input and PTY lifecycle. Record follow-up feedback in
  `slice-feedback.txt`.
