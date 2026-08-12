# Summary — goal 03: the render sweep

**Completed:** 2026-08-11
**Commits:** `4c6363c`, `3ad580b`, `6db1e2f`, `72ccb6a`, `73da762`, `aa4b7c0`, `4b6ecaa`
**Goal file:** [`execute-goal-03.md`](execute-goal-03.md)

## Action needed from the owner

**None.**

The one open question — whether `antiky-town`'s foliage sun was deliberate — was answered and
settled. See "The foliage sun turned out to be load-bearing" below. No bug found during this goal
is outstanding.

## What landed

All eight required outcomes. The eight source invariants that encode them are green; the three that
remain red belong to goals 06–07 and are listed under Outstanding.

| # | Outcome | Evidence |
|---|---|---|
| 1–2 | Camera near planes within a 500:1 budget on all four demos | New invariant walks the whole `src` tree — a `renderer.ts` glob misses `antiky-town`'s two nested cameras |
| 3 | One sun direction and one fog range per demo | `combat-arena` had three of each; `traversal-study` had two |
| 4 | `cull: 'back'` in `traversal-study` | Was `'none'`, throwing away every back-face fragment |
| 5 | Unlit soft contact shadows | New unlit programs in two demos, alpha-blended, radial falloff |
| 6 | Render interpolation in all four demos | Three new `presented-view.ts`; `antiky-town` needed a different fix |
| 7 | Camera shake rebuilt | Trauma model; autocorrelation 0.273 against a 0.3 budget |
| 8 | Dead code deleted with a grep guard | Seven names, plus three uncalled tuple writers |

## Findings worth keeping

**BroMetal cannot share a constant between shaders.** W D.2 asked me to hoist the sun into "a single
exported constant that all of its shaders read". The compiler rejects it outright: *"unknown
identifier — only shader parameters and local consts are in scope (module-level values are not
supported in the MVP)"*. So the choice was three agreed literals or a uniform. I took the literals,
because the duplication is three lines in one folder and `pipeline-invariants.test.mjs` makes drift
impossible, whereas a uniform buys a runtime-varying sun that nothing has asked for. **The uniform
is the right answer the moment a demo wants a sun that changes** — recorded on the register.

**The ships' sun won, not the floor's.** `combat-arena`'s three suns disagreed on the *sign of X* —
the arena floor was lit from the opposite side from the ships standing on it. The ships are the
subject and the contact shadows land on the floor, so the floor moved to agree with them.

**`antiky-town` already had render interpolation and was throwing it away.** Its character motor
implements the textbook version — `previousPosition` captured inside the fixed-step loop, an
accumulator alpha, a `renderPosition` — and does it *better* than the other three demos can, for the
reason below. The hero's sprite used it. The camera did not, and the NPCs discarded their `advance`
result entirely. So the hero was drawn smoothly against a camera stepping at 60 Hz, which jitters
worse than both stepping together. Three lines of routing, not a new system.

**The other three demos cannot be as correct, and the tests say so.** `session.advance` runs its
whole batch of fixed steps with no per-step hook, so a state captured before it is one step old only
when the frame ran exactly one step. That is the normal case at 60 Hz or above; a frame that ran
several steps snaps instead. **A per-step hook on the session is a real framework easy-win** — it
would let all three demos use the motor's fully-correct form.

**A blob drawn as a box blends twice.** The contact shadows used `createCube`. With alpha blending
the top and bottom faces paint the same pixels, so every blob was darkened twice by geometry nobody
could see. They now use a flat quad, which is also why the radial falloff has a clean silhouette.

**`traversal-study` measures `localContrastMedian` 0.00, and the metric is right.** Over half the
frame is flat empty sky, so the median 32px tile genuinely has zero variation. This is not a
regression — the committed metrics read 0 before this goal too. It is a composition finding for
goals 06–08, and it is exactly the "blocky" complaint stated as a number.

## Outstanding

| Item | Disposition |
|---|---|
| Local contrast below the 8.5 floor on three demos (combat-arena 6.12, point-light-expo 2.79, traversal-study 0.00; antiky-town 8.63 passes) | **Goals 06–08.** This goal was the sweep, not the render slice. |
| Three invariants still red — material tone-mapping, discarded normal maps, synthesised UVs | **Goals 06–07.** Not in this goal's required outcome. |
| A per-step hook on `EngineSession` so interpolation can be exact | **Register.** Framework easy-win; goal 11 owns `packages/framework/**`. |
| A shared sun/fog uniform | **Register.** Trigger is a demo wanting a runtime-varying sun. |
| `antiky-town` foliage sun | **Owner decision above**, then the foliage goal. |

## The foliage sun turned out to be load-bearing

The owner confirmed nobody authored the divergence deliberately, so it was unified onto `SUN_COLOR`
at 2.65 and captured. **The canopy turned yellow.** `SUN_COLOR` is a strongly orange golden-hour
key; green leaves under it at full strength clip the red channel before the green, so every tree
stops reading as a tree. 8.3% of the frame changed. `SUN_COLOR` at 1.05 avoids the clip but drains
the greens instead.

The original values are restored, and the comment beside them now carries the measurement rather
than a suspicion. This is the useful outcome: the divergence was undocumented, not wrong, and it is
now documented with the evidence that justifies it.

**Two things this exposed.** First, the "horrid trees" are a geometry and texture problem — flat
alpha cards — not a lighting one, so they belong to the foliage and art-direction goals. Second,
**the yellow version measured higher local contrast (9.25 against 8.63) while looking clearly
worse.** A budget number moving up is not on its own evidence that a change helped, which is now a
row on the register against M1.

## Town work, reported separately

The goal asked for this not to be absorbed silently. `antiky-town` took: the near-plane correction at
both camera sites (500:1 exactly), a documented foliage divergence and a documented post-pass sun
disc, and the interpolation routing above with a regression test. W D.2, W D.3 and W D.4 were
confirmed as **not applying** — one `LIGHT_DIR`, already `cull: 'back'`, and real depth-from-light
shadow passes rather than fake blobs.
