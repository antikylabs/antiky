# Content, assets, animation, and audio inspection

Research snapshot: 2026-08-09

## Executive conclusion

Antiky already has useful pieces of a content pipeline: a public asset catalog, a verified installer,
strict project manifests, build-change classification, exact build-artifact hashes, canvas-only frame
capture, structured runtime inspection, and one complete revision/correction model for point lights.
It does **not** yet have a project asset system.

An agent currently cannot answer, through an Antiky contract:

- Which source and accepted revision produced a visible texture, sprite, model, animation, effect,
  sound, or UI element?
- Is the file present, decodable, licensed, within budget, imported with current settings, loaded in
  this runtime, and used by any world entity or render/audio system?
- What depends on it, what output would a reimport invalidate, and which last-good revision can be
  restored?
- Does it look and move correctly from the gameplay camera, and does it sound correct in the game
  mix rather than as an isolated source file?

The right next step is not a large asset editor or hundreds of format-specific MCP tools. Build one
deep, Antiky-owned `AssetService` with a validated project registry, content/dependency graph,
candidate-to-accepted revision flow, runtime bindings, stable diagnostics, and evidence records.
CLI, MCP, Studio, build tooling, tests, and games should adapt that service. Blender, Aseprite,
image/audio codecs, and other DCCs remain bounded import workers; they never become Antiky's source
of authority.

## Scope and evidence labels

This audit covers Antiky Framework, CLI, Studio, the asset catalog, current demos, website demo
publication, product/architecture documents, and the game-art/content skill research. Antiky and
BroMetal are the implementation targets. External engines contribute patterns only.

Existing seed skills are non-authoritative scaffolding. Their roles, prompts, and artifact shapes
are inputs to evaluate, not constraints on the Antiky content system or its future skills.

- **Current** means implemented in source and supported by an inspectable path or test.
- **Accepted direction** means described by current Antiky architecture, not implemented proof.
- **Gap** means agents cannot obtain or control the required fact through a shared Antiky boundary.
- **Recommendation** is a proposed Antiky-native contract that still needs a real game slice.

## Current Antiky evidence

| Surface | Current capability | Important limit |
| --- | --- | --- |
| [`@antiky/asset-catalog`](../../../packages/asset-catalog/src/index.ts) | 1,292 CC0-first records; source, creator, license, formats, facts, preview origin, hashes, and `cataloged` / `source-verified` / `install-verified` states | A discovery catalog is not a project content database. Only three records are install-verified; `AssetKind` is a coarse six-value taxonomy. |
| [`antiky asset install`](../../../packages/asset-catalog/src/node/install.ts) | Validates one `.antiky` project; permits only install-verified records; enforces path containment; verifies file size and upstream hash; computes SHA-256; writes provenance to `assets/antiky-assets.json` | It has no import/decode validation, dependency check, usage graph, candidate state, prior-revision receipt, uninstall, or rollback. Reinstall replaces the destination before updating the registry. |
| [Project manifest](../../../packages/cli/src/project.ts) | Strict 64 KiB schema, project-root containment, loopback services, development/build commands, and viewport | It declares no content root, registry, import profiles, platform/quality profiles, or asset budgets. Asset records should not be embedded into this small high-level manifest. |
| [Build tracker](../../../packages/cli/src/host/build-tracker.ts) | Distinguishes source, shader, asset, and project changes; correlates a changed path to a newer ready runtime | “Asset” is an extension list and one latest path. There is no asset identity, batch, dependency closure, compiler status, reimport result, or current/last-good revision. Important DCC/runtime formats are not watched. |
| [Game host](../../../packages/cli/src/host/game-server.ts) | Serves files only from `dist`, rejects path escape/symlinks/oversize files, uses `nosniff`, and reports generic game start/frame failures | MIME mapping covers JS/JSON/CSS/common images/SVG/WOFF2, not glTF/GLB, KTX2, HDR/EXR, audio, video, or many fonts. It has no semantic loader report or stable asset diagnostic. |
| [Framework inspection](../../../packages/framework/src/inspection/snapshot.ts) | Validated, immutable, bounded runtime, render, diagnostic, session, world, event, and point-light views | The schema has no assets, dependencies, resource residency, animation, VFX, audio, or UI view. Diagnostics can only name runtime/render as their source. |
| [Studio inspection](../../../packages/studio/app/src/components/InspectionPanel.tsx) | Hierarchy, semantic stores, raw snapshot, events, MCP calls, and diagnostics | No asset browser, dependency/use graph, provenance/license status, import state, budgets, preview, or revision controls. |
| [Frame capture](../../../packages/cli/src/host/actions.ts) | Captures only the game canvas; returns PNG hash, bytes, development session, runtime, and build revision | It captures one frame, not motion or audio; omits camera/world/session-step/asset revisions and dimensions from its result; its absolute filesystem path can reveal a local user/path through MCP. |
| [Published demo artifacts](../../../packages/website/scripts/build/demo-artifact.mjs) | Deterministic source revision, exact output set, per-file SHA-256/size, symlink rejection, aggregate limits, and staging verification | The artifact knows files, not asset meaning, provenance, license, dependencies, target variant, runtime use, or visual/audio approval. |
| [Town validation](../../../packages/demos/antiky/antiky-town/src/town/art/town/validation.ts) | Deterministic procedural mesh fingerprint, topology/material checks, collision/path checks, and measured mesh budgets | Strong project-local validation, but it does not inspect external files or publish results through the shared Framework asset boundary. |
| [Rendering/assets architecture](../../architecture/framework/rendering-and-assets_A.md) | Defines stable asset IDs, revisions/hashes, source/compiled/live ownership, dependencies, validation, last-good replacement, and render bindings | **Accepted direction**, not current implementation. The asset manifest, compiler coordination, driver, and graph remain open decisions. |

The point-light slice is the best behavioral precedent. It exposes one stable identity through
authoring, runtime, and render projections; requires expected revisions; returns stable command
results; records accepted facts; and corrects without deleting history. Asset revisions should
follow that authority model while keeping large bytes out of commands/events.

## Concrete repository findings

These are current observations, not hypothetical future problems:

1. [`Point Light Expo`](../../../packages/demos/antiky/point-light-expo/assets/antiky-assets.json)
   contains a verified four-texture Poly Haven installation, but no game source refers to those
   files. Antiky has no orphan/unused-asset diagnostic.
2. Antiky Town and the pure BroMetal Town Study each carry byte-identical copies of four atlas
   images and their sidecars - roughly 6.4 MiB per project. The relationship is implicit; there is no
   shared content identity, snapshot declaration, or duplicate-content report.
3. The Town sprite sidecar points at
   `_legacy/creative/pixel-art/.../antiky-wayfarer-cardinal-walk-v003.aseprite`; that source path is
   absent. A source-missing audit would catch this before further derivation.
4. The atlas sidecars contain valuable hashes, dimensions, grid/pivot/animation information,
   generation date, limitations, and some provenance. They are separate ad hoc schemas with no
   shared parser. [Town runtime code](../../../packages/demos/antiky/antiky-town/src/town/index.ts)
   repeats dimensions, grid, pivot, and image paths instead of reading the sidecars, so metadata and
   behavior can drift independently.
5. Generated atlas provenance names “OpenAI built-in image generation” but omits model/version,
   prompt/reference hashes, service/output terms, full human edits, and approval evidence. Keyed
   sources for two atlases live under the website package rather than the demo's declared source
   boundary.
6. No current demo contains a shipped audio clip, 3D model file, rig, or skeletal-animation file.
   Current models, particles, and most motion are generated in code. Antiky therefore has no real
   evidence for those import/runtime paths yet.
7. The build watcher recognizes AVIF/GIF/GLB/glTF/JPEG/JSON/MP3/OGG/PNG/SVG/WebP, but not WAV/FLAC,
   KTX2/Basis/DDS, HDR/EXR, FBX/OBJ/Blend, Aseprite, or common font source formats. Expanding the list
   alone would still not create semantic reimport.
8. Combat Arena publishes a useful bounded particle-pool count, but there is no shared VFX asset,
   emitter, overdraw, timing, or budget contract. Sprite animation exists in one atlas sidecar but
   is not visible through runtime inspection.
9. Website poster tests enforce distinct SHA-256 values, ≥2560×1440 delivery dimensions, WebP, and
   a 1.2 MB budget. This is good publication evidence, but the poster has no capture record tying it
   to a game build, runtime, camera, state, or approval.

## Full lifecycle audit

| Stage | Current | Missing control/evidence |
| --- | --- | --- |
| Reference and art direction | Product/skill research defines target frames, art bibles, reference rights, and independent approval | No project-local art-direction/reference artifact identity, approval, source-rights record, or link from an asset to the target it must satisfy |
| Acquisition/generation | Static CC0-first catalog; three verified Poly Haven install selections; manual/generated atlases | No quarantine/staging state for manual, generated, archive, or DCC inputs; no generator/model/service-terms contract; no prompt-injection boundary for untrusted metadata |
| Provenance/licensing | Catalog records source, creator, license, attribution, retrieval, upstream hashes; installer persists those facts | Project registry covers catalog installs only; no license snapshot/receipt, human edits, releases/trademark/cultural flags, expiration/change review, credit generation, or publish blocker |
| Staging | Installer downloads to a random temporary directory, validates bytes, then renames | No inspectable candidate ID, file-type/magic/decode scan, active-content quarantine, archive inventory, prior-install checkpoint, crash-safe registry/files transaction, or dry-run diff |
| Import/reimport | Vite and BroMetal build commands create output; shader changes wait for generated output; game reload proves a new runtime | No registered importer profiles, DCC version/settings, deterministic source→compiled manifest, dependency invalidation, candidate validation, compatibility class, safe live swap, or last-good fallback evidence |
| Type/schema metadata | Catalog kind; ad hoc Town atlas JSON; strict generic world components | No shared texture/material/model/mesh/skeleton/clip/VFX/audio/UI schemas, migrations, capability discovery, or unknown-version quarantine |
| Variants/LOD/compression | Vite emits hashed files; Town has project-local mesh limits; website posters have publication limits | No target/quality profile, texture/audio/model variants, LOD chain, compression settings, decoded/GPU memory, visual error, or platform budget report |
| Dependency/use graph | Architecture describes a graph; Vite resolves module/file imports internally | No queryable source→compiled→material→entity/pass/audio-event graph, reverse dependents, “why included,” duplicate content, orphan files, cycles, or explicit incomplete status |
| Missing/broken assets | Failed load can become a generic game-start or frame diagnostic; installer checks selected bytes | No offline audit or stable codes for missing source/output, hash drift, unresolved dependency, decode failure, stale import, unsupported schema, unused asset, or missing runtime binding |
| Runtime validation | Runtime/build identity, generic render counts, canvas capture, world/store inspection | No per-asset load/decode/upload state, active/last-good revision, resource memory, bindings, load latency, animation state, voices/buses, VFX occupancy, fallback, or disposal proof |
| Player-facing review | Exact canvas PNG; fixed-step pause/step; high-resolution demo posters | No scenario/input/camera-linked capture sequence, contact/deformation review, lighting/state matrix, game-mix audio capture, visual/audio comparison, issue annotations, or approval verdict |
| Promotion/rollback | Point-light correction records history; architecture describes asset safe-swap | Installed files can be replaced but asset revisions cannot be promoted/rejected/restored through Antiky authority; no dependent rebuild/readback or rollback rehearsal |

## Recommended Antiky content model

### Keep one project manifest and one content authority

Do not put an asset inventory inside the small `.antiky` project manifest. Evolve the existing
`assets/antiky-assets.json` into a validated **Project Asset Registry** that covers catalog,
authored, generated, and procedural content. A future project-manifest version may declare its
portable relative path and named target profiles, but the registry remains a separate bounded
projection.

The catalog identity is an origin, not an Antiky `AssetId`. One catalog item can produce several
source revisions, meshes, textures, materials, collision assets, and platform variants. Give every
meaningful project asset a stable UUIDv7 `AssetId` and every immutable version a content hash.

Minimum current-record projection:

```ts
type ProjectAssetRecord = Readonly<{
  assetId: AssetId;
  typeId: string;
  schemaVersion: number;
  label: string;
  currentRevision: number | null;
  lastGoodRevision: number | null;
  candidateRevision: number | null;
  revisions: readonly AssetRevisionSummary[];
}>;

type AssetRevisionSummary = Readonly<{
  revision: number;
  state: 'staged' | 'compiled' | 'validated' | 'accepted' | 'rejected';
  contentHash: `sha256:${string}`;
  source: AssetOrigin;
  compilerProfileId: string | null;
  compilerVersion: string | null;
  settingsHash: `sha256:${string}` | null;
  variants: readonly AssetVariantSummary[];
  dependencies: readonly AssetDependency[];
  diagnostics: readonly AssetDiagnosticSummary[];
}>;
```

The projection should be deterministic and source controlled. Large bytes, captures, and detailed
logs stay outside it. Accepted commands/events preserve revision history; the exact persistence
layout should be earned by the first authoring slice rather than invented as a second database.

### Three graphs, one query surface

A trustworthy dependency answer merges three different graphs:

1. **Declared content graph:** texture → material → model/prefab; skeleton → clips; audio clips →
   audio events; atlas → UI/sprite definitions.
2. **Build graph:** source files and importer settings → compiled variants → exact `dist` files and
   artifact hashes.
3. **Live binding graph:** accepted asset revision → loaded CPU/GPU/audio resource → render/audio/
   animation binding → entity → pass/bus/system.

Each graph reports `available`, `retained`, and `incomplete` rather than pretending a static scan
found dynamic use. Queries must answer both directions: **what does this need?** and **what uses
this?** A project scan can identify unregistered files and likely orphans; only explicit build and
runtime reporting can prove inclusion and use.

### Source, candidate, accepted, and live remain distinct

```text
untrusted acquisition or generation
  → quarantined source + rights record
  → staged AssetRevision candidate
  → registered importer profile
  → content-addressed compiled variants
  → structural/type/budget validation
  → isolated preview + gameplay evidence
  → explicit accepted authoring command
  → safe runtime binding swap at a frame boundary
  → readback and independent approval
  → retire old live resource; retain last-good revision
```

An import or reimport never silently changes the accepted world. It creates a candidate. Promotion
requires an expected asset revision and permission; successful promotion records a fact. Rollback
is another accepted revision-selection command, not deletion of the failed or superseded history.

## Domain inspection contracts

These are semantic views over the shared asset model, not separate databases.

| Domain | Required inspectable facts | Required validation/evidence |
| --- | --- | --- |
| Texture / sprite atlas | Dimensions, format, color space, alpha mode/cutoff, semantic channels, normal convention, atlas cells/pivots/borders, mip count, sampler, compression variant, decoded/GPU bytes | Hash/dimension/atlas bounds; channel/color-space rules; alpha bleed; mip/compression visual comparison; material/entity bindings; native-resolution gameplay captures |
| Material / shader / VFX material | Pipeline/program slot, parameters, texture dependencies, blend/depth/cull, variants/fallback, current/last-good layout, passes and entities | Compile/layout diagnostics; rebind compatibility; shader/pipeline counts; overdraw/GPU timing; lighting/state matrix; failed replacement preserves last-good |
| Mesh / model | Units/axis, nodes, transforms/pivots/bounds, vertex/index/triangle counts, topology, UV sets, normals/tangents, material slots, morphs, collision, LODs | Format validator; finite/topology/UV/tangent checks; LOD coverage/hysteresis and visual error; collision/traversal; target-camera silhouette; CPU/GPU memory |
| Skeleton / rig | Joint IDs/names/hierarchy, bind pose, inverse binds, scale/axis, retarget profile, skinned meshes | Missing/duplicate joints; weight normalization/influences; deformation extremes; retarget readback; bounds and gameplay silhouette |
| Animation clip / graph | Source range, duration/sample rate, loop/additive/root-motion policy, contacts/events, compression, skeleton dependency, current state/transition/time | Deterministic import; root displacement; foot/hand contact and slide; rapid transitions/interruption; reduced-speed capture; runtime event and graph-state inspection |
| VFX system | Seed, emitters, curves, material/mesh dependencies, bounds, pool capacity, active/peak particles, blend/sort/depth, lifecycle and gameplay cue | Determinism; bounded allocation; spawn/cleanup; peak occupancy, uploads, overdraw and GPU timing; pause/step behavior; readability under busy gameplay |
| Audio clip / event | Codec/container, channels/sample rate/bit depth, duration, loudness/true peak, loop points, source rights; event variants, bus, attenuation, priority, concurrency, ducking, streaming, localization | Decode/loop/click/silence checks; peak/voice/memory/streaming budgets; deterministic event trigger record; attenuation/listener state; in-game mix capture with no microphone/desktop audio |
| UI / font / icon | Atlas/nine-slice/pivot, DPI/scale, color space, glyph and locale coverage, fallback chain, focus/input/accessibility states, material and memory | Safe-zone/aspect/resolution/localization expansion; missing glyphs; controller/touch focus; color-vision/reduced-motion states; overdraw/batches; busy-gameplay readability |
| Procedural content | Generator ID/version, seed, settings hash, source dependencies, output fingerprints, target profile | Same inputs produce same outputs; bounds/topology/collision/nav; density and memory worst case; generated dependencies and rights are explicit |

Antiky should not hard-code universal polygon, texture, animation, voice, or effect budgets. A project
owns named target/quality profiles. Every variant reports source bytes, delivery bytes, decoded CPU
bytes, estimated/observed GPU or audio memory, load time, and domain metrics against those profiles.
Optimization is accepted only when target measurements improve without failing gameplay-camera or
mix comparison.

## Antiky-native inspection and control surfaces

### Offline CLI first

The first deep module should work without a running game:

```text
antiky asset audit [--project path] [--json]
antiky asset graph <asset-id> [--direction dependencies|dependents|both]
```

`asset audit` should parse the complete registry strictly and emit stable diagnostics for missing
sources/outputs, hash drift, unregistered files, duplicate content, unsupported schemas, unresolved
dependencies, cycles, stale compiler/settings versions, incomplete provenance, license blockers,
invalid variants, and likely unused assets. It must distinguish **known unused**, **possibly unused
because the graph is incomplete**, and **live-used**.

This slice can immediately use current repository fixtures: the unused Point Light Expo install,
missing Town Aseprite source, duplicated Town images, and sidecar/runtime metadata drift.

### Shared read service and MCP projection

Add an optional bounded `assets` view to Framework inspection, then expose a small tool set:

| Tool | Result |
| --- | --- |
| `list_assets` | Filtered/paginated summaries with type, current/candidate/last-good revision, load state, severity, rights, budget, and use counts |
| `get_asset` | One exact source/compiled/live projection, variants, validation, provenance, bindings, and revision identities |
| `get_asset_graph` | Bounded dependencies/dependents across content, build, and live graphs with completeness/counts |
| `get_asset_diagnostics` | Stable current findings, affected IDs/revisions/profiles, recovery hint, and evidence links |

Do not return arbitrary source bytes, DCC documents, provider HTML, or absolute local paths through
these reads. Use opaque evidence IDs and project-relative paths. Studio's trusted native boundary
can resolve a local file when the user explicitly opens it.

### Candidate mutation service

After read-only inspection works, add shared typed operations rather than arbitrary shell/DCC tools:

| Operation | Required controls |
| --- | --- |
| `stage_asset_candidate` | Approved project-local source or catalog receipt; expected asset revision; rights record; type/size/magic/path validation; no acceptance |
| `compile_asset_candidate` | Registered importer profile and target profile; pinned tool/version/settings; restricted working roots/network; content-addressed outputs |
| `validate_asset_candidate` | Structural, dependency, domain, budget, runtime-preview, and evidence verdicts; no mutation of accepted state |
| `promote_asset_revision` | Human/declared authority, expected current revision, candidate hash, complete required gates; records accepted fact and dependent rebuild plan |
| `rollback_asset_revision` | Expected current revision and retained compatible target; records restoration fact; verifies bindings and dependents after swap |

Installation, compilation, and validation may be asynchronous bounded jobs, but job state must be
inspectable and cancellation must leave the current accepted asset untouched. DCC adapters accept
only a registered profile and owned input/output directory; an MCP caller must not supply an
arbitrary executable or script.

### Studio Assets surface

Add an **Assets** view backed by the same service, not a Studio-only index. It should show:

- type/status/severity filters and current/candidate/last-good revisions;
- source, license, attribution/rights blockers, compiler profile, variants, and budgets;
- dependency/dependent/use graph with selected entities, materials, passes, audio events, and files;
- missing, broken, duplicate, unused, stale, and fallback status;
- isolated preview plus exact in-game bindings and evidence;
- explicit validate, promote, reject, reimport, and rollback controls with a proposed-delta summary.

Studio is a reviewer/control client. It should not become a Blender clone, material graph, DAW, or
the owner of content state.

## Runtime validation and gameplay evidence

Every loader/import adapter must publish an `AssetRuntimeBinding` containing asset/revision/variant,
load/decode/upload state, resource identity, memory, load time, bindings, fallback, and stable error.
The render driver should report current and last-good material/mesh/texture revisions and dispose an
old resource exactly once after a safe swap. Animation, audio, and VFX adapters need equivalent
states rather than hiding failures in game-specific notes.

Extend capture into a bounded **evidence sequence**, not desktop screen recording:

```ts
type ContentEvidence = Readonly<{
  evidenceId: string;
  buildRevision: number;
  runtimeInstanceId: string;
  sessionId: string | null;
  completedStepRange: readonly [number, number] | null;
  worldRevision: number | null;
  assetRevisions: readonly { assetId: AssetId; revision: number; variantId: string }[];
  scenarioId: string | null;
  inputTraceHash: string | null;
  camera: { entityId: EntityId | null; viewport: readonly [number, number]; dpr: number };
  qualityProfileId: string;
  captures: readonly { kind: 'frame' | 'sequence' | 'game-mix-audio'; sha256: string }[];
  verdict: 'pending' | 'approved' | 'blocked';
}>;
```

Capture only the game canvas and, for audio, the game-owned mix - never the desktop, microphone,
terminal, title bar, notifications, or unrelated applications. Store opaque evidence IDs in MCP
results; do not expose `/Users/...` capture paths. Require at least an isolated preview and an
in-world sequence from expected gameplay cameras. Character/animation review needs motion and
contacts; VFX/UI need busy states; materials need multiple lighting states; audio needs real event,
listener, concurrency, and ducking conditions.

## Importer and untrusted-content boundary

All acquired files and metadata are hostile until validated:

- enforce path containment, file-count/expanded-size limits, no symlinks, and magic-byte/type checks;
- inventory archives before extraction and reject path traversal, links, devices, nested bombs, and
  executable/add-on content;
- contain glTF external URIs and reject unexpected network/data URIs;
- sanitize or rasterize untrusted SVG; same-origin SVG can contain active content;
- bound image dimensions/decoded pixels, mesh counts, animation tracks, audio duration/channels, and
  parser recursion before allocation;
- treat DCC documents, scripts, add-ons, metadata prose, and generated prompts as untrusted input;
- disable macros/scripts/external lookups by default and deny importer network access;
- pin tools and record executable/version/settings/output hashes;
- snapshot the exact license/receipt at acquisition and track copyright, trademark, publicity,
  performer/model release, cultural, and service/model-weight terms independently;
- never auto-promote a generated or downloaded candidate because a tool called it “production
  ready.”

The current catalog installer should become transactionally crash-safe: validate the existing
registry records, finish and fsync the candidate file tree and candidate registry, atomically swap
both with a recoverable prior receipt, and restore on interruption. Reinstall must not silently
destroy user-modified files; hash drift is a blocker requiring an explicit replace/adopt decision.

## Stable diagnostic taxonomy

The asset service needs IDs/revisions/paths as structured fields, not embedded only in prose.
Initial stable codes should cover:

```text
ANTIKY_ASSET_REGISTRY_INVALID       ANTIKY_ASSET_SOURCE_MISSING
ANTIKY_ASSET_HASH_MISMATCH          ANTIKY_ASSET_OUTPUT_MISSING
ANTIKY_ASSET_SCHEMA_UNSUPPORTED     ANTIKY_ASSET_DEPENDENCY_MISSING
ANTIKY_ASSET_DEPENDENCY_CYCLE       ANTIKY_ASSET_IMPORT_STALE
ANTIKY_ASSET_IMPORT_FAILED          ANTIKY_ASSET_DECODE_FAILED
ANTIKY_ASSET_RUNTIME_BIND_FAILED    ANTIKY_ASSET_BUDGET_EXCEEDED
ANTIKY_ASSET_PROVENANCE_INCOMPLETE  ANTIKY_ASSET_LICENSE_BLOCKED
ANTIKY_ASSET_UNUSED                 ANTIKY_ASSET_DUPLICATE_CONTENT
ANTIKY_ASSET_REPLACEMENT_REJECTED   ANTIKY_ASSET_LAST_GOOD_ACTIVE
```

An unused or duplicate asset is usually informational/warning, not an automatic deletion command.
A runtime may intentionally keep a fallback or preload. Diagnostics must state graph completeness
and offer a recovery action without inventing one.

## Prioritized Antiky slices

### P0 - Offline registry and audit

- Strictly parse current `assets/antiky-assets.json` records and project-local sidecars.
- Add stable `AssetId`, revision, source, hash, type/schema, provenance, dependency, and status
  projections without breaking the existing catalog installer.
- Implement `antiky asset audit --json` and detect the four concrete repository findings above.
- Harden reinstall into a recoverable transaction and preserve modified-file decisions.

**Exit:** a stopped project can produce a deterministic, path-safe report of every registered file,
hash, source, rights state, dependency completeness, duplicate, missing item, and likely orphan.

### P1 - One complete loaded-texture slice

- Register the Town material atlas and sidecar through one shared texture/atlas schema.
- Make runtime code consume generated typed metadata rather than repeat dimensions/grid/pivot.
- Publish source/compiled/live revisions, memory/load status, material/entity/pass bindings, and
  stable load diagnostics through Framework, MCP, and a Studio Assets view.
- Add `list_assets`, `get_asset`, `get_asset_graph`, and `get_asset_diagnostics`.

**Exit:** selecting the atlas explains its origin, hash, compiler settings, exact loaded resource,
users, current/last-good revision, budget, and native gameplay evidence. Removing or corrupting it
produces one stable asset diagnostic, not a generic game-start failure.

### P2 - Candidate reimport, safe swap, and rollback

- Reimport one texture/material candidate with pinned deterministic tooling.
- Validate before promotion; use expected revisions and explicit authority.
- Swap at a safe frame boundary, rebuild only declared dependents, read back live bindings, retain
  the prior good version, and prove exact-once disposal.
- Exercise rejection, interrupted import, incompatible layout, and rollback.

**Exit:** a failed candidate cannot replace the accepted frame; an accepted change can be restored
without deleting history or refreshing the world blindly.

### P3 - Target variants and artifact integration

- Add one measured desktop/mobile quality profile and source-preserving texture variant pipeline.
- Extend `antiky-artifact.json` with the accepted content manifest hash and compiled variant set only
  after the runtime registry is stable.
- Teach the game host correct reviewed MIME types for formats actually adopted.

**Exit:** the build proves source→variant→artifact→runtime identity and measured delivery/decoded/
GPU cost; staging rejects stale or undeclared variants.

### P4 - Animation and player-facing sequence evidence

- Convert the current Wayfarer atlas into the first shared sprite-animation contract.
- Resolve or explicitly mark its missing editable source and full generated-asset provenance.
- Publish active clip/direction/frame, events, atlas revision, and character binding.
- Capture deterministic movement sequences at normal and slowed playback from the gameplay camera.

**Exit:** an agent can trace one visible character frame to an accepted atlas/clip revision and prove
loop timing, pivot/ground contact, direction, transition, limitations, and runtime cost in motion.

### P5 - First real audio and scalable VFX slices

- Add one gameplay-critical sound event with licensed source, loop/loudness/attenuation/concurrency/
  streaming data and game-mix evidence.
- Generalize the existing particle-pool inspection through one measured combat or traversal effect,
  including deterministic seed, peak occupancy, overdraw/GPU cost, and cleanup.
- Add UI/font contracts only with a real controller/localization/accessibility feature.

**Exit:** audio, VFX, and UI contracts are earned by shipped game behavior rather than speculative
format schemas. Headless Framework tests remain free of browser, BroMetal, and DCC dependencies.

## Required evidence and regression coverage

When these code slices are implemented, their tests should prove:

- strict schema bounds, unknown-version rejection, immutable projections, pagination, and explicit
  incomplete counts;
- missing/hash-drift/duplicate/orphan/cycle/stale-import/license diagnostics with stable codes;
- archive/path/symlink/URI/decoded-size containment and no writes outside owned staging roots;
- deterministic import from source/tool/settings hashes and rebuild of only affected dependents;
- candidate rejection, crash/interruption recovery, expected-revision conflict, promotion readback,
  last-good fallback, rollback, and exact-once resource disposal;
- build artifact/content manifest agreement and correct reviewed MIME delivery;
- target-profile budget aggregation from observed rather than invented metrics;
- gameplay-canvas/game-mix-only evidence with build/runtime/world/session/asset identity and no
  absolute paths or desktop/terminal data;
- visual motion/contact and audio loop/mix fixtures at system cut points, plus qualified human
  approval for creative quality.

No prose tests were added for this research document.

## Bottom line

Antiky's architecture already contains the essential ideas: stable identity, separate authoring/
runtime/render projections, explicit dependencies, last-good replacement, structured diagnostics,
bounded inspection, expected revisions, and correction history. The implementation should earn that
asset model through the Town texture and sprite-animation slices before attempting broad model,
skeletal-animation, audio, or DCC automation.

The success criterion is not “an agent can download a file.” It is: an agent can prove where content
came from, what exact revision the player sees or hears, what it costs, what depends on it, whether
it satisfies the creative target in gameplay, and how to restore the last known good result without
guessing or exposing the user's machine.
