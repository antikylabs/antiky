# Summary — goal 16: update BroMetal and verify every local patch

**Status:** complete

**Completed:** 2026-08-16
**Commits:** `4c649c5`, `4743a35` (shared Goal 16 and Goal 18 delivery), `b089f3f`, `6e274f1`,
`1521875`, `398d204`, `0857a9e`, `2d2ecf2`, `58ea299`, `b6eb2f1`, `97574ab` (shared
planning and capture delivery), `a4aa2d5`
**Goal file:** [`execute-goal-16.md`](execute-goal-16.md)
**Patch ledger:**
[`goal-16-brometal-patch-ledger.md`](../../upstream/goal-16-brometal-patch-ledger.md)

## Action needed from the owner

None.

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
8. All four Antiky demos were rebuilt, captured, inspected, and resealed against Goal 18's final
   Framework source. Their visual budgets pass.

## What I got wrong

The old idempotence test hashed only `dist/runtime/webgpu.js`. `discard` and
`texture-array-sampler` both replaced the same `dist/dsl/builtins.d.ts` declaration anchor, so a
second install duplicated both declarations without changing the file the test hashed. The
installed 0.17.2 declaration file had grown to 938 lines before the audit exposed it. The two
patches now have independent anchors, and the test hashes every file under `dist/`.

The first attempt to commit the 0.18.0 manifest and lockfile update collided with Goal 18's staged
Framework work in the shared Git index. Commit `4743a35` therefore contains both goals even though
only Goal 16 paths were added in that command. Both owners audited the commit and preserved it
instead of rewriting shared history.

A later evidence commit repeated the shared-index problem. Commit `97574ab` includes the four
sidecars and Goal 16 documents together with already-staged planning work, including the owner's
Goal 17 deferral. It lost no work, but it is not a focused Goal 16 commit. The final evidence commit
`a4aa2d5` followed a cached-path audit and contains only this summary and the patch ledger.

The new GPU test was initially runnable only by its direct path. The repository structure audit
correctly exposed that collection gap. Commit `2d2ecf2` adds the declared GPU tier; the follow-up
repository-policy failure proved the command allowlist also had to recognize it.

## Traps worth knowing

- Run the GPU, capture, and repository tiers with `mise exec node@22.14.0 -- npm ...`. Node 25.9.0
  aborts inside the Playwright/Chromium native launch on this machine before a test result. The
  mise command also keeps npm child scripts on Node 22, which prevents Studio from packaging the
  wrong project-service executable.
- The first authoritative repository run found a stale 43.3 GiB Cargo target whose generated Tauri
  permissions named the old `emberwyrd/antikySite` checkout. A scoped `cargo clean` of
  `packages/studio/tauri/target` removed only generated artifacts; the rebuilt Node 22 native gate
  passes.
- A Framework source change invalidates all four Antiky demo sidecars. Goal 16 and Goal 18 ran in
  parallel, so final captures waited for Goal 18 commit `d4f790e`.
- Combat Arena and Traversal Study initially timed out because each passed a template expression to
  `new URL`. Vite compiled the lookup through an empty object, so the demos asked BroMetal to load
  `/undefined` and never published a runtime. Static literal URLs fixed both Antiky-side defects;
  production-bundle tests now prove both material maps resolve in each demo. Do not widen the
  managed-runtime timeout for this failure mode.
- The anti-slop structure checker no longer reports either GPU test as uncollected. Its whole-repo
  run still reports 151 other findings because its selected root-package oracle does not understand
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
| Real GPU tier | `mise exec node@22.14.0 -- npm run test:gpu` — 4/4 pass: readback, array binding, distinct layer selection, and coarse per-layer mip separation. |
| Studio native cache repair | JavaScript 25/25, Rust unit 11/11, and native contract 7/7 pass after the scoped generated-target cleanup. |
| Final repository gate | `mise exec node@22.14.0 -- npm test` exits 0. Root 106/106, camera 10/10, CLI 143/143, Framework 172/172, website and every workspace pass; Studio app is 58/58 and the native counts are 25/25, 11/11, and 7/7. |
| Demo verification | `mise exec node@22.14.0 -- npm run demos:verify` reports 32/33. Every sidecar budget passes. The sole failure is Goal 99 M12: `shader/graph.mjs` resolves the demos root one directory too shallow and discovers no demos. Goal 19 owns that pre-existing infrastructure defect. |

## Capture evidence

All four frames contain their intended populated scene with no blank frame, error surface, or
obvious missing texture. The Goal 16 agent and the coordinating agent inspected them independently.
Standalone BroMetal and Three.js demos are outside this pass under the owner's revised Goal 19
scope.

| Demo | Source digest / seal | p95 / local contrast / saturation | Retained PNG |
|---|---|---|---|
| Antiky Town | `25944c1cdeed0a9f` / `bf55868a11bd5b7e` | 0.362 / 7.75 / 0.320 | `/tmp/antiky-goal16-captures/antiky-town-run-1.png` |
| Combat Arena | `857ff27ee97d7f1c` / `5f0b1ada37d935d7` | 0.756 / 11.40 / 0.148 | `/tmp/antiky-goal16-captures/combat-arena-run-1.png` |
| Point Light Expo | `2766dfc75ea03be9` / `ec57803da0c0be9b` | 0.645 / 8.63 / 0.247 | `/tmp/antiky-goal16-captures/point-light-expo-run-1.png` |
| Traversal Study | `406769e82c74abe7` / `b292d9f8b87e7962` | 0.576 / 0.58 / 0.281 | `/tmp/antiky-goal16-captures/traversal-study-run-1.png` |

## What this unblocks

- Goal 19 can use the verified 0.18.0 dependency and all nine local contributions while it changes
  only Antiky-owned demos.
- Goal 19 can consume target readback through BroMetal's general renderer boundary without adding
  Framework IDs or Studio policy to the dependency.
- A future BroMetal release audit has one ledger that names each behavior, current upstream state,
  and exact retirement sequence.

## Deferred debt

Nothing blocks Goal 16. U1 and U2 remain dormant by owner instruction. They do not block this local
dependency update, but ADR 0021's upstream lifecycle remains incomplete. Reopen this debt when the
owner explicitly resumes upstream submission or when npm publishes a new BroMetal release that can
retire a patch. The durable state and retirement procedure are in the
[patch ledger](../../upstream/goal-16-brometal-patch-ledger.md); Goal 99 keeps the disposition in
[U1 and U2](summary-goal-99.md).
