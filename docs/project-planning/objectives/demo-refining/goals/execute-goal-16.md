# Execute goal 16: update BroMetal and verify every local patch

## Prerequisites

- [Goal 99](_completed/execute-goal-99.md) is complete. This goal needs the routed BroMetal items
  A11, U3, N3, and N4 from its
  [summary](_completed/summary-goal-99.md).
- [Goal 15](_completed/execute-goal-15.md) is complete. Keep its texture-array and mip-clamp
  behavior and its real-GPU evidence.
- The readback contribution follows
  [`brometal-request/07-UPSTREAM-DELIVERY-AND-DECISIONS.md`](../../brometal-request/07-UPSTREAM-DELIVERY-AND-DECISIONS.md).
- Run this goal before Goal 19. Both goals can invalidate the committed demo sidecars and must not
  recapture or commit them concurrently.

### Needed from the owner before starting

Nothing. The owner has explicitly deferred all upstream submission work. This goal does not open,
update, close, or comment on a BroMetal pull request.

ADR 0021 still requires one focused upstream pull request for every local patch. Goal 99 keeps that
future obligation in dormant items U1 and U2. Do not describe this goal as closing the upstream
patch lifecycle.

## `/goal` objective

Bring Antiky's whole BroMetal patch set onto the current published release, prove which existing
patches are still necessary, and add the two missing local patches. This goal delivers A11 and U3
from [`execute-goal-99.md:71-80`](_completed/execute-goal-99.md) and the local readback prerequisite from
[`brometal-request/07-UPSTREAM-DELIVERY-AND-DECISIONS.md:27-47`](../../brometal-request/07-UPSTREAM-DELIVERY-AND-DECISIONS.md).

The verified 2026-08-16 baseline is BroMetal 0.18.0 on npm while Antiky pins 0.17.2. Pull requests
3 through 7 are open and pull request 2 is closed without merge. BroMetal 0.18.0 still lacks all
seven locally patched capabilities, WebGPU-correct `mat4.perspective`, and public render-target
readback. Recheck all of these facts at execution time because releases and pull requests can move.

| Local contribution | Verified upstream state on 2026-08-16 |
|---|---|
| `render-target-filtering` | Pull request 3 is open. |
| `offscreen-multisampling` | Pull request 4 is open. |
| `discard` | Pull request 5 is open. |
| `present` | Pull request 6 is open. |
| `attribute-buffer-defects` | Pull request 7 is open. |
| `sampler-lod-clamp` | The local patch exists, but it has no upstream pull request. |
| `texture-array-sampler` | The local patch exists, but it has no upstream pull request. |
| WebGPU perspective depth | The defect is verified in 0.18.0; no local patch or focused pull request exists. |
| Render-target readback | The capability is absent from 0.18.0; no local patch or focused pull request exists. |

The seven existing rows must each receive a clean-package behavior check. The two missing rows
become failing-first local patch modules only if the current published release still lacks their
behavior. Pull-request submission is outside this goal.

## Required outcome

When the work is complete, the repository must have:

1. every BroMetal dependency and the exact patch-runner guard updated to the then-current published
   version, with the lockfile agreeing;
2. each existing patch tested against clean current source and classified as kept, retargeted, or
   retired, with the exact behavior evidence recorded;
3. one failing-first local patch for WebGPU-correct perspective depth when the current release still
   maps WebGPU depth incorrectly;
4. one failing-first local patch for bounded asynchronous render-target readback when the current
   release still lacks it, kept independent from Framework IDs, Studio, and selection policy;
5. each retained patch header stating its current upstream state, exact released-version retirement
   steps, and `not submitted` honestly when no pull request exists;
6. no local patch for a capability already present and verified in the installed release; and
7. clean-install, idempotence, real-GPU, full-test, and recaptured-demo evidence against the new
   dependency.

## In scope

- **Version update.** Own all package manifests that pin `brometal`, `package-lock.json`,
  `scripts/patch-brometal.mjs`, and the existing patch modules.
- **Two missing defects/capabilities.** Own new modules under `scripts/patch-brometal/` for the
  perspective-depth correction and target readback. Keep one module per potential future upstream
  contribution even though this goal does not submit it.
- **Existing patch validation.** Run each patch's behavior check against the clean published package
  before applying the patch. A patch target still matching is not proof that the patch is needed.
- **Patch metadata.** Preserve existing pull-request URLs. For an unsubmitted patch, state that
  status and the owner's deferral without fabricating a URL or claiming ADR 0021 is complete.
- **Evidence.** Own patch tests, the patch-module policy allowlist, affected demo sidecars, and the
  handoff documents needed to reproduce each patch decision.

## Required tests and evidence

At minimum, prove:

- the clean published package fails a plane-mapping test for `mat4.perspective`, then the patch maps
  the near plane to WebGPU depth 0 and the far plane to depth 1;
- the clean published package has no public bounded target read, then the patch reads known pixels
  asynchronously with correct row alignment, bounds, completion, format, and disposal behavior;
- every other retained patch has a behavior test that fails, or proves the API absent, against the
  clean current package and passes after patching;
- running every patch twice changes no bytes and the patched content is present;
- every installed BroMetal copy is patched, the wrong version throws, a moved target throws, and
  every patch module on disk is registered;
- each retained local module records its truthful upstream state and an exact release condition for
  removal; missing pull-request URLs remain explicit deferred work;
- the texture-array runtime test uses a real GPU and still separates two layers at a coarse mip;
- a clean install applies all patches, a second `npm run postinstall` changes nothing, `npm test`
  exits zero, and `npm run demos:verify` has no unexplained regression; and
- each affected Antiky demo is recaptured and inspected, with the metrics sidecar committed.

## Explicit non-goals

- Do not create an upstream branch or fork, open or update a pull request, comment on a BroMetal
  issue, or triage the remaining conveniences from closed pull request 2.
- Do not patch `mat4.orthographic` for the current Framework 2D proof; that proof owns plain numeric
  camera math and does not require a BroMetal helper.
- Do not add Antiky IDs, selection semantics, Studio behavior, or Framework policy to the readback
  contribution.
- Do not retire a patch because a pull request merged. Retire it only when Antiky installs a release
  that contains the verified behavior.
- Do not weaken the exact version guard or a moved-target failure to make the update install.
- Do not make a support or release promise.

## Engineering constraints

- Follow `AGENTS.md`, `docs/GOOD_ENGINEERING_H.md`, ADR 0021, and the `brometal-patching` workflow.
- The owner's scope instruction stops this goal before the workflow's pull-request phase. Preserve
  that obligation as U1/U2 follow-up and do not claim that an unsubmitted patch is fully upstreamed.
- Write the failing regression against clean published BroMetal before each new patch, and watch it
  fail for the intended reason.
- Keep one patch module per upstream contribution. N3's large texture-array module remains one file
  unless the upstream contribution itself splits.
- Preserve N4's hand-written atlas URL list and test-only validator unless their stated trigger is
  reached; neither is dependency-update work.
- Make short focused commits without coauthor tags and preserve unrelated worktree changes.

## Completion definition

The goal is complete only when Antiky installs the then-current BroMetal release, every existing
patch is proven necessary or retired, the perspective and readback gaps have failing-first local
patches when still present, every unsubmitted patch is identified honestly, clean-install and
idempotence checks pass, and affected demo captures have been viewed.

If the current release already contains a capability, retire that patch through the full update
workflow instead of reapplying it. If a proposed patch is an Antiky preference rather than a
general renderer capability or defect correction, stop and implement it on Antiky's side of the
driver boundary instead.
