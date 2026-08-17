# Summary — goal 16: update BroMetal and verify every local patch

**Status:** implementation complete; final repository and recapture evidence is pending the
concurrent Goal 18 Framework source digest.

**Completed:** not yet
**Commits:** `4c649c5`, `4743a35` (shared Goal 16 and Goal 18 delivery), `b089f3f`, `6e274f1`,
`1521875`, `398d204`, `0857a9e`, `2d2ecf2`
**Goal file:** [`execute-goal-16.md`](execute-goal-16.md)
**Patch ledger:**
[`goal-16-brometal-patch-ledger.md`](../upstream/goal-16-brometal-patch-ledger.md)

## Action needed from the owner

Nothing is needed now. You deferred upstream publication, and this goal made no external change.

Four retained modules have no pull request: `sampler-lod-clamp`, `texture-array-sampler`,
`webgpu-perspective-depth`, and `target-readback`. ADR 0021 still requires one focused upstream
contribution per local patch. Goal 99 keeps submission dormant as U1 and keeps the unmerged pull
request 2 convenience triage dormant as U2. Resume those only when you choose to reopen BroMetal
upstream work.

## What was delivered

1. Every live BroMetal consumer and the exact patch-runner guard moved from 0.17.2 to the current
   npm release, 0.18.0. The lockfile now resolves one deduplicated root copy and no longer carries
   stale workspace records for the removed `brometal-driver` and `town-study` packages.
2. Every one of the seven existing contributions was checked against the clean 0.18.0 tarball.
   Each behavior remains absent, every target still matches, and all seven patches stay local.
   Pull requests 3 through 7 remain open; the Goal 15 patches remain explicitly unsubmitted.
3. `webgpu-perspective-depth.mjs` corrects BroMetal's OpenGL-style projection terms. The patched
   matrix maps `z=-near` to WebGPU depth 0 and `z=-far` to depth 1.
4. `target-readback.mjs` adds a public bounded `readPixel(x, y)` operation on render targets. Each
   asynchronous read owns a 256-byte aligned staging buffer, submits before mapping, decodes all
   four `rgba16float` channels explicitly, and destroys the staging buffer on success or failure.
   It adds no Antiky identity, Studio, selection, or policy concepts.
5. All nine module headers now state their checked upstream status and require an installed,
   behavior-verified published release before retirement. A merge by itself is not a removal
   condition.
6. The real-GPU proof is a declared `npm run test:gpu` tier. It runs the existing array-texture
   device checks and the new known-pixel target readback check together.
7. The current dependency identity, clean-package results, upstream states, reproduction commands,
   and retirement procedure now live in the Goal 16 patch ledger.

## What I got wrong

The old idempotence test hashed only `dist/runtime/webgpu.js`. `discard` and
`texture-array-sampler` both replaced the same `dist/dsl/builtins.d.ts` declaration anchor, so a
second install duplicated both declarations without changing the file the test hashed. The
installed 0.17.2 declaration file had grown to 938 lines before the audit exposed it. The two
patches now have independent anchors, and the test hashes every file under `dist/`.

The first attempt to commit the 0.18.0 manifest and lockfile update collided with Goal 18's staged
Framework work in the shared Git index. Commit `4743a35` therefore contains both goals even though
only Goal 16 paths were added in that command. Both owners audited the commit and preserved it
instead of rewriting shared history. Later commits inspect `git diff --cached --name-only` before
committing.

The new GPU test was initially runnable only by its direct path. The repository structure audit
correctly exposed that collection gap. Commit `2d2ecf2` adds the declared GPU tier; the follow-up
repository-policy failure proved the command allowlist also had to recognize it.

## Traps worth knowing

- Run the GPU and capture tiers with the repository's Node 22 toolchain. Node 25.9.0 aborts inside
  the Playwright/Chromium native launch on this machine before a test result. Node 22.15.0 reaches
  the Apple GPU and passes the same four checks.
- Run Node 22 through `nvm exec`, not only by invoking npm's JavaScript entry point with a Node 22
  binary. npm child scripts otherwise find the Node 25 executable first and package it as Studio's
  project-service sidecar.
- The first authoritative repository run found a stale 43.3 GiB Cargo target whose generated Tauri
  permissions named the old `emberwyrd/antikySite` checkout. A scoped `cargo clean` of
  `packages/studio/tauri/target` removed only generated artifacts; the rebuilt Node 22 native gate
  passes.
- A Framework source change invalidates all four Antiky demo sidecars. Goal 16 and Goal 18 ran in
  parallel, so captures were held or discarded until Goal 18's final source and generated API
  digest settled.
- `CAPTURE_RUNTIME_TIMEOUT` can occur while Combat Arena's managed runtime cold-starts. No sidecar
  is written on that failure; release ports 3010 and 3011, then retry the same fenced capture.
- The anti-slop structure checker no longer reports either GPU test as uncollected. Its whole-repo
  run still reports 154 other findings because its selected root-package oracle does not understand
  the workspace test commands. Those findings were not presented as a clean result or changed in
  this goal.

## Evidence

| Check | Result |
|---|---|
| Current package identity | npm 0.18.0; tarball SHA-1 `b4dc5885b0456dc389b8e465c780a04331c275d7`; published git head `12089302f6be36f4c72b8eee7ec9154a52ee3dae` |
| Clean-package behavior | All nine retained behaviors are absent from clean 0.18.0 for the exact failures recorded in the patch ledger. |
| Test-first perspective | Failed with `near=-1` before the module; near 0 and far 1 pass after it. |
| Test-first readback | 6/6 failed with `readPixel is not a function` before the module; 6/6 pass after it. |
| Patched behavior and runner | 30/30 pass across readback, patch lifecycle, retained runtime behavior, and shader parity. |
| Clean install | `node_modules` removed, `npm install` applied all nine modules, a second `npm run postinstall` changed no bytes, and `npm ls brometal --all` reports one deduplicated 0.18.0 copy. |
| Real GPU tier | 4/4 pass on Node 22: readback, array binding, distinct layer selection, and coarse per-layer mip separation. |
| Studio native cache repair | JavaScript 25/25, Rust unit 11/11, and native contract 7/7 pass after the scoped generated-target cleanup. |
| Final repository `npm test` | Pending final Goal 18 source digest. |
| `npm run demos:verify` | Pending final Goal 18 source digest and recapture. |

## Capture evidence

All four Antiky sidecars and retained PNG paths will be recorded here after the final Goal 18 source
digest settles. Standalone BroMetal and Three.js demos are outside this pass under the owner's
revised Goal 19 scope.

## What this unblocks

- Goal 19 can use the verified 0.18.0 dependency and all nine local contributions while it changes
  only Antiky-owned demos.
- Goal 19 can consume target readback through BroMetal's general renderer boundary without adding
  Framework IDs or Studio policy to the dependency.
- A future BroMetal release audit has one ledger that names each behavior, current upstream state,
  and exact retirement sequence.

## What remains blocked

- Final whole-repository and four-demo evidence waits only for Goal 18 to release its final
  Framework source digest.
- U1 and U2 remain dormant by owner instruction. They do not block this local dependency update,
  but ADR 0021's upstream lifecycle remains incomplete.
