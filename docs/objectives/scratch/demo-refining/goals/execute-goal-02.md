# Execute goal 02: unblock the render pipeline inside BroMetal and send the fixes upstream

## Prerequisites

- [Execute goal 01](execute-goal-01.md) is complete. The capture evidence in this goal needs a
  working `capture_frame` path and the frame statistics from W0.2b, and `npm test` must already be
  green (W0.1b) before this goal adds a test file.
- [Execute goal 00](execute-goal-00.md) is complete, or the owner has released this goal ahead of
  it. ADR 0021 carries the contribution practice that the upstream pull requests here follow.
- No commit from goal 01 is in flight. Both goals edit `scripts/repository-policy.test.mjs` and root
  `package.json`, so they must not commit concurrently.

## `/goal` objective

Remove the two BroMetal defects that make a real render pipeline impossible, then send each one
upstream so the local patch can be retired.

This goal delivers Track A from `docs/objectives/scratch/demo-refining/06-WORK-PACKETS.md:138-172`:
packets W A.1 and W A.2. Both are bugs of omission in BroMetal 0.15.0, not workarounds. Both go into
the existing `scripts/patch-brometal.mjs`, which already patches `discard()` and `present()` the
same way.

Track B — the per-demo HDR target, tone map, shadow map, ambient and bloom work — is blocked on
this. In particular, without W A.2 every demo silently loses the 4× multisample anti-aliasing it has
today the moment it renders to an off-screen target, which makes the later bloom goal a visible
regression on every silhouette edge.

## Required outcome

When the work is complete, the repository must have:

1. a patch in `scripts/patch-brometal.mjs` that replaces the hard-coded nearest sampler on render
   targets at `node_modules/brometal/dist/runtime/webgpu.js:761` with linear filtering, for the
   render-target case only;
2. a patch in the same file that stops `drawTo` from forcing `passSamples = 1` at
   `node_modules/brometal/dist/runtime/webgpu.js:235`, so an off-screen pass keeps the sample count
   it was configured with;
3. both patches idempotent — running `npm run postinstall` twice is a no-op — matching the existing
   contract established by the `if (source.includes(after)) return;` guard at
   `scripts/patch-brometal.mjs:27-33`;
4. both patches behind the existing version guard at `scripts/patch-brometal.mjs:23-25`, which
   throws when the installed BroMetal is not `0.15.0`;
5. `scripts/patch-brometal.test.mjs`, registered in the `scripts/` allowlist at
   `scripts/repository-policy.test.mjs:24-33` and in the root `test` script at `package.json:27`, in
   the same commit; and
6. one focused upstream pull request prepared per patch, each standing on its own, so that an
   accepted pull request removes the need for that patch.

## In scope

- **W A.1 — linear filtering on render targets.** Owns `scripts/patch-brometal.mjs` (section 1) and
  `scripts/patch-brometal.test.mjs`. `webgpu.js:761` creates every render target's sampler with
  `magFilter: 'nearest', minFilter: 'nearest'`. A bloom downsample chain built on point sampling
  produces blocky, crawling glow. Read the comment directly above that line before changing it, but
  **check it against the code**: the comment cites `rgba32float`, which is not filterable without an
  opt-in device feature. `TARGET_FORMAT` at `webgpu.js:11` is `rgba16float`, which **is** filterable
  in core WebGPU. No `rgba32float` target is ever created, so the hardware constraint the comment
  names does not apply to any target that exists. The comment is stale on that point.
  The second half of its reasoning is still real: a target holding simulation state (particle
  positions) must not interpolate, because averaging two particles' positions is meaningless. That
  is a per-use policy, not a format constraint. So the patch must add a **per-target filter option
  that defaults to `nearest`**, preserving today's behaviour for every existing caller, with linear
  opt-in for image targets such as the bloom chain. Do not flip the global default.
- **W A.2 — preserve multisampling in off-screen passes.** Owns `scripts/patch-brometal.mjs`
  (section 2). `drawTo` sets `internals.passSamples = 1` at `webgpu.js:235` unconditionally, so a
  pass that renders into an off-screen target drops from 4× MSAA to none without saying so. The
  patch must carry the configured sample count through, and must keep the pass format and depth
  bookkeeping around it (`webgpu.js:234-236`) consistent with whatever it changes.
- **Serialisation.** W A.1 and W A.2 own the same file. Run them one after the other. Do not
  dispatch them in parallel — the owned-file list is the lock, and this is the one place in Track A
  where it binds.
- **Upstream contribution.** ADR 0021 carries the practice: patch locally, then send a focused
  upstream pull request for each patch so the patch can be retired. Prepare both pull requests in
  this goal — a minimal reproduction, the change against BroMetal's own source rather than against
  `dist/`, and a one-paragraph statement of the defect. Both patches individually satisfy the
  clause carried from ADR 0006 into ADR 0021 that a contribution "must help renderers in general or
  correct an error": nearest-only render-target sampling and silently dropped multisampling are both
  errors that affect every BroMetal user, not Antiky preferences.
- **Evidence.** After both patches apply, re-capture all three antiky demos through the goal 01
  harness and commit the `visual-metrics.json` sidecars. A change to the render path that has not
  been captured and looked at is not done.

## Required tests and evidence

At minimum, prove:

- the patch applies cleanly from a fresh `npm install`, and re-running `npm run postinstall` a
  second time changes no bytes — compare a checksum of `node_modules/brometal/dist/runtime/webgpu.js`
  before and after the second run;
- the patch throws a clear, named error when BroMetal's version is not `0.15.0`, exercised by a test
  that points the script at a fixture package with a different version rather than by editing the
  installed package;
- the patch throws `BroMetal patch target changed` when a patch target string is absent, so a silent
  no-op after a BroMetal upgrade is impossible;
- **W A.1 filtering:** a test renders a 2×2 texture into a larger target and asserts the sampled
  midpoint is an interpolated value, not equal to any of the four source texels within 1/255;
- **W A.1 default guard:** a render target created without an explicit filter option still receives
  a nearest sampler, proving state-holding targets keep their non-interpolating behaviour and that
  the intent behind `webgpu.js:758-760` survived;
- **W A.2 multisampling:** a diagonal edge rendered into an off-screen target and resolved shows at
  least three distinct intermediate values along the edge with the patch, and exactly two without
  it. Record both runs;
- **W A.2 no regression:** the three antiky demos' captures show no increase in aliased edge pixel
  count against the pre-goal baseline, measured through the goal 01 frame statistics;
- `npm test` is green, including the new `scripts/patch-brometal.test.mjs`, with both the `scripts/`
  allowlist and the root `test` script updated in the same commit; and
- each upstream pull request is recorded in the handoff with its URL, the BroMetal source file it
  changes, and the local patch section it retires when accepted.

## Explicit non-goals

- Do not change any demo shader, renderer, or `src/` file. This goal changes only the patch script,
  its test, and the metrics sidecars. Consuming the patches is Track B's work.
- Do not build an HDR target, a tone map pass, a shadow map, or bloom here. Those depend on this
  goal, and mixing them in makes the multisampling regression test meaningless.
- Do not vendor, fork, or check in a modified copy of BroMetal. The patch script is the mechanism.
- Do not edit `node_modules/` by hand as the deliverable. Any hand edit must be reproducible by
  `npm run postinstall` from a clean install, and the clean-install run is the evidence.
- Do not remove or weaken the version guard to make the patch apply to a newer BroMetal. A version
  bump is a separate, reviewed change.
- Do not write an ADR for the `postinstall` patch step. It is normal dependency practice with a
  stated exit, and ADR 0021 already carries the rule.
- Do not open an upstream pull request that bundles both patches, or that carries Antiky-specific
  preferences alongside the defect fix.

## Engineering constraints

- `packages/demos/antiky/antiky-town` is in scope for this objective, like every other demo. This
  goal changes no demo code, but the patches must not regress it — it has the most shader passes of
  any demo, so it is the strongest check that the multisampling patch is correct.
- Demos hand-roll rendering per demo until `BroMetalRenderDriver` exists. Do not extract a shared
  render package. The patches make a per-demo pipeline possible — they do not authorise starting the
  driver.
- Tests are required for every code change (`AGENTS.md`). Both patches fix reported, verified
  defects, so write the failing test first for each, watch it fail against unpatched BroMetal, then
  apply the patch.
- Use short one-line commit messages. Never add coauthor tags. W A.1 and W A.2 are two commits.
- Capture PNGs are not committed. `.antiky/` is gitignored and `*.png` is tracked by Git LFS. The
  committed artifact is the `visual-metrics.json` sidecar.
- Preserve unrelated dirty worktree changes.
- Respect the existing structure of `scripts/patch-brometal.mjs`. It is 186 lines and uses two
  helpers, `replace` and `replaceSection`. Add sections in the same style rather than restructuring
  the file, and keep it under 500 lines (`docs/GOOD_ENGINEERING_H.md`).
- Treat the comments in `node_modules/brometal/dist/runtime/webgpu.js` as Chesterton's fences.
  Understand why a line is there before patching it, and say so in the patch's own comment.

## Completion definition

The goal is complete only when both patches are in `scripts/patch-brometal.mjs`, both are proven
idempotent from a clean install, both have failing-then-passing tests recorded, the version guard
and the changed-target guard both still throw, the three demo captures show no aliasing regression,
`npm test` is green, and both upstream pull requests are open with their URLs in the handoff.

If either patch cannot be written without breaking the nearest-by-default guarantee or the pass
format bookkeeping, stop and report the exact conflict. Do not ship a patch that makes particle
sampling wrong to make bloom look right, and do not weaken the multisampling test to accept two distinct edge
values. Track B is blocked on this being correct, not on it being finished.
