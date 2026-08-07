# Feedback 08 plan: Match the website Studio layout

## Control

| Field | Value |
| --- | --- |
| Status | `COMPLETE WITH RECORDED BROWSER EVIDENCE LIMITATION` |
| Feedback source | [Slice 00 feedback, line 8](../slice-feedback.txt) |
| Outcome | The shipped Studio uses the same game-first workspace hierarchy as the Studio render on the website |
| Owner input | The source feedback and owner-supplied website render select the visual direction |
| Architecture decisions | [Studio 0002](../../../../adr/studio/0002-tauri-portable-web-editor_H.md) and [Studio 0004](../../../../adr/studio/0004-share-engine-services-with-cli_H.md) |
| Depends on | Completed Studio Slice 00 |
| Alignment revision | `0cf02f51dff72f0c22681cb5a3af890173c32b00` |
| Review date | `2026-08-06` |
| Complete check | Archived `PASS` in `outputs/studio-s00-feedback-08-20260806T181038Z/final-verifier.json`; temporary verifier removed after completion |
| Evidence | `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-08-{run-id}/receipt.json` |

Goal command:

```text
/goal implement docs/objectives/studio/slice-00/feedback-08-website-layout-plan.md until complete
```

## Feedback

> I like the layout of the studio shown on our website better than our actual studio layout...
> Can we adapt that?

## Outcome

Studio makes the running game the primary surface. It places inspection beside the game and keeps the
terminal and activity log in a quieter lower row. The shipped interface uses the website render as its
visual reference while it continues to show real game, terminal, inspection, and activity data.

### Observable behavior

- The desktop workspace has two columns and two rows.
- The live game occupies the larger upper-left surface.
- The terminal occupies the lower-left surface.
- Inspection occupies the upper-right surface.
- Activity occupies the lower-right surface.
- The title bar, simulation toolbar, panel headers, tabs, and status bar match the compact website chrome.
- The current live-game iframe, simulation controls, hierarchy, stores, snapshot, events, MCP calls,
  diagnostics, terminal, connection states, and error states remain available.
- The native terminal stays inside the terminal surface during launch, resize, zoom, and window movement.
- A narrow window stacks the surfaces in this order: live game, terminal, inspection, activity.
- Keyboard focus follows a deliberate logical order and remains visible.

### Visual reference boundary

The canonical reference is the rendered Studio window in
[`packages/website/src/app/studio/page.tsx`](../../../../../packages/website/src/app/studio/page.tsx) and
[`studio.css`](../../../../../packages/website/src/app/studio/studio.css). The owner-supplied render confirms
the intended result. Its panel hierarchy, proportions, spacing, color restraint, and density are normative.
Its static town image and sample records are illustrative. Studio must continue to render the live project.

### Non-goals

- Do not add draggable docks, detachable windows, saved layouts, or user-resizable splitters.
- Do not copy the website's fake terminal transcript, static inspection tree, or static event records.
- Do not replace the live-game iframe with the website poster.
- Do not add project loading, automatic development startup, or terminal theming in this feedback item.
- Do not change CLI, Framework, inspection, MCP, event-sourcing, or runtime authority.
- Do not import the Next.js website component into the Vite Studio application.

## Chosen shape

Use one explicit CSS grid for the four existing Studio surfaces. Give the left column about two thirds of
the usable width. Give the upper row about two thirds of the usable height. Use named grid areas so tests
and later maintainers can understand the layout without decoding line numbers.

```text
+--------------------------------------+-------------------+
| Live game                            | Inspection        |
|                                      |                   |
+--------------------------------------+-------------------+
| Terminal                             | Activity          |
+--------------------------------------+-------------------+
```

Keep the application DOM and behavior in `packages/studio/app`. Use the website implementation as the
presentation specification. Share existing brand assets and design tokens where the package boundary is
already safe. Do not make Studio depend on website runtime code.

### Options considered

- **Recompose the current shell with the website grid — selected.** This keeps every real Studio surface
  and changes only presentation and responsive behavior.
- **Import the website mockup — rejected.** The mockup owns static sample content and Next.js details. It
  is not an application shell.
- **Build a dock manager first — rejected.** It adds persistence, pointer, accessibility, and native-view
  geometry problems that the feedback does not require.

## Required reading

- [Source feedback](../slice-feedback.txt)
- [Studio objective guidance](../../AGENTS.md) and [slice workflow](../../../antiky-town/SLICE_WORKFLOW_A.md)
- [Website design language](../../../../../packages/website/DESIGN.md)
- [Website Studio render](../../../../../packages/website/src/app/studio/page.tsx) and
  [its styles](../../../../../packages/website/src/app/studio/studio.css)
- [Development harness research](../../../general-stuff/DEV_HARNESS_RESEARCH_A.md) and
  [inspection tooling direction](../../../general-stuff/INSPECTION_TOOLING_A.md)
- [Studio architecture](../../../../architecture/studio/overview_A.md)
- [Studio 0002](../../../../adr/studio/0002-tauri-portable-web-editor_H.md) and
  [Studio 0004](../../../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [ADRs under review](../../../../adr/UNDER_REVIEW_A.md) in full
- [Studio getting started](../../../../user-facing-docs/studio/getting-started.md)
- [Good Engineering](../../../../GOOD_ENGINEERING_H.md)

## Research and decision review

- [Unreal Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-editor-interface) gives the
  level viewport the primary area. It places the Outliner and Details panel on the right. Its output log
  is a lower supporting surface.
- [Unity](https://docs.unity3d.com/6000.0/Documentation/Manual/UsingTheInspector.html) links selection in
  the scene or hierarchy to a separate Inspector. Its Game view and play controls remain primary tasks.
- [Godot](https://docs.godotengine.org/en/stable/tutorials/editor/inspector_dock.html) updates a docked
  Inspector from the selected scene-tree node.
- [Phaser Editor](https://docs.phaser.io/phaser-editor/scene-editor/game-objects/common-object-properties)
  uses an Outline and Inspector around its Scene Editor.
- [PlayCanvas](https://developer.playcanvas.com/user-manual/editor/interface/) separates its viewport,
  hierarchy, and Inspector. This supports Antiky's game-first view with a narrow semantic rail.
- The shared development-harness and inspection research requires Studio to show structured service data.
  The layout must not derive state from pixels, terminal text, React internals, or BroMetal objects.
- BroMetal `0.15.0` is installed. `npm view brometal version` reports `0.15.0` on `2026-08-06`.
  This work does not change BroMetal, shaders, WebGPU, rendering ownership, or CPU/GPU transfers.
- The full `UNDER_REVIEW_A.md` review found no decision that this work must settle. This is a private
  presentation change. It does not need an ADR.

## Current state

- `StudioShell` places the terminal in a narrow full-height left column.
- The live game occupies the center column.
- Inspection occupies the right column.
- Activity spans the complete lower row.
- The current title and control bars are taller and louder than the website render.
- The native Ghostty view is an AppKit sibling above the WebView. It receives bounds from the terminal
  mount through `ResizeObserver`. A grid change can expose overlap or stale-bound defects.
- The website already implements the selected two-by-two hierarchy and responsive stack.

## Deliverables

- Give each workspace surface one stable semantic region and one named grid area.
- Reorder the real surfaces to match the website reference.
- Match the website title bar, simulation toolbar, surface headers, tabs, dividers, status bar, spacing,
  type scale, control density, and restrained colors.
- Preserve honest state labels. Do not display sample runtime values.
- Keep the live game visually dominant in connected, loading, stale, disconnected, and error states.
- Define desktop, intermediate, and narrow layouts without hiding required surfaces.
- Keep a logical DOM order and accessible landmarks independent of CSS placement.
- Keep the native terminal mount measurable and visible at every supported layout.
- Update general Studio user documentation when the visible workspace description changes.
- Keep temporary verification code inside this slice directory. Do not add permanent root scripts.

## Safe behavior

- Keep native terminal geometry finite, positive, bounded, and clipped to its panel.
- Do not mount a second terminal or a second game iframe during layout changes.
- Do not change session discovery, control commands, retained data, or event order.
- Keep stale and disconnected state visible. Do not cover it with decorative media.
- Preserve text contrast, visible focus, reduced motion, zoom, and keyboard access.
- Roll back to the current shell if the new grid causes a white game view, native overlap, duplicate
  windows, input loss, or unreadable state.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Capture the current app and website reference at the same desktop and narrow sizes | Labeled before/reference captures and failing layout assertion | `Define Studio layout target` |
| `CP-01` | Recompose the shell into the named two-by-two grid | Studio component tests and browser captures | `Match the Studio website layout` |
| `CP-02` | Compact the chrome and align tokens with the website language | Contrast, focus, and visual comparison | `Align Studio workspace chrome` |
| `CP-03` | Stabilize responsive and native-terminal geometry | Native resize, zoom, and narrow-window evidence | `Stabilize Studio panel geometry` |
| `CP-04` | Update user docs and record complete evidence | Full checks, owner review, and receipt | `Document the Studio workspace` |

## Test plan

- Add a failing layout regression first. It must prove that the current desktop surface placement does
  not match the selected reference.
- Test that every required surface renders once with the correct accessible name and honest state.
- Test the connected, connecting, stale, disconnected, loading, and failure shells.
- Test simulation controls, tabs, activity records, live-game retry, and terminal error presentation.
- Test desktop, intermediate, narrow, 200 percent zoom, reduced motion, and keyboard-only use.
- Launch the native application. Resize and move it repeatedly. Confirm that the terminal never overlaps
  the game, inspection, activity, toolbar, or status bar.
- Confirm that one launch creates one Studio window and one live-game iframe.
- Confirm that a ready game does not remain white after repeated Studio launches.
- Use browser control for web-shell checks and Computer Use for the native AppKit terminal boundary.
- Compare actual captures with the website reference. Automated tests alone cannot approve appearance.
- Run Studio app tests, Studio Tauri tests, Studio builds, website tests if its reference changes, and
  `npm run check`.

## Completion checks

- [x] The real Studio has the website's game-first two-by-two desktop hierarchy.
- [x] The compact chrome and visual density match the approved reference.
- [x] Every current Studio capability and honest state remains available.
- [x] The native terminal stays inside the lower-left surface during all geometry tests.
- [x] Narrow layouts remain readable and keyboard accessible; responsive contracts cover effective zoom reflow, with direct 200-percent browser capture recorded as unavailable.
- [x] One launch creates one window, one terminal, and one live-game iframe.
- [x] The owner approved the actual native desktop, intermediate, narrow, focus, and reference comparison; no unavailable browser capture is claimed.
- [x] Tests, builds, general docs, receipt, and slice summary pass.

## Owner approval and requested follow-ups

On `2026-08-06`, after reviewing the rendered evidence, the owner responded: “looks good to me, much
better.” Browser Control still had no attached browser, so the receipt closes with that evidence
limitation explicitly recorded rather than claiming a browser capture.

The same approved delivery also includes the owner's follow-up requests:

- The launched desktop HTML loads SSPS site `268`, and Tauri allows only the required SSPS script and
  WebSocket origins.
- Production website pages load SSPS site `268` once and show its live visitor count as “active now” in
  the global footer. Development builds do not pollute the production presence count.
- Every tracked `.png` and `.jpeg` at the delivery revision is stored through Git LFS. Existing history
  was not rewritten.

## Run and evidence rule

- Write temporary checks under `docs/objectives/studio/slice-00/verification/feedback-08/`.
- Write run evidence under `docs/objectives/studio/slice-00/outputs/studio-s00-feedback-08-{run-id}/`.
- Record commands, exit codes, test results, viewport sizes, accessibility checks, and capture paths.
- Record the exact source revision and website reference revision.
- Do not mark this feedback complete from unit tests alone. The owner must approve actual rendered evidence.
