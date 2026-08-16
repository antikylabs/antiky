# Summary — goal 02: unblock the render pipeline inside BroMetal

**Completed:** 2026-08-11
**Commits:** `1e5ce13`, `3203a82`, `9118e47`, `2217721`, `a9adbc3`, `57166ea`, `4633785`,
`f092acd`, `1ca4750`
**Goal file:** [`execute-goal-02.md`](execute-goal-02.md)

## Action needed from the owner

**None.**

Both decisions this goal needed were made during it, and the one deferred item was later reversed
by the owner and completed — see *After the goal closed* below. No bug found here is outstanding.

## What changed

| Artifact | Change |
|---|---|
| `scripts/patch-brometal.mjs` | Two new patch sections, plus a rewrite of install discovery |
| `scripts/tests/patch-brometal.test.mjs` | New. Idempotency, version guard, moved-target guard, all-copies-patched |
| `packages/demos/*/*/package.json` (8) | BroMetal `0.15.0` → `0.17.2` |
| `packages/demos/tests/shader-output-parity.test.mjs` | Version contract updated to `0.17.2` |
| `packages/demos/antiky/*/visual-metrics.json` | Re-captured twice — after the patches, and after the upgrade |
| `docs/.../upstream/` | Two pull-request drafts and a handoff |

## The two defects

**W A.1 — render targets could not be sampled with linear filtering.** The sampler was hard-coded
to nearest, and the comment above it blamed `rgba32float` not being filterable. That half of the
comment is stale: `TARGET_FORMAT` is `rgba16float`, which **is** filterable in core WebGPU, and no
`rgba32float` target is ever created. The other half is real and was preserved — a target holding
particle positions must not interpolate. Filtering became a per-target option that **still defaults
to nearest**, so no existing caller changed behaviour.

**W A.2 — an off-screen pass silently lost multisampling.** The goal file described this as `drawTo`
wrongly forcing `passSamples = 1`. That framing is wrong, and the correction matters: the target
texture **is** single-sampled, a pipeline must match its attachment, and 1 was therefore the only
valid value. Raising it alone would fail WebGPU validation. The missing piece was a multisampled
attachment. The patch adds one and resolves into the target, mirroring what the on-screen path at
`webgpu.js:126-150` already does. The goal's acceptance criteria were satisfiable as written; only
its explanation of the cause needed fixing.

## Evidence

Descriptors WebGPU actually received, headless Chromium with `--enable-unsafe-webgpu --use-angle=metal`.
**No WebGPU validation errors in any case** — the check that matters, because pass, pipeline and
attachments must agree on sample count or the device rejects the pipeline.

| Call | Result |
|---|---|
| `createRenderTarget(r, { width: 8, height: 8 })` | sampler `nearest` / `nearest` |
| `createRenderTarget(r, { …, filter: 'linear' })` | sampler `linear` / `linear` |
| `createRenderTarget(r, { …, depth: true })` | target `rgba16float` @1, depth @1; direct view, `storeOp: 'store'` |
| `createRenderTarget(r, { …, depth: true, samples: 4 })` | target @1, depth @4, colour @4; `resolveTarget`, `storeOp: 'discard'` |

Failing-then-passing was proven by unpacking pristine `brometal@0.15.0` from npm: all five
assertions absent, the defect present. Idempotency proven by checksum — a second run changes no
bytes. Version guard and moved-target guard both throw against fixture packages.

## The upgrade to 0.17.2

The owner asked whether the repository was on the latest BroMetal. It was not — 0.15.0 against a
published 0.17.2, four releases behind, with 0.17.2 published the same day.

Checked before upgrading:

- **Both defects still exist in 0.17.2.** The patches remain necessary and the upstream drafts
  remain accurate.
- **0.16.0 and 0.17.x are almost entirely `--js13k`**, a 13-kilobyte build target. 0.17.1 and
  0.17.2 are explicitly "no library changes; maintenance release". Nothing touches render targets,
  filtering, multisampling or the core runtime path.
- **All 19 patch targets exist unchanged in 0.17.2**, including the pre-existing `discard()` and
  `present()` sections. Only the version guard needed moving.

After the upgrade, all four antiky demos report **identical** metrics to before it — local contrast
3.01 / 5.47 / 0.00 / 8.62. No visual regression.

## Two problems the upgrade exposed, both fixed here

1. **npm stopped hoisting BroMetal and nested a copy into each of the 8 demo workspaces.** That
   broke `packages/demos/tests/shader-output-parity.test.mjs`, which imports `brometal` from a
   directory that is not itself a package and had always relied on hoisting. `npm dedupe` restored
   a single hoisted copy.
2. **The patch script only ever patched the first copy it found.** Its two-candidate lookup assumed
   hoisting. With a nested layout it patched nothing at all and threw; with a mixed layout it would
   have patched one copy and left seven unpatched, which fails **silently** — the demo simply renders
   with an unpatched runtime. The script now discovers every installed copy and patches each, and a
   test asserts it.

The second is the more valuable find. It was a latent fragility in code that predates this goal, and
it only surfaced because the dependency graph moved.

## Caveat on the no-regression evidence

The criterion passes, but **trivially**. **No demo renders to an off-screen target yet**, so both
patches are inert until Track B consumes them. The captures prove nothing broke. They do not
demonstrate either patch working in a demo — that happens in goal 06, the first consumer.

## Decisions taken during the goal

1. **The upstream pull requests were not opened.** Owner decision. Opening them forks BroMetal into
   the owner's account and publishes two pull requests under their identity on a third party's
   project, which an agent does not do on the strength of a goal file. The completion criterion
   requiring open pull requests was withdrawn by the owner — an agent may not loosen a criterion it
   is failing, the owner may.
2. **The drafts diff against `dist/`, not source.** A maintainer will reasonably want the change
   against BroMetal's TypeScript source, which is not in this repository. `HANDOFF.md` records the
   recommended sequence for doing it properly if the pull requests are opened later.


---

# After the goal closed

Three things happened after this summary was first written. They belong to goal 02's subject
matter, so they are recorded here rather than left in commit messages.

## 1. BroMetal upgraded 0.15.0 → 0.17.2 (`57166ea`)

The owner asked whether the repository was on the latest BroMetal. It was four releases behind.
Checked before upgrading: both defects still exist in 0.17.2, so the patches stayed necessary;
0.16 and 0.17 are almost entirely `--js13k` work with 0.17.1 and 0.17.2 explicitly "no library
changes"; and all 19 patch targets existed unchanged, so only the version guard moved. All four
antiky demos reported identical metrics afterwards.

**Two problems the upgrade exposed, both fixed:**

- npm stopped hoisting BroMetal and nested a copy into each of the 8 demo workspaces, which broke
  `packages/demos/tests/shader-output-parity.test.mjs` — it imports `brometal` from a directory
  that is not a package and had always relied on hoisting. `npm dedupe` restored a single hoisted
  copy.
- **The patch script only ever patched the first copy it found.** Its two-candidate lookup assumed
  hoisting. With a nested layout it patched nothing; with a mixed layout it would have patched one
  copy and left seven unpatched, which fails **silently** — the demo just renders with an unpatched
  runtime. It now discovers every installed copy, and a test asserts it. This was a latent
  fragility predating the goal, surfaced only because the dependency graph moved.

## 2. The patch script split into one file per contribution (`f092acd`)

`scripts/patch-brometal.mjs` became a runner over `scripts/patch-brometal/*.mjs`, split **by
contribution rather than by file touched** — `discard` spans eight replacements across five files
and is one module, because it is one upstream PR. Each file now maps 1:1 to a pull request, so an
accepted PR deletes exactly one file.

Two things worth remembering from that work:

- The first split produced a **syntax error**, and the idempotency check reported success anyway
  because both runs failed identically so the checksums matched. **A before/after checksum cannot
  tell "unchanged because correct" from "unchanged because it crashed before writing."** It was
  caught only by also grepping for the patch content.
- A modular split creates a failure mode the single file could not have: a patch that exists, reads
  correctly, and is never applied because nobody imported it. A test now asserts every `.mjs` on
  disk is registered in `PATCHES`.

## 3. The upstream pull requests were opened after all, and a fifth patch added (`1ca4750`)

The owner reversed the earlier decision and supplied a fork, which resolved the objection recorded
above — the drafts diffed against `dist/`, and a maintainer wants source. All five are written
against BroMetal's TypeScript source with a GPU check each:

| PR | Subject |
|---|---|
| [#3](https://github.com/ericdrowell/brometal/pull/3) | render target: linear filtering, nearest still the default |
| [#4](https://github.com/ericdrowell/brometal/pull/4) | render target: keep multisampling in an off-screen pass |
| [#5](https://github.com/ericdrowell/brometal/pull/5) | shader dsl: `discard()` |
| [#6](https://github.com/ericdrowell/brometal/pull/6) | renderer: `present()` |
| [#7](https://github.com/ericdrowell/brometal/pull/7) | webgpu: two per-frame attribute buffer defects |

`#5` and `#7` are **extracted from the owner's existing PR #2**, which bundles eight library
changes with four demos and is being closed in favour of these. `#5` needed porting rather than
cherry-picking, since #2 predates the WebGL2 removal. `#7` deliberately excludes #2's
`draw({ instanceCount })` (a convenience, not a defect) and its WebGL2 `blendFuncSeparate` fix
(no longer applicable).

**A fifth local patch** — `attribute-buffer-defects.mjs` — carries #7's fixes over the published
package, so the repository is covered whether or not upstream merges.

Every PR asks the maintainer to say if it is not applicable, whether a better approach exists given
design context we lack, and what he wants changed.

**Still inert.** All five patches remain unused by any demo until Track B renders off-screen. They
are correct now rather than discovered later, but goal 06 is the first consumer.
