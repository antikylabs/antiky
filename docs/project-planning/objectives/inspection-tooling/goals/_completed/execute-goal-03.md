# Execute goal 03: managed canvas capture and motion evidence

## Relationship to existing goals

Complete [execute goal 01](execute-goal.md) first. Reuse its observation fencing,
`EvidenceArtifactRefV1`-style opaque artifact identity, authorized retrieval, private retention, and
path-safe result contracts. Do not create a second capture store, freshness envelope, artifact URI,
or privacy state.

[Execute goal 02](execute-goal-02.md) is compatible but not a hard prerequisite. When semantic-world
queries are available, capture evidence may reference their observation and result identities. This
goal must still work with the existing bounded session, world, event, diagnostic, and render reads,
and must not reimplement component schemas or semantic world discovery.

This goal is the bounded follow-up to goal 01's explicit video/replay non-goals. It adds a
CLI-owned browser execution substrate and canvas motion evidence. It does **not** weaken goal 01's
capture fencing or turn presentation input into deterministic simulation replay.

The design follows the existing direction in
[CLI/MCP current state](../cli-mcp-current-state.md),
[rendering and visual evidence](../rendering-brometal-and-visual-evidence.md),
[QA and release](../qa-performance-release.md), and the
[recommended tooling roadmap](../recommended-tooling-roadmap.md).

## `/goal` objective

Implement one end-to-end Antiky development slice that can boot and inspect a WebGPU game without
requiring a person or agent to connect an external browser.

Add an on-demand, CLI-owned managed capture runtime backed by a pinned direct Playwright Chromium
dependency. It must use the existing Antiky game host and browser/runtime protocol, connect only to
the current project's loopback URL, publish normal runtime inspection, and be owned and cleaned up
by the development session.

Use that runtime to make the existing `capture_frame` self-sufficient and add one bounded
`capture_gameplay_sequence` operation for lossless canvas-frame sequences plus a reviewable WebM
derivative. The sequence operation may drive a small generic keyboard/pointer presentation trace in
the managed runtime and correlate frames with existing Antiky observations. It is not a general
browser tool, an OS input tool, or a deterministic `ScenarioRunner`.

## Required outcome

When the work is complete, an agent must be able to:

1. discover whether managed capture, WebGPU, still capture, motion capture, supported formats, and
   bounded presentation input are available before starting work;
2. invoke `capture_frame` while no external browser is connected and have Antiky launch an isolated
   capture runtime, wait for the current accepted build and runtime publication, capture only the
   game canvas, and return goal 01's opaque evidence reference plus MCP image content;
3. capture a bounded lossless PNG frame sequence from the game canvas and obtain a WebM derivative
   generated from that exact sequence with declared encoder settings;
4. optionally drive a bounded keyboard/pointer presentation trace inside the managed game page,
   with normalized pointer coordinates and explicit press/release edges, without using desktop or
   OS automation;
5. correlate the capture with development session, accepted build, runtime instance, canvas size,
   DPR, capture cadence, start/end observation, applicable completed steps and state digests, and
   the available session/world/event/diagnostic/render evidence;
6. retrieve authorized still, sequence, poster, manifest, and video artifacts by opaque evidence
   identity without receiving an absolute filesystem path or unbounded base64 JSON;
7. receive stable unavailable, conflict, timeout, capacity, WebGPU, encoder, dropped-frame, and
   runtime-lifecycle results instead of a hanging action or partial success; and
8. stop `antiky dev` and prove the managed browser, profile, pending actions, listeners, and private
   artifacts follow the declared cleanup and retention policy.

The final evidence from this goal proves that Antiky can capture and correlate its own canvas. It
does not prove that a game is attractive, readable, fun, performant on target hardware, or approved
for publication. Those remain separate human and target-device gates.

## Chosen architecture

Implement one deep CLI-owned `ManagedCaptureRuntime`-style module behind the development service.
Callers ask for evidence; they do not launch, navigate, script, or dispose a raw browser.

- Pin Playwright and the browser revision in repository dependency state. Interactive Playwright
  MCP available to an agent is useful for development, but is not a checked-in runtime dependency
  or test authority.
- Launch one ephemeral Chromium profile per managed capture runtime. Do not reuse a personal Chrome,
  Edge, Safari, or in-app browser profile, cookies, extensions, credentials, local storage, or
  signed-in session.
- Navigate only to the manifest's exact loopback game origin. Block non-loopback navigation,
  downloads, popups, permissions, and external resource requests by default.
- Exercise the existing built game module and Antiky browser transport. Do not create a Node-only
  copy of game startup, move BroMetal/WebGPU below the browser boundary, or add a second inspection
  protocol.
- Reuse a compatible current runtime for an observation-fenced still when safe. A managed
  presentation trace must run only in the managed runtime. Never disconnect or replace a person's
  connected interactive runtime implicitly; return a stable busy/unavailable result if the current
  host cannot safely support the requested managed run.
- Keep one capture writer per development session. Queueing, cancellation, multi-browser farms, and
  a generic `DevelopmentJob` protocol are outside this slice.
- Route browser console errors, page errors, WebGPU initialization failures, runtime disconnects,
  and capture failures into bounded, sanitized Antiky diagnostics with correlation IDs.

Two alternatives are deliberately rejected:

1. **External-browser-only capture:** less repository code, but repeats the current failure mode in
   which MCP has no runtime when an interactive browser is unavailable.
2. **A new headless renderer outside the browser:** could avoid Playwright, but would duplicate the
   real browser/WebGPU startup path and create a second runtime whose evidence is not the shipped
   game behavior.

## Capture capability and MCP surface

Expose the smallest capability-grouped surface that fits the existing roadmap.

### `get_capture_capabilities`

Return one strict versioned capture descriptor containing:

- managed-runtime availability and an explicit unavailable reason;
- pinned browser/runtime version and sanitized WebGPU availability;
- final-canvas-only target support;
- PNG-sequence and WebM-derivative support;
- maximum drawing-buffer dimensions, DPR, duration, FPS, frame count, trace entries, artifact bytes,
  retained evidence count, and retention age;
- supported presentation-input kinds; and
- whether a compatible interactive runtime is connected without exposing its PID, profile, path,
  user agent string, GPU serial/PCI identifiers, or other local identity.

Capability discovery is a read. It does not launch a browser, mutate game state, or imply that a
format will succeed after the observed environment changes.

### Compatible `capture_frame`

Add a new compatible request/result version rather than silently changing schema version 1.

The request must support:

- goal 01's expected observation fields;
- `runtimePolicy: 'current-or-managed' | 'managed-only'`;
- exact final-canvas drawing-buffer width/height and DPR within declared limits;
- bounded warm-up frames or an exact paused completed-step barrier; and
- a caller correlation/idempotency key.

The result must contain the actual observation, capture source attestation, PNG dimensions, DPR,
byte length, SHA-256, private review state, and opaque evidence/artifact references. MCP may return
the bounded PNG as an image content block, but JSON results and audit logs must not contain raw
base64 or a local path.

### `capture_gameplay_sequence`

Use the existing roadmap name instead of adding overlapping `capture_clip` and
`capture_scenario` tools.

The request accepts exactly one bounded source:

- a wall-time/frame-cadence window in a managed runtime; or
- a `PresentationTraceV1`-style sequence of keyboard/pointer actions and waits.

A presentation trace is limited to declared keyboard codes, normalized canvas-local pointer
coordinates, pointer movement, explicit press/release/click edges, presentation-frame waits, and
completed-step waits when the runtime publishes `EngineSession`. Unknown input kinds, repeated
presses without a release, non-finite coordinates, excessive entries, and unsatisfied step waits
must fail strictly.

Do not label this trace deterministic or semantic. DOM/presentation input timing can validate the
real host path and produce review footage, but only a future registered semantic-input trace with
seed, checkpoints, one immutable input per fixed step, and divergence reporting can become replay
authority.

The operation must:

- start from a declared accepted build and runtime policy;
- record exact source-frame cadence and actual capture times/steps;
- preserve lossless canvas-only PNG frames as the motion master;
- create a WebM review derivative from those exact masters and record encoder/version/settings;
- emit a poster PNG and a bounded manifest;
- record dropped/late frames explicitly and reject a supposedly exact capture when declared limits
  are violated;
- sample available session/world/events/diagnostics/render reads before and after the sequence from
  coherent observations; and
- return only opaque evidence references and bounded safe metadata.

Initial repository ceilings must be constants with strict parsers and tests. They must be no larger
than 15 seconds, 300 master frames, 2560 by 1440 pixels, 2.0 DPR, 512 trace entries, and 256 MiB of
private artifacts per sequence. Implementers may choose lower measured limits. Do not enlarge them
inside this goal to accommodate an arbitrary demo.

Audio is fixed to `none` in version 1. Adding game-mix audio later requires a separate source,
consent, privacy, encoding, and synchronization contract.

### `get_render_evidence`

Reuse goal 01's authorized evidence store and the rendering roadmap's read name instead of adding
separate `list_captures` and `get_capture` tools.

Support exact evidence/artifact lookup and bounded metadata listing by development session, kind,
and creation sequence. Return MCP image content for authorized PNG artifacts and opaque resource
links for larger manifests, frame collections, and WebM derivatives. Do not add arbitrary path,
directory enumeration, range outside an owned artifact, or generic download parameters.

## Evidence manifest

Every successful frame or sequence must produce one immutable manifest referencing:

- development session, accepted build, runtime instance, project revision, and observation schema;
- capture capability revision, pinned browser/Playwright versions, sanitized WebGPU status, and
  declared target profile values actually observed;
- final-canvas source, drawing-buffer dimensions, DPR, color-space/transfer facts when known, and
  explicit `unknown` values otherwise;
- warm-up, start/end time, frame cadence, actual frame count, dropped/late frame counts, and
  applicable completed-step/state-digest ranges;
- presentation trace hash and entries artifact when used;
- available session/world/event/diagnostic/render evidence references with explicit gaps;
- every master/derivative artifact's role, MIME type, byte length, SHA-256, and retention state; and
- privacy attestation with `gameCanvasOnly: true`, `desktopPixelsPossible: false`, `audio: 'none'`,
  `reviewState: 'private-unreviewed'`, and no claim of content-aware pixel scanning.

Wall-clock receipt time may describe artifact creation, but it must not be presented as simulation
time or deterministic ordering. Unsupported environment, WebGPU, color, GPU-timing, or semantic
facts must be reported as unavailable rather than inferred.

## Lifecycle, authority, and privacy

- The CLI development service owns browser launch, runtime credential delivery, action brokering,
  artifact writes, retention, and cleanup. MCP, Studio, and human CLI commands adapt the same typed
  service and do not gain raw Playwright authority.
- Managed launch is a local process-execution and canvas-capture capability. The trusted host
  supplies principal and permission; callers cannot assert either in request JSON.
- Presentation input is permitted only in the managed capture runtime. It cannot target a person's
  browser, primary Studio interaction, another project, or an arbitrary origin.
- Browser profiles and temporary files use restrictive permissions and opaque internal locations.
  Normal results, errors, diagnostics, audit records, and manifests contain no username, hostname,
  home/workspace/temp absolute path, PID, terminal prompt, token, cookie, credential, or browser
  profile data.
- Capture only the exact registered game canvas. Playwright page screenshots, browser chrome,
  desktop/window capture, screen-recording APIs, microphone, system audio, clipboard, camera,
  notification, and unrelated-application access are absent from the normal path.
- Game-rendered pixels remain untrusted and may themselves contain personal or secret content.
  Evidence stays `private-unreviewed`; export, upload, Discord posting, website publication, and
  content-aware pixel approval remain outside this goal.
- Stop, timeout, browser crash, runtime replacement, changed build, encoder failure, client
  disconnect, and partial artifact failure must settle every pending action and apply goal 01's
  cleanup/retention rules. Never leave an orphan listener or browser process.

## Stable failures

Define bounded structured results for at least:

- `CAPTURE_RUNTIME_UNAVAILABLE`
- `CAPTURE_BROWSER_LAUNCH_FAILED`
- `CAPTURE_BROWSER_VERSION_MISMATCH`
- `CAPTURE_WEBGPU_UNAVAILABLE`
- `CAPTURE_EXTERNAL_NETWORK_BLOCKED`
- `CAPTURE_RUNTIME_BUSY`
- `CAPTURE_RUNTIME_TIMEOUT`
- `CAPTURE_RUNTIME_DISCONNECTED`
- `CAPTURE_BUILD_STALE`
- `CAPTURE_OBSERVATION_STALE`
- `CAPTURE_CANVAS_MISSING`
- `CAPTURE_DIMENSIONS_MISMATCH`
- `CAPTURE_TRACE_INVALID`
- `CAPTURE_STEP_UNAVAILABLE`
- `CAPTURE_LIMIT_EXCEEDED`
- `CAPTURE_DROPPED_FRAMES`
- `CAPTURE_ENCODER_UNAVAILABLE`
- `CAPTURE_ARTIFACT_FAILED`

Messages must be recovery-oriented and path-safe. Preserve lower-level details only in a bounded
private diagnostic when policy allows it; do not return raw browser, driver, or thrown messages.

## Required tests and evidence

Add regression and integration tests at existing ownership boundaries. At minimum, prove:

- reproduce today's no-external-browser capture failure before implementing managed launch;
- capability parsing is strict, immutable, bounded, versioned, and reports unsupported features
  honestly without launching a browser;
- an on-demand managed runtime starts from the exact manifest/build, reaches WebGPU-ready runtime
  publication, captures a frame, and cleans up without an external browser;
- pinned browser/version mismatch, unavailable WebGPU, startup timeout, crash, disconnect, changed
  build, and partial initialization produce stable failures and release all resources;
- a connected person's interactive runtime is never silently replaced, navigated, or driven;
- non-loopback navigation, requests, downloads, popups, permissions, and profile reuse are denied;
- `capture_frame` produces the exact canvas PNG dimensions/hash/bytes and actual observation while
  synthetic PII placed in terminal/browser chrome outside the canvas never enters the artifact;
- a canvas that intentionally renders synthetic email/path/token-like text remains
  `private-unreviewed` and is never misrepresented as content-safe;
- a bounded sequence preserves the expected number and order of lossless masters, produces a WebM
  derived from those masters, records codec/settings/cadence, and detects missing, late, duplicate,
  or dropped frames;
- presentation keys and pointer edges are delivered only to the managed canvas, normalized pointer
  bounds are enforced, zero-frame/catch-up behavior does not reuse one click as repeated presses,
  and completed-step waits fail when session inspection is unavailable;
- before/after session, world, event, diagnostic, and render evidence either agrees with the capture
  observation or declares the exact unavailable/incomplete reason;
- evidence lookup/listing cannot cross development sessions, forge an ID, escape the artifact
  store, enumerate arbitrary files, bypass retention, or return an absolute path/raw base64 JSON;
- simultaneous captures obey the one-writer/busy contract; duplicate idempotency retries do not
  create duplicate browsers or artifacts; and
- direct service, human CLI, HTTP/stdio MCP, and Studio-facing types agree on compatible contracts
  while all existing capture, session, point-light, build, and runtime tests remain green.

After automated verification, use the new Antiky MCP path - not OS capture - to collect private local
evidence from all three current slices:

- Starbreaker Circuit: idle defeat plus a bounded mark-to-dash interaction;
- Blackout Relay: relay charging, rejected deposit feedback, and a successful deposit;
- Gale Post / Skyline Relay: attract motion plus manual-authority takeover.

For each, retrieve at least one native-resolution PNG and one three-to-six-second motion sequence,
then correlate it with the available session/world/event/diagnostic/render state. Record only opaque
evidence IDs and sanitized metadata in the handoff. These demos validate the tooling; their visual
quality still requires an independent human review.

Run affected CLI, Framework boundary, Studio type/build, MCP adapter, documentation, demo build,
and repository checks. Use canvas-only inspection; never use OS, desktop, window, terminal,
microphone, or unrelated-application capture.

## Explicit non-goals

- Do not implement registered semantic input schemas, authoritative deterministic replay,
  checkpoints, save/load, rewind, divergence analysis, headless simulation, a general
  `ScenarioRunner`, sandboxes, leases, or change promotion.
- Do not add visual baselines, perceptual comparison, diff/heatmap generation, automatic aesthetic
  scoring, optical flow, GPU profiling, target-device certification, or release gating.
- Do not add audio recording, game-mix capture, voice, microphone, system audio, subtitles, or
  audiovisual synchronization.
- Do not add arbitrary browser navigation, selector/script evaluation, DOM inspection, cookie or
  storage access, downloads, extensions, a persistent profile, a general Playwright MCP proxy, or
  raw Chrome DevTools access.
- Do not add desktop, monitor, window, Studio, terminal, camera, clipboard, notification, or
  unrelated-application capture.
- Do not add a generic filesystem server, arbitrary path parameter, public artifact URL, upload,
  website/Discord publication, or content-aware pixel-privacy claim.
- Do not add render-graph, shader/material/resource, asset, scene, animation, UI, accessibility,
  performance, crash, release, or external-engine tooling.
- Do not redesign or polish the three games inside this tooling goal. Use resulting evidence to
  create separate, reviewable game changes.
- Do not add a generic asynchronous job framework merely to evade the declared sequence limits. If
  the bounded operation cannot finish reliably within the existing action lifecycle, stop with a
  failing fixture and write a separate job-lifecycle goal.
- Do not preserve or redesign the existing seed skills; they remain non-authoritative scaffolding.

## Engineering constraints

- Preserve Framework import boundaries: Framework core must not depend on Playwright, Chromium,
  CLI, MCP, Studio, Node, browser DOM, BroMetal, WebGPU, or a model provider.
- Keep managed-browser and artifact complexity below the CLI development-service boundary. The
  public interface should remain capability discovery plus three deep evidence operations, not a
  shallow wrapper over Playwright methods.
- Reuse goal 01's observation, artifact, retrieval, privacy-state, and cleanup contracts. Reuse goal
  02's query identities when present. Never copy or fork them into capture-specific variants.
- Prefer one real browser integration seam and integration tests at process/runtime/artifact
  boundaries. Mock Playwright only for stable failure injection that cannot be produced safely in a
  real browser test.
- Add a failing regression before fixing each reproduced bug. Keep bounds and error schemas in
  named, tested constants rather than prose-only promises.
- Log major lifecycle branches with correlation IDs and safe structured codes. Never log raw
  credentials, browser objects, untrusted console objects, or local paths in agent-facing output.
- Keep handwritten production files below 500 lines when practical; review cohesion above 500 and
  decompose before 800.
- Keep every incremental change working, make short one-line commits without coauthor tags, and
  preserve unrelated worktree changes.

## Completion definition

The goal is complete only when Antiky can launch its own isolated Playwright/WebGPU capture runtime
from a no-external-browser state; produce fenced, path-safe final-canvas still and motion evidence;
drive and record one bounded presentation trace; retrieve artifacts through the authorized opaque
boundary; clean up deterministically; and pass the successful, adversarial, privacy, compatibility,
and three-demo evidence cases above.

The final handoff must list contracts and adapters, pinned browser/tool versions, exact limits,
tests and results, sanitized capability/failure/evidence examples, commits, and remaining gaps. It
must state explicitly that presentation input is not deterministic semantic replay, WebM is a
review derivative rather than a byte-stable regression master, and private canvas evidence is not
automatically approved for publication.

Stop rather than broadening scope if the real game host cannot support a managed capture runtime
without replacing a connected person's runtime, if browser WebGPU cannot be made available through
a pinned supported launch path, or if sequence work requires a generic job/checkpoint architecture.
Preserve the failing fixture and write the smallest follow-up goal needed.
