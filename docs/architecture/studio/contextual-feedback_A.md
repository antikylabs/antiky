# Contextual Feedback

**In Progress**

## Purpose

Studio feedback must point to the exact thing a person was looking at. Comments are first-class,
reviewable records bound to stable targets and available to both humans and agents through Studio's
shared surface and standard MCP adapter.

This guide expands Studio ADR
[0003](../../adr/studio/0003-contextual-feedback-queue_H.md).

## Goals

The feedback system will:

- attach a comment to one specific primary target;
- preserve what the author meant even if the target later changes;
- include enough resource, world, and hierarchy context for a reviewer to start work;
- queue the comment for an authorized human or agent;
- expose the same lifecycle through Studio UI, MCP, and tests;
- connect discussion, proposed changes, and validation evidence; and
- keep feedback separate from the command that eventually changes the game.

It is not a general social network, source-code review replacement, or hidden mutation channel.

## Comment identity and scope

Each comment has stable identity and belongs to a project or other explicit review scope. A
conceptual record contains:

- `CommentId`;
- project and optional session/world IDs;
- one primary `TargetRef`;
- a captured `TargetContext`;
- comment body and optional safe attachments or captures;
- trusted author identity and author kind: human, agent, or system;
- queue status and optional assignee;
- creation and update timestamps;
- thread replies and their authors;
- links to related comments, proposed change sets, commands, and validation evidence; and
- a record revision for concurrent queue updates.

Exact storage fields and wire names remain implementation details. Stable identity, target context,
authorship, status, and revision are required semantics.

## Target references

A comment has one primary target so its meaning is not ambiguous. Supported target kinds should grow
from implemented inspection capabilities and may include:

- project, session, world, zone, or scene;
- entity;
- component on an entity;
- property path within a component;
- relationship;
- asset or asset revision;
- shader, material, mesh, texture, or voxel region;
- render item, pipeline, or pass;
- diagnostic or command result; and
- a selected specialized element that resolves to a semantic owner.

A target reference uses stable IDs and a declared target kind. Runtime indexes, hierarchy paths,
batch slots, screen coordinates, and display names may be captured as evidence but never replace
stable identity.

If a user clicks a voxel, sprite instance, or render item, selection resolves both the precise
specialized hit and its semantic owner. The comment can retain the hit detail while using the stable
owner or asset as its primary target.

## Captured target context

At submission, Studio resolves the selection into a bounded context snapshot. It should include, as
applicable:

- project, session, world, and world revision;
- target type and stable IDs;
- display name and path hints at submission;
- the full ancestor hierarchy from world root to target;
- relevant component type, schema version, property path, and captured value;
- relevant relationship endpoints;
- asset ID, revision, content hash, source hint, dependencies, and dependents;
- render material, pipeline, geometry, and pass mappings;
- world position, normal, camera, or specialized pick details;
- related diagnostic and correlation IDs; and
- optional visual capture identity.

"Full hierarchy" means the complete ancestor chain needed to locate the selected object, not a copy
of every entity in the world. Context collection is bounded and redacts values the commenter is not
authorized to disclose.

The system stores both captured context and a resolvable target reference. When a reviewer opens the
comment, Studio can show:

- what the author saw at submission;
- whether the target still resolves;
- the target's current revision and hierarchy; and
- a clear indication of relevant changes or deletion.

A renamed, moved, or deleted target does not make the historical comment meaningless.

## Comment body and attachments

The body is user-authored feedback, not trusted instructions. Agent reviewers must treat it and all
captured asset metadata as untrusted project data.

Attachments may include a bounded screenshot, selected-object capture, diagnostic bundle, or
structured validation result. Large data remains an asset or blob reference. Comments never embed
secrets, arbitrary executables, unrestricted filesystem paths, or live engine/GPU objects.

## Queue lifecycle

The minimum lifecycle supports these meanings:

- **Open:** submitted and waiting for review.
- **In review:** an authorized reviewer has claimed or acknowledged the comment.
- **Resolved:** the feedback was addressed and the resolution is recorded.
- **Dismissed:** no change will be made, with a recorded reason.
- **Reopened:** later evidence returns a resolved or dismissed comment to active review.

Exact labels may change, but transitions are explicit commands with expected comment revisions. Two
reviewers cannot silently overwrite assignment or status.

Resolution should link evidence when work occurred, such as accepted command IDs, a promoted change
set, validation results, captures, or a written no-change decision. A code or world change does not
auto-resolve feedback merely because it touched the target.

## Queue views

Humans and agents need consistent filters and ordering, including:

- status;
- target kind and stable ID;
- project, world, scene, or zone;
- author or author kind;
- assignee;
- creation and update time;
- unresolved comments on the current selection; and
- comments blocked by missing or changed targets.

Queue pagination and subscriptions prevent clients from polling or loading unbounded history.

## Shared command and query surface

Feedback operations use the same Studio service from UI and MCP.

### Commands

The surface must support the capabilities to:

- create a comment from an explicit target or current selection;
- add a reply;
- claim, assign, or release review according to policy;
- change lifecycle status;
- link a proposed change set or validation evidence;
- resolve, dismiss, or reopen; and
- update allowed metadata without rewriting authorship or history.

### Queries

The surface must support the capabilities to:

- get one comment with captured and current target context;
- list and filter the review queue;
- list comments for the current selection or target;
- inspect the thread and linked evidence;
- report whether the target still resolves; and
- subscribe to queue and thread changes.

Exact API and MCP tool names will be chosen with implementation. The operations and parity are the
architectural contract.

## MCP access

The standard MCP adapter exposes feedback queue commands and read resources over `EditorSession`.
It does not maintain a separate queue or scrape the Studio panel.

An authorized agent can:

1. list open comments within its project and capability scope;
2. inspect a comment, captured target context, and current target state;
3. claim or acknowledge the work;
4. fork an appropriately scoped sandbox;
5. apply commands and collect diagnostics or captures;
6. attach a proposed change set and evidence;
7. request or perform authorized promotion; and
8. resolve the comment with the accepted evidence or explain why no change was made.

Read and write capabilities are separate. An agent allowed to read comments is not automatically
allowed to claim them, mutate the world, promote changes, or resolve feedback.

## Events and persistence

Comment creation, replies, assignments, status transitions, target-link changes, and resolution are
durable Studio facts with trusted authorship and ordered history. They may use their own feedback
streams or store rather than pollute gameplay-domain streams.

Notifications and presence remain transient. A reviewer viewing a comment does not create permanent
project history unless product requirements later call for an audit acknowledgement.

The storage adapter, retention schedule, and whether selected feedback files also participate in
source control remain open.

## Feedback-to-change boundary

A comment states a problem, observation, or request. It is not an executable command.

```text
comment
  -> reviewer understands captured and current context
  -> reviewer proposes commands
  -> sandbox validation when appropriate
  -> authorized primary mutation
  -> linked evidence
  -> explicit comment resolution
```

This prevents prompt text, imported comments, or agent-written replies from becoming an authority
bypass. All actual changes still follow command, capability, revision, and sandbox rules.

## Notifications

Studio may notify relevant humans or agents when:

- a comment enters their queue;
- it is assigned, replied to, resolved, dismissed, or reopened;
- its target becomes unresolved or changes materially;
- a linked change set becomes stale; or
- requested review evidence completes or fails.

Notification delivery is a projection with user preferences and rate limits. It is not the durable
comment source of truth.

## Permissions and privacy

The feedback service must enforce:

- who may comment on a target;
- who may read its captured context;
- who may claim, assign, reply, resolve, or dismiss;
- which world, asset, and diagnostic details may be captured;
- attachment size and type limits;
- comment and notification rate limits;
- redaction of secrets and sensitive paths; and
- safe output when a target exists but is no longer visible to the reviewer.

An agent sees only comments and context within its explicit capability scope. Comment bodies and
attachments are untrusted input for both humans and agent tooling.

## Failure behavior

- If the target changes during submission, return the captured revision and let policy reject or
  accept the stale context explicitly.
- If a target is deleted later, retain the comment and captured context and mark current resolution
  unavailable.
- If context capture partially fails, either reject creation or record clearly which required
  context is missing; never imply a complete capture.
- If assignment races, expected comment revision chooses one winner and rejects stale transitions.
- If linked promotion fails, keep the comment open or in review with the failure evidence.
- If MCP disconnects, durable queue state remains and transient presence expires.

## Verification

- A comment created from selection names the correct stable target.
- Captured context includes the full ancestor hierarchy and applicable resource details.
- Rename or reparent preserves target identity and shows captured versus current context.
- Deletion preserves the comment and historical context without resolving to a different object.
- UI and MCP create, list, inspect, reply to, and transition the same queue records.
- Unauthorized users and agents cannot read hidden context or change queue state.
- Concurrent claims and status changes enforce expected revisions.
- Comment text never executes a command or expands agent capabilities.
- Linked sandbox evidence does not mutate the primary world before promotion.
- Resolution retains authorship, reason, and linked evidence.

## Open decisions

- Final lifecycle labels and assignment rules.
- Feedback store and retention policy.
- Source-control export or synchronization.
- Notification channels and subscriptions.
- Allowed attachment types and storage limits.
- Automated duplicate detection or grouping.
- Whether comments can have multiple secondary references beyond one primary target.
- How much current-versus-captured context diffing Studio provides initially.
