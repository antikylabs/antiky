# Execute goal 16: update BroMetal and close every local patch loop

## Prerequisites

- [Goal 99](_completed/execute-goal-99.md) is complete. This goal needs the routed BroMetal items
  A11, U1, U2, U3, N3, and N4 from its
  [summary](_completed/summary-goal-99.md).
- [Goal 15](_completed/execute-goal-15.md) is complete. Keep its texture-array and mip-clamp
  behavior and its real-GPU evidence.
- The readback contribution follows
  [`brometal-request/07-UPSTREAM-DELIVERY-AND-DECISIONS.md`](../../brometal-request/07-UPSTREAM-DELIVERY-AND-DECISIONS.md).
- Run this goal before Goal 19. Both goals can invalidate the committed demo sidecars and must not
  recapture or commit them concurrently.

### Needed from the owner before starting

| # | What | Why it needs you |
|---|---|---|
| 1 | Authorize focused upstream pull requests for `sampler-lod-clamp`, `texture-array-sampler`, WebGPU perspective depth, and target readback. | Opening pull requests changes external state. ADR 0021 requires each local patch to have one, but an agent cannot infer publication approval. |

## `/goal` objective

Bring Antiky's whole BroMetal patch set onto the current published release and make every patch
temporary in practice. This goal delivers A11 and U1 through U3 from
[`execute-goal-99.md:71-80`](_completed/execute-goal-99.md) and the readback prerequisite from
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

The seven existing rows must remain traceable while the two missing rows become failing-first patch
modules. The four rows without pull requests account for the four external submissions that need
owner authorization.

## Required outcome

When the work is complete, the repository must have:

1. every BroMetal dependency and the exact patch-runner guard updated to the then-current published
   version, with the lockfile agreeing;
2. each existing patch rechecked against clean current source, rewritten only where its target
   moved, and retired only when the installed release contains the behavior;
3. one failing-first patch and focused upstream pull request for WebGPU-correct perspective depth;
4. one failing-first patch and focused upstream pull request for bounded asynchronous render-target
   readback, kept independent from Framework IDs, Studio, and selection policy;
5. focused upstream pull requests and exact retirement instructions for `sampler-lod-clamp` and
   `texture-array-sampler`;
6. a written U2 disposition: `discard` and the two attribute-buffer defects already have focused
   pull requests; `mat4.orthographic`, shader conveniences, instance-count convenience, and sprite
   demos are not silently recreated as local patches;
7. every patch header naming its upstream pull request and released-version retirement steps; and
8. clean-install, idempotence, real-GPU, full-test, and recaptured-demo evidence against the new
   dependency.

## In scope

- **Version update.** Own all package manifests that pin `brometal`, `package-lock.json`,
  `scripts/patch-brometal.mjs`, and the existing patch modules.
- **Two missing defects/capabilities.** Own new modules under `scripts/patch-brometal/` for the
  perspective-depth correction and target readback. One module maps to one contribution and one
  pull request.
- **Two missing upstream links.** Apply the current `sampler-lod-clamp` and
  `texture-array-sampler` contributions to current upstream TypeScript and tests, then replace
  `not yet submitted` with the pull-request URL and retirement instructions.
- **Existing contributions.** Refresh the states of pull requests 3 through 7. Do not retire a
  module for a merged-but-unreleased change.
- **PR 2 triage.** Preserve the useful split already achieved by pull requests 5 and 7. Record why
  each remaining bundled convenience is withdrawn or belongs to a different current consumer.
- **Evidence.** Own patch tests, the patch-module policy allowlist, affected demo sidecars, and the
  upstream handoff documents needed to reproduce each contribution.

## Required tests and evidence

At minimum, prove:

- the clean published package fails a plane-mapping test for `mat4.perspective`, then the patch maps
  the near plane to WebGPU depth 0 and the far plane to depth 1;
- the clean published package has no public bounded target read, then the patch reads known pixels
  asynchronously with correct row alignment, bounds, completion, format, and disposal behavior;
- running every patch twice changes no bytes and the patched content is present;
- every installed BroMetal copy is patched, the wrong version throws, a moved target throws, and
  every patch module on disk is registered;
- each retained local module names one open or merged upstream pull request and an exact release
  condition for removal;
- the texture-array runtime test uses a real GPU and still separates two layers at a coarse mip;
- a clean install applies all patches, a second `npm run postinstall` changes nothing, `npm test`
  exits zero, and `npm run demos:verify` has no unexplained regression; and
- each affected Antiky demo is recaptured and inspected, with the metrics sidecar committed.

## Explicit non-goals

- Do not bundle two contributions into one pull request or reopen the grab-bag shape of pull request
  2.
- Do not patch `mat4.orthographic` for the current Framework 2D proof; that proof owns plain numeric
  camera math and does not require a BroMetal helper.
- Do not add Antiky IDs, selection semantics, Studio behavior, or Framework policy to the readback
  contribution.
- Do not retire a patch because a pull request merged. Retire it only when Antiky installs a release
  that contains the verified behavior.
- Do not weaken the exact version guard or a moved-target failure to make the update install.
- Do not post to BroMetal issue 8 or make a support or release promise.

## Engineering constraints

- Follow `AGENTS.md`, `docs/GOOD_ENGINEERING_H.md`, ADR 0021, and the `brometal-patching` workflow.
- Write the failing regression against clean published BroMetal before each new patch, and watch it
  fail for the intended reason.
- Keep one patch module per upstream contribution. N3's large texture-array module remains one file
  unless the upstream contribution itself splits.
- Preserve N4's hand-written atlas URL list and test-only validator unless their stated trigger is
  reached; neither is dependency-update work.
- Make short focused commits without coauthor tags and preserve unrelated worktree changes.

## Completion definition

The goal is complete only when Antiky installs the then-current BroMetal release, every retained
patch is revalidated and traceable to one upstream pull request, the perspective and readback gaps
have failing-first local patches plus focused pull requests, PR 2's remainder has an explicit
disposition, clean-install and idempotence checks pass, and affected demo captures have been viewed.

If the current release already contains a capability, retire that patch through the full update
workflow instead of reapplying it. If owner authorization for the required pull requests is absent,
stop before local patch work creates another untraceable permanent patch.
