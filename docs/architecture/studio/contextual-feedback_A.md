# Contextual Feedback

**In Progress**

## Purpose

Studio feedback must identify the exact item that a person inspected. A comment is a stored review
record with a stable target. Humans and agents use the same Studio API to access it.

This guide expands Studio ADR
[0003: Attach each feedback comment to its exact target](../../adr/studio/0003-contextual-feedback-queue_H.md).

## Goals

The feedback system will:

- Attach a comment to one primary target.
- Preserve the author's meaning if the target changes later.
- Include enough resource, world, and hierarchy context for a reviewer to start work.
- Put the comment in a queue for a human or agent with permission.
- Supply the same comment states through the Studio UI, MCP, and tests.
- Link discussions, proposed changes, and validation evidence.
- Keep feedback separate from the command that changes the game.

The feedback system is not a social network or a replacement for code review. It is not a hidden way
to change project or world state.

## Comment IDs and review scope

Each comment has a stable ID. It belongs to a project or another defined review scope. A comment
record contains:

- `CommentId`
- Project ID and optional session or world IDs
- One primary `TargetRef`
- A stored `TargetContext`
- Comment text and optional safe attachments or captures
- Trusted author ID and author type
- Queue status and optional assignee
- Creation and update times
- Replies and their authors
- Links to related comments, proposed changes, commands, and validation evidence
- A record revision for updates that occur at the same time.

The exact storage fields and network names are implementation details. Each implementation must keep
stable identity, target context, authorship, status, and revision.

## Target references

A comment has one primary target so that its meaning is clear. Add target types only when Studio can
inspect them. Target types can include:

- Project, session, world, zone, or scene
- Entity
- Component on an entity
- Property path in a component
- Relationship
- Asset or asset revision
- Shader, material, mesh, texture, or voxel region
- Render item, pipeline, or pass
- Diagnostic or command result
- Selected specialized item that maps to an owner entity.

A target reference uses stable IDs and a declared target type. Studio can store runtime indexes,
hierarchy paths, batch slots, screen coordinates, and display names as evidence.

This evidence does not replace the stable ID.

If a user selects a voxel, sprite instance, or render item, Studio identifies the exact selected
item and its owner. The comment can keep the selection details.

It uses the stable owner or asset as its primary target.

## Captured target context

When an author submits a comment, Studio stores selected context with a defined size limit. When
applicable, this context includes:

- Project, session, world, and world revision
- Target type and stable IDs
- Display name and path at submission
- Complete parent hierarchy from the world root to the target
- Component type, schema version, property path, and stored value
- Related objects in a relationship
- Asset ID, revision, content hash, source, dependencies, and dependent assets
- Render material, pipeline, geometry, and pass mappings
- World position, surface direction, camera, or specialized selection details
- Related diagnostic IDs and IDs that link operations
- Optional visual-capture ID.

"Complete parent hierarchy" means all parents from the world root to the target. It does not mean a
copy of every entity in the world.

Context has a defined size limit. Studio removes values that the author does not have permission to
share.

The system stores context and a stable target reference that it can look up. When a reviewer opens
the comment, Studio can show:

- What the author saw at submission
- Whether the target still exists
- The current target revision and hierarchy
- A clear report of relevant changes or deletion.

A renamed, moved, or deleted target does not make the historical comment meaningless.

## Comment body and attachments

The comment text is user-written feedback. It is not a trusted instruction. Agent reviewers must
treat the text and stored asset information as untrusted project data.

Attachments can include a size-limited screenshot, selected-object capture, diagnostic package, or
structured validation result. Large data stays in an asset or binary-data reference.

Comments never contain secrets, arbitrary executable files, unrestricted file-system paths, or live
engine or GPU objects.

## Comment status

Each comment has one of these minimum status values:

- **Open.** The comment waits for review.
- **In review.** A reviewer with permission claimed or acknowledged the comment.
- **Resolved.** A reviewer addressed the feedback and recorded the result.
- **Dismissed.** A reviewer recorded why no change will occur.
- **Reopened.** New evidence returned a resolved or dismissed comment to active review.

The exact labels can change. Each status change uses a command with the expected comment revision.
Two reviewers cannot silently overwrite the assignment or status.

A resolution must link evidence when work occurred. Evidence can include command IDs, applied
changes, validation results, captures, or a written decision to make no change.

A code or world change does not automatically resolve feedback only because it changed the target.

## Queue views

Humans and agents need the same filters and order options:

- Status
- Target type and stable ID
- Project, world, scene, or zone
- Author or author type
- Assignee
- Creation and update time
- Unresolved comments on the current selection
- Comments that a missing or changed target blocks.

The queue returns comments in pages with a size limit. Change notifications prevent clients from
repeatedly requesting or loading all history.

## Shared Studio API

Feedback operations use the same Studio service from UI and MCP.

### Commands

The Studio API must support commands to:

- Create a comment from an explicit target or the current selection.
- Add a reply.
- Claim, assign, or release review according to policy.
- Change the comment status.
- Link proposed changes or validation evidence.
- Resolve, dismiss, or reopen a comment.
- Update permitted information without changing authorship or history.

### Queries

The Studio API must support queries to:

- Get one comment with stored and current target context.
- List and filter the review queue.
- List comments for the current selection or target.
- Inspect replies and linked evidence.
- Report whether the target still exists.
- Receive queue and reply changes.

Implementation work will select the exact API and MCP tool names. The UI and MCP must support the
same operations.

## MCP access

The standard MCP adapter supplies feedback commands and read resources through `EditorSession`. It
does not keep a separate queue or read data from the Studio panel.

An authorized agent can:

1. List open comments in its project and permission scope.
2. Inspect a comment, stored target context, and current target state.
3. Claim or acknowledge the work.
4. Create a sandbox with an applicable scope.
5. Apply commands and collect diagnostics or captures.
6. Attach proposed changes and evidence.
7. Request or perform an authorized change to the primary world.
8. Resolve the comment with accepted evidence or explain why no change occurred.

Read and change permissions are separate. Permission to read comments does not permit an agent to
claim them, change the world, apply sandbox changes, or resolve feedback.

## Stored comment history

Studio stores comment creation, replies, assignments, status changes, target-link changes, and
resolutions as durable facts. Each fact has a trusted author and a defined order.

Feedback can use its own event stream or storage. It does not need to enter gameplay-event streams.

Notifications and user presence stay temporary. Viewing a comment does not create permanent project
history. A later product requirement can add a durable review acknowledgment.

The storage adapter, retention schedule, and whether selected feedback files also participate in
source control remain open.

## How feedback becomes a change

A comment states a problem, observation, or request. It is not an executable command.

```text
comment
  -> reviewer understands stored and current context
  -> reviewer proposes commands
  -> sandbox validation when appropriate
  -> authorized change to the primary world
  -> linked evidence
  -> explicit comment resolution
```

This flow prevents prompts, imported comments, and agent replies from bypassing authority. All
changes still follow command, permission, revision, and sandbox rules.

## Notifications

Studio may notify relevant humans or agents when:

- A comment enters their queue.
- Someone assigns, replies to, resolves, dismisses, or reopens a comment.
- A comment target disappears or changes in an important way.
- Linked changes become stale.
- Requested review evidence completes or fails.

Studio creates notifications from stored comments, user preferences, and rate limits. A notification
is not the durable comment record.

## Permissions and privacy

The feedback service must enforce:

- Who can comment on a target.
- Who can read its stored context.
- Who can claim, assign, reply, resolve, or dismiss.
- Which world, asset, and diagnostic details Studio can store.
- Attachment size and type limits.
- Comment and notification rate limits.
- Removal of secrets and sensitive paths.
- Safe output when a target exists but the reviewer cannot see it.

An agent sees only comments and context in its explicit permission scope. Comment text and
attachments are untrusted input for humans and agent tools.

## Failure behavior

- If the target changes during submission, return the stored revision. Policy must explicitly accept
  or reject the out-of-date context.
- If a target is deleted later, keep the comment and stored context. Mark the current target as
  unavailable.
- If context capture partially fails, either reject creation or record clearly which required
  context is missing. Never report that the capture is complete.
- If two reviewers assign a comment at the same time, the expected revision accepts one assignment.
  It rejects the other assignment.
- If an attempt to apply linked changes fails, keep the comment open or in review with the failure
  evidence.
- If MCP disconnects, durable queue state remains and temporary online status ends.

## Verification

- A comment created from selection names the correct stable target.
- Captured context includes the full ancestor hierarchy and applicable resource details.
- Rename or movement in the hierarchy preserves target identity. Studio shows stored and current
  context.
- Deletion preserves the comment and historical context without resolving to a different object.
- UI and MCP create, list, inspect, reply to, and change the same queue records.
- Unauthorized users and agents cannot read hidden context or change queue state.
- Concurrent claims and status changes enforce expected revisions.
- Comment text never executes a command or expands agent capabilities.
- Linked sandbox evidence does not change the primary world before the primary session runs approved
  commands.
- Resolution retains authorship, reason, and linked evidence.

## Open decisions

- Final status labels and assignment rules
- Feedback storage and retention rules
- Source-control export or synchronization
- Notification channels and subscriptions
- Permitted attachment types and storage limits
- Automated duplicate detection or grouping
- The need for secondary references in addition to one primary target
- The first comparison view for stored and current context.
