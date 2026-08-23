# Current Studio state and proving cases

This document compiles the current-state and use-case research. Evidence labels have these meanings:

- **Established** - verified in current code, an accepted ADR, or maintained documentation.
- **Claimed** - stated by direction or third-party documentation but not proven in Antiky.
- **Inferred** - a conclusion drawn from established evidence.
- **Gap** - requires owner direction or a focused proof.

Raw evidence is retained in
[`00-current-studio-seams-corrected.md`](subagent_outputs/00-current-studio-seams-corrected.md) and
[`01-proving-apps.md`](subagent_outputs/01-proving-apps.md). The
[`initial seam report`](subagent_outputs/00-current-studio-seams-initial.md) is retained for
traceability but contains stale path aliases; the corrected companion is the source of truth for
repository citations.

## What exists today

**Established:** Studio is one coordinated game-editing workspace, not an app host. `StudioShell`
assembles four fixed regions - Live game, Terminal, Inspection, and Activity - inside a fixed CSS grid.
The shell owns split values, fullscreen state, active tabs, and Settings visibility. Those state
variables and CSS areas are implementation details rather than a registered workspace model.

**Established:** The portable web editor already has several narrow architectural seams:

| Seam | Current owner | What crosses it |
| --- | --- | --- |
| Project selection and recent projects | `EditorHost` plus project manager | Parsed project identity and bounded host operations |
| Local project lifecycle | Shared CLI project services through Tauri | Serialized start, stop, status, and development operations |
| Live game | CLI game-host document in an iframe | URL/session identity, controls, snapshots, call logs, and captures |
| Engine mutation | Versioned command services | Commands with identity, permission, duplicate, and revision checks |
| Native terminal | Studio native adapter | Mount geometry, visibility, focus, input, and teardown |
| Rendering | Game host, game module, and render driver | Canvas and typed render data; no renderer or GPU objects enter Studio panels |

These seams follow the accepted Studio, CLI, and Framework ADRs. An app system must compose them;
it must not create a second project lifecycle, a panel-only mutation path, or renderer-specific
Studio authority.

**Established:** The four visible regions are not interchangeable today.

| Surface | Important current behavior | Pressure on a future app host |
| --- | --- | --- |
| Live game | Stable iframe, cross-origin game host, focus and fullscreen behavior | Preserve mount lifetime and host isolation |
| Terminal | Native AppKit surface positioned over a DOM mount | Report geometry, visibility, focus, and disposal explicitly |
| Inspection | Read-only projections with commands for changes | Share clients and command services rather than direct state access |
| Activity | Events, calls, and diagnostics from the same development session | Keep session and project revision truth coherent |

**Inferred:** `Panel`, the current tab primitive, CSS grid area names, and React component props are
useful implementation precedents, but they are not yet a durable extension API. Promoting them
unchanged would freeze current accessibility gaps and shell-specific assumptions.

## The compatibility baseline

**Established:** The owner explicitly requires the current game-editor experience to remain
intact. Therefore, the existing four-area workspace is the first regression consumer of any app
seam, even if it is not immediately rewritten as an app.

**Inferred:** A successful seam must be able to describe or host the current workspace without:

- remounting the game iframe, terminal, or future GPU resources when panels move or hide;
- changing project selection and development-service authority;
- changing the visible wide and narrow workspace behavior by accident;
- making Inspection or Activity into new mutation authorities; or
- exposing raw Tauri, renderer, world, or GPU objects to panel code.

This baseline proves compatibility. By itself, it does not prove that the seam generalizes.

## Candidate proving cases

The objective says there are several intended first apps but does not name them. The nearby idea
documents contain possibilities rather than product commitments. The voxel-renderer idea is the
only recorded candidate that clearly pressures a new GPU-native workspace, but its minimum user
workflow is not yet specified.

| Candidate | Distinct capability pressure | What it does not yet establish |
| --- | --- | --- |
| Current game editor | Multiple panels, iframe, native terminal, project lifecycle, inspection, activity, responsive layout | A new app contract or an in-process WebGPU tool |
| Voxel tool, if promoted | File import, app-owned editable state, reusable canvas host, progressive/invalidation rendering, large GPU uploads, export and disposal | Whether it is a viewer, editor, shader workbench, asset compiler, or some combination |
| Non-GPU project utility | Ordinary panels, project-scoped queries/actions, persistence, empty/loading/error states, no renderer dependency | Which utility the owner actually wants first |

**Inferred:** The smallest genuinely independent proof set is:

1. the current game editor as the non-regression consumer;
2. one owner-approved GPU-native content tool; and
3. one owner-approved utility that does not need a canvas or renderer.

An asset catalog or asset-install surface is a strong non-GPU candidate because nearby work already
needs it, but research does not promote that idea into this objective. Feedback capture, visual QA,
and diagnostics may be shared capabilities or panels rather than independent apps.

## Capabilities the cases actually pressure

| Capability | Game editor | GPU-native tool | Non-GPU utility |
| --- | :---: | :---: | :---: |
| Stable app and panel identity | Yes | Yes | Yes |
| App-provided initial workspace | Yes | Yes | Likely |
| User layout preservation | Yes | Yes | Likely |
| Project selection and revision | Yes | Likely | Likely |
| Shared queries and commands | Yes | Likely | Yes |
| Native terminal surface | Yes | Optional | No |
| Iframe-hosted runtime | Yes | Optional | No |
| In-process canvas host | No | Yes | No |
| Device/resource lifecycle | Indirect | Yes | No |
| Import/export and progress | Capture only | Yes | Candidate-specific |
| App-scoped persistence | Session-local today | Yes | Likely |
| Fault isolation and complete disposal | Yes | Yes | Yes |

**Inferred:** Terminal, viewport, command, query, diagnostics, and persistence support should be
capabilities an app requests from Studio-owned services. They should not become mandatory methods
on every app object.

## Unsupported assumptions and gaps

- **Gap:** The exact first apps are not recorded in the objective.
- **Gap:** The voxel candidate has no owner-defined minimum workflow or boundary between authoring,
  rendering, compilation, and export.
- **Gap:** It is unknown whether apps must work without an open project.
- **Gap:** It is unknown whether the current game editor eventually becomes a registered app or
  remains the permanent core workspace beside apps.
- **Gap:** It is unknown whether first-party apps are only compiled into Studio or may be discovered
  from a project.
- **Gap:** The required terminal policy is unclear: global, app-requested, or fixed only for the
  game editor.
- **Gap:** Layout persistence scope and the inviolable parts of the current workspace need owner
  direction.

## Planning implications

- Preserve the current workspace as explicit acceptance evidence.
- Select real app consumers before fixing an app contract; do not let generic extensibility become
  the consumer.
- Keep optional capabilities out of the minimum app identity and lifecycle shape.
- Treat the voxel tool as a useful pressure test only after the owner defines what its first useful
  workflow does.
- Require one non-GPU consumer so that WebGPU needs do not distort the general app seam.
