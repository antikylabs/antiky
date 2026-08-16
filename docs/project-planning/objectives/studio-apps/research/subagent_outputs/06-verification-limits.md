# Verification, evolution, and operational limits

## Findings

- **Claimed.** The objective asks for composable, mountable panels, terminal and WebGPU surfaces, plus app-defined workspace configuration. None of this is demonstrated yet (`docs/objectives/studio-apps/objective.md:31-33`).

- **Established.** Studio has no extension registration seam. `PanelProps.workspaceArea` is a fixed four-value union (`packages/studio/app/src/components/primitives.tsx:3-9`), and `StudioShell` directly mounts the game, terminal, inspection, and activity surfaces (`packages/studio/app/src/components/StudioShell.tsx:290-360`).

- **Established.** Studio UI tests run Vitest without a browser configuration or browser-testing dependency (`packages/studio/app/package.json:6-11`, `packages/studio/app/package.json:22-28`, `packages/studio/app/vite.config.ts:1-10`). Existing shell evidence is primarily server-rendered HTML, source text, CSS regexes, and pure layout functions (`packages/studio/app/tests/components/StudioShell.test.tsx:181-224`, `packages/studio/app/tests/components/StudioShell.test.tsx:284-293`, `packages/studio/app/tests/components/workspaceLayout.test.ts:11-34`). It does not prove layout, focus, accessibility-tree, pointer, native-overlay, or visual behavior in a running browser.

- **Inferred.** A first extension seam is not verified by type tests alone. It needs one actual built-in app mounted through the seam in a browser while the current game workspace remains observably unchanged. This follows the repository preference for working proofs and integration tests at system cut-points (`docs/GOOD_ENGINEERING_H.md:12-16`, `docs/GOOD_ENGINEERING_H.md:57-61`).

- **Established.** Current project switching validates a prospective project, awaits `beforeProjectSwitch`, activates it in the host, and only then publishes it (`packages/studio/app/src/editor/projectManager.ts:111-140`). Its test counts switch callbacks and retains the prior project after invalid input (`packages/studio/app/tests/editor/projectManager.test.ts:92-146`), but does not prove extension disposal order, failed-disposal behavior, rollback, or reactivation of the prior project.

- **Inferred, high risk.** If old resources are disposed and new host activation then fails, the current manager retains the old project in state even though some old resources may already be closed. Extension verification must therefore prove a truthful failure state or a real rollback; “old project still named in state” is insufficient evidence that it remains operational.

- **Established.** Studio runs its entire React tree under `StrictMode` (`packages/studio/app/src/main.tsx:49-58`). React performs an additional setup/cleanup cycle for Effects during development, so lifecycle verification must prove no duplicate live registrations, listeners, workers, frame loops, terminals, or GPU resources after `setup → cleanup → setup`, rather than freezing an exact development call count. [React StrictMode](https://react.dev/reference/react/StrictMode).

- **Established.** Strong lifecycle precedents already exist outside an extension seam:

  - Native terminal setup removes listeners, observers, animation frames, and closes its host resource (`packages/studio/app/src/NativeTerminal.tsx:111-212`), although its teardown tests inspect source instead of executing Effects (`packages/studio/app/tests/NativeTerminal.test.ts:67-81`, `packages/studio/app/tests/NativeTerminal.test.ts:109-116`).
  - The CLI attempts every cleanup operation with `Promise.allSettled`, reports each failure, and returns a failure count (`packages/cli/src/host/session.ts:540-609`; exercised at `packages/cli/tests/development-session.test.ts:766-825`).
  - The native development host stops before replacement, clears all stored state, supports repeated stop, and kills the child on drop (`packages/studio/tauri/src/development.rs:236-344`; real worker test at `packages/studio/tauri/src/development.rs:357-404`).

- **Inferred.** The reusable lifecycle property is idempotent cleanup with complete cleanup attempts and explicit failure reporting. Exact cleanup ordering and failure recovery still depend on the extension contract and require a prototype.

- **Established.** Studio’s current accessibility evidence is incomplete:

  - The “keyboard order” test compares substring positions in server-rendered HTML, not focus movement (`packages/studio/app/tests/components/StudioShell.test.tsx:512-535`).
  - Tabs give only the active tab `tabIndex=0`, give inactive tabs `-1`, and have no arrow-key handler or tabpanel relationships (`packages/studio/app/src/components/primitives.tsx:37-65`).
  - Splitters expose role, orientation, values, labels, pointer drag, arrow keys, and Home reset (`packages/studio/app/src/components/StudioShell.tsx:362-401`), but no `aria-controls` or Enter collapse behavior.
  - Focus outlines exist in CSS (`packages/studio/app/src/styles.css:48-57`), but no browser test proves visibility, focus order, or freedom from a keyboard trap.

- **Inferred.** Inactive tabs currently have no implemented keyboard route. The WAI-ARIA tabs pattern expects arrow navigation, activation with Space/Enter, and tab-to-tabpanel relationships. The pattern is informative rather than normative, but WCAG’s keyboard, focus-order, name/role/value, and focus-visible requirements are normative. [Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [APG status](https://www.w3.org/WAI/ARIA/apg/about/introduction/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/#keyboard).

- **Inferred.** Keyboard resizing does not by itself prove WCAG 2.5.7’s requirement for a single-pointer alternative to dragging. Whether panel resizing needs another pointer mechanism or qualifies for an exception needs interaction review. The APG splitter guidance is also explicitly incomplete and should not be treated as a conformance certificate. [WCAG Dragging Movements](https://www.w3.org/TR/WCAG22/#dragging-movements), [Window Splitter pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/).

- **Established.** Studio has a 760 CSS-pixel narrow breakpoint and a 320-pixel document minimum (`packages/studio/app/src/responsive.css:1-59`, `packages/studio/app/src/styles.css:29-35`). The native window minimum is 720×680, and its test proves only that the 760-pixel breakpoint is reachable (`packages/studio/tauri/tauri.conf.json:13-25`, `packages/studio/tauri/tests/tauri-config.test.mjs:126-132`). No test renders at these dimensions. WCAG reflow requires content at an equivalent width of 320 CSS pixels without two-dimensional scrolling, except content whose meaning requires a two-dimensional layout. [WCAG Reflow](https://www.w3.org/TR/WCAG22/#reflow).

- **Established.** Existing visual regression machinery captures only the game canvas and deliberately excludes browser chrome, desktop, and terminal pixels (`scripts/shoot-demos.mjs:1-14`, `docs/user-facing-docs/mcp/tools.md:305-318`). It cannot detect Studio design drift.

- **Established.** The demo visual budgets provide a useful evidence discipline: metrics are bound to a source digest, and thresholds were adjusted only after owner review and repeated captures quantified variation (`packages/demos/antiky/antiky-town/tests/visual-budget.test.mjs:21-35`, `packages/demos/antiky/antiky-town/tests/visual-budget.test.mjs:43-73`). Those numerical thresholds describe Antiky Town pixels and cannot be reused for Studio chrome.

- **Inferred.** Studio design-drift evidence needs deterministic full-shell screenshots at owner-approved reference states and viewports. A visual threshold is unjustified until repeated captures identify variance. Structural or accessibility assertions should cover behavior; screenshot evidence should cover appearance. Source-string, frozen copy, and exact CSS-text assertions do not substitute for either. WPT distinguishes API tests, rendering reftests, visual tests, and manual tests for behavior that cannot be automated. [WPT test types](https://web-platform-tests.org/writing-tests/).

- **Established.** Existing boundary validation rejects incompatible and oversized values:

  - Native project records use exact keys, schema version 1, bounded strings, and a 64 KiB source limit (`packages/studio/app/src/editor/tauriHost.ts:20-90`; tests at `packages/studio/app/tests/editor/tauriHost.test.ts:22-65`).
  - Native development connections require an exact loopback shape and serialized lifecycle commands (`packages/studio/app/src/development/native.ts:23-108`; tests at `packages/studio/app/tests/development/native.test.ts:14-65`).
  - Browser messages reject unauthorized, wrong-origin, malformed, oversized, stale, and semantically invalid data (`packages/cli/tests/development-session.test.ts:1541-1648`).

- **Inferred.** An internal, compiled contribution should remain a typed in-process value rather than being serialized merely to imitate a plugin protocol. Runtime registration must still reject minimum-invalid states such as missing IDs, duplicate IDs, unsupported contribution kinds, and throwing factories. Exact-key rejection is justified only at a real serialized or trust boundary (`docs/adr/framework/0010-serialize-at-boundaries_H.md:18-48`).

- **Established.** CLI diagnostics already use stable codes, levels, components, correlation IDs, and schema version 1; failure of the diagnostic sink cannot change the lifecycle operation (`packages/cli/src/host/diagnostics.ts:1-65`). Safe-error tests prove raw credentials and thrown messages do not leak (`packages/cli/tests/cli.test.ts:344-367`, `packages/cli/tests/development-session.test.ts:1475-1538`).

- **Established.** Studio’s Activity view currently combines CLI and Framework diagnostics with one Studio issue; it has no extension/app diagnostic source (`packages/studio/app/src/components/ActivityPanel.tsx:122-150`).

- **Inferred.** Extension diagnostics need a single structured source that both the human Activity view and agent-facing inspection can read. Whether that source is Studio-local or enters the CLI-owned development snapshot is an unresolved ownership decision; adding a second engine or project authority would conflict with accepted Studio/CLI boundaries (`docs/adr/studio/0006-use-cli-project-services-directly_H.md:24-56`).

- **Established.** Current compatibility practice versions real boundaries explicitly. Development snapshots have v1 and v2 shapes, and the v2 parser deliberately reuses validated v1 semantics before adding observation data (`packages/cli/src/development/types.ts:18-99`, `packages/cli/src/development/browser-client.ts:122-159`). Project schema changes require a new version and migration rules (`docs/adr/cli/0003-make-cli-project-services-the-development-authority_H.md:37-38`, `docs/adr/cli/0003-make-cli-project-services-the-development-authority_H.md:64-72`).

- **Inferred.** A built-in, lockstep extension API does not yet justify marketplace-style semantic-version negotiation. Version only serialized workspace state, persisted app state, or a later independently deployed boundary.

## Risk-ranked verification matrix

P0 means a failure can corrupt lifecycle or authority, leak resources, or take down the shell. P1 means a critical workflow, accessibility, recovery, or visual contract can fail. P2 means capacity or evolution can degrade without immediate corruption.

| Risk | Surface | Evidence required from a first internal seam | Current evidence | Missing or prototype-dependent |
| --- | --- | --- | --- | --- |
| P0 | Contract and authority | Register one real built-in app through the public seam; reject duplicate/missing IDs and unsupported kinds; prove panels receive only declared services and mutations use shared commands; prove no direct Tauri, process, authoritative world, renderer-object, or GPU-handle access | Current panels are hard-coded (`primitives.tsx:3-9`; `StudioShell.tsx:290-360`). Accepted architecture requires read-only panels whose controls send commands (`docs/architecture/studio/overview_A.md:227-245`, `docs/architecture/studio/overview_A.md:404-415`) | **Claimed:** no registry, capability contract, import boundary, or real consumer exists |
| P0 | Activation and disposal | Under StrictMode and repeated mount/unmount, assert one live instance, no post-disposal callbacks, reusable cleanup, and complete cleanup attempts when one disposer fails | StrictMode is enabled (`main.tsx:49-58`); native terminal contains real cleanup (`NativeTerminal.tsx:111-212`); CLI cleanup is all-settled (`session.ts:540-609`) | **Claimed:** no extension activation/disposal contract; **prototype required** for actual React Effects, workers, RAF, observers, and async cancellation |
| P0 | Project switch | Record the selected lifecycle sequence for changed revision, same-project reopen, failed next activation, failed old disposal, repeated switch, and app-global versus project-scoped contributions; the displayed active state must match live resources | Validation/switch/activation sequence exists (`projectManager.ts:111-140`); current test only counts callback invocations (`projectManager.test.ts:92-146`) | **Claimed:** no extension teardown/reactivation or rollback evidence; current retained-project state can become misleading after partial teardown |
| P0 | Malformed contribution and error isolation | Inject invalid descriptors through `unknown`; exercise duplicate IDs, throwing registration/activation/render/disposal, rejected async callbacks, and partial activation; one failure must leave shell, game workspace, and unrelated apps usable; fallback and retry must be accessible; cleanup must still run | Strict native and network boundary tests plus safe failure/cleanup precedents (`tauriHost.test.ts:22-80`; `development-session.test.ts:703-731`, `development-session.test.ts:766-825`) | **Claimed:** no panel isolation boundary or recovery state; **prototype required** because render boundaries do not catch every Effect, event-handler, or promise failure |
| P0 | GPU/resource lifetime | Use an instrumented resource ledger for deterministic ownership assertions and a real supported browser/GPU smoke test for configure, resize, repeated mount/switch/dispose, error scopes, uncaptured errors, and device loss. Destroy or retain a device according to the selected owner; unconfigure an owned canvas on disposal | Studio currently embeds a game iframe but owns no reusable GPU viewport (`LiveGameFrame.tsx:6-20`). Renderer resources belong to the game module/driver (`docs/adr/studio/0007-framework-first-allow-others_H.md:38-56`) | **Claimed:** device-sharing model and viewport owner are unresolved. Real leak, device-loss, and recovery behavior needs hardware/browser prototypes |
| P1 | Real integration | Drive the first app through registration, workspace selection, interaction, deactivation, remount, settings overlay, and native project switch in a running browser; include a native smoke where terminal/webview behavior matters | Current connected shell and settings behavior are asserted only through SSR markup (`StudioShell.test.tsx:258-282`, `StudioShell.test.tsx:342-378`) | **Claimed:** no browser UI harness or native end-to-end extension path |
| P1 | Keyboard, focus, semantics, and input owner | Run Tab/Shift-Tab and widget keys; validate accessibility-tree relationships; prove no iframe/terminal trap; prove only the focused panel receives commands; announce activation, error, and recovery state without stealing focus; include manual assistive-technology coverage for the supported native platform | Static separator semantics and focus CSS exist (`StudioShell.test.tsx:207-224`; `styles.css:48-57`). Tabs lack arrow navigation and tabpanel association (`primitives.tsx:37-65`) | **Inferred defect:** inactive tabs are not keyboard reachable. **Claimed:** no real focus, screen-reader, input-owner, or status-announcement evidence |
| P1 | Responsive/reflow | Render on both sides of 760 px, at an equivalent 320 CSS-pixel width, with text enlargement and native minimum size; assert nonessential chrome has no two-dimensional scroll, all controls remain reachable, focus is not obscured, panel order remains meaningful, and essential canvas exceptions are bounded | Static 760 px stacking and 320 px minimum (`responsive.css:1-59`; `styles.css:29-35`); native minimum reaches only the breakpoint (`tauri.conf.json:13-25`) | **Claimed:** no computed overflow, zoom, clipping, focus, terminal-overlay, or real responsive evidence |
| P1 | Visual design drift | Capture deterministic, full-shell states for main workspace, Settings, launcher/project page, first app, narrow layout, loading, failure, and recovery. Bind baselines to source and require owner approval before selecting a diff tolerance | Existing shell tests freeze CSS text (`StudioShell.test.tsx:181-224`, `StudioShell.test.tsx:284-293`); game visual metrics use source-bound, owner-reviewed evidence (`antiky-town/tests/visual-budget.test.mjs:21-73`) | **Claimed:** no Studio screenshots or reference states; current capture deliberately excludes Studio chrome |
| P1 | Diagnostics and recovery | Assert stable code/severity/phase, app and contribution identity, project revision, activation/correlation identity, bounded safe message, recovery action/result, and cleanup-failure count. A broken diagnostic sink must not alter lifecycle. Human and agent views must agree | CLI diagnostic structure and isolation (`diagnostics.ts:1-65`); Activity has no app source (`ActivityPanel.tsx:122-150`) | **Claimed:** extension codes, source ownership, retention, deduplication, and agent-readable path are undecided |
| P1 | Compatibility and evolution | Compile every built-in app against the current contract; reject unsupported persisted versions explicitly; test any old-state migration into current semantic state; preserve stable contribution identity through label changes; prevent temporary activation IDs from entering durable layout state | Explicit v1/v2 development parsing (`types.ts:18-99`; `browser-client.ts:122-159`) and stable-versus-runtime identity precedent (`docs/adr/framework/0011-stable-ids-and-runtime-aliases_H.md:21-42`) | **Claimed:** no extension-state schema, compatibility promise, stable ID format, or migration corpus |
| P2 | Performance and capacity | Instrument cold/warm activation, switch/disposal, main-thread blocking, rendered panel count, frame behavior, diagnostic growth, and owned GPU-resource counts under a named fixture and environment. Establish distributions before approving thresholds | Existing measurements belong to project services and capture, not apps (`types.ts:85-89`; `capture-capabilities.ts:3-75`) | **Unverifiable:** no app count, panel count, activation time, disposal time, frame-time, memory, GPU-memory, or visual-diff budget exists |

## Existing measured values and their limits

These are established values, not automatic budgets for extensions.

| Existing value | Evidence | Valid scope |
| --- | --- | --- |
| CSS minimum width 320 px; narrow layout at 760 px | `packages/studio/app/src/styles.css:29-35`; `packages/studio/app/src/responsive.css:1-59` | Current browser shell |
| Native window minimum 720×680; initial 1440×900 | `packages/studio/tauri/tauri.conf.json:13-25` | Current Tauri window |
| Workspace defaults: column 69%, row 64%; column limits 25–80%, row 25–75%; keyboard step 2 percentage points | `packages/studio/app/src/components/workspaceLayout.ts:10-18`, `packages/studio/app/src/components/workspaceLayout.ts:38-49` | Current fixed four-panel workspace |
| Native terminal minimum 80×40 CSS px; geometry maximum 16,384 | `packages/studio/app/src/NativeTerminal.tsx:23-25`, `packages/studio/app/src/NativeTerminal.tsx:46-89` | Native terminal bridge only |
| Studio polling default 1,000 ms; accepted 250–60,000 ms; stale/disconnected after three consecutive failures | `packages/studio/app/src/development/coordinator.ts:60-60`, `packages/studio/app/src/development/coordinator.ts:98-107`, `packages/studio/app/src/development/coordinator.ts:170-207` | Development-session discovery only |
| Native worker response 8 KiB; startup 15 s; graceful stop 5 s | `packages/studio/tauri/src/development.rs:17-19`, `packages/studio/tauri/src/development.rs:101-147` | Project-service process bridge only |
| Development client snapshot timeout 2 s; action timeout 30 s; configured range 1–60,000 ms | `packages/cli/src/development/browser-client.ts:71-72`, `packages/cli/src/development/browser-client.ts:177-183` | Loopback inspection client only |
| Capture maximum 6 s, 30 FPS, 180 frames, 512 trace entries, 256 MiB, 32 retained evidence items | `packages/cli/src/development/capture-capabilities.ts:3-11`, `packages/cli/src/development/capture-capabilities.ts:50-62` | Canvas evidence capture only |
| Antiky Town local-contrast floor 7.5 after repeated 7.75–7.79 captures with about ±0.04 variation | `packages/demos/antiky/antiky-town/tests/visual-budget.test.mjs:21-35` | Owner-approved Antiky Town frame only; not Studio |

**Inferred.** None of these values establishes an extension activation deadline, panel capacity, frame-time target, diagnostic retention count, memory ceiling, GPU budget, or screenshot-difference tolerance. Repository guidance requires profiling before optimization (`docs/GOOD_ENGINEERING_H.md:85-88`).

## Compatibility and evolution rules

1. **Established rule:** Keep the first built-in contribution typed and in-process. Do not add JSON, a manifest protocol, or runtime version negotiation without a real process, trust, import/export, or durable-storage boundary (`docs/adr/framework/0010-serialize-at-boundaries_H.md:18-48`).

2. **Inferred rule:** Compile and integration-test every built-in app against the same registry contract. Lockstep source compatibility is sufficient while Studio and all apps ship together.

3. **Inferred rule:** Introduce `schemaVersion` only for persisted workspace/app state or a later external contribution boundary. Unsupported versions must fail with a stable diagnostic rather than being silently coerced or partially loaded.

4. **Established constraint:** Current exact-key validators reject additive fields within an existing version (`packages/studio/app/src/editor/tauriHost.ts:29-35`, `packages/studio/app/tests/editor/tauriHost.test.ts:51-65`). Therefore, if extension state copies this policy, adding a field is not automatically backward compatible; version dispatch and migration must be explicit.

5. **Inferred rule:** Persist stable app and contribution identities, not display labels or activation-instance IDs. A label rename must not silently discard a saved layout. The exact ID format is unresolved; the framework’s UUIDv7 rule should not be applied automatically to app IDs without an ownership decision.

6. **Inferred rule:** Add capabilities only when a real app requires them. A required capability change must update every built-in consumer and its integration evidence; optional capabilities must have an explicit absent behavior.

7. **Inferred rule:** Compatibility tests should assert meaning and behavior, not frozen interface prose, serialized key order, JSX source text, or incidental CSS spelling.

## Diagnostic rules

- **Established precedent:** Stable code and severity, explicit component/source, schema version, and relevant correlation IDs (`packages/cli/src/host/diagnostics.ts:1-51`).
- **Inferred minimum extension context:** lifecycle phase, stable app ID, contribution/panel ID, project identity and revision when applicable, temporary activation instance ID, related development/runtime/action IDs, and recovery outcome.
- **Established precedent:** A diagnostic sink failure must not alter registration, activation, disposal, or project switching (`packages/cli/src/host/diagnostics.ts:57-65`).
- **Established precedent:** Public messages must be bounded and must not expose raw thrown text, credentials, paths, payloads, or process details (`packages/cli/tests/cli.test.ts:344-367`; `packages/cli/tests/development-session.test.ts:1475-1538`).
- **Inferred rule:** Report each failed cleanup owner plus a summary count, while still attempting independent cleanup.
- **Inferred rule:** Repeated render or polling failures need bounded retention or deduplication. No current evidence justifies a retention number.
- **Inferred rule:** Activation, error, degraded, disposed, and recovered states need accessible status semantics where users must be notified without moving focus. [WCAG Status Messages](https://www.w3.org/TR/WCAG22/#status-messages).
- **Unresolved:** Whether Studio owns an app-diagnostic stream or whether the CLI development authority transports it. The current Activity panel cannot display app-specific diagnostics without a new source.

## Platform and conformance boundary

- **Established.** WPT is the cross-browser Web Platform test suite, with canonical sources and regularly collected browser results. Application tests should rely on it for browser primitives and test Antiky’s integration behavior rather than reimplementing platform conformance. [Web Platform Tests](https://web-platform-tests.org/).

- **Established.** The WebGPU CTS is the normative WebGPU conformance suite and can run standalone or in WPT. Antiky still needs tests for its own resource ownership, lifecycle, diagnostics, and recovery because the CTS does not know Antiky’s app contract. [WebGPU CTS](https://github.com/gpuweb/cts).

- **Established.** WebGPU exposes device-loss, error-scope, uncaptured-error, explicit-destroy, and canvas-unconfigure lifecycle surfaces. Predictable resource release should use explicit lifecycle operations rather than garbage collection. [WebGPU specification](https://www.w3.org/TR/webgpu/).

- **Claimed, prototype required.** Passing a mock-resource ledger cannot prove driver stability, memory behavior, device-loss recovery, or multi-canvas behavior on the supported WebView/GPU combinations. Conversely, GPU hardware tests alone cannot deterministically prove every owned disposer ran. Both forms of evidence are needed once viewport ownership is selected.

## Claims requiring a real prototype

- **Claimed:** A registry can mount a genuinely different first app without changing the current game workspace’s behavior or appearance.
- **Claimed:** A panel-local error boundary and lifecycle wrapper can isolate render, Effect, event-handler, promise, and disposal failures without leaving partial resources.
- **Claimed:** Project switching can remain truthful and recoverable after old-app disposal succeeds but new-project activation fails.
- **Claimed:** A reusable WebGPU viewport can choose shared or per-app device ownership, survive device loss, and dispose without disturbing another viewport.
- **Claimed:** Studio has acceptable activation, switch, disposal, panel-count, main-thread, memory, and GPU limits. No measurements exist.
- **Claimed:** A screenshot threshold can detect meaningful design drift without producing platform/font noise. It needs repeated captures and owner-approved references.
- **Claimed:** Current and contributed tabs, splitters, terminal, iframe, overlays, and panel controls are usable with the supported keyboard and assistive-technology combinations.
- **Claimed:** The 320-equivalent browser layout and 720-pixel native window remain usable once contributed panels and a native terminal overlay are present.
- **Claimed:** Extension diagnostics can be made equally legible to humans and agents without creating a second project or engine authority.

## Gaps

- No registry, contribution type, lifecycle scope, capability surface, or first app exists.
- No Studio browser UI runner, accessibility-tree audit, screenshot baseline, or native end-to-end extension test exists.
- No extension activation, disposal, cancellation, error-isolation, or recovery policy exists.
- No project-switch rollback policy exists for resources already disposed before a later failure.
- No reusable Studio WebGPU viewport or device-loss path exists.
- No extension diagnostic source, error-code vocabulary, retention policy, or agent-facing query exists.
- No persisted extension/workspace-state schema or compatibility promise exists.
- No supported browser, native WebView, operating-system, assistive-technology, or GPU test matrix is recorded.
- No owner-approved Studio visual references or diff tolerance exist.
- No extension performance baseline or capacity limit exists.
- Current tabs lack a demonstrated keyboard path to inactive tabs.
- Current splitter behavior has not been assessed against the single-pointer alternative to dragging.
- The local command `npm test --workspace @antiky/studio-app` could not execute in this checkout because `vitest` is not installed (`sh: vitest: command not found`, exit 127). This is an environment limitation, not evidence that the checked-in tests fail.

## Planning implications

- Acceptance of the seam must include a real built-in consumer in a running browser; types and SSR markup are supporting evidence only.
- The current game workspace needs a behavioral, accessibility, and owner-approved visual baseline before its fixed composition is moved behind a registry.
- Lifecycle, project-switch truthfulness, malformed input, isolation, diagnostics, and disposal belong in the seam’s acceptance evidence, not deferred hardening.
- Internal lockstep contributions need minimal compatibility machinery. Versioning becomes necessary only when persisted or externally transported state appears.
- Performance and GPU thresholds must follow instrumented prototypes; existing polling, transport, capture, and demo constants must retain their current narrow scopes.
- A generic panel system cannot be described as accessible while the shared Tabs component lacks real keyboard navigation and while focus/input ownership is only inferred from markup.
- Visual tests should compare rendered, deterministic UI states and owner-approved references. New tests should not freeze copy, source text, or incidental CSS syntax.
