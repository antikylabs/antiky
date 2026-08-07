# ADRs Under Review

These entries identify architecture decisions that Antiky can need. They are discussion drafts.
They are not accepted Architecture Decision Records (ADRs), and they do not control implementation.

Core Contributors review each entry. They can change, reject, or accept the suggested direction.
An entry stays open until the owners reject it or record a decision in an ADR.

Review states have these meanings:

- **Open.** Antiky has not made the architecture decision.
- **Resolved.** Accepted ADRs contain the architecture decision.

Last reviewed: 2026-08-07.

## Open candidates

### 2. Runtime schema

**State:** Open.

**Why this is open:** Antiky has versioned schemas and validators for project files, commands,
inspection data, and development protocols. It has no general schema catalog for components,
commands, events, tools, and stored data.

**Suggested direction:** Keep each current boundary schema with its owner. Prove a need for a shared
catalog before Antiky adds catalog identity, schema views, migration rules, or a public schema format.

### 3. Entity-component-system storage and queries

**State:** Open.

**Why this is open:** The accepted entity-component-system model does not select a physical storage
layout or a permanent query implementation.

**Suggested direction:** Keep storage private and map-based. Move measured hot components into typed
storage only when performance evidence requires the change. Keep public queries semantic.

### 4. 2.3D depth policy

**State:** Open.

**Why this is open:** Games that mix 2D and 3D content need consistent depth, transparency, render
order, and selection behavior. The Town renderer gives evidence, but it does not set shared policy.

**Suggested direction:** Let render orchestration own semantic policy. Use cutout surfaces by default.
Sort transparent objects when blending is necessary. Add complex transparency only for a measured need.

### 6. Principals and permissions

**State:** Open.

**Why this is open:** The point-light command path proves authorization through trusted host context.
Antiky has no general model for people, agents, remote clients, roles, or grants.

**Suggested direction:** Check each mutation at the authority boundary. Use default-deny typed grants,
permission limits, and a trusted actor chain. Keep bounded audit evidence for privileged changes.

### 7. Sandbox isolation

**State:** Open.

**Why this is open:** [Framework ADR 0014](framework/0014-promote-sandbox-commands_H.md) decides how
approved commands return to the primary world. It does not decide how to construct or isolate a
sandbox, share immutable resources, or rebuild temporary identities.

**Suggested direction:** Start a sandbox from a complete semantic world copy. Preserve stable IDs,
rebuild temporary aliases, and share only immutable assets. Add process isolation after a real need.

### 8. Event store and snapshots

**State:** Open.

**Why this is open:** Durable authoring and recovery need a storage boundary. Durable snapshots,
runtime checkpoints, physics checkpoints, and network snapshots are different contracts.

**Suggested direction:** Define a backend-neutral durable store with atomic outcome commits. Use a
local adapter first. Add a hosted database adapter when remote scale requires it.

### 9. Online replication and cross-session handoff

**State:** Open.

**Why this is open:** Online play needs decisions for replication, prediction, rollback, session
placement, and player handoff. Server authority alone does not decide these protocols.

**Suggested direction:** Make separate decisions for replication, rollback, and placement. Remove old
session authority before a new session accepts authoritative input.

### 10. Authoritative server runtime

**State:** Open.

**Why this is open:** Antiky has not selected the language, process model, or deployment artifact for
online authoritative sessions.

**Suggested direction:** First qualify a pinned Node.js Long-Term Support release with compiled
TypeScript and the selected physics artifact. Change the runtime only after measured evidence.

### 11. Voxel authoring and runtime-asset boundary

**State:** Open.

**Why this is open:** Voxel source files and generated voxel data must not become permanent runtime or
provider contracts by accident.

**Suggested direction:** Keep VOX as an authoring and interchange format. Normalize it into an Antiky
scene and compile deterministic runtime artifacts. Start with one static surface target.

### 12. Feedback data governance

**State:** Open.

**Why this is open:** Feedback can contain sensitive context and untrusted instructions. It needs
rules for authority, retention, deletion, and agent access outside world state and source control.

**Suggested direction:** Start with local text records, stable targets, verified caller authority, and
bounded retention. Keep workflow history separate from deletable feedback content.

### 14. Player-presentation ownership

**State:** Open.

**Why this is open:** Reusable audio, player interfaces, haptics, and presentation cues need ownership
that does not move gameplay authority into device adapters.

**Suggested direction:** Let game-owned presentation code derive views and consume typed cues. Let
device adapters own devices, recovery, preferences, and disposal. Extract only after a second consumer.

### 15. Game-logic extension, scripting, and mods

**State:** Open.

**Why this is open:** Public system registration, hot reload, embedded languages, and mods create new
trust, state, compatibility, and failure boundaries.

**Suggested direction:** Keep normal game logic as build-time TypeScript. Do not publish an extension
interface until a real extension needs identity, capabilities, isolation, migration, and resource limits.

### 16. Shipped-game artifact and asset package

**State:** Open.

**Why this is open:** Website publication now builds a bounded browser artifact, records its files,
checks source revision and digests, and stages it outside the demo project. This proof does not decide
whether its manifest is an Antiky product contract or private website publication data.

**Suggested direction:** Keep the current manifest private to the website. Create an ADR only when a
second product consumer or a release-compatibility requirement needs a shared shipped-game contract.

### 17. Studio terminal ownership

**State:** Open.

**Why this is open:** Studio embeds Ghostty through native macOS code. Accepted ADRs do not decide
native terminal ownership, portable terminal behavior, process boundaries, or a non-macOS fallback.

**Suggested direction:** Keep the terminal behind a narrow Studio host boundary. Define terminal
lifecycle, process authority, and platform fallback before Antiky supports another desktop platform.

### 18. External analytics and presence

**State:** Open.

**Why this is open:** The website loads Fathom and SSPS. Studio can send the optional SSPS online
presence signal. Accepted ADRs do not define third-party ownership, privacy, opt-out, failure, or
retention rules for these services.

**Suggested direction:** Keep external signals optional and product-owned. Send no project or usage
data for presence. Document each network boundary, fail closed, and keep a local opt-out for Studio.

## Resolved candidates

### 5. Studio process and connection

**State:** Resolved.

[CLI ADR 0002](cli/0002-supply-cli-project-services-through-a-library-api_H.md) puts project services
behind a library API. [CLI ADR 0003](cli/0003-make-cli-project-services-the-development-authority_H.md)
makes those services the development authority.
[Studio ADR 0006](studio/0006-use-cli-project-services-directly_H.md) requires Studio to use that
library directly. Together, these records decide the local service owner and connection model.
