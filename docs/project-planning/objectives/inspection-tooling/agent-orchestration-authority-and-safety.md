# Agent orchestration, authority, and safety

## Purpose

This report audits Antiky's current inspection and mutation surfaces as a foundation for multiple
agents working on one project. It separates three categories throughout:

- **Implemented:** verified in current source.
- **Accepted direction:** recorded in accepted ADRs or current architecture documents, but not
  necessarily implemented.
- **Recommendation:** a proposed Antiky-native protocol or sequencing decision.

The main conclusion is direct: Antiky has several good causal building blocks, but it does not yet
have a multi-agent authority plane. The current loopback MCP service gives every process running as
the same local user the same tool authority. The action broker serializes actions but does not grant
ownership. The project revision identifies the `.antiky` manifest, not the source and asset state.
The MCP call log is a useful bounded debugging view, not a durable audit or change journal.

Broader authoring tools, parallel agent mutation, external processes, or network access should wait
until capability grants, identity preflight, fenced mutation leases, causal receipts, safe journals,
and reviewable change sets exist.

## Executive assessment

### What is already strong

The current implementation is not a blank slate. It already provides:

- exact-loopback binding, Host checking, strict methods, bounded request sizes, and strict JSON
  schemas at the CLI inspection boundary;
- a private development-session descriptor with a random credential for the REST/Studio surface;
- stable development-session, engine-session, runtime-instance, world, entity, action, command, and
  capture identities;
- publication sequence and runtime-instance rejection of stale browser publications;
- fixed-step session control with explicit completed-step expectations;
- a single in-process Framework writer and a single pending CLI action;
- a point-light mutation proof with trusted context, scoped permission checking, duplicate command
  rejection, expected entity revision, structured decisions, accepted facts, and corrective facts;
- bounded Framework-owned world inspection and event history rather than exposing live objects;
- capture hashes and restricted capture storage permissions; and
- a bounded MCP call view with receipt order, duration, outcomes, correlation IDs, truncation, and
  field-name-based secret redaction.

These are reusable causal kernels. They should be generalized rather than replaced.

### What is not yet an authority system

The most important current gaps are:

1. `POST /mcp` is deliberately routed before the development credential check. Loopback and Host
   validation protect against remote exposure and some browser attacks, but not another same-user
   process, a compromised local tool, or a confused deputy.
2. The local host supplies the hard-coded principal `antiky-local-development` and
   `world.light.edit` permission to every point-light command. The Framework checks permission, but
   the caller did not receive a caller-specific grant.
3. `ANTIKY_ACTION_BUSY` is a one-slot serialization guard. It has no holder, scope, expiry, base
   revision, renewal, release, or fencing token, so it is not a mutation lease.
4. `project.revision` is the SHA-256 of the manifest bytes. It does not bind the git commit,
   worktree, dirty state, source files, assets, dependency locks, or generated content.
5. The accepted build revision is a local monotonic build-attempt counter. It is useful within a
   development session but is not a portable build or content identity.
6. The MCP log is in memory, retains at most 100 calls, drops old entries, and redacts secrets by
   field name. It does not record the caller, grant, task, lease, approval, transaction, read/write
   set, before/after revision, or causal event receipts.
7. Framework sandbox creation, proposed change sets, promotion, durable snapshots, and generic
   command authorization are accepted direction, not current product capabilities.

## Current authority and causality map

### Identity and revision inventory

| Current value | Current meaning and lifetime | Good for | Not sufficient for |
| --- | --- | --- | --- |
| Canonical manifest path | Local project identity used by the CLI | Finding the active local project and rejecting a different descriptor | A portable/public project ID; path can contain PII and changes when copied or moved |
| `project.revision` | SHA-256 of `.antiky` manifest bytes | Detecting a changed manifest | Detecting source, asset, dependency, generated-file, branch, or dirty-state changes |
| `developmentSessionId` | One CLI development-service run | Correlating Studio, REST, MCP results, actions, and diagnostics | Identifying the initiating client, agent, task, or workspace |
| `acceptedBuildRevision` | Monotonic accepted-build counter in one development session | Knowing which locally observed rebuild a runtime action relates to | Reproducing or comparing content across sessions or machines |
| `sessionId` | Framework engine-session identity | Scoping simulation status | Identifying the development project or agent workspace by itself |
| `runtimeInstanceId` | One live game/runtime instance | Rejecting retired runtime publications and stale action results | Establishing source/content equivalence |
| `worldId` | Stable Framework world identity | Targeting inspection and commands | Granting authority to edit the world |
| `entityId` | Stable Framework entity identity | Targeting point lights and inspection records | Preventing edits outside an agent's assigned subsystem |
| Publication sequence | Strictly increasing within one runtime instance | Rejecting replayed or out-of-order browser publications | Tracking authoring transactions |
| Session command/control/world revisions | Framework-owned session counters | Fixed-step and state causality | Filesystem or asset conflict detection |
| Point-light entity revision | Authoring record revision | Optimistic concurrency for the proof mutation | A general world, component, asset, or file revision protocol |
| Event sequence | Ordered accepted runtime facts | Reading retained world fact order | Durable cross-session history or actor/approval attribution |
| `actionId`, `commandId`, `captureId` | Operation identities | Matching requests, responses, facts, and captures | Expressing task ownership, authority, transaction, or approval |

The required addition is not one universal revision. Antiky needs an explicit identity tuple because
different conflicts happen at different layers:

```text
ProjectId + WorkspaceId + ManifestRevision + SourceRevision
  + DevelopmentSessionId + AcceptedBuildRevision
  + EngineSessionId + RuntimeInstanceId + WorldId
  + target-specific revision or content hash
```

The caller must state expected mutable revisions, while the host supplies trusted identity and
authority context. Local paths and PIDs should be available only in a privileged diagnostic view,
not returned by default to every agent or copied into evidence artifacts.

### Current MCP surface

Implemented reads are `get_dev_status`, `get_latest_build`, `get_runtime_status`,
`get_render_stats`, `get_diagnostics`, `get_session_status`, `get_world_inspection`,
`get_event_log`, `list_point_lights`, and `get_point_light`. Implemented actions are `dev_reload`,
`capture_frame`, `pause_simulation`, `resume_simulation`, `step_simulation`,
`set_point_light_power`, and `correct_point_light_power`.

Positive implementation facts:

- tool inputs are strict objects with `additionalProperties: false`;
- point-light mutations require UUIDv7 command IDs and expected entity revisions;
- stepping requires the previously observed completed-step count;
- MCP annotations separate reads from actions and describe retry-safe controls;
- tool descriptions tell an agent which preflight read should occur first; and
- results carry several session/runtime/world/action identities.

Concrete gaps:

- capability discovery is a flat `tools/list`; there is no project-specific support matrix,
  capability revision, tool schema revision, risk tier, required grant, target scope, or current
  caller permissions;
- ordering and prerequisites live in prose descriptions rather than machine-readable constraints;
- definitions provide input schemas but not declared output schemas;
- all actions are marked non-destructive even though reload, capture, simulation control, and
  authoring have materially different risks;
- there is no MCP Resource or Prompt surface for stable context, policies, evidence, or handoffs;
  and
- there is no generic command envelope shared by every mutation.

### Transport and client authority

The inspection server binds only the exact configured `127.0.0.1` address and checks the request
Host. Browser runtime routes require the configured game Origin. REST development and action routes
require the random per-development-session bearer credential. The MCP route is intentionally
handled before that credential check and can be called without an Origin by a local client.

This produces a clear trust distinction:

| Surface | Current protection | Remaining authority issue |
| --- | --- | --- |
| Runtime publication/action polling | Exact game Origin, bounded envelopes, session/runtime identities | Runtime process has broad delivery responsibility; no agent concern should be trusted from browser input |
| REST/Studio development API | Random session credential from a mode-`0600` descriptor | One shared session credential is not an attenuated per-client or per-task grant |
| HTTP MCP | Loopback, exact Host, strict MCP framing | Any same-user local process receives the full MCP tool surface |
| Stdio MCP adapter | Access inherited from the launching process | No server-side principal/grant attached to individual tool calls |

The user-facing MCP documentation already states that any process running as the same local user can
access MCP and warns against tunneling it. That is an honest current limitation, but it is not a
sufficient basis for agent mutation authority.

### Serialization and current mutation proof

The CLI action broker allows only one pending action. It ties an action to the development session,
runtime instance, and accepted build revision, then rejects mismatched or stale results. Reload
relates old and new runtime instances. Capture validates PNG metadata, bounds bytes, writes private
files, and returns a SHA-256. Session controls validate the returned control state. These are useful
action receipts.

The Framework engine session also has an in-process busy guard, ordered command sequence, control
revision, and world revision. The point-light service is the best current model for future authored
commands:

- schema-validated versioned input;
- trusted principal and permission context supplied separately from command data;
- runtime, world, entity, expected revision, and value checks;
- duplicate command detection;
- structured accepted, rejected, stale, missing-permission, and no-op results;
- accepted facts with old/new values and resulting revision; and
- correction by a new fact instead of deleting history.

However, the CLI host currently fabricates the same trusted principal and edit permission for every
MCP caller. Point-light facts do not expose the trusted actor, grant, task, approval, or transaction.
Their bounded in-memory history is evidence for one runtime instance, not a durable audit.

### Inspection, event history, and call history

Framework inspection correctly exposes bounded, versioned projections with ownership, stable IDs,
counts, and explicit incomplete/retention information. Framework event history has ordered source
sequence, world/runtime identity, command and entity correlation, revision, time, structured data,
and a declared retention policy.

The current event envelope still lacks an event ID, trusted actor, grant, task, causation/correlation
links, transaction, approval, build/content identity, and durable cross-session storage. The accepted
architecture describes a richer durable event envelope; that is direction rather than current code.

The MCP call log is useful for Studio visibility:

- calls are sequenced in receipt order even when completion order differs;
- it records call and JSON-RPC IDs, time, duration, tool name, bounded arguments, outcome, and
  bounded result/error;
- selected action/session/world/entity/command correlation IDs are extracted; and
- oversized, deep, cyclic, or secret-named values are truncated or redacted with explicit paths.

It is not an audit ledger:

- it is in memory, session-scoped, capped at 100 entries, and drops the oldest entries;
- `initialize` and `tools/list` are not logged, so client identity and discovery are absent;
- it lacks principal, client, agent, task, handoff, grant, lease, approval, checkpoint, transaction,
  change-set, evidence, before/after revision, and event receipt fields;
- field-name matching does not catch secrets or PII embedded in arbitrary strings, filenames,
  messages, absolute paths, tool output, or image pixels;
- it stores broad arguments/results rather than a schema-defined safe projection; and
- there is no integrity chain, durable retention policy, access separation, or signed export.

Keep this debug ring. Add a separate mutation journal rather than stretching this UI projection into
an authority ledger.

## Accepted architecture direction versus implementation

The accepted Framework ADRs establish the correct direction:

- important external changes use versioned commands;
- trusted identity comes from outside command data;
- command entry checks permission, duplicates, expected revision/tick window, and returns a
  structured decision;
- only one writer changes a world during a simulation step;
- parallel workers may calculate, but stale results are rejected at application time;
- sandboxes begin from a known base revision and produce proposed commands plus validation evidence;
  and
- promotion re-dispatches commands to the primary session and rechecks current permission,
  revisions, and rules. It never copies live objects, sandbox event numbers, or sandbox-owned
  storage into true state.

Current architecture documents also direct Studio to remain a client of the same Framework/CLI
services, keep read and change permissions separate, treat feedback and attachments as untrusted,
and make comment-to-change flow explicit: understand, propose, sandbox, validate, authorize, apply,
prove, resolve.

These decisions should shape the authority plane. They do not imply that generic commands,
sandboxes, promotion, durable snapshots, collaborative history, or contextual feedback are already
implemented.

The researched seed skills are non-authoritative, unvalidated scaffolds. Patterns from Unreal,
Unity, Godot, Blender, and other tools are comparison inputs only; Antiky's own protocols, tests,
and authority decisions remain controlling.

## Requirement and gap audit

| Need | Implemented now | Concrete gap | Required primitive | Priority |
| --- | --- | --- | --- | --- |
| Capability discovery | Strict `tools/list`, descriptions, annotations | No project/caller/risk/support metadata or version | Capability catalog and current-grant view | P0 |
| Scoped permissions | Point-light service checks one permission | Host gives every caller the same hard-coded principal/permission | Server-side attenuated grant | P0 |
| Project/session identity | Canonical manifest, manifest hash, dev/session/runtime/world IDs | No stable project/workspace ID or source/dirty identity | Sanitized agent context tuple | P0 |
| Single-writer ownership | One Framework writer; one pending CLI action | Busy flag is not scoped ownership or a stale-writer fence | Expiring scoped mutation lease | P0 |
| Transactions | Point-light command is atomic inside its service | No authored multi-command group; no cross-file/runtime contract | Change set plus subsystem transaction IDs | P1 |
| Checkpoint/rollback | Corrective point-light fact; capture artifacts | No source/asset/world checkpoint; no rollback contract | Checkpoint plus compensation plan | P1 |
| Change manifest | Capture hash and some action identities | No files/assets/commands/events/revisions/tool provenance bundle | Versioned change manifest | P1 |
| Causal readback | Structured action results and event/inspection reads | No universal before/after receipt or lost-response recovery | Action receipt and verify-change query | P0 |
| Tool journal | Bounded MCP debug ring | Not durable, attributable, complete, integrity protected, or privacy robust | Separate durable redacted journal | P1 |
| Subtask handoff | Research recommends bounded handoffs | No machine-readable ownership, base revisions, or child authority | Task and task-result envelopes | P1 |
| Parallel isolated work | Framework architecture allows workers/sandboxes | No Antiky workspace or sandbox-world lifecycle | Workspace/sandbox manager | P1 |
| Conflict detection | Runtime publication, step, entity revision checks | No source/path/asset/read-set/write-set conflicts | Multi-layer expected revisions and lease fencing | P1 |
| Prompt-injection resistance | Feedback architecture calls text untrusted | No provenance labels or enforcement at tool boundary | Trust labels and non-escalation policy | P0 |
| Network/process/destructive gates | Project process commands are bounded by manifest shape | No agent-specific approval or destination/executable allowlist | Separate high-risk capabilities and approvals | P0 before exposure |
| Secrets/PII-safe capture | Private canvas capture, name-based log redaction, isolated Studio terminal | Absolute paths/PIDs and arbitrary strings/pixels can leak PII | Schema projections, path aliases, capture policy and review | P0 |
| Provenance | Command/action/capture IDs and hashes | No tool/skill/source/asset/version chain | Provenance fields in change/evidence manifests | P1 |
| Eval evidence | Inspection, facts, diagnostics, captures | No evidence bundle tied to exact change and acceptance criteria | Evidence manifest and review decision | P1 |
| Human approvals | Product direction preserves human creative authority | No exact-preview approval artifact/token | Bound one-time approval decision | P1; P0 for high risk |

## Trust model

### Principals and trust zones

Antiky should distinguish at least:

1. the human project owner and named human reviewers;
2. Studio UI acting for a human interaction;
3. the local Antiky host that authenticates clients and mints trusted context;
4. an orchestrator agent;
5. child agents with attenuated, task-specific grants;
6. CLI/MCP adapters and editor/runtime bridges;
7. the authoritative Framework session; and
8. external processes, network services, DCC/editor integrations, and release systems.

Repository files, comments, feedback, asset names/metadata, imported scenes, logs, diagnostics, MCP
results, webpages, skill packages, and model output are **untrusted content**. They can supply data
and evidence. They cannot mint permissions, broaden scopes, satisfy an approval, redefine the active
project, or change which instructions are trusted.

Host authority and Framework authority must remain separate:

- the host authenticates the client, derives the permitted project/task/tool scope, and attaches a
  trusted grant/lease/approval context;
- the Framework validates the versioned command, current world/session/runtime/target revisions,
  permission, duplication, and domain rules; and
- neither layer treats caller-provided `principalId`, `permissions`, `approved`, or `trusted` fields
  as authority.

### Primary threat cases

- a same-user process calls unauthenticated MCP and edits a project it did not own;
- a child agent reuses a parent credential and exceeds its task or target scope;
- a prompt injection in a comment, asset, log, skill, or webpage requests network access, deletion,
  secrets, or self-approval;
- an agent operates on the right project name but wrong canonical project/workspace/session;
- two writers act from the same base state and the later result silently overwrites the first;
- a lease expires, but a delayed writer still commits because no fencing token is checked;
- an approval is replayed against different bytes, commands, targets, or environment;
- a lost response causes an unsafe retry of a non-idempotent operation;
- a screenshot or journal includes a terminal username, home directory, account identifier, token,
  unrelated window, or private notification;
- generic process/network tools become confused deputies for arbitrary code, downloads, uploads,
  signing, publishing, or production mutation; and
- “rollback” claims success after only one of source, asset, runtime, or external side effects was
  restored.

## Proposed Antiky-native protocols

The protocols below are recommendations. Use small versioned schemas and stable rejection codes.
Every trusted field is attached by the host from authenticated server-side state.

### 1. Capability catalog and authenticated client session - P0

Add a host-generated capability view before expanding mutation:

```json
{
  "schemaVersion": 1,
  "capabilityRevision": "sha256:...",
  "toolSchemaRevision": "sha256:...",
  "clientSessionId": "...",
  "projectId": "...",
  "workspaceId": "...",
  "developmentSessionId": "...",
  "groups": [
    {
      "id": "world.authoring.lights",
      "mode": "read-write",
      "risk": "authoring",
      "requiredGrant": "world.light.edit",
      "targetScopes": ["world", "entity"],
      "requiresLease": true,
      "supportsDryRun": true,
      "supportsTransaction": true
    }
  ]
}
```

Recommended reads are `get_agent_context`, `list_capability_groups`, `describe_capability_group`,
and `get_current_grant`.

The catalog should report only capabilities supported by the active project, tool versions, and
current caller. Machine-readable metadata should include read/write class, risk tier, required
permission, lease/approval prerequisites, target scopes, idempotence, input/output schema revision,
and evidence behavior.

Authenticate HTTP MCP. A practical first implementation is a random per-client credential stored
and resolved server-side, with a server-side grant record. Do not place grant claims in caller-
editable JSON and do not create a bespoke self-verifying token format. `initialize.clientInfo` is
useful attribution but is not authentication. Bind the authenticated connection to a minted
`clientSessionId`; tools cannot change that identity in arguments.

Use lazy capability groups as the surface grows. A default read session should not even advertise
ungranted mutation, process, network, signing, publishing, or production tools.

### 2. Agent context and source identity - P0

`get_agent_context` should be the mandatory preflight and return:

- stable `ProjectId` created and stored by Antiky;
- `WorkspaceId` for the exact checkout/worktree/sandbox;
- manifest revision;
- source-control commit, branch, dirty flag, and a bounded dirty/content digest;
- lockfile/dependency revision when relevant;
- development session and accepted build revision;
- session, runtime instance, world, and latest event/revision identities;
- capability/tool schema revisions; and
- sanitized aliases such as `${PROJECT_ROOT}` rather than a home-directory path.

The exact source digest should be defined and reproducible. It may use commit plus a deterministic
digest of changed tracked/untracked inputs, not timestamps. Large assets can be represented by an
asset/catalog manifest. The accepted build receipt should add source/content digests so a build can
be compared across sessions, rather than replacing the useful local counter.

### 3. Attenuated agent grant - P0

A server-side `AgentGrant v1` should contain:

```text
grantId, principalId, clientSessionId, agentId, taskId, optional handoffId
ProjectId, WorkspaceId, optional development/session/world scopes
allowed capability IDs and target/path scopes
read/write distinction, operation/time/count/byte budgets
allowed executable templates and network destinations (normally empty)
capture/privacy policy, approval requirements, issuedAt, expiresAt, revokedAt
```

Child grants are derived only by attenuation: their capability set, paths, targets, budget, and
expiry must be subsets of the parent grant. A model cannot widen a grant by editing a handoff or
request. Revocation and development-session termination invalidate the derived grants.

Keep high-risk authority separate:

- delete versus add/modify;
- overwrite of shared/binary assets;
- arbitrary code versus a named build/test command;
- process launch versus an already-running editor bridge;
- network read, download, upload, and external messaging;
- dependency changes;
- secrets access;
- signing, publishing, deployment, and production/live mutation; and
- any capture outside the known game canvas.

### 4. Universal action envelope and causal receipt - P0

Every action should pass through one host envelope even when its domain command has its own schema:

```text
requestId / idempotency key
trusted: clientSessionId, principalId, grantId, agentId, taskId, handoffId
trusted: ProjectId, WorkspaceId, developmentSessionId
target: sessionId, runtimeInstanceId, worldId, entity/asset/path IDs
expected: manifest/source/build/control/world/target revisions as applicable
mutation: leaseId + fencingToken, optional transactionId/changeSetId
approvalId when required, purpose code, dryRun flag
domain command
```

The caller supplies expected revisions and opaque handles. The host resolves the handles and
attaches trusted identity, permissions, lease fence, and approval facts. Unknown or unnecessary
fields fail closed.

Every action returns or can later be read by `get_action_receipt(requestId|actionId)`:

```text
accepted | rejected | no-op | pending
stable decision code and safe recovery class
trusted actor/task/grant/lease/change identities
before and after layer-specific revisions/digests
changed target IDs and bounded changed-field summary
command ID, event IDs/sequences, build/runtime transition IDs
evidence references and journal sequence
```

This makes lost-response recovery safe: retry the same idempotency key or read its receipt. It also
provides causal readback without forcing an agent to infer success from a screenshot.

### 5. Scoped mutation lease with fencing - P0

Recommended tools are `acquire_mutation_lease`, `renew_mutation_lease`,
`release_mutation_lease`, and `get_mutation_lease`.

A lease names its holder principal/task, ProjectId/WorkspaceId, scope, base revisions, issuance and
expiry, and a monotonically increasing fencing token. Possible scopes include a live world,
component/store family, asset set, or normalized project-relative path set. Overlapping write scopes
conflict; reads normally do not.

Every mutation checks the current lease ID and fence at the last authoritative commit point. An
expired or superseded writer is rejected even if its delayed command arrives after a new lease was
issued. Renewal is explicit and bounded. Release is idempotent. Session termination revokes live-
session leases.

The existing single pending action remains a useful delivery serialization guard. It should not be
used as proof of ownership. Once unrelated domains exist, a scoped queue can serialize commits
without blocking independent reads, builds, or isolated workspace work.

### 6. Checkpoints, change sets, and honest rollback - P1

Recommended lifecycle: `create_checkpoint` → `begin_change_set` →
`apply_change_set_command` → `validate_change_set` → `commit_change_set` or
`propose_change_set`. `get_change_set`, `discard_change_set`, `promote_change_set`, and
`correct_change` cover review, disposal, primary apply, and compensation.

`ChangeSet v1` begins at an exact Project/Workspace/source/build/world revision tuple. It owns a
bounded write set and records commands, file/asset changes, validation, and evidence. A primary-world
promotion re-dispatches the proposed commands under a current grant and lease, then rechecks all
current revisions and rules as ADR 0014 requires.

Do not claim one atomic transaction across git/files, asset import, a live Framework world, process
side effects, and remote services. Use:

- real atomicity inside one Framework command/event commit or one transactional store;
- checkpoint/discard for isolated uncommitted source/assets;
- content hashes and expected revisions at each boundary; and
- a recorded saga/compensation plan when effects cross systems.

After an accepted durable world fact, “undo” is usually a new corrective command. After an external
upload or publication, rollback may require another explicit externally approved operation. The
change set must report partial completion and non-reversible effects instead of presenting a false
success.

A `ChangeManifest v1` should record:

- base and resulting project/workspace/source/build/world revisions;
- agent, task, handoff, grant, lease, approval, checkpoint, transaction, and change-set IDs;
- tools, tool schema versions, skill/source package identifiers and hashes;
- files and assets added/modified/deleted with before/after hashes and provenance;
- commands, decisions, durable event receipts, and changed targets;
- external/process/network side effects;
- tests, replays, diagnostics, captures, performance, and review evidence;
- known risks, non-reversible effects, and correction/compensation instructions.

### 7. Durable tool and mutation journal - P1

Retain the current 100-call MCP ring as a Studio debugging projection. Add a separate append-only
journal whose records include:

```text
journal sequence and timestamp
ProjectId / WorkspaceId / development session
client / principal / agent / task / handoff
capability / tool schema revision / tool
grant / lease fence / approval / checkpoint / transaction / change set
request/action/command IDs and causation/correlation IDs
safe argument projection and decision
before/after revisions, event receipts, evidence references
redaction/classification result and integrity linkage
```

The journal should use schema-defined safe projections rather than logging arbitrary raw arguments,
prompts, results, environment, or process output. Separate a redacted operator view from a more
restricted local audit artifact. Define retention and export explicitly. Hash stored evidence and
journal segments; use vetted signing/attestation systems for release provenance rather than inventing
cryptography.

Secret/PII controls should include:

- typed secret fields that are never serialized to the journal;
- path aliasing and removal of usernames/home directories/PIDs from default agent views;
- bounded safe messages and code-based diagnostics;
- synthetic PII/secret scrub fixtures, including terminal names, absolute paths, emails, tokens,
  account IDs, chat, and notifications;
- no raw environment dump or shell history; and
- explicit privileged access when a local path or full diagnostic is genuinely necessary.

### 8. Task handoff and isolated parallel work - P1

Use a versioned `TaskEnvelope` rather than prose alone:

```text
taskId, parentTaskId, handoffId, owner and reviewer
objective, acceptance criteria, prohibited actions
ProjectId, WorkspaceId, base source/build/world revisions
owned paths/assets/world targets and explicit read-only areas
allowed capabilities, derived grant, budgets, expiry
input artifact hashes and untrusted-content labels
required output artifacts, evidence, and review gate
```

`TaskResult` returns status, resulting revision tuple, change manifest, evidence, unresolved risks,
and proposed handoff. It cannot declare its own approval gate passed.

Safe parallelism patterns:

- multiple read-only explorers may share a project/session;
- tests, profiling, and analysis may run concurrently when they do not mutate shared state;
- write workers use distinct `WorkspaceId`s/worktrees or Framework sandbox worlds;
- each shared artifact has one owner; each live mutation scope has one fenced lease holder;
- only the integration owner promotes proposed changes; and
- reviewers receive read-only grants and consume artifacts, receipts, and evidence rather than a
  worker's conclusion.

Conflict detection should combine normalized path overlap, content hashes, source base revision,
asset/catalog revision, dependency-lock revision, world/target revision, read/write sets, and lease
fencing. A clean textual merge does not prove that asset, scene, runtime, or gameplay behavior is
compatible.

The official OpenAI subagent guidance supports this boundary: subagents have independent context,
custom roles can be read-only, and parallelism is most useful for read-heavy exploration, tests, and
triage; write-heavy parallelism increases conflict and coordination cost. Antiky should encode the
same restriction in grants and artifacts instead of relying on prompting alone.

### 9. Human approval protocol - P0 for high risk, otherwise P1

`ApprovalRequest v1` should contain an exact preview:

- action/capability and risk class;
- exact project/workspace/environment and targets;
- command or change-manifest hash;
- before/expected-after revisions and bounded diff;
- process executable/arguments or network destination/method as applicable;
- data/capture classification and external recipients;
- validation/evidence and rollback/compensation plan;
- one-time nonce and expiry.

`ApprovalDecision v1` records the named human/authorized principal, decision, time, request hash,
scope, and conditions. The host mints an opaque approval handle bound to those exact bytes and
environment. Changed bytes, targets, destination, process arguments, revision, expired time, or a
replayed one-time handle require new approval.

Explicit human approval is required for deletion or destructive overwrite, arbitrary code/process
execution, new dependencies, network/download/upload, external messages, privacy/capture exceptions,
secrets, signing, publishing, deployment, production/live mutation, and primary-world promotion when
policy does not already grant that exact bounded action.

An agent cannot author, execute, and approve its own quality or release gate. “The model judged this
safe” is never an approval artifact.

### 10. Prompt injection, process, network, and capture enforcement - P0

Tag provenance at ingestion:

```text
trusted-policy | trusted-task | trusted-human-decision
untrusted-project-content | untrusted-feedback | untrusted-tool-output
untrusted-web | untrusted-skill-package | generated-proposal
```

Trust tags are host-managed. Content can propose an action, but only a grant plus any required bound
approval permits it. Instructions discovered inside comments, repository content, imported assets,
logs, webpages, tool output, or skill files cannot change the active project, request secrets,
expand paths, enable network/process tools, or mark approval complete.

Do not expose general-purpose `run_process`, `fetch_url`, `write_any_file`, `delete_path`, or
`capture_desktop` as normal game-authoring capabilities. Provide narrow named operations with:

- normalized project-relative paths and no symlink/path escape;
- executable and argument templates;
- destination/method/byte/response limits;
- empty network allowlists by default;
- separate download and upload authority;
- no inherited secrets unless a named operation requires a brokered secret;
- time, output, and child-process limits; and
- causal receipts plus post-action verification.

The safe capture tool is `capture_game_view`, not desktop screenshot. It should capture only the
known game canvas or an Antiky-owned offscreen render target, record canvas size/build/runtime/state,
hash the pixels, and run a privacy policy before export. Terminal, desktop, notifications, unrelated
windows, browser chrome, usernames, full local paths, and account UI fail closed. Upload is a
separate approved capability. This extends the current canvas capture and isolated Studio terminal
direction without relying on an agent to crop private pixels correctly.

## Recommended tool surface

| Phase | Tool or group | Authority |
| --- | --- | --- |
| P0 | `get_agent_context` | Read current sanitized identity/revision tuple |
| P0 | `list_capability_groups`, `describe_capability_group` | Discover only available/granted domains |
| P0 | `get_current_grant` | Read effective scope and limits, never raw credentials |
| P0 | `acquire_mutation_lease`, `renew_mutation_lease`, `release_mutation_lease`, `get_mutation_lease` | Fenced ownership of exact write scope |
| P0 | `get_action_receipt`, `verify_change` | Causal readback and lost-response recovery |
| P0 | `capture_game_view` | Canvas/offscreen-only evidence under capture policy |
| P1 | `create_checkpoint` | Establish reversible isolated base |
| P1 | `begin_change_set`, `apply_change_set_command`, `validate_change_set`, `get_change_set` | Build and inspect bounded work |
| P1 | `commit_change_set`, `discard_change_set`, `propose_change_set` | Resolve isolated work without primary authority |
| P1 | `promote_change_set`, `correct_change` | Reauthorize/revalidate primary apply or compensation |
| P1 | `get_tool_journal` | Read a role-filtered redacted causal journal |
| P1 | `request_approval`, `get_approval` | Human decision workflow; no agent self-decision |
| P1 | `run_replay`, `attach_evidence`, `submit_review` | Bind tests/visuals/performance/review to the exact change |

Existing narrow tools can remain compatibility façades over the new envelope. Point-light mutation
should be the first vertical migration because it already has a command, permission, expected
revision, structured result, fact, and correction.

## Delivery priorities

### P0 - before broader mutation

1. Require authenticated HTTP MCP and mint a distinct client session plus server-side grant.
2. Add `get_agent_context` with stable Project/Workspace IDs and source/dirty identity.
3. Add the capability catalog/current-grant view and stop advertising ungranted tools.
4. Wrap every action in the trusted universal envelope and return a retrievable causal receipt.
5. Add scoped expiring mutation leases with fencing tokens.
6. Replace broad/raw call logging for authority purposes with schema-safe projections; alias paths
   and keep private local diagnostics privileged.
7. Enforce trust labels and separate process/network/destructive/capture gates before exposing any
   such capability.

### P1 - before parallel writers or sandbox promotion

1. Introduce WorkspaceId and isolated workspace/sandbox-world lifecycle.
2. Implement checkpoint/change-set manifests and Framework command re-dispatch promotion.
3. Add machine-readable task handoff/result envelopes and child-grant attenuation.
4. Add multi-layer conflict detection and single-owner integration.
5. Add the durable mutation journal and bound human approvals.
6. Bind replays, captures, diagnostics, performance, provenance, and independent review to a change.

### P2 - production-quality evidence

Add deterministic scenario/replay fixtures, visual comparison, feel/design review, performance
budgets, accessibility/compatibility evidence, asset provenance, and release artifact manifests.
Human reviewers retain creative and release approval.

### P3 - external and production authority

Only after the local authority plane is exercised should Antiky broker DCC/editor processes,
downloads/uploads, signing, publishing, deployment, telemetry, or production/live operations. These
need named destinations/environments, secret isolation, stronger approvals, durable audit,
attestation, staged rollout, and compensation/rollback rehearsal.

## Migration path from the current proof

1. Protect `/mcp` with per-client credentials and a default read-only grant; publish explicit output
   schemas, risk, and preconditions in the capability catalog.
2. Extend the current identity tuple without removing existing IDs or the local build counter.
3. Route both point-light mutations through a real caller grant and fenced lease; attach trusted
   actor/task/grant to facts, receipts, and the durable journal. Keep `/v1/mcp-calls` as the UI ring.
4. Generalize the Framework envelope only after that vertical slice works end to end.
5. Add isolated source workspaces and sandbox-world change sets with command-based promotion.
6. Add authoring domains one at a time with narrow targets, conflicts, corrections, evidence, and
   adversarial evals.

This sequence preserves the working proof and puts authority underneath breadth.

## Required adversarial and causal evaluations

Each result must be backed by command output, receipts, inspection/events, manifests, and evidence;
agent prose does not pass a gate.

1. A same-user process with no client credential cannot list privileged capabilities or call MCP.
2. A read-only client cannot mutate even if it submits `principalId`, `permissions`, or `approved`.
3. A child agent cannot widen the parent grant, paths, targets, budget, expiry, process, or network
   scope.
4. A descriptor/grant copied to another ProjectId, WorkspaceId, or development session is rejected.
5. Identical manifest bytes with changed source/asset/dirty state causes stale-work rejection.
6. Two overlapping writers cannot both acquire a lease; a late command with an old fence is denied.
7. Independent read tasks and isolated workspaces can proceed without taking the live writer lease.
8. A lost action response is resolved by the same idempotency key/receipt without double mutation.
9. A stale runtime, build, world, entity, asset, or file base revision rejects the apply with a
   stable recovery code.
10. Prompt injection in comments, assets, logs, repository files, web content, tool results, and
    skills cannot acquire secrets, tools, network, deletion, process, approval, or project changes.
11. Unapproved executable, argument, network destination, upload, dependency, deletion, overwrite,
    signing, publishing, and production requests fail closed and are journaled safely.
12. Terminal/desktop/notification/account pixels cannot be captured; synthetic PII and secrets in
    paths, output, metadata, and pixels are denied or scrubbed according to policy.
13. An approval works only for its exact preview/hash, environment, target, revision, and expiry;
    replay or modification is denied.
14. A sandbox result cannot copy live objects or its event sequence into primary state; promotion
    reauthorizes and revalidates commands.
15. A partial source/asset/runtime/external failure reports exact completion and performs declared
    compensation without erasing accepted history.
16. The journal can trace task → authenticated client → grant → lease → tool → action/command →
    decision/event → resulting revisions → evidence → independent review.
17. Journal/capture retention, redaction, truncation, export, and integrity failure modes are visible
    and testable.
18. Revocation, lease expiry, client disconnect, development-session stop, and cleanup invalidate
    pending authority deterministically.

## Anti-patterns to reject

- Treating loopback as authentication or a same-user process as inherently trusted.
- One shared “god token” for Studio, orchestrator, every child agent, and every tool.
- Accepting caller-provided principal, permissions, trusted-content labels, or approval flags.
- Using `tools/list` prose descriptions as the permission policy.
- Treating the global pending-action slot as a writer lease.
- Treating the manifest hash or local build counter as the complete content revision.
- Using the current MCP call ring as a durable audit ledger.
- Logging raw prompts, tool arguments/results, environments, filesystem paths, or process output.
- Letting content discovered in the project, logs, skills, or web redefine trusted instructions.
- Generic arbitrary process, Python/script, filesystem, network, download/upload, or desktop-capture
  tools in the default authoring grant.
- Parallel writers in one worktree or live world without isolated workspaces and fenced ownership.
- Allowing a worker to integrate, review, and approve its own change.
- Promoting a sandbox by copying runtime objects/state instead of re-dispatching commands.
- Claiming cross-filesystem/runtime/network ACID transactions or silently hiding partial effects.
- Calling correction “history deletion” or claiming a screenshot alone proves the causal change.
- Exporting captures before a privacy policy or coupling capture permission to upload permission.

## Verified source map

### Current implementation

- MCP: [`tools.ts`](../../../packages/cli/src/mcp/tools.ts),
  [`server.ts`](../../../packages/cli/src/mcp/server.ts),
  [`inspection-server.ts`](../../../packages/cli/src/host/inspection-server.ts), and
  [`mcp-call-log.ts`](../../../packages/cli/src/host/mcp-call-log.ts).
- Authority, actions, identity, and revision: [`actions.ts`](../../../packages/cli/src/host/actions.ts),
  [`project-node.ts`](../../../packages/cli/src/project-node.ts),
  [`session-descriptor.ts`](../../../packages/cli/src/host/session-descriptor.ts),
  [`session.ts`](../../../packages/cli/src/host/session.ts),
  [`runtime-connection.ts`](../../../packages/cli/src/host/runtime-connection.ts), and
  [`build-tracker.ts`](../../../packages/cli/src/host/build-tracker.ts).
- Client/types: [`browser-client.ts`](../../../packages/cli/src/development/browser-client.ts) and
  [`types.ts`](../../../packages/cli/src/development/types.ts).
- Framework session and mutation proof:
  [`contract.ts`](../../../packages/framework/src/sessions/engine-session/contract.ts),
  [`runtime.ts`](../../../packages/framework/src/sessions/engine-session/runtime.ts),
  [`commands.ts`](../../../packages/framework/src/point-light/commands.ts), and
  [`service.ts`](../../../packages/framework/src/point-light/service.ts).
- Framework inspection: [`world.ts`](../../../packages/framework/src/inspection/world.ts) and
  [`events.ts`](../../../packages/framework/src/inspection/events.ts).
- Current MCP security disclosure: [`MCP overview`](../../user-facing-docs/mcp/overview.md).

### Accepted direction and product constraints

- ADRs: [commands](../../adr/framework/0007-commands-as-mutation-boundary_H.md),
  [one writer](../../adr/framework/0013-explicit-simulation-inputs_H.md), and
  [sandbox promotion](../../adr/framework/0014-promote-sandbox-commands_H.md).
- Framework architecture: [commands/events](../../architecture/framework/commands-events-and-persistence_A.md),
  [protocol trust boundary](../../architecture/framework/protocols-and-serialization_A.md), and
  [world/session/sandboxes](../../architecture/framework/world-and-session-model_A.md).
- Studio architecture: [overview](../../architecture/studio/overview_A.md) and
  [untrusted feedback workflow](../../architecture/studio/contextual-feedback_A.md).
- Product direction and human authority: [`PRODUCT.md`](../../../packages/website/PRODUCT.md).

### Research inputs

- Antiky orchestration and library design:
  [`docs/objectives/skill-research/orchestration-and-library-design.md`](../skill-research/orchestration-and-library-design.md)
- Recommended Antiky skill library:
  [`docs/objectives/skill-research/recommended-library.md`](../skill-research/recommended-library.md)
- Production, QA, security, privacy, and evidence research:
  [`docs/objectives/skill-research/production-qa.md`](../skill-research/production-qa.md)
- Official OpenAI subagent guidance:
  [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents.md)
