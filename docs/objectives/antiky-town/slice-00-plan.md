# Slice 00: Development Harness and Minimum Inspection

## Control block

| Field | Value |
| --- | --- |
| Status | `NOT READY` |
| Owner | Antiky project owner |
| Plan approver | Antiky project owner |
| Selected option | `0A + C1 + 0P-A + 0T-A` — recommended, not approved |
| Selection state | `PROPOSED` |
| Depends on | `NONE` |
| Framework alignment date | 2026-08-04 |
| Framework alignment revision | `79a5de6cabb7f9a9db63eb565c38f3c3a11d77cd` |
| Evidence revision | `PENDING` |
| Complete verification command | `npm run verify:slice-00` |
| Run state | `NOT STARTED` |
| Evidence receipt format | `antiky.slice-receipt/v1` |
| Evidence receipt path | `docs/objectives/antiky-town/evidence/slice-00/{runId}/receipt.json` |

This plan is ready for review. Implementation is not ready. The project owner must approve the
host, configuration, package placement, and runtime-bridge choices. The readiness table names the
remaining baseline, dependency, browser, client, and run-setup work.

After every readiness gate passes, use:

```text
/goal implement docs/objectives/antiky-town/slice-00-plan.md until complete
```

The goal must build the receipt bootstrap before other implementation work. It must not add the
world model, entity model, game commands, or renderer abstractions that belong to later slices.

## Required reading

| Document or source | Why it controls this slice |
| --- | --- |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines the shared gates, run rules, evidence rules, and rubric |
| [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) | Defines the required plan sections and matrices |
| [`DEV_HARNESS_RESEARCH_A.md`](DEV_HARNESS_RESEARCH_A.md) | Defines the researched host, inspection, reload, MCP, and GPU-tool boundary |
| [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md) | Defines the Slice 0 outcome, options, and evidence requirements |
| [`Antiky Town README`](../../../packages/demos/src/demos/antiky-town/README.md) | Defines demo ownership and the reference relationship |
| [`scripts/dev.mjs`](../../../scripts/dev.mjs) | Contains the current root development dispatcher |
| [`packages/demos/scripts/dev.mjs`](../../../packages/demos/scripts/dev.mjs) | Contains the current demo slug validation and host launch |
| [`LiveDemoStage.tsx`](../../../packages/demos/src/react/LiveDemoStage.tsx) | Owns the current browser runtime, phase, render loop, statistics, and disposal |
| [`packages/demos/src/runtime.ts`](../../../packages/demos/src/runtime.ts) | Defines the current demo host contract and render statistics |
| [`GOOD_ENGINEERING_H.md`](../../GOOD_ENGINEERING_H.md) | Requires small changes, deep modules, strategic tests, logging, and least privilege |
| [`framework/overview_A.md`](../../architecture/framework/overview_A.md) | Keeps hosts and protocol adapters outside framework core |
| [`protocols-and-serialization_A.md`](../../architecture/framework/protocols-and-serialization_A.md) | Requires runtime validation at encoded and local network boundaries |
| [`ADR 0003`](../../adr/framework/0003-agent-native_H.md) | Requires agent tools to use stable engine services instead of UI simulation |
| [`ADR 0010`](../../adr/framework/0010-serialize-at-boundaries_H.md) | Requires JSON at MCP, diagnostic, and process boundaries |
| [Official MCP TypeScript server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) | Defines the supported SDK server and transport patterns to pin and test |
| [`webgpu_inspector`](https://github.com/brendan-duncan/webgpu_inspector) | Defines the optional low-level WebGPU investigation tool and its limits |

## Goal

### Outcome

One command starts the current town in an isolated local development session, reports its build and
runtime state through versioned inspection, supports controlled reload and frame capture, and stops
all owned resources safely.

### Why this slice exists

Later slices need a reliable way to run, inspect, test, capture, and recover the game. The current
host can render the town, but its state is available only through the page and React state. This
slice makes the development loop observable before the framework owns game state.

This slice also supplies the base run receipt used by every later slice. It does not make delivery
state part of the game framework.

### Observable behavior

At completion:

1. The repository command `npm run antiky -- dev` applies the `antiky dev` command contract.
2. The command loads and validates one `antiky.config.json` file before it starts a child process.
3. The command uses the configured loopback host and strict ports without choosing replacements.
4. The configured `town-study` route reaches a canvas in the supported WebGPU browser.
5. Inspection reports the development session, build, browser runtime, render statistics, and
   diagnostics without reading pixels or React state.
6. The development-session ID stays stable across a browser reload or reconnect.
7. The runtime-instance ID changes after browser reconstruction and stays stable across a bridge
   reconnect in the same runtime.
8. The build revision changes only after an accepted source, shader, or asset update. A config
   change requires a new development session.
9. A failed shader or config update keeps the last valid result and reports a stable diagnostic.
10. A controlled reload returns the old and new runtime IDs or a structured failure.
11. A frame capture records the development-session, build, runtime, and capture IDs.
12. Direct tests, the CLI, MCP resources, and MCP tools read the same inspection service.
13. The base receipt records the run setup, attempts, checkpoints, failures, checks, and artifacts.
14. Normal shutdown and child failure close the server, browser bridge, files, ports, and children.

The Slice 0 config targets `town-study`. Slice 01 changes the configured game only after it registers
a real Antiky Town consumer. Slice 0 does not create a pass-through Antiky Town route.

### Non-goals

- The Antiky world, entity, component, command, event, projection, or persistence model.
- A Studio UI, hierarchy, editor panel, or production game host.
- A new web bundler, module loader, shader compiler, or framework-owned HTTP server.
- State-preserving module replacement.
- Durable game state across a browser or process restart.
- Production authentication, remote access, cloud deployment, or multiplayer authority.
- WebGPU Inspector as a required inspection source.
- World, entity, asset, clock, selection, history, or editing MCP operations.
- A general workflow engine or agent-swarming system.

### Approved differences from the reference

None. The development harness can add local inspection traffic and development-only controls. It
must not change the `town-study` route's intended behavior or appearance.

## Terms and identities

| Term | Meaning |
| --- | --- |
| Supervisor | The local Node development tool that validates config and owns child processes |
| Development session | One supervisor lifetime from accepted start through final cleanup |
| Runtime instance | One browser game runtime; a page reconstruction creates a new instance |
| Connection | One browser-to-supervisor bridge connection; reconnect can keep the runtime instance |
| Build revision | An increasing session-local number for an accepted source, shader, asset, or config result |
| Pending change | A detected change that has not produced an accepted build result |
| Inspection service | The typed in-memory source used by direct tests, CLI, MCP, and later Studio adapters |

Use opaque random UUIDs for development-session, service, runtime-instance, connection, request,
reload, capture, and diagnostic IDs. These IDs are development identities. Slice 0 does not select
the persistent game-entity ID implementation.

## Reference and baseline

| ID | Reference fact | How to reproduce or measure it | Stored evidence | Status |
| --- | --- | --- | --- | --- |
| `REF-01` | `npm run dev:demos -- town-study` starts the website host on port `3010` | Inspect and run the root and demos development scripts | Source paths are recorded; runtime transcript is missing | `FAIL` |
| `REF-02` | The website `predev` script compiles shaders once before Next.js starts | Inspect `packages/website/package.json` | Source at the alignment revision | `PASS` |
| `REF-03` | The demos package has a separate `shaders:watch` command | Inspect `packages/demos/package.json` | Source at the alignment revision | `PASS` |
| `REF-04` | `LiveDemoStage` owns WebGPU creation, browser phase, render statistics, and disposal | Inspect the component and runtime types | Source at the alignment revision | `PASS` |
| `REF-05` | Current phase and render statistics stay in React state | Inspect `LiveDemoStage` and search for an external inspection service | No external service exists | `PASS` |
| `REF-06` | The `town-study` route is reachable and its initial appearance is stored | Open the current route in the selected browser at a fixed viewport | Capture is missing | `FAIL` |
| `REF-07` | Current startup, source update, shader update, shutdown, and port-release timings are known | Run ten recorded fixture operations and measure process cleanup | Measurements are missing | `FAIL` |
| `REF-08` | Current child failure and occupied-port behavior are recorded | Run fixture child and port-conflict probes | Evidence is missing | `FAIL` |
| `REF-09` | No Antiky config, supervisor, inspection bridge, MCP server, or receipt tool exists | Search manifests, source, scripts, and lock file | Repository probe at the alignment revision | `PASS` |

The final comparison must keep the same route, mode, viewport, pixel ratio, browser, GPU, initial
camera, and capture timing. A visual capture proves reachability and appearance only. Structured
inspection proves identities and state.

## Framework alignment snapshot

This snapshot describes code at revision `79a5de6cabb7f9a9db63eb565c38f3c3a11d77cd`.

| Area | Current fact | Direct evidence |
| --- | --- | --- |
| Root development entry | `scripts/dev.mjs` dispatches to the website, framework, or demos workspace | Root script and package scripts |
| Demo development entry | The demos script validates one optional slug and starts the website with `ANTIKY_DEMO_SLUG` | `packages/demos/scripts/dev.mjs` |
| Website host | Next.js `15.5.x` starts on hard-coded port `3010` | Website package manifest and lock file |
| Shader tools | BroMetal `0.14.0` supplies one-shot and watch commands | Demos package manifest and lock file |
| Browser runtime | `LiveDemoStage` owns renderer start, phase, frame loop, statistics, retry, and disposal | Component source and demos runtime types |
| Reference route | `town-study` is registered and visible; `antiky-town` remains an empty scaffold | Demo registry and both owned folders |
| Framework core | `@antiky/framework` exports no capability and has no test script | Framework entry point and package manifest |
| Devtools package | No Antiky development-tool package exists | Workspace list and repository search |
| Configuration | Host, port, and route behavior is split across scripts and environment values | Root, demos, and website scripts |
| Inspection | No typed development inspection service or browser bridge exists | Repository search and React-local state |
| MCP | No MCP SDK or server dependency exists | Package manifests and lock-file search |
| Run receipt | No `antiky.slice-receipt/v1` writer or validator exists | Repository search |
| Test base | Node test, Vitest, TypeScript checks, and WebGPU-only boundary tests exist | Root and workspace package scripts |
| Architecture | Accepted ADRs keep adapters outside core and require validated JSON boundaries | Required-reading ADRs and architecture guides |

### Drift rule

Before implementation starts or resumes:

1. Reinspect the scripts, manifests, lock file, demo registry, browser host, framework exports, and
   tests.
2. Recheck the stable official MCP TypeScript SDK package surface and protocol support.
3. Update this snapshot and the capability inventory.
4. Record the change in the drift log.
5. Rerun every affected readiness row.

The current official MCP TypeScript SDK documentation has stable v1 guidance and a newer split
package surface. Pin one reviewed stable package set before implementation. Do not combine examples
from different major versions.

## Execution contract

Slice 0 bootstraps the receipt tools that later slices use. Before `CP-00` passes, keep an append-only
bootstrap log with the run setup, commands, attempts, results, and artifacts. Import that log into
the first valid receipt. Preserve the bootstrap log as an artifact.

### Run setup

| Field | Required value or rule | Run value and direct evidence |
| --- | --- | --- |
| Run ID and attempt IDs | Use `slice-00-YYYYMMDDTHHMMSSZ-abcdef0`; start at attempt `1` and never reuse an attempt ID | `PENDING` |
| Source and final revision | Start from one clean full Git revision; record each checkpoint and the final revision | `PENDING` |
| Worktree and branch | Use one dedicated writable worktree and branch; permit no concurrent writer | `PENDING` |
| Dependency lock | Record the SHA-256 hash of root `package-lock.json` | `PENDING` |
| Configuration | Use one explicit run config; record its path and redacted SHA-256 hash | `PENDING` |
| Runtime tools | Record exact Node `22.x` or later, npm, OS, and architecture values | `PENDING` |
| Browser and GPU | Record the selected WebGPU browser, version, OS, adapter, and driver | `PENDING` |
| Visual profile | Record route, viewport, pixel ratio, demo mode, initial camera rule, and capture timing | `PENDING` until `REF-06` passes |
| Deterministic inputs | Use fixed fixture contents; record locale, time zone, clock rule, and network profile | `PENDING`; no external network during verification |
| Isolated resources | Use explicit host and inspection ports, a run-specific browser profile, temp paths, child group, and evidence directory | `PENDING`; a collision fails preflight |
| Development identities | Record delivery run, development-session, service, build, runtime-instance, connection, and capture IDs | `PENDING` |
| Start and resume events | Use process-started, build-accepted, runtime-ready, reload-complete, capture-complete, and process-stopped events | Supplied during Slice 0; each wait has a timeout |

The default developer config can use ports `3010` and `3011`. Tests and overlapping runs must use a
separate generated config with explicit reserved ports. The supervisor must not select ports or
paths silently.

### Delivery permissions

| Operation | Required capability | Allowed scope | Grant source | Expiry or revocation | Audit evidence |
| --- | --- | --- | --- | --- | --- |
| Read repository and local process state | Workspace read and local process inspection | This repository and run-owned processes | Approved goal | Run close | Receipt operation list |
| Create and remove delivery worktrees | Git worktree access | This repository and explicit run paths | Approved goal after readiness passes | Verified cleanup | Worktree path, branch, revision, and cleanup result |
| Edit and commit checkpoints | Workspace write and Git commit | Files named by `CP-00` through `CP-05` | Approved options and goal | Run close or cancellation | Patches and checkpoint commits |
| Install dependencies | Package-manager network and lock-file write | Exact approved packages and versions for the selected MCP, schema, and bridge implementation | Explicit owner approval | One install operation | Approval, command, package changes, and lock hash |
| Start local services and browser | Local process, loopback-port, and browser-profile access | Explicit run ports, child processes, and run profile only | Approved goal | Process cleanup or run close | Session and process records |
| Write local session data | Workspace-local ignored data and evidence write | `.antiky/dev` and the Slice 00 evidence directory | Approved goal | Session cleanup and evidence retention rule | Paths, permissions, and artifact hashes |
| Request reload or capture | Local development tool permission | One run-owned runtime only | Session credential and approved verifier | Runtime disposal | Request and result IDs |
| Use production, secrets, deployment, remote hosts, or external messages | None | `DENIED` | None in Slice 0 | Always denied | Receipt records no such operation |

### Failure, retry, and resume

| Failure class | Detection rule | Maximum automatic retries | Required action and evidence |
| --- | --- | ---: | --- |
| `EXPECTED_REJECTION` | Config, port, origin, credential, protocol, reload, or capture input fails a defined rule | `0` | Record the stable result and no-partial-start proof; do not change the input silently |
| `TRANSIENT` | A run-owned tool or process fails without repeatable code or config evidence | `2` | Check health, use recorded bounded backoff, and preserve all attempts |
| `DEFECT` | The same input and run setup give the same wrong result, or a required test fails | `0` | Add proof, fix the cause, and start a new attempt |
| `STALE_RUN` | Source, lock, config, process, build, runtime, or reference identity does not match the frozen setup | `0` | Invalidate affected evidence and reconstruct or start a new run |
| `AUTHORITY_BLOCK` | A step needs an unapproved option, dependency, permission, port, browser, or client | `0` | Stop and request the exact authority or resource |
| `EVIDENCE_FAILURE` | A transcript, event, ID link, capture, hash, or receipt record is missing or invalid | `1` | Confirm the unchanged setup, repair the evidence path, and record both attempts |

Resume only from a passing checkpoint whose commit, lock hash, config hash, and receipt fragment
still match. A busy strict port is an expected rejection. It is not permission to choose another
port. An unexplained flaky result is a defect.

### Software rollback

| Field | Required answer |
| --- | --- |
| Last-known-good revision or artifact | The implementation-start revision, then the latest passing Slice 00 checkpoint |
| Rollback triggers | Reference regression, partial start, leaked child or port, authentication failure, corrupt receipt, or unsafe lifecycle result |
| Programmatic action | Stop run-owned processes; create a corrective or revert commit for owned work; start the last-known-good revision in a separate worktree; do not rewrite shared history |
| State and data effect | Slice 0 has no durable game state; remove session-local data and issue new development, service, connection, and runtime IDs |
| Proof after rollback | Run the current `town-study` smoke check, completed checkpoint tests, port-release probe, and receipt validation |
| Receipt record | Record trigger, commits, processes, ports, commands, IDs, cleanup, checks, and artifacts |

Controlled browser reload is not software rollback. Process restart is not proof that a bad code
revision was removed.

## Readiness gate

Do not start feature implementation until every applicable row is `PASS`.

| ID | REQUIRED condition | Status | Direct evidence or exact blocker |
| --- | --- | --- | --- |
| `PRE-01` | The owner approved host `0A`, config `C1`, package placement `0P-A`, and bridge `0T-A`, or documented replacements | `BLOCKED` | All four choices are recommendations only |
| `PRE-02` | Every earlier required slice is complete | `PASS` | Slice 00 has no earlier slice |
| `PRE-03` | The framework alignment snapshot matches the implementation-start revision | `PASS` | Snapshot recorded on 2026-08-04; refresh after drift |
| `PRE-04` | The route, appearance, startup, update, failure, shutdown, and port baselines are stored | `FAIL` | `REF-01`, `REF-06`, `REF-07`, and `REF-08` need runtime evidence |
| `PRE-05` | The outcome, non-goals, failure behavior, and safe-state rules are explicit | `PASS` | This plan defines them |
| `PRE-06` | Session, build, runtime, connection, diagnostic, request, and receipt identities are defined or in scope | `PASS` | The terms and contracts define them |
| `PRE-07` | Inspection resources, reload, capture, direct-query, MCP, and receipt contracts are defined or in scope | `PASS` | The contract sections define them |
| `PRE-08` | Tests and one complete verification command are named | `PASS` | The test and checkpoint sections define them |
| `PRE-09` | Reload, reconnect, replacement, disposal, child failure, and shutdown behavior are defined | `PASS` | The lifecycle table defines them |
| `PRE-10` | Local binding, origin, credential, size, redaction, and permission rules are defined | `PASS` | The security and contract sections define them |
| `PRE-11` | Startup, update, payload, process, and cleanup baselines and limits are approved | `FAIL` | Current runtime measurements are missing |
| `PRE-12` | No unresolved architecture decision changes framework ownership or a public game contract | `PASS` | The proposed work stays in private development tooling and demo-host adapters |
| `PRE-13` | Exact MCP, schema, bridge, browser, and agent-client inputs are available | `BLOCKED` | Package versions, browser profile, and one compatible client are not selected and recorded |
| `PRE-14` | The run setup is frozen and every resource is isolated | `BLOCKED` | Run IDs, worktree, ports, config, browser profile, and hashes are not allocated |
| `PRE-15` | Delivery permissions are explicit and sufficient | `BLOCKED` | Dependency installation needs exact owner approval |
| `PRE-16` | Failure, retry, resume, and software rollback rules are testable | `PASS` | This plan defines exact classes, bounds, resume checks, triggers, and proof |
| `PRE-17` | The receipt bootstrap can record work before the base receipt tool exists | `PASS` | `CP-00` imports the append-only bootstrap log before other implementation work |

### Owner action before the goal can run

1. Approve or replace options `0A`, `C1`, `0P-A`, and `0T-A`.
2. Approve the exact pinned dependency set and lock-file change.
3. Select one supported WebGPU browser and one agent client for the MCP evidence.
4. Capture `REF-01`, `REF-06`, `REF-07`, and `REF-08`.
5. Approve the measured startup, update, payload, and cleanup limits.
6. Allocate the worktree, explicit ports, browser profile, and evidence location.
7. Freeze the run setup and change every readiness row to `PASS` with direct evidence.

## Existing capability inventory

Decision values describe what Slice 00 must do after the readiness gate passes.

| ID | Need | Required behavior | Existing API and path | Existing proof | Decision |
| --- | --- | --- | --- | --- | --- |
| `CAP-01` | Root command dispatch | Reach one repository development entry | Root package scripts and `scripts/dev.mjs` | Current workspace dispatch | `EXTEND` with `antiky` and `verify:slice-00` entries |
| `CAP-02` | Demo selection | Validate a slug and select one route | `packages/demos/scripts/dev.mjs` | Source behavior | `USE` semantics; move launch authority to the supervisor |
| `CAP-03` | Web host | Serve the current route and apply source updates | Next.js website host | Working `town-study` consumer | `USE` through host option `0A` |
| `CAP-04` | Shader compiler | Compile once and watch shader sources | BroMetal package scripts | Current generated shaders and scripts | `EXTEND` with accepted build events and last-good diagnostics |
| `CAP-05` | Browser lifecycle | Start WebGPU, report phase and render stats, and dispose | `LiveDemoStage` and demos runtime types | Working browser demo | `EXTEND` with a development-only bridge |
| `CAP-06` | Process supervision | Start, observe, stop, and clean child processes | Root scripts spawn one child only | Source behavior; no cleanup contract test | `CREATE` |
| `CAP-07` | Versioned config | Validate strict JSON and publish JSON Schema | None | Research only | `CREATE` |
| `CAP-08` | Session and build state | Own session IDs, revisions, diagnostics, and accepted events | None | Research only | `CREATE` |
| `CAP-09` | Runtime bridge | Connect one browser runtime and exchange bounded typed messages | None | Research only | `CREATE` |
| `CAP-10` | Inspection service | Serve safe read snapshots and controlled operations | None | Architecture and research only | `CREATE` |
| `CAP-11` | MCP adapter | Expose the inspection service through Streamable HTTP | No dependency or server | Official SDK and research only | `CREATE` after package selection |
| `CAP-12` | Stdio compatibility | Adapt clients that cannot use Streamable HTTP | None | Client probe not run | `DEFER` unless the selected client needs it |
| `CAP-13` | Frame capture | Capture the active canvas on request with related IDs | No host operation | Browser shows pixels only | `CREATE` narrow development operation |
| `CAP-14` | Run receipt | Write and validate `antiky.slice-receipt/v1` | None | Workflow contract only | `CREATE` first in `CP-00` |
| `CAP-15` | Low-level GPU inspection | Inspect GPU objects, commands, and validation | Optional WebGPU Inspector | Research only | `DEFER`; not a Slice 00 completion dependency |
| `CAP-16` | Test infrastructure | Run unit, integration, type, and boundary tests | Node test, Vitest, TypeScript, and root checks | Current passing workspace checks | `USE` and extend with devtools suites |

## Missing-capability hypotheses

Run each pending probe before its related implementation checkpoint.

| ID | Hypothesis | Why it appears missing | Probe | Result | Decision |
| --- | --- | --- | --- | --- | --- |
| `HYP-01` | A dedicated Vite host is required for Slice 00 | The current host has broad page reload behavior | Run the reference through Next.js and map the required update and reconnect events | Current route and host already work; no missing visible capability is proved | `USE` Next.js through `0A` |
| `HYP-02` | Existing scripts can enforce versioned config and strict isolated ports | Host, port, and route values are hard-coded or use one environment value | Inspect scripts and run invalid-port and occupied-port probes | No config schema, preflight, or strict-port contract exists | `CREATE` in devtools |
| `HYP-03` | Current React and HUD state is sufficient for agent inspection | The page shows phase and some counters | Search for a typed external query and compare direct facts with the DOM | Facts stay inside React and cannot identify sessions, builds, or diagnostics | `CREATE` the inspection service and bridge |
| `HYP-04` | BroMetal watch output already supplies stable machine-readable build events | A watch command exists | Inspect the CLI output and run success and failure fixture changes | `PENDING` | `USE` if stable; otherwise wrap one-shot compile behind the supervisor |
| `HYP-05` | Node built-ins are sufficient for reliable cross-platform file and browser-bridge events | Avoiding dependencies reduces surface | Test recursive watch, event coalescing, disconnect, backpressure, and cleanup on supported systems | `PENDING` | `USE` only if the probe passes; otherwise pin one narrow library |
| `HYP-06` | The repository already has an MCP SDK or compatible server | Research selected MCP but no implementation is visible | Search manifests and lock file | No MCP dependency exists | `CREATE` with one reviewed stable official SDK version |
| `HYP-07` | Antiky must implement MCP framing itself | The SDK package surface is changing | Compare the required resources and transports with official stable SDK docs | Official SDKs provide Streamable HTTP and stdio transports | `USE` the official SDK; do not hand-build MCP |
| `HYP-08` | Browser screenshots can replace a runtime capture operation | A browser tool can capture pixels | Compare required identity links and controlled-run evidence | A screenshot lacks Antiky session, build, runtime, and request identity by itself | `CREATE` a correlated capture tool; keep screenshots as support |
| `HYP-09` | WebGPU Inspector is required for minimum inspection | It supplies deep GPU facts | Compare Slice 00 resources with its engine-independent data | It cannot report Antiky sessions, builds, or runtime authority | `DEFER` to optional investigation and Slice 5 evidence |
| `HYP-10` | Development tooling belongs in framework core | Later framework features need inspection | Apply import and ownership rules to the supervisor and network adapters | The tool owns Node, browser-host, and MCP concerns, not game rules | `CREATE` a private devtools package; keep framework unchanged |

New discoveries enter this table before they become implementation work.

## Expected framework additions

Slice 00 adds no `@antiky/framework` export or implementation. The framework package must remain
headless and independent from Node processes, Next.js, React, BroMetal, browsers, MCP, and delivery
receipts.

| ID | Addition | Owner and surface | Complexity hidden | Required tests | First consumer |
| --- | --- | --- | --- | --- | --- |
| `FW-00` | `NONE` | Framework remains unchanged | `N/A` | Import-boundary and unchanged-export checks | `N/A` |

If implementation appears to need framework code, record and test a new hypothesis. Stop if the
change introduces a world, session, command, event, entity, renderer, or persistence contract.

## Expected development-tool and host additions

| ID | Addition | Owner | Required behavior | Proof |
| --- | --- | --- | --- | --- |
| `DEV-00` | Base receipt schema, writer, append path, and validator | Private `@antiky/devtools` package | Import the bootstrap log and preserve all attempts in `antiky.slice-receipt/v1` | Receipt unit and corruption tests |
| `DEV-01` | `antiky` CLI and root scripts | Private devtools package and root package manifest | Parse `dev`, `receipt`, and verifier operations; return stable exit results | CLI contract tests |
| `DEV-02` | Versioned config and JSON Schema | Devtools config module and root `antiky.config.json` | Reject unknown or unsafe values before side effects; resolve paths from config location | Config tests and published schema comparison |
| `DEV-03` | Process supervisor and build tracker | Devtools supervisor module | Preflight ports, start host and shader work, accept build results, and clean every child | Fake-child and live-fixture integration tests |
| `DEV-04` | Typed inspection service | Devtools inspection module | Own immutable versioned snapshots, bounded diagnostics, events, and controlled-operation results | Direct service contract tests |
| `DEV-05` | Authenticated runtime bridge | Devtools server plus browser-safe protocol export | Validate one runtime connection, accept phase and render data, and push reload and capture requests | Protocol, reconnect, and backpressure tests |
| `DEV-06` | Development-only browser adapter | Demos and website host integration | Publish current phase and stats without exposing React, DOM, BroMetal, or GPU objects | Browser/direct inspection parity tests |
| `DEV-07` | Streamable HTTP MCP adapter | Devtools MCP module over the inspection service | Expose Slice 00 resources and tools; validate origin, credential, size, and schema | Official client contract and security tests |
| `DEV-08` | Optional stdio adapter | Devtools MCP module | Connect the selected client to the same inspection service when HTTP is unsupported | Required only after the client probe selects it |
| `DEV-09` | Controlled reload and correlated capture | Runtime bridge and browser adapter | Return stable request IDs, old and new runtime IDs, build revision, capture metadata, and failures | Browser lifecycle and artifact tests |
| `DEV-10` | Complete Slice 00 verifier | Root and devtools package scripts | Run config, process, browser, inspection, MCP, security, reload, capture, rollback, and cleanup proof | `npm run verify:slice-00` |

Keep each module narrow. Do not expose the supervisor, transport objects, child processes, browser
objects, or MCP SDK through framework or game APIs.

## Implementation options and decisions

The owner must approve one choice in each group. The recommended set uses the smallest change that
can prove the Slice 0 outcome.

### Host option

#### 0A. Current Next.js host with a supervisor — recommended

Keep the working website and demo route. Add a small supervisor around the current shader and host
commands. Connect the page to the inspection service through a development-only adapter.

- Benefit: It reuses the working route, browser lifecycle, and BroMetal integration.
- Cost: A source update can reconstruct the page. Slice 0 must test this behavior.
- Proof needed: The ten-edit fixture, reconnect tests, and last-valid shader test must pass.

#### 0B. Dedicated Vite development host

Build a second host for framework demos.

- Benefit: It can give the framework a narrow development surface.
- Cost: It duplicates routing, asset, shader, and browser-lifecycle work before the framework needs
  that ownership.
- Use only if: `0A` fails a measured requirement that the supervisor cannot correct.

#### 0C. Framework-owned development server

Put serving, watching, and protocol work in `@antiky/framework`.

- Benefit: None for the Slice 0 outcome.
- Cost: It mixes Node and browser-host concerns with headless game rules.
- Decision: Reject. It conflicts with the accepted package boundary.

### Configuration option

#### C1. Strict `antiky.config.json` — recommended

Use one versioned JSON file with a published JSON Schema. Reject unknown fields and unsafe values
before any side effect.

- Benefit: Humans and agents can inspect the same stable input.
- Cost: Comments and executable values are not available.

#### C2. TypeScript configuration

Load an executable TypeScript module.

- Benefit: It supports computed values.
- Cost: Configuration can run code before validation and is harder to hash and reproduce.

#### C3. A field in `package.json`

Put Antiky settings in the root package manifest.

- Benefit: It avoids one file.
- Cost: It mixes development-session settings with package metadata and makes the schema harder to
  find.

### Package-placement option

#### 0P-A. Private `@antiky/devtools` package — recommended

Own the config, CLI, supervisor, inspection service, adapters, receipt tools, and verifier in one
private workspace package. Export a small browser-safe protocol entry for the demo adapter.

- Benefit: It gives Node tooling one owner and keeps framework core headless.
- Cost: It adds one workspace package and one explicit browser-safe build boundary.

#### 0P-B. Root scripts only

Add the behavior to `scripts/`.

- Benefit: It avoids a new package.
- Cost: Tests, typed contracts, browser-safe protocol code, and reuse by later slices become harder
  to control.

### Runtime-bridge option

#### 0T-A. Authenticated push bridge — recommended

Use one bounded, versioned, bidirectional local transport. The service pushes state and operation
requests. The browser pushes ready, phase, render-stat, capture-result, and diagnostic messages.
Keep the selected transport private.

- Benefit: It supports runtime events, reload, and capture without repeated polling.
- Cost: It needs connection, backpressure, origin, authentication, and cleanup tests.

#### 0T-B. Request and polling bridge

Poll browser state and queue reload or capture requests for the next poll.

- Benefit: It can use plain request-response calls.
- Cost: It adds delay, repeated traffic, request expiry rules, and more state reconciliation.

### Decision record

| Decision | Recommended choice | State | Owner | Evidence required before approval |
| --- | --- | --- | --- | --- |
| Host | `0A` | `PENDING` | Antiky project owner | Reference start, update, failure, and cleanup baselines |
| Configuration | `C1` | `PENDING` | Antiky project owner | Schema fields, invalid fixtures, and no-side-effect rule |
| Package placement | `0P-A` | `PENDING` | Antiky project owner | Import-boundary review and proposed package API |
| Runtime bridge | `0T-A` | `PENDING` | Antiky project owner | Transport probe, threat checks, bounds, reconnect, and cleanup cases |
| MCP package set | Stable official TypeScript SDK set | `PENDING` | Antiky project owner | Exact package names, versions, protocol version, client probe, and lock diff |
| Optional GPU tool | WebGPU Inspector for investigation only | `PENDING` | Antiky project owner | Supported-browser probe and explicit local-use approval |

No checkpoint can turn a pending choice into an implicit decision. Record an approved replacement
in this table, the drift log, and the control block.

## Data and authority path

```text
antiky.config.json and source files
  -> config validator and preflight
  -> development supervisor
       -> shader build process
       -> current Next.js website host
       -> session, build, process, and diagnostic state
  -> authenticated browser bridge
       -> LiveDemoStage development adapter
       -> phase, runtime, canvas, and render-stat snapshots
       <- controlled reload and capture requests
  -> typed inspection service
       -> direct tests and CLI
       -> Streamable HTTP MCP adapter
       -> optional stdio adapter
  -> verifier, artifacts, and antiky.slice-receipt/v1
```

| Stage | Input | Output | Authority owner | Failure behavior |
| --- | --- | --- | --- | --- |
| Config validator | Raw JSON and config path | Immutable validated config | Config module | Return a stable error before any child or listener starts |
| Preflight | Valid config and run allocation | Reserved run plan | Supervisor | Report all detected conflicts and start nothing |
| Supervisor | Run plan and child events | Session, process, and build snapshots | Supervisor | Keep the last accepted build when safe; stop all owned work on fatal failure |
| Browser adapter | Host settings and live demo facts | Bounded protocol messages | Current runtime instance | Reject invalid requests; never expose live objects |
| Inspection service | Valid supervisor and browser events | Immutable versioned snapshots and operation results | Inspection service | Keep the last valid snapshot and add one bounded diagnostic |
| MCP and CLI adapters | Authenticated read or tool request | Copied service result | Inspection service | Return the same stable result as a direct call |
| Verifier | Frozen run setup and service results | Tests, captures, measurements, and receipt | Verifier | Preserve failed attempts; never publish a partial receipt |

### Authority rules

- The supervisor owns development-session, service, process, and accepted build identities.
- The browser runtime creates one runtime-instance ID and keeps it across a bridge reconnect.
- A full page or game-runtime reconstruction creates a new runtime-instance ID.
- The inspection service is the source of truth for development inspection snapshots.
- The page supplies runtime facts. It does not decide build acceptance or delivery state.
- MCP, CLI, tests, and future Studio adapters call the same inspection service.
- Only the local supervisor can request reload or capture for its current runtime.
- A caller cannot supply its own trusted session, origin, permission, time, or revision.
- Delivery receipts do not enter game state or framework APIs.

## Contracts and limits

### Configuration contract

The root `antiky.config.json` uses schema version `1`. The validator rejects duplicate or unknown
fields. It resolves relative paths from the config file. It completes validation and port preflight
before it starts a listener, browser, or child process.

| Field | Required value or rule | Limit | Invalid result |
| --- | --- | --- | --- |
| `schemaVersion` | Integer `1` | Exact | `CONFIG_VERSION_UNSUPPORTED` |
| `game.id` | Registered demo slug; Slice 0 uses `town-study` | `1..64` lower-case letters, digits, and hyphens | `CONFIG_INVALID` |
| `game.route` | Absolute local route with no query, hash, traversal, or encoded separator | `1..256` UTF-8 bytes | `CONFIG_INVALID` |
| `host.bind` | Exact loopback IP `127.0.0.1` for Slice 0 | No hostname or wildcard | `INVALID_HOST` |
| `host.port` | Website port | Integer `1024..65535` | `INVALID_PORT` |
| `host.strictPort` | Boolean `true` | Exact for Slice 0 | `CONFIG_INVALID` |
| `host.open` | Boolean | Default `false`; verifier uses `false` | `CONFIG_INVALID` |
| `inspection.enabled` | Boolean `true` | Exact for Slice 0 | `CONFIG_INVALID` |
| `inspection.port` | Inspection and bridge port | Integer `1024..65535`; distinct from host port | `PORT_COLLISION` |
| `evidence.root` | Repository-relative evidence directory | Must stay below `docs/objectives/antiky-town/evidence` | `CONFIG_INVALID` |

The CLI syntax is `antiky dev`. The repository command is `npm run antiky -- dev`. A non-zero exit
code includes one stable code and safe details. Help and version operations have no side effects.

### Identity and ordering contract

| Identity or value | Rule |
| --- | --- |
| Development-session ID | New random UUID for each accepted supervisor start; stable until cleanup ends |
| Service ID | New random UUID for each inspection-service instance |
| Runtime-instance ID | New random UUID for each browser game-runtime construction |
| Connection ID | New random UUID for each bridge connection |
| Build revision | Session-local safe integer; starts at `0`; increments once for each accepted change result |
| Change ID | New random UUID for each coalesced detected file change |
| Request, reload, and capture IDs | New random UUID for each operation; never reused |
| Diagnostic ID | New random UUID for each stored diagnostic |
| Wall time | UTC ISO 8601 for correlation and human review |
| Duration and timeout | Monotonic milliseconds; never derived from wall-clock subtraction |
| Event order | One session-local increasing safe integer for accepted service events |

A failed or cancelled build does not increment the build revision. A pending change has a change ID
and status, but no new accepted revision. A full supervisor restart resets the build revision to `0`
and creates new session and service IDs.

### Browser-bridge contract

| Contract | Required fields | Limits and units | Version | Invalid result |
| --- | --- | --- | --- | --- |
| Handshake | Protocol version, credential proof, session ID, runtime ID, route, page origin | One current session and one exact origin | `1` | `SESSION_UNAUTHORIZED` or `ORIGIN_REJECTED` |
| Runtime snapshot | Event sequence, runtime ID, build revision, game ID, phase, WebGPU state, canvas facts | One latest immutable snapshot | `1` | `RUNTIME_PROTOCOL_INVALID` |
| Render-stat update | Runtime ID, build revision, sample time, frame, FPS, draws, instances, dynamic bytes, known/unknown flags | At most `2 Hz` and `64 KiB` encoded | `1` | `REQUEST_TOO_LARGE` or `RUNTIME_PROTOCOL_INVALID` |
| Controlled request | Request ID, operation, target runtime ID, deadline | One in flight for each operation type; timeout in monotonic ms | `1` | `RUNTIME_NOT_READY` or `OPERATION_BUSY` |
| Operation result | Request ID, status, runtime/build IDs, safe metadata, optional diagnostic ID | At most `256 KiB` excluding a stored capture artifact | `1` | `RUNTIME_PROTOCOL_INVALID` |
| Diagnostic event | Diagnostic ID, stable code, severity, safe details, related IDs, time | Details at most `4 KiB`; active list at most `256` | `1` | `REQUEST_TOO_LARGE` |

The browser-safe protocol contains data records and validators only. It must not import Node APIs,
React, Next.js, BroMetal, or the MCP SDK.

### Stable diagnostics

| Code | Meaning | State or side-effect rule |
| --- | --- | --- |
| `CONFIG_NOT_FOUND` | No config exists at the explicit or default path | Start nothing |
| `CONFIG_INVALID` | A field has an invalid type, value, path, or relation | Start nothing |
| `CONFIG_VERSION_UNSUPPORTED` | The schema version is not supported | Start nothing |
| `UNKNOWN_CONFIG_FIELD` | The JSON contains a field outside the schema | Start nothing |
| `INVALID_HOST` | The host is not the approved loopback address | Start nothing |
| `INVALID_PORT` | A port is outside the accepted range | Start nothing |
| `PORT_COLLISION` | Configured ports are equal or already owned | Start nothing and do not choose another port |
| `CHILD_START_FAILED` | An owned child cannot start | Stop all children and listeners started by this attempt |
| `CHILD_EXITED` | An owned child exits unexpectedly | Mark the session unhealthy and clean all owned resources |
| `SHADER_BUILD_FAILED` | Shader compilation rejects a change | Keep the last accepted generated output and build revision |
| `RUNTIME_PROTOCOL_INVALID` | A bridge message fails schema, version, order, or identity checks | Reject the message and keep the last valid snapshot |
| `ORIGIN_REJECTED` | A browser or MCP request has an unapproved origin | Reject before service access |
| `SESSION_UNAUTHORIZED` | A credential or session does not match | Reject before service access |
| `RUNTIME_DISCONNECTED` | No current bridge connection exists | Keep the last snapshot and mark it stale |
| `RUNTIME_NOT_READY` | The current runtime cannot perform the requested operation | Make no runtime change |
| `OPERATION_BUSY` | The same controlled operation is already running | Make no second request |
| `RELOAD_FAILED` | Controlled reconstruction did not reach ready state | Return old and observed runtime IDs; mark health accurately |
| `CAPTURE_FAILED` | The runtime could not produce or store a frame capture | Store no partial final artifact |
| `REQUEST_TOO_LARGE` | An encoded message exceeds its bound | Reject it before parsing nested data or changing state |
| `RECEIPT_INVALID` | The final receipt fails its schema or relation checks | Do not publish the final receipt |
| `CLEANUP_FAILED` | One or more owned resources remain after bounded cleanup | Mark the run failed and list only safe owned-resource facts |

### Service bounds

- Accept request bodies of at most `64 KiB`.
- Return one service response of at most `256 KiB`.
- Return at most `100` list items per page.
- Keep at most `256` active diagnostics and `256` recent operation results.
- Keep only the latest runtime and render snapshots in live service state.
- Limit render-stat updates to `2 Hz`.
- Limit a capture to `4096 x 4096` pixels and `16 MiB` after encoding.
- Reject new controlled work after shutdown begins.
- Do not store unbounded console output. Persist bounded transcripts as verifier artifacts.

## Tool and evidence plan

| ID | Tool | Claim it proves | Command or operation | Required artifact |
| --- | --- | --- | --- | --- |
| `TOOL-01` | Devtools unit and contract suites | Config, IDs, service state, protocol, receipt, and errors follow the contracts | `npm test --workspace @antiky/devtools` | Test output |
| `TOOL-02` | Devtools type check | Node and browser-safe entries have valid and separate types | `npm run typecheck --workspace @antiky/devtools` | Type-check output |
| `TOOL-03` | Workspace checks | Existing workspaces, tests, docs, and WebGPU-only rules pass | `npm run check` | Check output |
| `TOOL-04` | Direct inspection CLI | The CLI reads the same service without MCP or UI state | `npm run antiky -- inspect --session "$ANTIKY_DEV_SESSION_PATH" --format json` | Versioned JSON snapshot |
| `TOOL-05` | Official MCP client | Resources and tools work through the selected official client | Client discovery, read, reload, and capture operations | Client transcript and returned IDs |
| `TOOL-06` | Supported WebGPU browser | The route starts, reconnects, reloads, and captures a real frame | Programmatic browser verifier with a run-specific profile | Captures, browser events, and runtime IDs |
| `TOOL-07` | Process and port probes | Strict ports, child failure, signal handling, and cleanup are safe | Fixture child, occupied-port, interrupt, and release operations | Process transcript and port results |
| `TOOL-08` | Receipt validator | Receipt shape, relations, hashes, attempts, and result are valid | `npm run antiky -- receipt verify --path "$ANTIKY_SLICE_RECEIPT_PATH"` | Validation result |
| `TOOL-09` | Optional WebGPU Inspector | A low-level GPU investigation can support a later diagnostic | Approved local capture in the selected browser | Capture ID and summarized facts; not required for completion |
| `TOOL-10` | Complete verifier | All Slice 0 claims pass from a clean isolated start | `npm run verify:slice-00` | Exit code, summary, artifact index, and receipt |
| `TOOL-11` | Isolated rollback rehearsal | The last-known-good revision remains runnable without changing the active worktree | Verifier rollback phase in a temporary worktree | Revision, health result, cleanup record, and receipt links |

All routine operations must have a command or typed tool. A visual reviewer can decide whether the
reference appearance changed. The receipt records that reviewer, decision, and related capture.

## Evidence receipt

The complete verifier writes one `antiky.slice-receipt/v1` JSON receipt at the path in the control
block. `CP-00` imports the append-only bootstrap log as attempt history before it writes the first
receipt.

| Receipt area | Slice 00 requirement |
| --- | --- |
| Identity | Slice ID, run ID, attempt IDs, source revision, final revision, and checkpoint commits |
| Run setup | Every run-setup value or hash and each allocated resource |
| Correlation | Checkpoint, operation, change, build, service, runtime, connection, request, diagnostic, test, and capture IDs that apply |
| Decisions | Every readiness, option approval, acceptance, rubric, owner-review, and final-audit result |
| Recovery | Every failure class, retry, resume, rollback trigger, action, and result |
| Authority | Every changing operation, used capability, target, grant, and denied escalation |
| Process | Unplanned intervention, flaky check, permission escalation, missed check, and blocked duration |
| Artifacts | Stable paths and SHA-256 hashes for stored JSON, captures, logs, and measurements |
| Result | Final status, completion time, and after-completion owner |

Receipt writer: `npm run antiky -- receipt write --run "$ANTIKY_SLICE_RUN_ID"`

Receipt validator: `npm run antiky -- receipt verify --path "$ANTIKY_SLICE_RECEIPT_PATH"`

Use this correlation path for one accepted source update:

```text
run ID
  -> attempt ID
  -> checkpoint ID
  -> change ID and source fixture
  -> accepted build revision
  -> runtime-instance and connection IDs
  -> inspection resource or operation request ID
  -> test, measurement, diagnostic, or capture artifact
```

Write to a run-local temporary file. Validate the full receipt. Rename it to the final path in one
operation. A reader must never see a partial final receipt. Use `N/A` with a reason when one identity
does not apply. Do not store credentials, raw permissions, or unredacted environment values.

## BroMetal and CPU-to-GPU plan

This section is `N/A` for new rendering work. Slice 0 does not change scene data, render algorithms,
shader interfaces, BroMetal resources, or GPU ownership. It reads the existing safe render counters
and can request one frame capture. Slice 5 owns deep render and GPU inspection.

| ID | Measure | Reference | Allowed result | Tool | Final result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `GPU-00` | GPU-to-CPU readbacks added to the normal inspection path | Current normal path has no planned readback | `0` | Source boundary test and runtime counters | `PENDING` | `PENDING` |
| `GPU-01` | Draws or queue submissions added by a read operation | `0` | `0` | Before/after render stats | `PENDING` | `PENDING` |
| `GPU-02` | GPU resources created by the inspection service or bridge | `0` | `0` | Source and lifecycle tests | `PENDING` | `PENDING` |
| `GPU-03` | Frame capture frequency | On demand only | At most one capture for each accepted capture request | Request/result correlation | `PENDING` | `PENDING` |
| `GPU-04` | WebGPU Inspector in the normal or production path | Not installed or loaded | `0` | Bundle and source check | `PENDING` | `PENDING` |

The browser capture operation can use a canvas read only after an explicit authenticated request.
It must not become a frame-loop readback. WebGPU Inspector remains an optional local investigation
tool. The Slice 0 semantic contract must work without it.

## Performance and process budget

Measure reference values before the owner approves limits. The ten-edit fixture uses fixed files and
contents. Start each measurement at the recorded file-change event and end it at the accepted build
and ready runtime event.

| ID | Measure | Reference | Allowed result | Tool | Final result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `PERF-01` | Clean start to route ready | `REF-07` pending | Owner-approved measured limit | Browser and supervisor events | `PENDING` | `PENDING` |
| `PERF-02` | Ten valid TypeScript fixture updates | `REF-07` pending | Each update at most `10 s`; record median and maximum | Complete verifier | `PENDING` | `PENDING` |
| `PERF-03` | Ten valid shader fixture updates | `REF-07` pending | Each update at most `10 s`; record median and maximum | Complete verifier | `PENDING` | `PENDING` |
| `PERF-04` | Invalid shader rejection | `REF-07` pending | Stable diagnostic within owner-approved limit; no build revision increment | Shader fixture and inspection | `PENDING` | `PENDING` |
| `PERF-05` | Render-stat traffic | No bridge exists | At most `2 Hz` and `64 KiB` for each update | Protocol counters | `PENDING` | `PENDING` |
| `PERF-06` | Read response size | No service exists | At most `256 KiB`; lists page at `100` | Contract tests | `PENDING` | `PENDING` |
| `PERF-07` | Normal shutdown to released ports | `REF-07` pending | Owner-approved measured limit; zero owned process or port leaks | Process and port probes | `PENDING` | `PENDING` |
| `PERF-08` | Fatal child exit to cleanup complete | `REF-08` pending | Owner-approved measured limit; zero owned process or port leaks | Fixture child and process probes | `PENDING` | `PENDING` |

Do not hide a slow result with a median. All ten valid updates must meet the limit. Preserve every
sample and the environment record in the receipt.

## Structured inspection contract

Names in this table are the required semantic names. The selected MCP SDK can map them to its exact
resource URI and tool registration APIs. All data uses schema version `1`.

| ID | Resource, query, or tool | Required fields or result | Bounds and version | Same service used by |
| --- | --- | --- | --- | --- |
| `INS-01` | Development status | Schema version, health, config path/hash, safe URLs, session/service IDs, start time, and child states | One immutable snapshot; no credential | Direct test, CLI, MCP |
| `INS-02` | Build status | Current revision, last accepted change ID and kind, pending state, start/end/duration, and related diagnostic IDs | One current build plus at most `100` recent safe summaries | Direct test, CLI, MCP |
| `INS-03` | Runtime status | Runtime and connection IDs, game ID, route, phase, WebGPU support, canvas facts, build revision, ready/stale flags, and sample time | One current runtime snapshot | Browser test, CLI, MCP |
| `INS-04` | Render statistics | Runtime/build IDs, frame, FPS, draws, instances, dynamic bytes, sample time, and explicit known/unknown flags | Latest sample only; producer at most `2 Hz` | Browser test, CLI, MCP |
| `INS-05` | Diagnostics | Stable code, severity, time, message, safe details, and related session/build/runtime/request IDs | At most `100` per page and `256` active | Tests, CLI, MCP |
| `INS-06` | `dev_reload` tool | Request ID, status, old/new runtime IDs, build revision, duration, and optional diagnostic ID | One current runtime; bounded timeout | Direct call, MCP, verifier |
| `INS-07` | `capture_frame` tool | Request/capture IDs, status, session/build/runtime IDs, dimensions, media type, artifact path/hash, and optional diagnostic ID | At most `4096 x 4096` and `16 MiB` | Direct call, MCP, verifier |
| `INS-08` | Session discovery | Safe endpoint, session/service IDs, health, protocol versions, and credential-file path without credential value | One run-owned session | CLI and selected agent client |

Read operations do not change runtime or build state. Reload and capture call the same inspection
service from direct tests and MCP. An adapter cannot rebuild facts from pixels, DOM structure, React
state, console text, BroMetal objects, or raw GPU objects.

## Test plan

The exact file split can become smaller during implementation. The named behavior cannot disappear.

| ID | Level | Test file or suite | Cases | Expected proof |
| --- | --- | --- | --- | --- |
| `TEST-01` | Unit and contract | `packages/devtools/src/receipt/receipt.test.ts` | Bootstrap import, valid receipt, missing relation, duplicate attempt, bad hash, corrupt temp file, and failed-run history | Receipt output is complete and never partial |
| `TEST-02` | Unit | `packages/devtools/src/config/config.test.ts` | Valid config, missing file, version, unknown field, unsafe host/path, port bounds, equal ports, and occupied ports | Validation is strict and has no side effects |
| `TEST-03` | Unit and contract | `packages/devtools/src/cli/cli.test.ts` | Help, version, dev, inspect, receipt, bad operation, error code, and exit result | CLI behavior is stable and scriptable |
| `TEST-04` | Unit and lifecycle | `packages/devtools/src/supervisor/supervisor.test.ts` | Ordered start, partial-start rollback, start failure, unexpected exit, signal race, repeated stop, and cleanup timeout | Each owned resource starts and stops safely |
| `TEST-05` | Unit and contract | `packages/devtools/src/inspection/service.test.ts` | IDs, build acceptance, pending and rejected changes, immutable snapshots, bounds, order, and redaction | The service is one bounded source of truth |
| `TEST-06` | Unit and security | `packages/devtools/src/bridge/protocol.test.ts` | Versions, malformed messages, size, stale IDs, wrong order, origin, credential, reconnect, backpressure, and shutdown | The bridge rejects unsafe input without state change |
| `TEST-07` | Contract | `packages/devtools/src/mcp/mcp.test.ts` | Discovery, resources, pagination, reload, capture, invalid input, wrong origin, wrong credential, and direct-call parity | MCP is a thin validated adapter |
| `TEST-08` | Browser integration | `packages/demos/src/react/LiveDemoStage.devtools.test.tsx` | Disabled mode, connect, ready, phase, stats, request dispatch, capture result, reconnect, and disposal | The page publishes safe facts only in development |
| `TEST-09` | Integration | Devtools live fixture suite | Valid TypeScript, shader, asset, and config changes; invalid shader; host and shader child failure | Builds, last-valid state, and diagnostics follow the contract |
| `TEST-10` | Browser and visual | Slice 00 verifier | Reference start, source update, reconnect, controlled reload, capture, fixed profile, and appearance comparison | The complete browser path works and the reference stays available |
| `TEST-11` | Lifecycle | Slice 00 verifier | Interrupt at each start stage, normal stop, child exit, browser disconnect, repeated cleanup, and port release | No owned child, listener, file handle, profile lock, or port leaks |
| `TEST-12` | Performance | Slice 00 verifier | Ten valid TypeScript edits, ten valid shader edits, invalid shader timing, traffic bounds, and cleanup timing | Every budget row has repeatable measurements |
| `TEST-13` | Boundary | Workspace checks and bundle inspection | Framework imports unchanged; browser protocol has no Node/MCP code; production bundle has no devtools bridge or Inspector | Ownership and production exclusion are enforced |
| `TEST-14` | Delivery | Slice 00 verifier fixtures | Frozen setup, port conflict, stale build/runtime, interruption, resume, retry exhaustion, denied authority, rollback, and prior-checkpoint smoke tests | Run rules and permissions are enforced |
| `TEST-15` | Complete | Root Slice 00 verifier | All tools, tests, acceptance rows, rubric rows, artifact hashes, and receipt validation | One clean command proves the slice |

### Required change cases

For each source or shader fixture update, record the change ID, content hash, detection time, build
result, build revision, runtime ID, ready time, and related artifact.

1. Start at build revision `0` and wait for the current runtime to become ready.
2. Apply one valid fixture edit and require build revision `1`.
3. Apply one invalid shader edit and require `SHADER_BUILD_FAILED` with revision still `1`.
4. Restore valid shader content and require build revision `2`.
5. Reconnect the bridge and require the same runtime ID with a new connection ID.
6. Request controlled reload and require a new runtime ID with the current build revision.
7. Request a capture and link it to the session, build, runtime, request, and capture IDs.
8. Repeat the valid edit fixture ten times. Require each accepted update to finish within `10 s`.

### Regression-first rule

For a reported error, add and run a failing regression test before the fix. Record the expected
failure and the later passing result in the receipt and evidence log.

## Reload, reconnect, recovery, lifecycle, and security

| Change or event | Expected behavior | State guarantee | Evidence |
| --- | --- | --- | --- |
| Valid TypeScript or demo source change | The current host applies the update or reconstructs the page | Build revision increments once after acceptance; session stays; runtime changes only on reconstruction | Live fixture and inspection events |
| Valid shader change | Compile the shader before the new result becomes current | Revision increments once; the runtime uses accepted generated output | Shader fixture and browser check |
| Invalid shader change | Reject the pending result and report `SHADER_BUILD_FAILED` | Last accepted generated output, revision, and healthy runtime remain current | Invalid fixture, snapshot, and capture |
| Asset change | Apply the host's supported update or reconstruct the runtime | A failed load keeps the last safe state when possible and reports a diagnostic | Asset fixture and browser check |
| Valid configuration change | Require an explicit supervisor restart | New session, service, connection, and runtime IDs; build revision resets to `0` | Restart integration test |
| Invalid configuration change | Reject before restart side effects | Current session stays unchanged; a new start attempt starts nothing | Config and live-process tests |
| Browser bridge disconnect | Mark the latest runtime snapshot stale | Session and runtime IDs stay; no operation is accepted while disconnected | Disconnect test and inspection |
| Bridge reconnect from the same runtime | Accept a new connection after handshake | Runtime ID and build revision stay; connection ID changes | Reconnect test |
| Full page reconstruction | Create a new browser runtime and wait for ready | Session and build revision stay; runtime and connection IDs change | Controlled reload test |
| Controlled reload failure | Return `RELOAD_FAILED` with observed IDs and health | Do not report a new runtime as ready unless its ready event passed validation | Failure-injection test |
| Capture failure | Return `CAPTURE_FAILED` and remove any partial output | No partial final capture exists; runtime and build state do not change | Capture failure test |
| Unexpected host or shader child exit | Mark the run unhealthy and perform bounded cleanup | No owned child, listener, port, or browser profile remains after successful cleanup | Fixture child and port probe |
| Normal supervisor shutdown | Stop accepting work, close adapters, stop children, release ports, and close the receipt attempt | Cleanup is ordered and safe if called again | Lifecycle test and process transcript |
| Run or evidence interruption | Close the failed attempt and resume only from a matching passing checkpoint | Old evidence stays immutable; the new attempt gets a new ID | Delivery fixture and receipt history |
| Software rollback | Run the last-known-good revision in an isolated worktree and create a corrective or revert commit if required | Active shared history is not rewritten; all development identities are new | Rollback rehearsal |

### Security rules

- Bind the host and inspection service to `127.0.0.1` only.
- Reject wildcard, LAN, public, proxied, and forwarded-host configurations in Slice 0.
- Allow only the exact configured page origin. Validate MCP origins where the client sends one.
- Create separate browser-bridge and MCP credentials. Give each at least `256` random bits.
- Store the credentials in run-owned ignored files below `.antiky/dev` with owner-only permission.
- Pass the bridge credential-file path only to the development host process. The server reads the
  file and supplies the value to a development-only runtime bootstrap. Do not compile the value
  into a client bundle.
- Supply the MCP credential in an authorization header. Do not put either credential in a URL,
  source map, artifact, receipt, console line, or diagnostic.
- Validate an exact origin when the request contains an origin. Allow an absent origin only for an
  authenticated loopback non-browser client.
- Compare credentials without an early-exit text comparison when the selected runtime supports it.
- Give read resources and changing tools separate internal capabilities.
- Limit reload and capture to the current run-owned runtime.
- Validate protocol version, schema, identity, order, size, and operation timeout before use.
- Copy safe data into service records. Never expose a child-process, server, socket, browser, React,
  DOM, BroMetal, or GPU object.
- Redact environment values, paths outside the repository, headers, tokens, and raw child output.
- Exclude the bridge endpoint, credential, MCP adapter, and WebGPU Inspector from production builds.
- Stop all new requests when shutdown starts. Close each owned resource once.

## Implementation checkpoints

Start these checkpoints only after every readiness row is `PASS`. Each checkpoint includes its tests,
evidence, and one short commit.

| ID | Deliverable | Files or ownership | Tests and evidence | Commit message | Status |
| --- | --- | --- | --- | --- | --- |
| `CP-00` | Base receipt schema, bootstrap-log importer, writer, and validator | New private devtools package scaffold, receipt module, root scripts, and Slice 00 fixtures | `TEST-01`; corrupt, failed, interrupted, and atomic-publish cases | `Bootstrap slice receipts` | `PENDING` |
| `CP-01` | Strict config, JSON Schema, CLI, and root config | Extend the devtools package, root scripts, and `antiky.config.json` | `TEST-02`, `TEST-03`, browser-safe boundary type check | `Add Antiky dev configuration` | `PENDING` |
| `CP-02` | Process supervisor, strict preflight, change tracker, build revisions, and cleanup | Devtools supervisor and fixture children | `TEST-04`, build-state cases in `TEST-05`, and process probes | `Supervise Antiky dev processes` | `PENDING` |
| `CP-03` | Typed inspection service, browser protocol, and development-only page adapter | Devtools inspection/bridge modules plus demos and website host seam | `TEST-05`, `TEST-06`, `TEST-08`, direct CLI snapshot, and production exclusion | `Expose development inspection` | `PENDING` |
| `CP-04` | MCP adapter, controlled reload, capture, authentication, and client discovery | Devtools MCP/server modules and browser adapter operations | `TEST-07`, security probes, official client transcript, reload and capture artifacts | `Add Antiky dev tools` | `PENDING` |
| `CP-05` | Complete verifier, live fixtures, budgets, rollback rehearsal, documentation, and final receipt | Devtools verifier, root script, objective evidence, and handoff docs | `TEST-09` through `TEST-15`, all acceptance and rubric rows | `Verify development harness` | `PENDING` |

Do not add Slice 01 world or lamp behavior during these checkpoints.

## Acceptance ledger

All rows are required.

| ID | REQUIRED result | Evidence method | Status | Direct evidence |
| --- | --- | --- | --- | --- |
| `AC-01` | `npm run antiky -- dev` validates config and starts the current town through one supervisor | CLI and clean-start integration test | `PENDING` | None |
| `AC-02` | Missing, malformed, unknown, unsafe, colliding, and occupied config values start no listener or child | Config fixtures, process probe, and before/after digest | `PENDING` | None |
| `AC-03` | The configured route reaches a ready canvas in the selected WebGPU browser | Browser verifier and reference capture | `PENDING` | None |
| `AC-04` | Development-session and service IDs stay stable for one supervisor lifetime | Inspection timeline | `PENDING` | None |
| `AC-05` | Bridge reconnect keeps the runtime ID and changes the connection ID | Browser reconnect test | `PENDING` | None |
| `AC-06` | Controlled reconstruction changes the runtime and connection IDs but keeps the session and accepted build revision | `dev_reload` result and status snapshots | `PENDING` | None |
| `AC-07` | A valid source change increments the build revision once and reaches a ready runtime | Live source fixture and correlated events | `PENDING` | None |
| `AC-08` | A valid shader change increments the build revision once and reaches the current runtime | Live shader fixture and correlated events | `PENDING` | None |
| `AC-09` | An invalid shader change keeps the last accepted output, build revision, and visible result | Invalid fixture, diagnostic, status, and capture | `PENDING` | None |
| `AC-10` | Direct tests, CLI, and MCP return the same session, build, runtime, render, and diagnostic facts | Adapter parity contract test | `PENDING` | None |
| `AC-11` | MCP discovery exposes the required resources and only the reload and capture changing tools | Official client transcript and capability audit | `PENDING` | None |
| `AC-12` | Controlled reload returns related request, build, old runtime, and new runtime IDs or one stable failure | Direct and MCP operation tests | `PENDING` | None |
| `AC-13` | Frame capture returns related request, capture, session, build, runtime, path, and hash values | Capture operation and artifact audit | `PENDING` | None |
| `AC-14` | Inspection data is versioned, bounded, copied, redacted, and contains no live implementation object | Service, protocol, and serialization tests | `PENDING` | None |
| `AC-15` | Ten valid TypeScript edits and ten valid shader edits each complete within `10 s` | `TEST-12` full sample set | `PENDING` | None |
| `AC-16` | Malformed, oversized, stale, wrong-origin, and unauthorized requests are no-ops with stable results | Security and protocol tests | `PENDING` | None |
| `AC-17` | Normal stop, interrupt, partial start, and child failure leave zero run-owned processes, listeners, locks, and ports | Lifecycle and process probes | `PENDING` | None |
| `AC-18` | `@antiky/framework` exports and imports remain unchanged | Revision diff and import-boundary test | `PENDING` | None |
| `AC-19` | The `town-study` reference behavior and appearance remain available | Existing tests and fixed-profile captures | `PENDING` | None |
| `AC-20` | Normal inspection adds no GPU readback, resource creation, draw, or queue submission | `GPU-00` through `GPU-04` | `PENDING` | None |
| `AC-21` | The production bundle contains no local bridge, credential, MCP server, or WebGPU Inspector | Production bundle and route probe | `PENDING` | None |
| `AC-22` | `npm run check` passes | Workspace command | `PENDING` | None |
| `AC-23` | `npm run verify:slice-00` passes from one clean isolated start | Complete verifier | `PENDING` | None |
| `AC-24` | The run uses the frozen setup and no resource from another run | Preflight, allocation record, and receipt | `PENDING` | None |
| `AC-25` | The receipt links each required result through run, attempt, checkpoint, change or request, service/runtime, and artifact IDs | Receipt validator and final audit | `PENDING` | None |
| `AC-26` | Every failed attempt, retry, resume, and rollback follows its defined rule | Delivery fixture and receipt history | `PENDING` | None |
| `AC-27` | The last-known-good revision passes the reference and health checks in an isolated rollback rehearsal | `TOOL-11` and receipt | `PENDING` | None |
| `AC-28` | Every changing operation stays inside the permissions table and uses no production or external authority | Receipt permission audit | `PENDING` | None |
| `AC-29` | The plan has no blocker, unresolved owner choice, placeholder, or unexplained `N/A` | Final plan audit | `PENDING` | None |
| `AC-30` | Every unexpected result has a disposition and the after-completion record names owners and paths | Learning-log and handoff audit | `PENDING` | None |

## Success rubric

Scores: `0` no evidence, `1` partial or one-time manual result, `2` repeatable main path with a
missing edge or proof, `3` complete with repeatable direct evidence. Do not average scores.

| ID | Dimension | Score required | Current score | Evidence or gap |
| --- | --- | --- | --- | --- |
| `RUB-01` | Outcome and scope | `3` | `0` | No supervisor, config, or complete command exists |
| `RUB-02` | Framework alignment | `3` | `2` | Source snapshot exists; implementation-start refresh and runtime baselines remain |
| `RUB-03` | Framework design | `3` | `2` | The plan preserves the headless boundary; code and boundary tests remain |
| `RUB-04` | Correctness | `3` | `0` | Required unit, contract, browser, and delivery tests do not exist |
| `RUB-05` | Inspectability | `3` | `0` | The service, CLI, MCP adapter, reload, and capture do not exist |
| `RUB-06` | Render efficiency | `N/A` | `N/A` | Accepted reason: Slice 0 adds no render or GPU-state change; `GPU-00` through `GPU-04` guard this boundary |
| `RUB-07` | Failure and recovery | `3` | `0` | Last-valid, retry, resume, and rollback tests do not exist |
| `RUB-08` | Lifecycle and security | `3` | `0` | Loopback, credential, process, and cleanup proof is absent |
| `RUB-09` | Reference and performance | `3` | `0` | Runtime baselines and ten-edit results are missing |
| `RUB-10` | Reproduction and handoff | `3` | `1` | Commands and paths are named but not implemented |
| `RUB-11` | Autonomous execution | `3` | `1` | The run contract exists; isolated execution and receipt proof are missing |
| `RUB-12` | Operation and learning | `3` | `1` | Owners and paths are planned; no completed run or finding disposition exists |

## Evidence log

| Date | Run ID | Attempt | Revision | Evidence ID | Correlation ID | Command or operation | Result | Artifact or output |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| 2026-08-04 | `PLAN` | `0` | `79a5de6cabb7f9a9db63eb565c38f3c3a11d77cd` | `PRE-03`, `CAP-01` through `CAP-16` | `N/A` | Inspect scripts, manifests, lock file, routes, host, runtime, framework, tests, and docs | Current capabilities and gaps are recorded | This plan's alignment and inventory tables |
| 2026-08-04 | `PLAN` | `0` | Same revision | `HYP-01` through `HYP-10` | `N/A` | Compare research with current source and accepted package boundaries | Proposed host, package, service, and tool boundary is recorded | Missing-capability and option tables |
| 2026-08-04 | `PLAN` | `0` | Same revision | `PRE-13`, `HYP-06`, `HYP-07` | `N/A` | Review official MCP TypeScript SDK server and transport guidance | Official SDK supports the required server transports; exact stable packages remain an owner-approved input | Drift rule and decision table |
| 2026-08-04 | `PLAN` | `0` | Same revision | `CAP-15`, `GPU-04` | `N/A` | Review WebGPU Inspector against the semantic inspection need | Useful optional GPU investigation; not the source for Antiky session or build facts | GPU and tool sections |

## Delivery failure and learning log

| Date | Run and attempt | Class | Unexpected result or intervention | Disposition | Evidence and status |
| --- | --- | --- | --- | --- | --- |
| 2026-08-04 | `PLAN` | `PROCESS_GAP` | Slice 01 depended on Slice 0, but Slice 0 had research and a high-level implementation entry only | Add this executable plan, apply the strengthened workflow, and link it from Slice 01 and the objective index | This document and link audit; `CLOSED` |
| 2026-08-04 | `PLAN` | `PROCESS_GAP` | The earlier slice workflow did not require isolated run identity, a complete receipt, bounded retries, rollback proof, or after-completion ownership | Keep the strengthened shared rules and make `CP-00` create the base receipt tools | Workflow, template, and execution contract; `CLOSED` |

During implementation, record unplanned intervention, retry, flaky check, permission escalation,
missed check, and blocked time. Keep every failed attempt in the receipt.

## After completion

| Area | Owner | Signal or source | Trigger | Required action |
| --- | --- | --- | --- | --- |
| Development-harness health | Framework maintainers | `npm run verify:slice-00`, session health, and stable diagnostics | A required check fails or cleanup reports an owned resource | Triage the failing layer, add a regression test, and recover or roll back |
| Human feedback | Antiky project owner | `docs/objectives/01-FEEDBACK_H.txt` | A new report concerns the harness or inspection contract | Triage it through the objective workflow before implementation |
| Agent findings | Antiky project owner | `docs/objectives/02-AGENT-FINDINGS_A.txt` | An agent finds a gap, unsafe behavior, or drift | Record evidence and triage it before scope grows |
| Regression and rollback | Framework maintainers | Complete verifier and the latest passing checkpoint | Reference, security, receipt, or cleanup gate fails | Stop unsafe use and run the documented rollback rehearsal |
| MCP dependency review | Framework maintainers | Official SDK releases and lock-file audit | Upgrade, advisory, or protocol change | Re-run client, security, resource, tool, and receipt contract tests |
| Deprecation or retirement | Antiky project owner | Consumer inventory and replacement proof | A later Studio or hosted tool replaces one local adapter | Approve the replacement, migrate consumers, and remove the old adapter in a separate change |

Slice 0 has no deployed service or continuous production monitor. Its health signal is the local
complete verifier and the status of each active development session.

## Drift and discovery log

| Date | Change or discovery | Effect on the plan | Decision and approver |
| --- | --- | --- | --- |
| 2026-08-04 | Current scripts hard-code or split route, port, shader, and host behavior | Slice 0 needs strict config and one supervisor before it adds inspection | `C1 + 0A`, proposed for owner approval |
| 2026-08-04 | Runtime phase and render stats exist only in React-local state | Add a development-only browser adapter and typed inspection service | `0T-A`, proposed for owner approval |
| 2026-08-04 | `@antiky/framework` remains empty and headless | Keep all Slice 0 Node, host, MCP, and receipt work outside framework core | `0P-A`, proposed for owner approval |
| 2026-08-04 | Official MCP TypeScript SDK guidance supports Streamable HTTP, but the package surface is in transition | Pin and test one stable official package set; do not mix major-version examples | Exact versions remain blocked on owner approval |
| 2026-08-04 | WebGPU Inspector can provide low-level GPU facts but not Antiky semantic facts | Keep it optional and make the typed inspection service mandatory | Plan decision; owner approval pending |
| 2026-08-04 | The strengthened workflow requires an atomic machine-readable receipt before later slice work | Add receipt bootstrap as `CP-00` | Plan decision; owner approval pending |

## Final completion declaration

Current declaration: **NOT COMPLETE**

The owner can change this declaration to `COMPLETE` only when:

- [ ] Every applicable readiness row is `PASS`.
- [ ] Every implementation option and dependency is approved and recorded.
- [ ] Every applicable acceptance row is `PASS`.
- [ ] Every applicable rubric row scores `3`.
- [ ] Every `N/A` has an accepted reason.
- [ ] The complete verification command passes from a clean isolated start.
- [ ] Evidence names the final revision and all checkpoint commits.
- [ ] The run state is `CLOSED`.
- [ ] The evidence receipt validates and links every required result.
- [ ] Every failed attempt has a resolved class and disposition.
- [ ] The after-completion record names each owner and feedback path.
- [ ] The `town-study` reference remains available.
- [ ] The framework core remains unchanged.
- [ ] No placeholder, blocker, or owner choice remains.
- [ ] The final audit confirms the original Slice 0 outcome.

Final evidence revision: `PENDING`

Final audit result: `PENDING`
