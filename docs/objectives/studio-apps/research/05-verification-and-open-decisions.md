# Verification, evolution, and open decisions

This document compiles the evidence required to make an initial Studio app seam credible and lists
the decisions that remain with the owner. It is not an implementation plan.

Evidence labels are **Established**, **Claimed**, **Inferred**, and **Gap** as defined in
[`01-current-state-and-proving-cases.md`](01-current-state-and-proving-cases.md). The complete
verification analysis and source links are retained in
[`06-verification-limits.md`](subagent_outputs/06-verification-limits.md).

## Current evidence ceiling

**Established:** Studio has useful unit and boundary tests for project management, development
coordination, serialized native values, CLI cleanup, and pure split calculations. Most shell tests
use server-rendered markup, source assertions, CSS patterns, or pure functions. There is no current
browser UI harness that proves layout, focus, accessibility-tree, pointer, native-overlay, or visual
behavior in a running Studio workspace.

**Established:** Existing visual-regression tooling captures the game canvas only. It deliberately
excludes Studio chrome and the native terminal, so it cannot detect the design drift called out in
the objective.

**Inferred:** Types and SSR markup are supporting evidence, not proof of an app seam. Acceptance
needs a real built-in app mounted through the public seam in a browser while the current game
workspace remains observably intact.

## Risk-ranked evidence matrix

| Priority | Risk | Minimum useful evidence |
| --- | --- | --- |
| P0 | Contract and authority | Register one real app; reject invalid/duplicate identity; prove only declared services cross the seam and engine changes remain commands |
| P0 | Activation and disposal | StrictMode setup-cleanup-setup, repeated mount/unmount, no duplicate live resources, stale async fencing, exhaustive cleanup after one disposer fails |
| P0 | Project switch | Observable selected order for validation, old disposal, activation, publication, failure, rollback/degraded truth, and same-revision reopen |
| P0 | Error isolation | Invalid descriptor plus throwing registration, activation, render, callback, and disposal; current workspace and unrelated apps remain usable |
| P0 | GPU lifetime | Instrumented ownership ledger plus supported-browser smoke for configure, resize, loss, remount, errors, disposal, and selected root-device policy |
| P1 | Real integration | App selection, workspace mounting, interaction, Settings overlay, deactivation, remount, and native project switch in a browser/native smoke |
| P1 | Accessibility and input | Keyboard traversal, tab relationships, splitter alternatives, focus ownership, iframe/terminal escape, status announcements, and manual assistive-technology coverage |
| P1 | Responsive behavior | Both sides of 760 px, equivalent 320 CSS px, enlarged text/zoom, native minimum, reachable controls, meaningful order, and no destructive saved projection |
| P1 | Visual coherence | Owner-approved deterministic screenshots for launcher, game workspace, Settings, first apps, narrow, loading, failure, and recovery states |
| P1 | Diagnostics and recovery | Stable safe diagnostic identity/phase/context, cleanup failure accounting, recovery result, and one source readable by humans and agents |
| P1 | Compatibility | Every built-in app compiles against the current contract; persisted/external versions reject or migrate explicitly; stable IDs survive label changes |
| P2 | Performance and capacity | Instrument activation, switch, disposal, main-thread blocking, panel count, frame behavior, diagnostics, and GPU resources before choosing thresholds |

## Lifecycle and project-switch truth

**Established:** Current project selection calls the pre-switch hook before host activation and
publishes the new project only after activation succeeds. Existing tests prove callback invocation
and retention of the prior project after invalid input; they do not prove that already-disposed old
resources remain operational if later activation fails.

**Inferred high risk:** A UI that still names the old project after its terminal/apps/resources were
closed is not a successful rollback. The app lifecycle must make the actual operational state
truthful, even if the selected policy is an explicit degraded state rather than rollback.

**Established:** Studio runs React `StrictMode`, so development performs an extra Effect
setup/cleanup cycle. Verification should assert one live registration/resource after the cycle,
not freeze a particular development call count.

## Compatibility and evolution posture

1. **Established:** Typed values are appropriate inside one trusted process; serialization belongs
   at real process, worker, network, storage, import/export, or trust boundaries.
2. **Inferred:** While Studio and all built-in apps ship together, lockstep compilation and
   integration tests are enough. Marketplace-style semantic-version negotiation is not justified.
3. **Inferred:** Add `schemaVersion` when layout/app state becomes durable or contributions cross an
   independently deployed boundary. Unsupported versions fail explicitly.
4. **Inferred:** Persist stable app and contribution identity, not labels, React positions, or
   activation-instance IDs.
5. **Inferred:** Add capabilities only when a proving app requires them; optional capability absence
   must have defined behavior.
6. **Inferred:** Compatibility tests should assert meaning and behavior, not frozen prose, JSX
   source, key order, or incidental CSS syntax.

## Diagnostic minimum

Current CLI diagnostics provide a useful established precedent: stable code and severity, explicit
component/source, schema version, correlation identity, bounded safe messages, and a sink whose
failure cannot alter the lifecycle operation.

**Inferred:** App diagnostics need at least lifecycle phase, stable app/contribution identity,
project identity and revision when applicable, temporary activation identity, related session or
action identity, cleanup failure count, and recovery outcome. Repeated errors need bounded retention
or deduplication, but there is no evidence for a numeric limit yet.

**Gap:** Activity currently has no app diagnostic source. Whether Studio owns that stream or the
CLI development authority transports it is unresolved. Humans and agents should read the same
structured source rather than separate interpretations.

## Existing numbers are not app budgets

The repository has established limits for the current shell, project bridge, polling, capture, and
Antiky Town visual evidence. They retain their narrow scopes:

- shell minimum 320 CSS px and narrow breakpoint 760 px;
- native window minimum 720×680 and initial 1440×900;
- current split defaults/ranges and 2-point keyboard adjustment;
- terminal geometry bounds;
- coordinator polling and stale-state thresholds;
- native worker message/start/stop limits;
- development-client and evidence-capture limits; and
- one owner-approved Antiky Town image metric.

**Inferred:** None establishes an app activation deadline, panel capacity, main-thread budget,
memory/GPU ceiling, diagnostic retention count, or Studio screenshot tolerance. Those values need
instrumented prototypes and repeated measurements.

## Claims that require a prototype

- A registry can host a genuinely different app without changing the game workspace's behavior or
  appearance.
- A surface boundary can isolate render, Effect, event, promise, and disposal failures.
- Project switching can recover or remain truthful after old resources are closed and new
  activation fails.
- A viewport can implement the selected device policy, survive loss, and dispose without affecting
  unrelated surfaces.
- The selected layout behaves with the native terminal, iframe, zoom/reflow, keyboard, assistive
  technology, and GPU panels.
- Owner-approved screenshots can distinguish design drift from platform/font variance.
- App diagnostics can serve both humans and agents without becoming a second engine or project
  authority.
- Any proposed performance, capacity, memory, or screenshot threshold is appropriate.

Web Platform Tests and the WebGPU CTS can establish browser-platform conformance. They do not prove
Antiky's ownership, lifecycle, integration, recovery, or design behavior; application evidence is
still required.

## Consolidated owner decisions

These choices must be answered before `create-plan` can produce honest goals:

1. **First apps:** Which named apps should prove the seam? Is the voxel idea one of them, what is
   its smallest useful workflow, and which no-GPU utility is the independent second case?
2. **Game editor relationship:** Does the current game workspace eventually become an app, coexist
   with apps as core Studio, or remain an inviolable built-in app? Which of its four surfaces may a
   user hide, move, close, or replace?
3. **Customization ceiling:** Does version 1 need resizing, tabs, show/hide, arbitrary docking,
   maximize, floating panes, or popouts?
4. **Layout state:** Is arrangement global, per app, per project, or per app and project? What
   happens when a new app version adds a panel?
5. **App provenance:** Are version-1 apps compiled and trusted only? May projects contribute
   validated descriptors? Is executable project-local code explicitly deferred or required?
6. **Activation policy:** Are apps eager, selected on demand, or contribution-triggered? Can users
   disable them? May an app be required and veto project opening?
7. **Host capabilities:** Is Terminal global, a singleton app capability, or game-editor-only? Must
   any app work without an open project?
8. **Viewport policy:** Which hosting/device option should be prototyped first, and must version 1
   support both continuous and invalidate/progressive rendering?
9. **Accessibility/design:** Is WCAG 2.2 AA the explicit baseline? Should Settings remain a true
   modal? Which shell states require owner-approved visual references?
10. **Durable boundaries:** Should app discovery, permissions, layout persistence, or app state
    enter `.antiky` now? Any such change needs explicit schema and likely ADR work.
11. **Diagnostics:** Should app lifecycle diagnostics remain Studio-local or join the shared
    development observation stream used by humans and agents?

## Evidence limitation

No code was changed in this research phase, so no new code test was required. One raw researcher
attempted the existing Studio test command, but this checkout has no installed `vitest` binary; the
command exited 127. That is an environment limitation, not evidence that checked-in tests fail.
