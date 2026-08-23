# Recent architecture learnings

## Purpose

This note records architecture evidence from work completed from 2026-08-08 through 2026-08-10.
It also includes the uncommitted website work that existed during this review.

This note does not make an architecture decision. It identifies decisions that need an ADR review.

## Review result

The recent work contains four decision areas that are not fully recorded in accepted ADRs:

1. Visual evidence is a versioned development service, not a browser screenshot helper.
2. A catalog record, a verified source asset, and a runtime asset are different artifacts.
3. Studio native commands must use the same project authority as the portable web editor.
4. Game presentation needs a small projection and resource-lifetime boundary.

Two recent patterns do not need a new ADR now:

- Dynamic Studio ports are private allocation details of the CLI development authority.
- Website demo publication is already tracked by open candidate 16 in
  [`docs/adr/UNDER_REVIEW_A.md`](../../../../../adr/UNDER_REVIEW_A.md).

## 1. Visual evidence is a development service

### Evidence

Commits `38f34ba`, `0e86cfb`, `44fcbc9`, and `aba11f9` added and hardened managed capture.
The implementation has these properties:

- The CLI owns interactive and managed capture through its development session.
- A capture request names the expected session, build revision, and runtime slot.
- The service rejects stale observations and stale builds.
- One lock serializes capture operations.
- An idempotency key binds to one request digest.
- The capability document pins Playwright, Chromium, formats, dimensions, and resource limits.
- Evidence retention is bounded to the development session.
- The managed runtime targets the final game canvas and checks WebGPU availability.

Relevant implementation files include:

- `packages/cli/src/development/capture-capabilities.ts`
- `packages/cli/src/host/capture-service.ts`
- `packages/cli/src/host/capture-sequence-service.ts`
- `packages/cli/src/host/managed-capture-runtime.ts`
- `packages/cli/src/host/evidence-store.ts`

### Missing decision

CLI ADR 0003 makes CLI project services the development authority. It does not define visual
evidence as a service contract. It also does not define evidence freshness, reproducibility, or
retention.

The contract is now large enough that accidental changes can weaken the meaning of captured proof.
For example, an unpinned browser or a capture without an accepted build revision is not equivalent
evidence.

### ADR candidate

**Title:** Make the development authority own reproducible visual evidence.

The ADR should decide these points:

- The CLI development authority owns capture and evidence records.
- Each result identifies the development session, accepted build, runtime instance, and observation.
- The service rejects stale or ambiguous runtime state.
- Managed capture uses a pinned browser runtime and a declared capability revision.
- Capture limits and retention are part of the safety contract.
- A review derivative does not replace the lossless frame evidence.
- Capture input is presentation input. It does not bypass the game input boundary.

Do not put current pixel limits or exact browser revisions in the ADR. Those values are versioned
implementation policy.

## 2. Asset identity has three layers

### Evidence

Commits `459a43a`, `98507a3`, `10fd318`, `04595bf`, and `44b30b4` established a static asset catalog
and a versioned delivery path. Commits `bbb3654`, `09af969`, and `43940c5` then consumed catalog
assets in game projects.

The work reveals three different artifacts:

1. A catalog record identifies a provider asset and supports discovery.
2. A verified source intake preserves provider data, license evidence, and selected source bytes.
3. A derived runtime asset records exact input digests, an output digest, and the transform recipe.

The Point Light Expo manifest at
`packages/demos/antiky/point-light-expo/assets/derived-assets.json` is the clearest proof. It records
provider identity, license, input hashes, output hashes, and transform operations.

The static API also has an independent `v1` path and schema version in
`packages/asset-catalog/src/static-api.ts`. The website consumes the asset UI, but it does not own
the catalog delivery contract.

### Missing decision

No accepted ADR defines asset identity, provenance, or derivation. Framework ADR 0010 covers
serialization at boundaries. It does not say which asset record is authoritative.

Open candidate 11 discusses voxel source and runtime artifacts. The recent evidence shows that the
same boundary applies to general external assets, not only voxel data.

### ADR candidate

**Title:** Preserve source provenance and derive runtime assets explicitly.

The ADR should decide these points:

- A catalog identifier is a discovery identity. It is not a content identity.
- Project intake records the provider, source location, license, and verified source digest.
- A build can create a runtime artifact only through a deterministic, recorded transform.
- Each derived artifact records its input digests, output digest, tool or recipe version, and material
  interpretation.
- Runtime code consumes project-owned runtime artifacts. It does not depend on mutable provider URLs.
- Publication verifies delivery paths separately from provenance.

This ADR can replace the voxel-only wording in candidate 11 with a general asset boundary. A later
voxel ADR can still decide VOX-specific normalization.

### Key learning

License metadata and content hashes solve different problems. A license says what Antiky can do with
an asset. A digest says which bytes Antiky reviewed and transformed. Both are necessary.

## 3. Native Studio commands use shared project authority

### Evidence

Commits `cfe1556` and `9815a03` added native project menus and documented them. The Tauri menu does
not create a second project model. It selects a path, stages the selection through native project
state, emits the existing project-open event, and returns focus to the main window.

The recent-project menu also uses the same bounded recent-project data. It disables missing projects
instead of inventing a separate recovery flow.

Relevant implementation files include:

- `packages/studio/tauri/src/studio_menu.rs`
- `packages/studio/tauri/src/project.rs`
- `packages/studio/tauri/src/recent_projects.rs`
- `packages/studio/app/src/editor/tauriHost.ts`

### Missing decision

Studio ADR 0002 keeps the web editor independent from Tauri. Studio ADR 0006 makes Studio use CLI
project services directly. Neither ADR states how native desktop commands join the portable editor
without creating a second authority.

### ADR candidate

**Title:** Route native Studio commands through portable editor actions.

The ADR should decide these points:

- The native shell can provide operating-system affordances such as menus and file pickers.
- A native affordance must produce the same typed project action that the portable editor accepts.
- The native shell must not own a parallel open-project state machine.
- Recent-project storage remains native host data, but project acceptance remains in the shared
  project authority.
- Missing or invalid projects return typed errors through the existing project-open path.

This decision clarifies ADR 0002. It does not change the CLI authority selected by ADR 0006.

## 4. Presentation needs projection and lifetime boundaries

### Evidence

Commits `bbb3654`, `09af969`, and `43940c5` independently moved large demo renderers toward the same
shape:

- Simulation owns gameplay state and deterministic changes.
- A presentation or projection module derives render-ready state.
- Composition modules define stable visual layout outside the frame loop.
- The renderer uploads and draws the derived data.
- A resource scope or lifetime module owns GPU cleanup.
- Tests check projection, resource disposal, and visual contracts without opening renderer internals.

Examples include:

- `combat-arena/src/combat-projection.ts` and `combat-arena/src/resource-lifetime.ts`
- `point-light-expo/src/presentation.ts` and `point-light-expo/src/resource-lifetime.ts`
- `traversal-study/src/render-plan.ts` and `traversal-study/src/resource-scope.ts`

### Missing decision

Framework ADR 0009 separates authoring, runtime, and render state. Framework ADR 0016 gives platform
work to the game host. Neither record assigns game-owned presentation projection or GPU resource
lifetime.

Open candidate 14 already identifies player-presentation ownership. Three implementations now give
enough evidence to sharpen that candidate.

### ADR candidate

**Title:** Let game modules own presentation projection and let render drivers own GPU resources.

The ADR should decide these points:

- Gameplay simulation does not store renderer objects or device resources.
- Game-owned presentation code derives semantic render data and transient cues from gameplay state.
- The render driver owns GPU allocation, upload, recovery, and disposal.
- A game can define renderer-specific composition without moving gameplay authority into the
  renderer.
- Tests can verify semantic projections and resource lifetime at these boundaries.

Do not require one shared projection framework yet. The repeated boundary is useful. The current
demo-specific types are still simpler than a general abstraction.

## Decisions that can stay private

### Dynamic development ports

Commit `3ca3aa6` allocates a unique game port for each Studio development session. This prevents
parallel sessions from colliding. The public contract is endpoint discovery through the development
session, not port `5173` or the current allocation range.

This is consistent with CLI ADR 0003. Keep the port range and allocation algorithm private unless a
second process must coordinate leases without the CLI authority.

### One-command demo launch

Commit `34af9c8` adds a convenient game launch command. It composes existing project discovery and
development services. It does not introduce a new authority or runtime boundary.

### Website demo publication

The current website changes add demos to `demo-publication.json`, stage WebP posters, and keep
editorial approval separate from artifact staging. Open candidate 16 already describes this exact
boundary. The current work strengthens that candidate but does not reveal a separate decision.

## Recommended review order

1. Review the visual-evidence ADR candidate first. Agents and release evidence depend on its meaning.
2. Review the asset-provenance ADR candidate before more games add custom intake scripts.
3. Promote and sharpen player-presentation candidate 14 with the evidence in this note.
4. Add the native-command clarification when Studio adds its next operating-system integration.
