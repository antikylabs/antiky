# Slice 01: Change One Market Lamp Through Antiky

This plan is the implementation contract. The accepted owner decisions are in
[`owner-input_H.md`](owner-input_H.md).

## Control

| Field | Value |
| --- | --- |
| Status | `COMPLETE` |
| Outcome | One command changes one market lamp through the complete framework path |
| Owner input | [`owner-input_H.md`](owner-input_H.md) |
| Depends on | [`../slice-00/plan.md`](../slice-00/plan.md) completed |
| Alignment revision | `c59085bf6f2f887023675b7e1297900862b5177e` |
| Complete check | Finished; see the saved results below |
| Closeout | [Slice 01 summary](slice-summary.md) |

The goal runner must read the owner-input file and completed Slice 00 evidence. It must stop on a
`PENDING` answer or incomplete Slice 00. Run `/goal implement docs/objectives/antiky-town/slice-01/plan.md until complete`.

Slice 00 completed before the focused Vite host and tools-only MCP surface shipped. `CP-00` must
realign the Slice 00 verifier and make its clean verification pass before point-light work starts.
`antiky dev` starts the game, inspection, and HTTP MCP services together. Do not start a second MCP service.

## Outcome

An accepted command changes the base power of one market lamp through Antiky Framework. The new
value is visible in Antiky Town and available through structured inspection.

At completion:

- `Market Lamp West 01` starts at base power `1.05`.
- An authorized command can set a finite base power from `0` through `4`.
- The next frame uses the new value without a page reload.
- Direct, CLI, Studio-compatible, and MCP inspection report the same state.
- Invalid, unauthorized, duplicate, stale, and out-of-range requests change no state.
- Correction-based undo restores `1.05` as a new accepted fact.

The current flicker remains presentation behavior. It does not change authoring state or create an
event on each frame.

The framework point-light service supports multiple lamps by stable ID. Slice 01 ports one lamp to the
visible town. A second headless lamp proves that the service is not a single-object special case.

### Non-goals

- A general entity-component-system, registry, scheduler, or schema library.
- Durable history or a database.
- The Slice 02 fixed-step clock.
- Porting all lights or the complete town.
- A general render driver, render graph, or BroMetal change.
- Studio panels, multiplayer, or production authentication.

## Named object and reference

The slice uses practical-light slot `0` from `town-study`.

| Field | Required value |
| --- | --- |
| Label | `Market Lamp West 01` |
| Stable ID | One fixed UUIDv7 in authored content |
| Position | `[-3.565, 4.237, 6.82]` world units |
| Color | `[1, 0.52, 0.22]` linear RGB |
| Radius | `4` world units |
| Base power | `1.05` |
| Render slot | `0` |
| Initial authoring revision | `1` |

The ID stays fixed after rename, reload, replay, and state rebuild. Runtime index `0` and render slot
`0` are temporary aliases. They do not enter authored data or accepted events.

The implementation agent captures the fixed-camera visual reference, actual GPU writes, draw count,
and resource count before code work. It keeps `town-study` runnable.

## Data and authority path

```text
test, typed CLI client, Studio, or MCP Tool
  -> SetPointLightPower command
  -> trusted context and validation
  -> point-light authoring service
  -> PointLightPowerSet accepted fact
  -> runtime lamp projection
  -> render entry and dirty slot 0
  -> town adapter
  -> existing BroMetal uniforms
  -> visible lamp
```

Authoring state is the source of truth. The local host supplies identity, permissions, receipt time,
and runtime identity. Command data cannot supply trusted values.

Render state and GPU values never decide the command result. The adapter resolves the stable ID to
slot `0` before the frame loop.

## Ownership

| Owner | Owns in Slice 01 | Does not own |
| --- | --- | --- |
| `@antiky/framework` | IDs, lamp data, command decision, accepted facts, projections, and inspection | BroMetal, React, DOM, website, Node.js host, or MCP transport |
| `antiky-town` | Composition and the narrow mapping from lamp render data to town slot `0` | Command authority or general framework storage |
| `brometal-town` | Reference rendering and a narrow input seam with unchanged defaults | Framework identity or history |
| CLI, Studio, and MCP | Presentation or transport over shared services | Engine rules, a second lamp service, or state copies |

## Required reading

- [`owner-input_H.md`](owner-input_H.md)
- [`../slice-00/plan.md`](../slice-00/plan.md) and its completed outputs
- [`SLICE_WORKFLOW_A.md`](../../SLICE_WORKFLOW_A.md)
- [`IMPLEMENTATION_PLAN_A.md`](../../IMPLEMENTATION_PLAN_A.md)
- [ADR 0001: Use MCP Tools for local development](../../../../adr/cli/0001-use-mcp-tools-for-development_H.md)
- [ADR 0007: Use commands to change world state](../../../../adr/framework/0007-commands-as-mutation-boundary_H.md)
- [ADR 0009: Keep authoring, runtime, and render state separate](../../../../adr/framework/0009-separate-state-projections_H.md)
- [ADR 0011: Use stable IDs and temporary numeric aliases](../../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
- [`rendering-and-assets_A.md`](../../../../architecture/framework/rendering-and-assets_A.md)
- [`GOOD_ENGINEERING_H.md`](../../../../GOOD_ENGINEERING_H.md)

## Framework deliverable

Add only the framework behavior that this lamp proves and later point lights can reuse:

- Branded UUIDv7 `WorldId`, `EntityId`, and `CommandId` creation and validation.
- Versioned `Transform` and `PointLight` records with explicit validation.
- A point-light authoring service with private storage, immutable reads, and one writer.
- More than one point-light record keyed by stable `EntityId` values.
- `SetPointLightPower` behavior for any registered point light, with validation, authority,
  duplicate detection, revision checks, and stable results.
- A bounded in-memory `PointLightPowerSet` history with replay and correction-based undo.
- Runtime and render projections that apply each accepted revision once.
- Lamp inspection through the Slice 00 inspection source.

Keep storage maps, mutation functions, and event application private. Do not export a generic
registry, query engine, scheduler, event store, or render graph.

## Command contract

| Field | Rule |
| --- | --- |
| Protocol and command version | `1` |
| Type | `antiky.authoring.set-point-light-power` |
| IDs | Valid command, world, and lamp UUIDv7 values |
| Expected revision | Must equal the current non-negative authoring revision |
| Data | One finite `power` value from `0` through `4` |
| Encoded limit | `4 KiB` at a process or MCP boundary |
| Trusted context | Supplied separately by the host |
| MCP reads | `list_point_lights` and `get_point_light` |
| MCP changes | `set_point_light_power` and `correct_point_light_power` |
| MCP transport | HTTP `/mcp` from `antiky dev`; stdio is a compatibility fallback |

An accepted command increments the revision once and adds one versioned accepted fact. The fact
records old and new power, event sequence, source command, world, lamp, resulting revision, trusted
time, and an optional correction link.

A same-value request returns `NO_OP`. It does not change the revision, history, or projections.

Keep at most `256` command results and `256` accepted facts in one demo runtime. Reject the next
change before a limit is exceeded. A runtime reconstruction resets this history but keeps stable
world and lamp IDs.

Use these stable result codes:

- `ACCEPTED` and `NO_OP`.
- `INVALID_COMMAND`, `WORLD_NOT_FOUND`, and `ENTITY_NOT_FOUND`.
- `MISSING_PERMISSION`, `DUPLICATE_COMMAND`, and `STALE_REVISION`.
- `VALUE_OUT_OF_RANGE`, `HISTORY_CAPACITY_REACHED`, and `EVENT_SEQUENCE_ERROR`.

A rejected request changes no authoring, history, runtime, render, or GPU-resource state.

The framework service must not contain `Market Lamp West 01`, render slot `0`, or another
town-specific value. The Antiky Town adapter owns that mapping.

The four new MCP Tools call the same typed development client as direct and Studio-compatible
clients. They use strict schemas and bounded results. Do not add MCP Resources that duplicate these
Tools. `antiky inspect` includes the lamp inspection snapshot; do not add a lamp-specific shell
command.

## Demo and render deliverable

Add a town-local seam that can supply slot `0` base power. Keep the existing default values for
`town-study`.

Register the `antiky-town` demo slug only after the framework service, projection, and adapter pass.
Run it at the focused Vite host root through `antiky.config.json`. The Antiky Town composition root
owns the lamp service and connects it to the current town factory. Keep `town-study` registered.

BroMetal `0.14.0` writes a complete program uniform block on the first draw of a frame. The four
affected source-derived block sizes total `2,112` bytes per frame. The runtime baseline must confirm
this estimate.

Slice 01 must not claim a four-byte GPU write. A power change must:

- Mark only Antiky render slot `0` and its base-power field.
- Perform zero GPU readbacks.
- Create no program, geometry, texture, target, or buffer.
- Add no draw or GPU queue submission.
- Keep static light position, radius, and color data stable.
- Use the existing next-frame uniform path and presentation flicker.
- Keep the last valid state and resources after failure.
- Dispose each owned resource and listener once.

## User-facing documentation deliverable

- Update framework guidance for adding point lights, light identity, commands, results, and
  inspection.
- Include one valid example that changes and then corrects the market lamp power.
- Update CLI guidance for the four new MCP Tools and automatic HTTP endpoint.
- Update Studio guidance only if its connection workflow changes. Otherwise, record `N/A` and why.

## Safe lifecycle and security

| Event | Required result |
| --- | --- |
| Invalid or unauthorized command | Stable result and no state change |
| Duplicate or stale command | Stable result with safe related revision data |
| Projection or adapter failure | Keep the last valid authoring and render values |
| Framework or town reload | Rebuild from authored `1.05`; keep stable IDs; use a new runtime ID |
| Inspection reconnect | Report the same live lamp revision when the runtime still exists |
| Disposal or shutdown | Reject later commands and release each resource once |

Read operations do not change state. Change operations need a trusted identity with
`world.light.edit`. Diagnostics must not expose credentials, raw permissions, live objects, DOM,
BroMetal resources, or GPU resources.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Realign the harness; capture lamp, render, and visual baselines | Current Slice 00 verifier plus fixed evidence | `Record Slice 01 baseline` |
| `CP-01` | Add IDs, lamp records, and validators | Framework unit tests | `Add lamp identity and data` |
| `CP-02` | Add command, history, replay, undo, and projections | Headless command and parity tests | `Add market lamp command flow` |
| `CP-03` | Extend shared inspection with lamp facts and operations | Direct, CLI, Studio-compatible, and MCP parity | `Expose market lamp inspection` |
| `CP-04` | Add reference seam, town adapter, and Antiky Town demo | Render, lifecycle, and visual tests | `Connect market lamp rendering` |
| `CP-05` | Add complete verifier and receipt mapping | Clean end-to-end run | `Verify Antiky Town slice one` |

Each checkpoint includes tests and leaves the repository in a working state.
A checkpoint that changes public framework, CLI, or Studio behavior also updates the matching page
under `docs/user-facing-docs/`.

## Test plan

Add headless and integration tests for:

- UUIDv7 validation and fixed fixture identity.
- Component defaults, finite values, units, bounds, and immutable reads.
- Two registered point lights that use the same service without shared state or special-case code.
- Accepted, same-value, malformed, missing, unauthorized, duplicate, stale, and out-of-range
  commands.
- Capacity rejection, ordered replay, sequence gaps, correction, and complete rebuild parity.
- Exactly-once authoring, runtime, and render revision application.
- Direct, CLI, Studio-compatible, and MCP query and command parity.
- Tools-only MCP discovery through the HTTP endpoint that `antiky dev` starts.
- Slot `0` updates, unchanged other lights, full uniform writes, zero readback, stable resources, and
  exactly-once disposal.
- Reload, reconnect, invalid replacement, shutdown, and focused-host parity.
- Before, changed, and corrected fixed-camera captures.
- Import boundaries that keep BroMetal, DOM, React, website, and Node.js host code out of framework.
- User-facing framework examples, links, and any affected CLI or Studio workflow.

For every rejection, compare value, revision, fact count, runtime value, render value, and dirty
count before and after. All six values must stay unchanged.

The accepted fixture changes power from `1.05` to `2.0` at revision `1`. It reaches revision `2` and
event sequence `1`. Correction restores `1.05` at revision `3` and event sequence `2`.

## Completion checks

- [x] The owner-input file is `ANSWERED` and Slice 00 is complete.
- [x] The focused Antiky Town host shows the reference town and lamp.
- [x] The fixed lamp ID, data, revision, history, and render binding are inspectable.
- [x] The same framework service supports a second headless point light without town-specific code.
- [x] The accepted fixture reaches authoring, runtime, render, and the next frame.
- [x] Every rejected fixture changes no state copy, history, dirty range, or GPU resource.
- [x] Replay, complete rebuild, and correction produce the required state.
- [x] Direct, CLI, Studio-compatible, and MCP clients report the same framework facts.
- [x] Only render slot `0` becomes dirty.
- [x] Actual BroMetal writes are measured without a false partial-write claim.
- [x] The normal path has zero GPU readback, new resources, extra draws, and extra submissions.
- [x] Reload, reconnect, failure, disposal, shutdown, and security tests pass.
- [x] Framework and applicable CLI or Studio docs match the shipped behavior and pass their checks.
- [x] `town-study` remains available with no unapproved visual change.
- [x] Framework tests and `npm run check` pass.
- [x] The final complete check passed from one clean start.
- [x] The evidence receipt links the run, attempts, checkpoints, commands, facts, revisions,
  projections, runtimes, measurements, captures, tests, and artifacts.

## Run and evidence rule

The shared workflow controls isolation, permissions, retries, rollback, and receipt content. Record
actual run values in the receipt. Do not put production, deployment, secrets, or external messages
in this slice.

Each run writes `receipt.json`, `confirmation-checks.md`, `facts.json`, and `measurements.json` in
this slice's `outputs/{run-id}/` directory. Store captures and logs there only when a check needs
them.

Use a clean revision and isolated resources. Record all attempts. Restore the latest passing
checkpoint when a regression or unsafe behavior cannot be fixed forward.

After completion, framework and demo maintainers own the verifier and health checks. Human feedback goes
to `docs/objectives/01-FEEDBACK_H.txt`; agent findings go to `docs/objectives/02-AGENT-FINDINGS_A.txt`.
