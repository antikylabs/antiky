# Studio Agent panel

This document selects the portable UI, state coordination, workspace placement, and interaction
behavior for the first ACP conversation surface. It deliberately stops short of a general code editor
or a Studio app framework.

## Workspace placement

The first Agent panel shares the existing lower-left workspace area with Terminal through two
Studio-owned tabs:

```text
[ Terminal ] [ Agent ]
```

This preserves the current four-area workspace, splitters, Live game, Inspection, Activity, status
bar, and Settings behavior. Only the selected lower-left surface is interactive. When Agent is
selected, the native terminal overlay is hidden through its existing visibility/layout path; when
Terminal is selected, the agent session remains alive but its DOM does not steal focus.

Alternative placements were a fifth permanent panel, replacing Terminal, a modal, or waiting for the
Studio apps objective. A fifth panel harms the current layout, replacement loses direct CLI access, a
modal is poor for a long-running thread, and waiting couples two independently useful proofs. The
tabbed placement is selected as the smallest reversible product surface.

## Portable host interface

`AgentHost` is a narrow injected interface with methods for snapshot, event subscription,
configuration, lifecycle, prompt, cancellation, and permission response. Only its Tauri adapter
imports `@tauri-apps/api`.

The browser implementation reports `unavailable` with a stable reason. Pure UI tests can use a fake
host that emits exact DTOs. The panel never branches on an agent vendor, imports the ACP SDK, parses
JSON-RPC, reads a process environment, or constructs MCP launch commands.

## Coordinator state

The agent coordinator owns one immutable public state:

- platform availability and configured profile summary;
- native host generation and event sequence;
- connection/session/turn lifecycle;
- negotiated presentation capabilities;
- ordered in-memory transcript items;
- current prompt draft and submission state;
- active permission request;
- selection-follow state and pending context preview;
- bounded safe diagnostics and recoverable issue.

It reads the native snapshot, subscribes, applies only the next sequence for the active generation,
and refreshes after a gap. Retired-generation updates are ignored. It does not infer `ready` from a
process PID or merge an event into a different ACP session.

Transcript retention has explicit item, per-item byte, and total byte limits. When it evicts older
items, it displays a retention marker. This is in-memory UI retention, not durable transcript
storage.

## Minimum rendered content

The first panel renders:

- unconfigured, stopped, starting, ready, prompting, stopping, and failed states;
- selected profile and active agent/session identity where safe;
- user-entered prompts and Studio-generated selection prompts;
- streamed agent text with stable ordering;
- plans and plan-item state;
- tool-call title, kind, status, locations, and bounded content/diff summary;
- permission subject and exact offered decisions;
- turn stop reason, cancellation state, and retry affordance;
- MCP availability and a link or cue to the existing Activity panel's MCP call history;
- safe ACP diagnostic metadata.

The panel does not render terminal escape sequences, run commands from presented content, or apply a
diff because it appeared in an ACP update. Links and locations are treated as untrusted display data
until a separate bounded Studio action validates them.

## Profile setup

Settings contains the first local agent-profile editor or a bounded entry point to it. It can edit
display label, executable, argument list, and allowed environment pass-through names. It clearly
states that the agent owns authentication, models, billing, coding sandbox, and native tools.

Configuration validation happens in both the web adapter for fast feedback and the native host for
authority. A saved profile does not start a process automatically. Opening a project does not spend a
model turn. The user explicitly connects or starts a new session.

## Prompt and turn behavior

- The composer submits only while the ACP session is `ready` and no permission request blocks it.
- A submitted prompt becomes a visible transcript item before native invocation completes. A failure
  marks that same item rather than silently deleting it.
- Streaming updates use stable item identities so React updates one item without rebuilding the
  complete transcript.
- Cancellation remains available during an active turn and shows requested versus confirmed state.
- A permission card traps neither keyboard focus nor the entire application. It is announced as an
  actionable status and can be completed without a pointer.
- A child/session failure leaves the in-memory transcript readable and offers explicit restart. It
  does not replay the prior prompt automatically.

## Selection context presentation

When a current context is available, the panel shows an attachment summary before or with dispatch:

- selected target label and stable ID;
- root-to-target ancestry;
- project/build/runtime/world observation identity;
- component and related-store counts;
- complete or partial state with stable reasons;
- encoded byte size;
- pending, submitted, replaced, rejected, or retired state.

The full bounded JSON can be inspected in a disclosure surface. It must match the content submitted
to ACP after capability projection. Studio does not show “full context” when `complete` is false.

Selection-follow is off until the user enables it for the active ACP session. Enabling it submits the
current eligible selection once, then follows newer contexts. Changing project or ACP session turns it
off. The UI makes turn creation visible so automatic behavior is not hidden model usage.

## Accessibility and interaction

- Terminal/Agent tabs use the existing accessible tab primitive or a corrected single-select tablist.
- Transcript streaming uses restrained live-region announcements; it does not announce every token.
- Permission requests and terminal turn state use semantic status/alert behavior without stealing
  focus repeatedly.
- All actions are keyboard operable, focus remains visible, and disabled controls explain state in
  adjacent text.
- Long content wraps or scrolls within the panel without widening the workspace.
- Reduced motion applies to stream/progress decoration, and color is not the only status signal.
- Browser zoom, narrow layouts, panel resizing, native terminal switching, and Settings transitions
  receive rendered tests.

## Failure and recovery states

| State | Presentation and recovery |
| --- | --- |
| Native ACP unavailable | Explain that the browser build has no local agent host; keep Terminal and all other Studio features usable. |
| Profile invalid | Show field-level validation and native safe error; do not launch. |
| Agent failed to initialize | Show protocol/capability summary and bounded diagnostics; offer restart after configuration changes. |
| MCP unavailable | Allow plain ACP use if session creation supports it, but disable selection-follow and state that engine tools are absent. |
| Event sequence gap | Pause optimistic commands, refresh one snapshot, then resume or show a native-host issue. |
| Context incomplete | Show partial reasons in attachment and payload; never hide the warning. |
| Context stale/retired | Do not dispatch; keep a visible retired marker if it was already previewed. |
| Permission request expires | Disable its choices and show the terminal outcome. |

## Verification

- Reducer/coordinator tests cover every lifecycle transition, generation/sequence fence, retention
  bound, prompt failure, permission race, cancellation, and selection dispatch state.
- Component tests cover accessible names, keyboard behavior, transcript ordering, partial-context
  labels, and unsupported content.
- Browser integration tests prove unavailable fallback and all non-native Studio surfaces.
- Native rendered tests prove terminal overlay visibility, tab focus, splitters, Settings, and project
  switching.
- Owner-reviewed screenshots compare the panel with the existing main and Settings visual language;
  source snapshots alone are not visual evidence.

## Cost and exclusions

This approach adds an agent coordinator, a substantial stateful panel, and native/browser test
variants. It avoids the much larger cost of docking, a full editor, and durable history. It does not
define app contributions, restore ACP threads, render every optional rich-content type, apply diffs,
open arbitrary paths, add a general terminal, or hide provider/sandbox responsibility behind Studio
branding.
