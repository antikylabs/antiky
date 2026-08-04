# Slice 00: Start the Antiky Development Runtime

This plan is the implementation contract. The accepted owner decisions are in
[`owner-input_H.md`](owner-input_H.md).

## Control

| Field | Value |
| --- | --- |
| Status | `READY` |
| Outcome | One command starts, inspects, and stops the current town through Antiky |
| Owner input | [`owner-input_H.md`](owner-input_H.md) |
| Architecture decision | [ADR 0004: Make CLI and Studio use the same engine services](../../../adr/studio/0004-share-engine-services-with-cli_H.md) |
| Depends on | None |
| Alignment revision | `441563bcce94abd76fb6813869e603e13f116b5a` |
| Complete check | `npm run verify:slice-00` |
| Evidence | `docs/objectives/antiky-town/slice-00/outputs/{run-id}/receipt.json` |

The goal runner must read the owner-input file before implementation. It must stop if the file has a
`PENDING` answer. It must use the inline answers as part of this contract.

After the owner-input status is `ANSWERED`, use:

```text
/goal implement docs/objectives/antiky-town/slice-00/plan.md until complete
```

## Review summary

Slice 00 makes these changes:

- Create `@antiky/cli` with the `antiky` command.
- Add the first small inspection capability to `@antiky/framework`.
- Let `antiky dev` start and supervise the current town.
- Let CLI, Studio, MCP, and tests use one engine service surface.
- Keep Studio UI, world state, entities, commands, and rendering abstractions for later slices.

This slice does add framework code. The prior plan statement that the framework stays unchanged was
incorrect.

## Outcome

One command starts the current town in a local development session. A person or agent can inspect
the session through structured Antiky data. The same command can stop all owned resources safely.

The first launch target is the existing `town-study` route in the current Next.js host.

## One service, different clients

```text
                              starts and supervises
antiky CLI ------------------------------------------------> development host
Studio host ----------------------------------------------- attaches to it
                                                                  |
                                                                  v
                                                         current game host
                                                                  |
                                                                  v
CLI / Studio / MCP / tests ---> shared service surface ---> framework runtime
```

CLI and Studio are not the same application. They are separate adapters over the same service
surface. Studio must not parse terminal output or implement a second engine API.

The CLI package can contain the first development-host implementation. Extract a separate host
package only when a second in-process consumer proves that need.

## Ownership

| Owner | Owns in Slice 00 | Does not own |
| --- | --- | --- |
| `@antiky/framework` | Semantic inspection contract, runtime diagnostics, and engine or render measurements | Node.js processes, ports, Next.js, MCP, Studio UI, or terminal output |
| `@antiky/cli` | Config, launch, build tracking, local connections, adapters, capture requests, and cleanup | Game truth, engine rules, or Studio panels |
| Demo and website host | Current browser lifecycle and the adapter that publishes real runtime facts | The inspection schema or development-session authority |
| Studio | A future visual client of the same services | A separate launcher or engine API |
| Delivery verifier | Run evidence and the Slice 00 receipt | A public framework or CLI feature |

A semantic measurement describes the game or engine. Examples are a frame count, draw count, or
simulation step. The framework owns these meanings.

A development measurement describes the tool run. Examples are build time, reload time, child
process health, or cleanup time. The CLI development host owns these meanings.

## Required reading

- [`owner-input_H.md`](owner-input_H.md)
- [`SLICE_WORKFLOW_A.md`](../SLICE_WORKFLOW_A.md)
- [`DEV_HARNESS_RESEARCH_A.md`](../DEV_HARNESS_RESEARCH_A.md)
- [`INSPECTION_TOOLING_A.md`](../INSPECTION_TOOLING_A.md)
- [`IMPLEMENTATION_PLAN_A.md`](../IMPLEMENTATION_PLAN_A.md)
- [ADR 0003: Use one engine API for humans and agents](../../../adr/framework/0003-agent-native_H.md)
- [ADR 0004: Make CLI and Studio use the same engine services](../../../adr/studio/0004-share-engine-services-with-cli_H.md)
- [`framework/overview_A.md`](../../../architecture/framework/overview_A.md)
- [`studio/overview_A.md`](../../../architecture/studio/overview_A.md)
- [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md)

## Current state

At the alignment revision:

- `@antiky/framework` has no exported capability.
- The root development script dispatches to workspaces.
- `town-study` runs through the website and demos packages.
- `LiveDemoStage` owns browser lifecycle and render statistics.
- Runtime facts stay inside React state.
- No Antiky CLI, config, inspection service, browser bridge, or MCP adapter exists.
- The Studio package has no implementation.

The implementation agent captures the working route, appearance, launch time, update behavior,
failure behavior, and cleanup behavior before it changes code. This is implementation checkpoint
`CP-00`. It is not owner work.

## Framework deliverable

Add a small, headless inspection module to `@antiky/framework`.

The module supplies:

- A versioned `InspectionSnapshot` data contract.
- An `InspectionSource` that reads the latest immutable snapshot.
- A subscription that reports a newer snapshot.
- Structured runtime diagnostics.
- Semantic runtime and render measurements that the current demo can report truthfully.

The first snapshot contains only these facts:

- Schema version.
- Runtime instance ID and lifecycle state.
- Current diagnostics.
- Available frame and render measurements.

The module must not import Node.js, React, Next.js, BroMetal, browser globals, Studio, or MCP. It
must not add the world, entity, command, event, or render-driver model.

Later slices will extend the same service surface with engine sessions, entities, commands, assets,
and render graphs. They must not replace it with a Studio-only or MCP-only service.

## CLI deliverable

Create `packages/cli` as the `@antiky/cli` workspace package. Export the `antiky` executable.

Slice 00 supplies these commands:

- `antiky dev` validates config, starts the development host, starts the game, and owns cleanup.
- `antiky inspect` reads the same structured service that Studio and MCP can use.
- `antiky mcp` connects an MCP client to that service when the selected client needs a standard I/O
  adapter.

Add a strict, versioned `antiky.config.json`. Reject unknown fields before any process starts. The
config names the game command, working directory, game URL, loopback address, game port, and
inspection port.

The development host publishes a `DevelopmentSnapshot`. It contains the development-session ID,
accepted build revision, process and connection health, development diagnostics, and the latest
framework `InspectionSnapshot`.

The CLI must not calculate engine facts from terminal text, the DOM, React state, screenshots, or
BroMetal objects.

## Host, MCP, and Studio boundary

The browser adapter maps the existing runtime phase and render statistics into the framework
inspection contract. It sends a validated snapshot to the local development host.

The MCP adapter reads the same service used by `antiky inspect`. It contains transport and
permission logic only. It does not contain game or engine rules.

Slice 00 proves a Studio-compatible connection contract. It does not build a Studio panel or
desktop host. Studio implementation starts after the first town port.

Do not integrate WebGPU Inspector. Use it only as a design reference. Antiky's native inspection
scope is defined in [`INSPECTION_TOOLING_A.md`](../INSPECTION_TOOLING_A.md).

## User-facing documentation deliverable

- Add framework guidance for inspection snapshots, subscriptions, diagnostics, and measurements.
- Add CLI guidance for config, `antiky dev`, `antiky inspect`, `antiky mcp`, errors, and cleanup.
- Update Studio guidance if the owner-approved work changes a Studio workflow. Otherwise, record
  `N/A` and the reason.
- Check every command, config example, and local link that these pages contain.

## Safe behavior

| Event | Required result |
| --- | --- |
| Invalid config or busy port | Return a stable error and start no partial session |
| Invalid source or shader update | Keep the last valid build and publish a diagnostic |
| Browser reload | Keep the development-session ID and create a new runtime ID |
| Runtime disconnect | Mark the runtime unavailable and allow one valid reconnect |
| Invalid or unauthorized request | Return a stable rejection and change no state |
| Normal stop, interrupt, or child failure | Stop every owned child and release every owned port |

Bind local services to `127.0.0.1`. Use a random credential for each development session. Do not put
the credential in a URL, log, diagnostic, capture, or inspection result.

Validate message versions, origins, sizes, and fields at the browser and MCP boundaries. Exclude the
local bridge, credentials, and MCP server from production website output.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Capture baselines and select exact tools, dependencies, ports, and fixtures | Baseline record and clean preflight | `Record Slice 00 baseline` |
| `CP-01` | Add the framework inspection contract and store | Headless unit and import-boundary tests | `Add framework inspection` |
| `CP-02` | Add CLI config, launch, supervision, and cleanup | CLI and process integration tests | `Start games with Antiky CLI` |
| `CP-03` | Connect the browser runtime and publish both snapshot types | Browser and direct-inspection parity tests | `Connect runtime inspection` |
| `CP-04` | Add MCP, reload, capture, security, and reconnect behavior | Protocol, lifecycle, and client tests | `Expose Antiky development tools` |
| `CP-05` | Add the complete verifier and evidence receipt | Clean end-to-end run | `Verify Slice 00` |

Each checkpoint must include its tests. Each checkpoint must leave the repository in a working
state. A checkpoint that changes public framework, CLI, or Studio behavior must update the matching
page under `docs/user-facing-docs/`.

## Test plan

The implementation must add tests for these boundaries:

- Framework snapshot immutability, subscription order, diagnostics, and measurements.
- Framework imports that reject Node.js, React, Next.js, Studio, MCP, and BroMetal dependencies.
- Config success, unknown fields, unsafe paths, invalid ports, and busy ports.
- Child start, partial start, child failure, interrupt, cleanup, and port release.
- Browser message validation, reconnect, reload, capture, and last-valid shader behavior.
- Direct, CLI, MCP, and Studio-compatible client results from one service source.
- Unauthorized, wrong-origin, stale, malformed, and oversized messages.
- Production output that contains no local inspection server or session credential.
- User-facing CLI commands, config examples, and framework links.
- Ten valid source updates and ten valid shader updates. Each update must reach a ready runtime in
  ten seconds or less on the recorded test system.

Run `npm run check` before the complete Slice 00 verifier.

## Completion checks

Slice 00 is complete only when all these statements are true:

- [ ] The owner-input file has status `ANSWERED` and no pending answer.
- [ ] `antiky dev` starts the selected town from one strict config.
- [ ] The selected town reaches a ready WebGPU canvas.
- [ ] `@antiky/framework` supplies the semantic inspection snapshot and measurements.
- [ ] `@antiky/cli` supplies launch, development state, inspection, and safe cleanup.
- [ ] Direct, CLI, MCP, and Studio-compatible clients use the same service facts.
- [ ] Framework and development measurements remain separate and identify their owner.
- [ ] Reload creates the correct development and runtime identities.
- [ ] A bad update keeps the last valid result and reports a diagnostic.
- [ ] Reload and capture operations return related structured IDs.
- [ ] Security, payload, production-exclusion, and cleanup tests pass.
- [ ] Framework, CLI, and applicable Studio docs match the shipped behavior and pass their checks.
- [ ] The update timing test passes on the recorded system.
- [ ] The current town reference remains available and has no unapproved visual change.
- [ ] `npm run check` passes.
- [ ] `npm run verify:slice-00` passes from one clean start.
- [ ] The evidence receipt records the revision, environment, dependencies, checkpoints, attempts,
  failures, tests, measurements, and artifacts.

## Run and evidence rule

The shared slice workflow controls isolation, retries, rollback, permissions, and evidence. The
implementation agent records the run-specific values in the evidence receipt. This plan does not
repeat empty operational tables.

Each run writes `receipt.json`, `confirmation-checks.md`, `facts.json`, and `measurements.json` in
this slice's `outputs/{run-id}/` directory. Store captures and logs there only when a check needs
them.

Use a clean revision and isolated resources. Record failed attempts. Retry only a classified
transient failure. Restore the latest passing checkpoint when a change makes the harness unsafe.

If implementation finds a product-scope or public-contract question, add it to the owner-input file
with context. Stop only the affected work until the owner answers it.
