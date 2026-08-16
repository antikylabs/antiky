# Integration proof and verification

This document defines the proving fixtures, evidence levels, acceptance matrix, measurements, and
closeout requirements. No one unit or fake-agent test can establish the complete click-to-agent
claim.

## Proof assets

### Deterministic fake ACP agents

Test subprocesses implement only the protocol behavior required by each test. They make request
ordering, capability variants, permission races, cancellation, malformed output, stderr pressure,
child exit, and slow shutdown deterministic. They are protocol fixtures, not evidence that a real
agent is usable.

### Two real ACP agents or adapters

Run the same native host and public Studio state projection against two independently implemented ACP
v1 agents or adapters available in the execution environment. Record profile configuration,
versions, capabilities, MCP transport, and observed permission behavior. Vendor-specific launch
arguments are configuration; vendor-specific branches in `AgentHost`, the coordinator, or panel fail
the boundary proof.

### Existing BroMetal selection fixture

Reuse and extend the fixture owned by the BroMetal request objective. It must publish a retained
root-to-target hierarchy, components, and at least one meaningful authoring, runtime, and render
semantic entry for a selected entity. A second synthetic selection fixture can support fast tests but
cannot replace the actual displayed-pixel GPU proof.

## Evidence levels

| Level | Proves | Does not prove |
| --- | --- | --- |
| Contract/unit | Validation, ordering, bounds, context derivation, reducers, state transitions. | Child-process I/O, real ACP behavior, native UI, or GPU selection. |
| Fake-process integration | SDK/stdin/stdout behavior, bidirectional requests, cancellation, failure cleanup, Tauri DTO projection. | Compatibility with independent agents or provider UX. |
| Browser/native UI integration | Panel behavior, accessibility, terminal switching, stale/partial presentation, project lifecycle. | Agent protocol portability or real GPU identity. |
| Two-agent conformance | ACP rather than one vendor is the integration boundary; MCP configuration works for observed agents. | Every ACP agent, operating system, or optional capability. |
| GPU-to-agent end to end | The owner's actual click, hierarchy context, visible dispatch, receipt, and MCP follow-up path. | General asset graphs, every render type, or durable agent workflows. |

Completion requires all five levels. Each level keeps its own artifacts and claims.

## Acceptance matrix

### ACP lifecycle

| Case | Expected evidence |
| --- | --- |
| Valid start and initialization | One child, negotiated v1 capabilities, one project session, public `ready`. |
| Invalid executable/profile | No child and a stable actionable configuration error. |
| Malformed or oversized protocol line | Connection fails once, child is reaped, bounded redacted diagnostic remains. |
| Stderr flood | Protocol remains responsive, memory stays bounded, truncation is visible. |
| Child exit during turn | One terminal turn/session update; no late event revives it. |
| Explicit stop and project switch | Bounded graceful attempt, kill fallback, child reaped, generation retired. |
| Studio application exit | No intentionally detached managed ACP process remains. |

### Conversation and permission behavior

| Case | Expected evidence |
| --- | --- |
| Manual text prompt | User item appears, agent stream remains ordered, terminal stop reason appears. |
| Plans/tool updates | Stable transcript items update without duplication or reordering. |
| Permission allow/deny | Only the matching active request accepts one choice; UI labels agent-defined scope. |
| Cancel while prompting | Cancellation is sent once and visible until the terminal agent result. |
| Cancel racing permission | Exactly one terminal path wins; stale action is rejected safely. |
| Unsupported optional content | Visible bounded unsupported item; session continues when protocol permits. |

### MCP connection

| Case | Expected evidence |
| --- | --- |
| Compatible HTTP agent | Session receives the current loopback MCP URL; a tool call appears in the same development-session log. |
| stdio-only agent | Host resolves `antiky mcp --project` without a shell; tool result matches the current session. |
| No compatible transport | Studio does not claim engine access and disables selection-follow with recovery guidance. |
| Runtime restart | ACP thread may remain, but old context and pending dispatch retire; next MCP read sees the new runtime. |

### Selection context

| Case | Expected evidence |
| --- | --- |
| Selected root entity | Empty ancestor list is complete; target/components/store entries are exact. |
| Deep selected entity | Every root-to-parent entity appears once in order. |
| Incomplete relationship/store view | `complete: false` and stable reasons appear in UI and submitted content. |
| Target removed or not retained | No context turn; selected state reports unavailable/stale truthfully. |
| Same selection across polls | One submitted turn only. |
| Same entity with new relevant revision | New context identity and one new turn. |
| Rapid clicks while agent is busy | Only latest still-current pending context submits after turn end. |
| Clear/no-hit | No generated prompt. |
| Project or ACP session change | Pending and submitted-dedup state cannot cross the boundary. |

### Complete owner workflow

1. Open the proving project in native Studio and start its development session.
2. Configure/start a real ACP v1 agent and verify Antiky MCP availability.
3. Enable selection-follow for the active ACP session.
4. Click a known displayed item in the game canvas.
5. Observe the same stable entity selected in Inspection.
6. Observe one visible generated Agent turn with exact target, complete hierarchy, components,
   authoring/runtime/render evidence, observation identity, and completeness status.
7. Confirm the real agent receives the same semantic context.
8. Ask or allow it to refresh one fact with Antiky MCP and confirm the call appears in Activity for
   the same development session.
9. Repeat with a second ACP agent/adapter without changing native or React semantics.
10. Exercise a rapid second/third click, no-hit, and runtime restart to prove dedupe, latest-pending,
    and fencing.

## Measurements and hard bounds

Safety bounds exist from the first implementation for:

- ACP protocol message bytes;
- prompt and context bytes;
- transcript item and total retained bytes;
- stderr retained bytes/entries;
- diagnostic entry count;
- pending permissions and turns;
- startup, request, cancellation, and shutdown waits;
- Tauri event payload size and event queue depth.

Record the configured bounds and observed maxima for fake agents and both real agents. Performance
evidence records ACP startup, session setup, first update, context projection, click-to-dispatch,
turn completion, and cleanup durations as distributions where repeatable. The plan does not invent a
latency promise before the harness exists.

## Security and privacy checks

- Snapshot every React-facing/native diagnostic DTO and assert absence of credential, token, secret,
  password, private key, full inherited environment, unrestricted path, and raw stderr fields.
- Use canary secrets in environment, agent stderr, malformed protocol fields, and component/store
  data to prove redaction and permission filtering at each intended boundary.
- Confirm selection context excludes manifest/project-root paths and REST credentials.
- Confirm untrusted agent text, tool titles, paths, diffs, and resource labels render as data and do
  not execute, navigate, or mutate state without a separate validated action.
- Confirm ACP permission approval does not bypass an Antiky MCP denial or revision failure.

## Closeout evidence

The objective summary must record:

- commit and package versions;
- operating-system and packaged/development host variants tested;
- the two real ACP implementations and negotiated capabilities;
- direct HTTP and/or stdio MCP transports actually proved;
- automated test commands and results;
- rendered UI evidence and owner review status;
- GPU-to-agent trace correlation IDs and safe logs;
- measured sizes, durations, cleanup result, and truncation behavior;
- known unsupported ACP content/capabilities and incomplete selection/resource cases;
- whether any fallback, workaround, patch, ADR, or later objective is required.

Passing evidence supports only the tested versions and contracts. It is not a universal ACP support
claim.

## Options, cost, and exclusions

Mock-only tests are reliable but cannot prove protocol portability or GPU identity. Manual-only real
agent tests are expensive and cannot deterministically cover races and malformed input. The selected
layered suite uses each where it is strongest. The cost is a fake-agent harness, conditional external
agent setup, packaged native testing, and correlation across GPU, Framework, CLI, Tauri, React, ACP,
and MCP.

This proof does not benchmark model quality, compare providers, test every ACP agent, establish a
public compatibility matrix, certify the agent's own sandbox, prove every operating system, or prove
an asset/render graph beyond the explicit fixture data.
