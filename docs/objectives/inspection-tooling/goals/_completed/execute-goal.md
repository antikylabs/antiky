# Execute goal: trustworthy observation and private canvas evidence

## `/goal` objective

Implement one end-to-end Antiky development slice that makes runtime-backed inspection fresh and
identifiable, and makes `capture_frame` private and path-safe.

Introduce a strict, versioned observation reference shared by the existing CLI development client
and runtime-backed MCP reads. Use it to bind a canvas capture to the exact development session,
accepted build, runtime instance, and applicable simulation state the caller observed. Reject stale
or mismatched capture requests with stable errors. Replace absolute capture paths in normal typed
client and MCP results with an opaque, content-addressed evidence-artifact reference that agents can
inspect through an authorized path without learning the host username or filesystem layout.

This is a compatibility-preserving hardening slice for the current tools, not a new general
inspection architecture.

## Required outcome

When the work is complete, an agent must be able to:

1. read any current runtime-backed inspection result and determine its development session,
   accepted build, runtime instance, publication sequence and time, connection/freshness state, and
   applicable session/world counters;
2. request a game-canvas capture against the relevant identities it previously observed;
3. receive a stable conflict or unavailable result if the build, runtime, session, or requested
   simulation state is no longer current;
4. receive an opaque artifact reference containing safe metadata such as media type, dimensions,
   byte length, hash, capture identity, and the observation actually captured;
5. inspect the captured image through the typed/MCP boundary without an absolute path appearing in
   the result, error, or MCP audit projection; and
6. distinguish a private, unreviewed local artifact from evidence approved for export. This goal
   must not add automatic publication or imply that arbitrary game-rendered pixels are PII-safe.

## In scope

- Define one strict immutable `ObservationRefV1`-style contract at the CLI development-service
  boundary. It must reuse existing identities and name unavailable fields explicitly rather than
  inventing one universal revision.
- Derive each observation from one accepted runtime publication. Do not assemble a supposedly
  coherent observation by sampling mutable stores at different times.
- Add the observation reference to new compatible result versions for all current runtime-backed
  development-client and MCP reads. Preserve current version-1 behavior where compatibility
  requires it; do not silently change an existing schema.
- Report publication time/sequence and an explicit stale or unavailable state. Retained data after
  disconnect must never look current by omission.
- Strengthen `capture_frame` with expected development-session, accepted-build, runtime-instance,
  and applicable session/simulation preconditions. Require only identities necessary for safe
  capture; do not create a race-prone requirement that every incidental publication remain equal.
- Record the observation actually presented and captured. If an exact simulation step is requested,
  require a paused or otherwise deterministic presentation barrier and fail when it cannot be
  proven.
- Replace the public absolute `path` with a versioned `EvidenceArtifactRefV1`-style result. Keep the
  existing PNG validation, size limit, private permissions, atomic write, hash, stale-result
  rejection, timeout, and cleanup behavior.
- Provide the smallest authorized retrieval mechanism needed by the direct typed client and MCP to
  inspect the image. It may return bounded image content or resolve an opaque artifact ID, but it
  must not expose arbitrary filesystem access or a local path.
- Mark new capture artifacts `private-unreviewed` by default. Keep export, upload, Discord posting,
  website publication, and claims of pixel-content PII scanning outside this slice.
- Update the current CLI/MCP user documentation and inspection-tooling records to distinguish the
  implemented contract from the remaining roadmap.

## Required tests and evidence

Add or update tests at the existing ownership boundaries. At minimum, prove:

- strict parsing, immutability, bounds, unknown-field rejection, and version compatibility for the
  observation and artifact references;
- one runtime publication produces one internally consistent observation across the affected read
  adapters;
- connected, disconnected-retained, replaced-runtime, changed-build, wrong-session, stale-step,
  malformed, oversized, timed-out, and late-result cases fail or report freshness exactly as
  specified;
- a successful capture remains game-canvas-only, carries correct PNG dimensions/hash/byte length,
  and refers to the actual captured observation;
- synthetic usernames, hostnames, home/project paths, terminal prompts, credentials, and PIDs do
  not appear in normal capture results, MCP content, MCP audit projections, or safe errors;
- opaque artifact lookup cannot escape the owned capture store, enumerate arbitrary files, resolve
  another development session's artifact, or bypass retention/cleanup;
- direct development client, CLI adapter, HTTP/stdio MCP adapter, and Studio-facing types agree on
  the same result semantics where they currently share the service; and
- the current point-light inspect/change/readback/correct flow and all existing capture/session
  behavior continue to pass.

Run the affected Framework, CLI, Studio, and documentation checks. Include a sanitized example
receipt from a successful capture and the stable results from at least one stale-runtime and one
path-injection fixture in the final handoff. Do not use OS, desktop, window, terminal, microphone,
or unrelated-application capture for manual verification.

## Explicit non-goals

- Do not build deterministic scenario replay, video encoding, audio capture, visual comparison,
  GPU profiling, render-graph inspection, asset tooling, generic world queries, generic authoring,
  sandboxes, leases, or the future skill library in this goal.
- Do not redesign Studio, create a showcase game, polish current demos, or change website marketing.
- Do not add Unity, Unreal, Godot, or other external-engine support.
- Do not expose raw browser, BroMetal, WebGPU, process, shell, or filesystem objects.
- Do not add a generic file-download endpoint, arbitrary path parameter, generic script/eval tool,
  desktop automation, or screen-recording capability.
- Do not claim this solves caller-specific MCP authentication or content-aware pixel privacy. Record
  those as remaining gaps without broadening this implementation.
- Do not preserve or redesign the existing seed skills; they are non-authoritative scaffolding.

## Engineering constraints

- Preserve Framework's import boundaries: Framework core must not depend on CLI, MCP, Studio, Node,
  browser DOM, BroMetal, or a model provider.
- Keep the CLI project service as the local development and artifact authority. MCP, Studio, CLI
  commands, and tests adapt the same typed service.
- Prefer one deep observation/artifact contract over tool-specific copies.
- Preserve strict schemas, bounded values, stable identities, one writer, expected revisions,
  structured errors, safe readback, and correction rather than hidden mutation.
- Add regression tests before fixing any reproduced bug, including absolute-path or stale-state
  leakage.
- Keep each incremental change working, make short focused commits without coauthor tags, and do not
  modify or discard unrelated worktree changes.

## Completion definition

The goal is complete only when all required behavior is implemented—not merely documented—and the
repository demonstrates the successful and adversarial cases above through passing tests. The
final handoff must list the changed contracts and adapters, test commands/results, compatibility
decision, sanitized evidence, commits, and any remaining limitations.

Stop rather than expanding scope if the implementation reveals that exact capture fencing requires
a separate simulation/checkpoint architecture. Document the blocker with a failing fixture and
leave the broader capability as a follow-up goal.
