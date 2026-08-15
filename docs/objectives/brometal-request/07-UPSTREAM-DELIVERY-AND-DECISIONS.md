# Upstream delivery and decisions

This document records the BroMetal contribution route, accepted ADR alignment, product-delivery
limits, and the decisions that remain with the owner. It confirms that no new architecture decision
or owner questionnaire blocks planning.

## BroMetal route

GPU target readback is a hard dependency. The repository snapshot uses BroMetal `0.17.2`; that
version's public `RenderTarget` has no read operation even though the WebGPU texture is internally
created with `COPY_SRC` (`node_modules/brometal/dist/runtime/render-target.d.ts:42-50` and
`node_modules/brometal/dist/runtime/webgpu.js:816-870`). Antiky must not import or patch around private
WebGPU internals from Framework code.

### Options considered

| Option | Result | Decision |
| --- | --- | --- |
| Use installed private internals | Fast local experiment, but couples Antiky to an unsupported backend shape and violates driver/dependency ownership. | Reject. |
| Freeze on a permanent local patch | Unblocks Antiky, but leaves a general renderer capability private and creates indefinite upgrade debt. | Reject. |
| Wait for an upstream release before integrating | Avoids a patch, but makes Antiky's internal proof depend on external scheduling. | Reject. |
| Current-version check, temporary patch, focused PR, later retirement | Keeps Antiky moving while giving the renderer-general capability back to BroMetal. | Select; required by ADR 0021 if readback is still absent. |

The selected route has an upstream coordination cost and exact-version maintenance cost. That is an
accepted consequence of concentrating BroMetal work in the Framework driver.

## Required `team-brometal` sequence

1. **Check the current release and source.** Query the latest published BroMetal version and inspect
   current upstream TypeScript. Do not infer capability from the installed package alone.
2. **Choose update or patch.** If suitable public async readback exists, update through the normal
   dependency workflow and audit all existing patches against the new exact version. Do not recreate
   the function locally.
3. **Prove the gap unpatched.** If readback is absent, add a failing exact-version test against clean
   BroMetal. The test reads a known pixel written earlier in the same submit/present path.
4. **Patch one contribution.** Add one named patch module, register it in `PATCHES` and the patch-file
   allowlist, guard the exact version, prove idempotence, and make moved targets fail loudly.
5. **Keep the API general.** The contribution reads a pixel or bounded target region asynchronously
   with correct validation, row alignment, completion, cleanup, and format semantics. It contains no
   Framework identity, selection, Studio, game object, or alias policy.
6. **Open the focused PR in the same work.** Apply the change to current upstream TypeScript and its
   own harness, show before/after evidence, and include one idea only.
7. **Record provenance.** Put the PR URL, upstream status, and precise retirement steps in the local
   patch header.
8. **Retire only from a released dependency.** Merge alone is insufficient. After Antiky targets a
   released version that includes the fix, remove the patch, perform a clean install, run postinstall,
   run affected tests, and recapture the real GPU proof.

An upstream merge or release does not block this objective. The version-guarded local patch is the
temporary bridge. Credentials or repository permission are execution concerns for the goal that opens
the required PR, not an architecture questionnaire.

## Contribution boundary

The BroMetal PR is readback only. Do not bundle:

- `mat4.orthographic`;
- the separate perspective-depth defect candidate;
- matrix inverse, project, or unproject helpers;
- configurable target formats; if the exact ID proof establishes that one is required, amend this
  plan and make it a separate regression, patch, and focused PR; or
- Antiky-specific ID encoding or selection behavior.

Framework can implement its bounded orthographic camera math with plain numbers. Separate general
renderer improvements need their own evidence, patch, and focused PR.

## Accepted decision alignment

| Record | Constraint applied by this plan | Result |
| --- | --- | --- |
| Framework ADR 0001 | Use specialized private maps; do not select a general ECS prematurely. | Small runtime `Position2D` store only. |
| Framework ADR 0002 | Frequent movement, camera, selection, render state, diagnostics, and telemetry are temporary unless a bounded replay/audit proves otherwise. | No durable event per frame, camera update, or selection result. |
| Framework ADR 0004 | Treat 2D as a first-class runtime/editor form. | Dedicated orthographic proof; no claim that 3D/2.3D selection is complete. |
| Framework ADR 0007 | External important world changes use versioned commands; only private session-owned systems write runtime state directly. | Position mutation is an internal runtime API, not a Studio/agent/gameplay-client write surface. |
| Framework ADR 0008 | Worlds own simulation state and `EngineSession` controls world/service lifecycle. | The fixture world owns position state; its session owns service lifecycle. Standalone construction is a test/helper seam. |
| Framework ADR 0009 | Separate authoring, runtime, and render data. | Caller owns durable entity data; Framework stores runtime positions; presentation emits numeric draw data. |
| Framework ADR 0010 | Serialize at real boundaries and do not leak live renderer objects. | Validated selection record crosses existing inspection JSON. |
| Framework ADR 0011 | Stable UUIDv7 identities; numeric aliases are temporary. | GPU IDs are per submitted pick frame and resolve before the driver boundary. |
| Framework ADR 0013 | Simulation inputs and time are explicit; render presentation can run at another rate. | Camera smoothing receives explicit delta time and follows the interpolated presentation position. |
| Framework ADR 0018 | GPU readback is asynchronous; normal simulation does not wait. | Synchronous frame submission plus separate asynchronous selection result. |
| Framework ADR 0020 | Host owns raw input/canvas; game owns semantic state; driver owns GPU work. | Host click/wheel correction, renderer-neutral camera, driver picking. |
| Framework ADR 0021 | BroMetal driver owns GPU resources; general changes are patched and upstreamed. | Readback follows the patch/PR/retirement workflow. |
| Framework ADR 0022 | GPU IDs select Framework entities; stable ID reaches Studio. | This is the completion path; CPU selection cannot substitute. |
| Studio ADR 0006 | Studio uses CLI project services. | Reuse existing development snapshot transport. |
| Studio ADR 0007 | Studio inspects semantic Framework data, not renderer objects. | Studio consumes stable selection inspection only. |

No accepted ADR conflicts with the plan. ADR 0022 records the formerly open architecture choice, so
no new ADR is required. There are no active AIPs to reconcile. Architecture guides that still call
the first canvas-selection method undecided should be updated after the implementation proves the
accepted path; the ADR remains the authority.

## Source delivery versus package delivery

Antiky Framework is already MIT-licensed open source and available from this repository. The current
workspace package uses `private: true`, version `0.0.0`, and has no published npm artifact. Those are
package-distribution facts, not qualifications on open source
(`docs/objectives/brometal-request/research/03-delivery-ownership-and-decisions.md:9-30`).

This objective delivers source, tests, and a runnable repository example. It does not deliver an
installable versioned package or an external support promise.

### Why package extraction waits

A separate companion or published Framework would need decisions and work that the integration proof
does not answer:

- package identity and whether public consumers use generic keys or Framework `EntityId`;
- build output, type declarations, export map, file allowlist, and packed-artifact tests;
- semver, release automation, install documentation, compatibility range, and support policy; and
- an independent consumer outside the monorepo.

At closeout, record evidence for or against later extraction. Do not create `@antiky/spatial-2d`, a
BroMetal companion, or a Framework npm release in this objective.

## Owner decisions

No owner decision blocks `create-goals` or the internal implementation proof.

| Decision | When it is needed | What it blocks now |
| --- | --- | --- |
| Whether to reply on BroMetal issue #8 or contact its author | After the proof exists, or earlier only if the owner explicitly wants communication. Refresh issue state first. | External communication only; no implementation work. |
| Whether Antiky promises external support | Before making a public support or compatibility statement. | Public promise only. |
| Whether to publish Framework or create a separate companion | After the proof provides extraction evidence. This likely needs its own objective and possibly a package-ownership ADR. | Package distribution only. |
| Whether selection becomes bidirectional, MCP-visible as a dedicated tool, or part of feedback/editor workflows | In a later objective with its own user behavior. | Those later features only. |

The issue author and BroMetal maintainer are not acceptance authorities for this internal objective.
No maintainer response or requester adoption is required to complete it.

## External communication rule

Do not post to issue #8 as part of implementation or closeout without explicit owner authorization.
If authorized later:

1. refresh the issue, maintainer response, BroMetal release, and Antiky delivery state;
2. link exact source, tests, and runnable instructions only after they work;
3. state plainly that repository source is open and npm publication is separate;
4. avoid release-date, ecosystem-endorsement, support, and canal-compatibility promises; and
5. keep the BroMetal technical readback PR separate from the product discussion on issue #8.

## Deliberate exclusions and later triggers

This plan deliberately excludes a general ECS/World, CPU picking, transform hierarchy, spatial
indexing, durable or bidirectional selection, MCP and feedback work, Studio editor camera, npm release,
separate package, canal application, issue/Discord outreach, website fixture, transparent/blended/MSAA
picking, touch/pinch, broad 3D/2.3D completion, retrofitting all demos, and unrelated BroMetal math.

Reopen one of these only when a working consumer or owner product decision creates specific evidence.
Do not reopen it because the adjacent capability is merely plausible.
