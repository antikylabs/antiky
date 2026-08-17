# BroMetal 0.18.0 patch ledger

This reference records why Antiky retains each local BroMetal patch after the Goal 16 dependency
update. Use it when a new BroMetal release is published: repeat the clean-package checks before
changing the version guard, then remove only behavior that the installed release proves it owns.

## Published package audited

| Field | Value |
|---|---|
| Audit date | 2026-08-16 |
| npm version | `0.18.0` |
| npm tarball SHA-1 | `b4dc5885b0456dc389b8e465c780a04331c275d7` |
| lockfile integrity | `sha512-6SdkWaHUj+ogxY/VFDaQANJr6QlH7kX2gSUduqTOALc7QUSdkHfxop0RsDx4dA3X9R82iKz2rCyOyuowVhBZ9Q==` |
| Published git head | `12089302f6be36f4c72b8eee7ec9154a52ee3dae` |
| Antiky pin | Exact `0.18.0` in Framework, four Antiky demos, and three standalone BroMetal demos |
| Installed layout | One root copy, deduplicated for all eight consumers |

The clean npm package still lacks all nine retained behaviors. Every old replacement anchor still
matches 0.18.0, so no patch needed a source retarget. The audit did not open, update, close, or
comment on an upstream pull request.

## Retained contributions

| Patch module | Clean 0.18.0 evidence | Upstream state checked 2026-08-16 | Decision |
|---|---|---|---|
| `render-target-filtering` | A requested linear target still creates a nearest sampler. | [PR 3](https://github.com/ericdrowell/brometal/pull/3) open | Keep. |
| `offscreen-multisampling` | No 4x color attachment or resolve path is created for a 4x target. | [PR 4](https://github.com/ericdrowell/brometal/pull/4) open | Keep. |
| `discard` | The DSL cannot compile `discard()` as a fragment statement. | [PR 5](https://github.com/ericdrowell/brometal/pull/5) open | Keep. |
| `present` | A renderer has no one-frame `present()` operation. | [PR 6](https://github.com/ericdrowell/brometal/pull/6) open | Keep. |
| `attribute-buffer-defects` | Two uploads in one frame bind offsets `[0, 0]`; the second overwrites the first. | [PR 7](https://github.com/ericdrowell/brometal/pull/7) open | Keep. |
| `sampler-lod-clamp` | `lodMinClamp` and `lodMaxClamp` do not reach the sampler descriptor. | Not submitted; owner deferred submission. | Keep. |
| `texture-array-sampler` | `sampler2DArray`, `buildWebgpuTextureArray`, and per-layer mip generation are absent. | Not submitted; owner deferred submission. | Keep. |
| `webgpu-perspective-depth` | `mat4.perspective` maps the near plane to -1 instead of WebGPU depth 0. | Not submitted; owner deferred submission. | Add and keep. |
| `target-readback` | The public target has no `readPixel`; the six readback regressions fail with that missing operation. | Not submitted; owner deferred submission. | Add and keep. |

Pull request 2 remains closed without merge. Its other convenience work was not triaged because
Goal 99 keeps that work dormant as U2. The unsubmitted patch backlog remains dormant as U1. This
ledger does not close ADR 0021's upstream-contribution obligation.

## Behavior checks

| Check | Patched 0.18.0 result |
|---|---|
| Runtime behavior for discard, present, target filtering, offscreen MSAA, LOD clamps, and repeated attribute uploads | 6/6 pass |
| Texture-array DSL and runtime behavior | Pass; the clean package rejects the DSL type and lacks both runtime exports |
| Perspective plane mapping | Near maps to 0 and far maps to 1 within `1e-6` |
| Bounded readback unit behavior | 6/6 pass: row alignment, submit-before-map completion, binary16 values, bounds, active/disposed targets, concurrency, and cleanup |
| Patch runner contract | Full `dist/` digest is unchanged after a second pass; wrong version, moved target, missing registration, and unpatched installed copy checks pass |
| Real GPU tier | 4/4 pass with mise Node 22.14.0: known-pixel readback plus array binding, layer selection, and coarse per-layer mip separation |

The first full-payload idempotence check found a defect in the old patch set. `discard` and
`texture-array-sampler` both replaced the same declaration anchor, so each repeated install added
another pair of declarations. The previous test hashed only `dist/runtime/webgpu.js` and could not
see the change in `dist/dsl/builtins.d.ts`. Goal 16 gave the patches independent anchors and now
hashes every file under `dist/`.

## Reproduce the installed-package checks

From the repository root:

```sh
mise exec node@22.14.0 -- npm ci
mise exec node@22.14.0 -- npm run postinstall
mise exec node@22.14.0 -- node --test scripts/tests/brometal-readback.test.mjs \
  scripts/tests/patch-brometal.test.mjs \
  scripts/tests/runtime-patches.test.mjs \
  packages/demos/tests/shader/output-parity.test.mjs
mise exec node@22.14.0 -- npm run test:gpu
mise exec node@22.14.0 -- npm ls brometal --all
```

Use the exact mise invocation above on this audit machine. Node 25.9.0 aborts inside the
Playwright/Chromium native launch before a test result; mise Node 22.14.0 completes the same
real-GPU tests against the Apple adapter.

To inspect a future clean release without running Antiky's patch hook:

```sh
BROMETAL_AUDIT_DIR="$(mktemp -d)"
npm pack brometal@0.18.0 --pack-destination "$BROMETAL_AUDIT_DIR"
tar -xzf "$BROMETAL_AUDIT_DIR/brometal-0.18.0.tgz" -C "$BROMETAL_AUDIT_DIR"
ANTIKY_BROMETAL_TEST_ROOT="$BROMETAL_AUDIT_DIR/package" \
  node --test scripts/tests/runtime-patches.test.mjs scripts/tests/brometal-readback.test.mjs
```

For a new version, replace `0.18.0` in the two commands. A retained behavior must fail against that
clean package and pass after installation. An expected clean-package failure is evidence that the
patch remains necessary; it is not a green verification run.

## Remove a patch after an upstream release

Do not remove a patch because its pull request merged. Remove it only after Antiky installs a
published release and the clean-package behavior check passes without the local module.

For each retired contribution:

1. Remove its module from `scripts/patch-brometal/`.
2. Remove its entry from `PATCHES` in `scripts/patch-brometal.mjs`.
3. Remove its path from the script allowlist in `scripts/tests/repository-policy.test.mjs`.
4. Update every exact dependency pin, the runner guard, and `package-lock.json` together.
5. Delete `node_modules`, run `npm install`, then run `npm run postinstall` again.
6. Run the behavior, patch-runner, GPU, repository, and demo verification tiers.

If the clean release still fails the behavior check, keep the patch even when an upstream pull
request is marked merged.
