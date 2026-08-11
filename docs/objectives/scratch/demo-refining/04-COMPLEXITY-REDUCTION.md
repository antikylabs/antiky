# Complexity Reduction — the three Antiky demos

**Date:** 2026-08-10
**Scope:** `packages/demos/antiky/point-light-expo`, `combat-arena`, `traversal-study`.
`antiky-town` was not read for this document. **Superseded 2026-08-10:** it is now in scope, and
`goals/execute-goal-09.md` extends this sweep to it. Findings here therefore under-count.
**Rubric:** `docs/GOOD_ENGINEERING_H.md`.
**Reads with:** `02-REMEDIATION-PLAN.md`, `subagent-reports/01-antiky-render-audit.md`.

---

## The constraint this document works inside

The owner deliberately hand-rolls rendering per demo. Capabilities stay in the demos until the
framework officially supports them through its slice process. **Nothing in this document proposes
a shared package, a shared library, or moving code between demos.** Duplication *across* demos is
an accepted, intentional cost and is never listed as a defect here.

What *is* listed is duplication and divergence **inside a single demo** — three different
"where is the ground" functions inside `traversal-study`, two palettes inside `combat-arena`,
two `set`/`setValues` APIs inside one file. That is not the price of the strategy; it is drift
that the strategy does not ask anyone to pay.

---

## Measured size

Handwritten `src` (excluding `*.shader.gen.ts`, which is generated and committed):

| Demo | handwritten src | generated shader src |
|---|---|---|
| `point-light-expo` | 3,635 | 463 |
| `combat-arena` | 3,981 | 427 |
| `traversal-study` | 2,510 | 209 |

Files at or over the rubric's review threshold (>500 needs a cohesion review, >800 should
normally be decomposed). **No file in any of the three demos exceeds 800 lines.** Three exceed
500:

| Lines | File | Verdict |
|---|---|---|
| 568 | `traversal-study/src/simulation.ts` | split — see A1 |
| 524 | `traversal-study/src/renderer.ts` | split — see A2 |
| 503 | `point-light-expo/src/simulation.ts` | borderline — see A3 |
| 498 | `combat-arena/src/simulation.ts` | leave — see A4 |
| 452 | `point-light-expo/src/relay-visuals.ts` | leave — see A5 |
| 361 | `traversal-study/src/inspection.ts` | one 265-line function — see A6 |

The headline finding is **not** file size. It is that roughly 350–450 lines across the three
demos exist to compensate for the colour and lighting bugs in `01-antiky-render-audit.md`, and
another ~250 lines are dead, vestigial, or a second way to do something the demo already does.

---

## Ranked worklist

Ordered by (complexity removed) ÷ (risk × effort). "Gate" says whether the item is safe **before**
the render remediation lands, or must wait until **after**.

| # | Item | Demo | Lines out | Risk | Effort | Gate |
|---|---|---|---|---|---|---|
| 1 | Delete `ARENA_ENERGY_INSTANCES`, `DEFAULT_OFFSETS`, `ROLE_SHAPES.height`, `catalogParts` | combat-arena | ~15 | none | 15 min | before |
| 2 | Delete the dead `set()` twin on both batch factories | all three | ~60 | none | 30 min | before |
| 3 | Delete `uTint` from `traversal-model.shader` (always `[1,1,1]`) | traversal-study | ~10 | none | 20 min | before |
| 4 | Delete `uModel` from `foundry.shader` (always identity) | point-light-expo | ~8 | none | 20 min | before |
| 5 | Collapse the three "ground height at x" functions to one | traversal-study | ~15 | **medium** | 2 hr | before |
| 6 | One palette in combat-arena (`arena-signals` vs `COMBAT_PALETTE`) | combat-arena | ~5 | low | 30 min | before |
| 7 | `ROLE_SHAPES` width/length → read `ENEMY_HULL_CONTRACTS[role].span` | combat-arena | ~10 | low | 1 hr | before |
| 8 | Collapse `ENEMY_VISUAL_PROFILES` 32-entry table to a function | combat-arena | ~25 | none | 30 min | before |
| 9 | Retire the vestigial `procedural` landmark channel | traversal-study | ~15 | low | 45 min | before |
| 10 | Delete `BACKGROUND_LAYERS` (stale, tests-only, contradicts geometry) | traversal-study | ~10 | low | 30 min | before |
| 11 | Delete `lap` and fix `platformInstancesNear(_x, …)` | traversal-study | ~8 | low | 45 min | before |
| 12 | Delete `backgroundCompositionAt`'s ignored `_cameraX` parameter | traversal-study | ~5 | low | 20 min | **after** Phase 3 parallax decision |
| 13 | Trim `RelayOnboardingCue` to the one field the runtime reads | point-light-expo | ~20 | low | 45 min | before |
| 14 | Fold `frame-scratch.ts` into `renderer.ts` | point-light-expo | ~18 | none | 20 min | before |
| 15 | Collapse the three `create*ModelBatch` wrappers to one | point-light-expo | ~20 | low | 45 min | before |
| ~~16~~ | ~~Delete the `RelayOnboardingDependencies` seam~~ — **withdrawn**, it is injected by `tests/onboarding-resources.test.ts:8-11` | — | — | — | — | — |
| 17 | Delete `RELAY_VISUAL_COUNTS` / `RELAY_RENDER_PASSES` exports | point-light-expo | ~5 | none | 15 min | before |
| 18 | Delete the `SHIP_PRESENTATION_SPANS` double re-export | combat-arena | ~8 | none | 20 min | before |
| **19** | **Retire the wash-out knobs** (`uDiffuseLift`/`uTextureContrast`/`uSaturation`, floor grey-wash) | point-light-expo | ~40 | **high** | 3 hr | **after** A1+A2 colour fix |
| **20** | **Retire `uGradeColor`/`uGradeMix`** | traversal-study | ~25 | **high** | 3 hr | **after** B4 material response |
| 21 | Delete `vWash` (±4%, invisible) | traversal-study | ~5 | low | 20 min | after 20 |
| 22 | Delete per-instance micro-tints and rock/stump fake emissive | point-light-expo | ~30 | med | 3 hr | **after** hemispheric ambient |
| 23 | Split `traversal-study/src/simulation.ts` | traversal-study | 0 net | med | 4 hr | before |
| 24 | Split `traversal-study/src/renderer.ts` | traversal-study | 0 net | med | 4 hr | **after** Phase 1 |
| 25 | Delete the 27 "ambience" filler instances | point-light-expo | ~55 | low | 1 hr | after Phase 3 — **owner call** |

Items 1–18 (less the withdrawn 16) are ~210 lines of pure removal at near-zero risk and no visual
change. Do them first;
they make the render remediation a smaller diff. Items 19–22 are the scar tissue and must not be
started until the underlying bug is fixed, or the demos will visibly darken.

---

## A. Files over the limit, and what the split should be

### A1. `traversal-study/src/simulation.ts` — 568 lines

Three responsibilities are welded together:

- **Course geometry queries** — `platformInstances` module state (`:145-151`), `platformInstancesNear`
  (`:153-159`), `supportAt` (`:161-171`). This is *world query*, not simulation state, and it is
  module-level mutable state shared by every simulation instance created in a process.
- **Particle system** — `TrailParticle` (`:84-91`), `spawnTrail` (`:241-252`), `updateParticles`
  (`:499-509`). Self-contained; touches nothing but `trail` and `player`.
- **The run itself** — `update` (`:328-497`), a 170-line function, plus snapshot marshalling
  (`:511-543`).

**Proposed split**, by responsibility:

| New file | Contents | Approx |
|---|---|---|
| `course-query.ts` | `platformInstances`, `platformInstancesNear`, `supportAt`, plus the single `groundTopAt` from item 5 | ~70 |
| `trail-particles.ts` | `TrailParticle`, pool creation, `spawnTrail`, `updateParticles` | ~60 |
| `simulation.ts` | constants, types, `createTraversalSimulation`, snapshot | ~430 |

**Acceptance criterion:** every file under 450 lines; `npm test --workspace @antiky/demo-traversal-study`
passes with **zero changes to `tests/simulation.test.ts`** other than import paths; `tsc --noEmit`
clean. If any assertion needs its *value* changed, the refactor changed behaviour — revert.

**Test protection:** `tests/simulation.test.ts` (385 lines) covers jump buffering, coyote time,
hazards, checkpoints, storm failure and digest determinism. That is enough to make this a safe
mechanical move. No new test required.

### A2. `traversal-study/src/renderer.ts` — 524 lines

`createTraversalRenderer` is a single 228-line function (`:296-524`) containing a 162-line `render`
closure (`:350-512`). Inside it, six unrelated concerns are interleaved: catalog batch population
(`:352-388`), checkpoint flags (`:390-396`), collectibles (`:398-406`), hazards (`:408-413`),
the courier (`:415-420`), the contact shadow (`:422-426`), particles (`:428-443`), ring effects
(`:445-463`), camera (`:465-469`) and the entire HUD (`:471-507`).

**Proposed split:**

| New file | Contents | Approx |
|---|---|---|
| `render-batches.ts` | `writeVec3`, `rollbackAndRethrow`, `createSurfaceBatch`, `createGlowBatch`, `createCatalogBatch` (`:87-275`) | ~190 |
| `hud-projection.ts` | the HUD block (`:471-507`) as `writeTraversalHud(hud, state, cameraFrame, aspect)` | ~60 |
| `world-projection.ts` | course, background, flags, coins, spikes, courier, shadow, trail, effects | ~150 |
| `renderer.ts` | construction, ordering, camera, present | ~130 |

**Acceptance criterion:** every file under 250 lines; `tests/visual-contract.test.ts` passes
unchanged (it already projects the HUD and landmark geometry through the real camera —
`tests/visual-contract.test.ts:82-180`); the demo's committed capture is pixel-identical.

**Gate: after Phase 1.** The HDR-target and shadow-pass work rewrites `drawFrame` and the
per-batch `setFrame` loop. Splitting first means doing the merge twice.

### A3. `point-light-expo/src/simulation.ts` — 503 lines

Just over the line. `update` (`:273-464`) is 194 lines and contains the shade separation solver
(`:405-420`) inline. A minimal split — move the particle pool (`RelayParticle` `:74-84`, `burst`
`:200-224`, `updateParticles` `:259-272`) into `relay-particles.ts` — brings the file to ~450 and
takes the largest self-contained lump out of the way.

**Acceptance criterion:** `simulation.ts` under 460 lines; `tests/simulation.test.ts` (273 lines)
and `tests/inspection.test.ts` pass unchanged.

**This is the lowest-value split in the list.** The file is cohesive and the rubric says
"split by responsibility, not merely to satisfy a line count". Do items 1–22 first.

### A4. `combat-arena/src/simulation.ts` — 498 lines — leave it

It is under the threshold, and it is already decomposed: `combat-state.ts` holds state and pools,
`combat-ai.ts` holds behaviour, `combat-encounter.ts` holds rounds, `combat-projectiles.ts` holds
collision, `combat-pools.ts` holds allocation, `combat-digest.ts` holds hashing. What remains is
eighteen small named closures plus a 92-line `update` (`:373-465`). This is what a decomposed
simulation is supposed to look like. **No action.**

### A5. `point-light-expo/src/relay-visuals.ts` — 452 lines — leave it

Three functions (`populateFormsAndOrbs`, `populateRings`, `populateGlows`) writing instance rows.
It is long because there are a lot of instances, not because it is tangled. Splitting it three
ways would produce three files that each import the same palette, the same slot table and the same
two helpers — more coupling for no gain. **No action** beyond item 25 (deleting the ambience
filler), which removes ~55 lines on its own.

### A6. `traversal-study/src/inspection.ts` — 361 lines

`createTraversalInspectionModel` (`:66-328`) is a single 262-line function. It is almost entirely
one flat `entities` array literal. This is a *data* file wearing a function's clothes.

**Proposed change:** hoist the static parts of the entity descriptors (labels, `typeId`,
`schemaVersion`, ids) into a module-level table, leaving `world()` as a loop that fills in the
snapshot-dependent fields.

**Acceptance criterion:** `createTraversalInspectionModel` under 120 lines;
`tests/inspection.test.ts` passes unchanged; the inspection JSON is byte-identical for a fixed
snapshot (add one snapshot-equality assertion first if none exists).

The same shape applies to `combat-arena/src/inspection.ts` (324) and
`point-light-expo/src/inspection.ts` (312), but both are under 500 and this is cosmetic. Low
priority.

---

## B. Scar tissue — delete, do not tune

Everything in this section exists to fight a bug that lives somewhere else. The remediation plan
already names three of these; the rest are found here. **All of it is gated on the underlying fix.**

### B1. `point-light-expo` — the albedo flatten filter

`src/presentation.ts:21-26` drives `src/shaders/reliquary-model.shader.ts:164-168`:

```ts
const saturated = mix(vec3(L, L, L), sourceBase, uSaturation);          // 0.90
const lifted = mix(vec3(0.48, 0.48, 0.48), saturated, uTextureContrast) // 0.78
  .add(vec3(uDiffuseLift, ...));                                        // 0.14
```

Net: `albedo_out = 0.78·albedo + 0.2456`. A black texel becomes 0.246.

**Delete:** `uDiffuseLift`, `uTextureContrast`, `uSaturation` from the shader (`:84-86`, `:134-136`,
`:164-168`), the three `RELAY_PRESENTATION.catalogMaterial` fields (`presentation.ts:22-24`) and
the three uniform writes (`renderer.ts:157-159`). Then regenerate `reliquary-model.shader.gen.ts`.

**Acceptance:** `rg 'uDiffuseLift|uTextureContrast|uSaturation' packages/demos/antiky/point-light-expo`
returns **zero** hits including `.gen.ts`; `npm run shaders:prod` produces no diff on a second run;
`tsc --noEmit` clean.

**Gate: after** the sRGB decode + single encode (audit A1/A2). Deleting first makes the demo
visibly darker and muddier, not better.

### B2. `point-light-expo` — the floor grey-wash

`src/shaders/reliquary-floor.shader.ts:113` `mix(vec3(0.38,0.36,0.31), sourceDiffuse, 0.56)` —
only 56% of the Poly Haven forest-floor texture survives — then `:122` multiplies by
`uDiffuseTint (0.78,0.82,0.74)`, then `:126-127` multiplies again by a `pathTint`. Three separate
desaturating multiplies on the most detailed asset in the scene.

**Delete:** `uTextureContrast` and `uDiffuseTint` from the floor shader (`:49-50`, `:89-90`, `:113`,
`:122`) and `presentation.ts:19-20`. Keep `pathTint` — it is authored art, not a correction.

**Acceptance:** `rg 'floorTextureContrast|floorDiffuseTint|uDiffuseTint' point-light-expo` returns
zero hits. **Gate: after** A1/A2, same as B1.

### B3. `traversal-study` — `uGradeMix`

`src/renderer.ts:307-314` sets `gradeMix` up to **0.90** on clouds and 0.78 on cliffs, applied at
`src/shaders/traversal-model.shader.ts:53`. 90% of the texture replaced by flat near-white. Eight
of the thirteen batches pass the default `0` (`renderer.ts:200-202`), so for those the `mix()` is
already a no-op on every fragment.

**Delete:** `uGradeColor`, `uGradeMix` (`traversal-model.shader.ts:24-25`, `:46`, `:53`), the two
`createCatalogBatch` parameters (`renderer.ts:201-202`, `:233-234`) and the five call-site
arguments (`:307`, `:310-314`).

**Acceptance:** `rg 'uGradeColor|uGradeMix|gradeMix' packages/demos/antiky/traversal-study` returns
zero hits; `tests/visual-contract.test.ts` passes unchanged (it asserts geometry, not colour, so
it will not mask a regression — pair with a capture).

**Gate: after** B4 in the audit (a real material response for `traversal-model`). The grade exists
because the source assets are 1×1-pixel palette strips (audit §4.3); until the shader gives those
strips something to be shaded *by*, deleting the grade just exposes flat colour.

### B4. `traversal-study` — `vWash`

`traversal-model.shader.ts:42` `vWash = 0.96 + sin(world.x*1.7 + world.y*2.3)*0.04` — a ±4%
world-space brightness ripple, consumed at `:54`. The audit measured this as invisible. It is a
varying, a sine and a multiply per fragment for nothing.

**Delete.** **Acceptance:** `rg vWash traversal-study` returns zero hits.
**Gate:** do it with B3, in the same commit, so one capture covers both.

### B5. `point-light-expo` — per-instance micro-tints and fake emissive on rock

`reliquary-model-layout.ts` writes a per-instance `iTint` of `(1.04, 1.08, 0.96)`,
`(0.94, 1.02, 0.9)`, `(0.82, 1.02, 0.78)` and so on (`:34`, `:42`, `:76`, `:90`, `:105-107`,
`:123`, `:131`, `:143-145`) — hand-tuned ±8% colour nudges — together with a `roughnessBias` of
`-0.02` to `-0.08` and an `emissive` of `0.018`–`0.035` on **rocks and tree stumps**.

Self-illuminating rock is not art direction. It exists because `reliquary-floor` and
`reliquary-model` have no real ambient (audit §2.1: the up/down ambient range is only 1.8×) and
because `materialLayout: 1` forces the rocks' occlusion to `1` (`reliquary-model.shader.ts:162`),
leaving them flat. The emissive is propping them up.

**Delete after** hemispheric ambient + baked AO land (remediation Phase 1 step 3): set every
`iTint` to `1,1,1`, every `emissive` to `0`, every `roughnessBias` to `0`, then judge whether the
instance attributes still earn their place. If they do not, drop `iTint` and the `roughnessBias`
lane from the shader too.

**Acceptance:** `reliquary-model-layout.ts` contains no literal in `[0.7, 1.1]` in a tint position,
and `rg 'emissive' point-light-expo/src/reliquary-model-layout.ts` returns zero hits;
`tests/catalog-primary-models.test.ts` passes unchanged.

**Needs owner confirmation** on whether *any* of the tint variation is deliberate art. My read is
that it is compensation, but it is authored data and I did not find a comment either way.

### B6. `point-light-expo` — the specular clamps

`reliquary-model.shader.ts:60` `min(specGGX(...), 1.5) * 0.12` and `foundry.shader.ts:36`
`min(specGGX(...), 2.4) * (0.16 + metalness*0.84)`. The `min()` exists solely because BroMetal's
`specGGX` is the D term only and spikes toward infinity as roughness → 0 (audit §0). The `0.12`
exists because the unclamped result is unusable.

**Delete both clamps** when the real energy-conserving GGX lands (remediation Phase 1, "Replace
the stub BRDF"). A correct BRDF does not need a magic ceiling.

**Acceptance:** `rg 'min\(specGGX' packages/demos/antiky` returns zero hits.
**Gate: after** the BRDF replacement. Do not delete the clamp before the fix — it will produce
fireflies.

### B7. `combat-arena` — `COMBAT_READABILITY_PROFILE`

`src/combat-projection.ts:25-33`. Named "readability", and every field is a hard-coded size that
compensates for something else: `markedMinimumAlpha: 0.7` and `markedScale: 1.38` exist because
the marked-enemy ring cannot be distinguished at its natural size under a 15–35% luminance band
(diagnosis) — i.e. it is a contrast workaround, not a design constant.

**Do not delete now.** Flag it: once bloom and a real value range land (Phase 1 step 4 + Phase 3),
re-derive these from the ring's actual on-screen contrast and expect `markedMinimumAlpha` to drop
substantially. **Owner confirmation needed** on whether `markedScale` is a gameplay affordance
(reads as "this is the marked one") rather than a contrast patch. I could not tell from the code.

### B8. Summary — the full scar-tissue inventory

| Knob | Where | Compensating for |
|---|---|---|
| `uSaturation` 0.90 | `reliquary-model.shader.ts:86` | sRGB-space lighting desaturating everything |
| `uTextureContrast` 0.78 | `reliquary-model.shader.ts:85` | same |
| `uDiffuseLift` 0.14 | `reliquary-model.shader.ts:84` | no ambient floor |
| `floorTextureContrast` 0.56 | `presentation.ts:20` | texture noise under broken lighting |
| `floorDiffuseTint` | `presentation.ts:19` | same |
| `uGradeMix` ≤ 0.90 | `renderer.ts:310-312` | 1×1-pixel source textures |
| `vWash` ±4% | `traversal-model.shader.ts:42` | 1.81:1 toon ramp having no variation |
| per-instance `iTint` ±8% | `reliquary-model-layout.ts` (many) | flat ambient |
| rock/stump `emissive` 0.018–0.035 | `reliquary-model-layout.ts` (many) | rocks forced to `occlusion = 1` |
| `roughnessBias` −0.02…−0.08 | `reliquary-model-layout.ts` (many) | no Fresnel, so roughness is the only lever |
| `min(specGGX, 1.5 / 2.4)` | two shaders | stub BRDF diverging |
| `uExposure` 1.24 | `presentation.ts:9` | no tone-map/exposure stage |
| `markedMinimumAlpha` 0.7 | `combat-projection.ts:30` | compressed luminance range |

Thirteen knobs. **All of them go away or get re-derived once colour, ambient and the BRDF are
correct.** None should be re-tuned in the meantime.

---

## C. Dead code and vestigial features

Every item here was checked with a whole-repo grep (`packages/**`, excluding `node_modules`) for
the identifier, including `.md` and `.mjs`.

### C1. Provably unreferenced

| Item | File:line | Evidence |
|---|---|---|
| `ARENA_ENERGY_INSTANCES = 36` | `combat-arena/src/arena-environment.ts:6` | repo-wide grep returns **one** hit — the declaration. Actual glow instances are computed at `arena-environment.ts:53-100`. |
| `DEFAULT_OFFSETS = {gauge:28, ring:24}` | `combat-arena/src/arena-signals.ts:9` | `setCombatSignals` has exactly one caller (`combat-projection.ts:249`) and it always passes `SIGNAL_OFFSETS`. The default is also **wrong**: the real gauge offset is 60 (`SHADOW_START` 25 + `ENEMY_COUNT` 6 + 1 + 28). If it ever fired it would corrupt the hull gauges. |
| `ROLE_SHAPES[*].height` | `combat-arena/src/combat-visuals.ts:84-87` | no `.height` reference anywhere in `combat-arena/src` or `tests`. The real vertical scale is `HullContract.presentation.y` (`combat-hulls.ts:37`). |
| `set()` on `createSurfaceBatch` / `createGlowBatch` | `combat-arena/src/render-batches.ts:53`, `:125`; `point-light-expo/src/render-batches.ts:90`, `:168` | no caller. `arena-composition.ts:28/43/61/72` calls `.set` on the **`ModelBatch`** from `arena-assets.ts`, a different type. Everything else uses `setValues`. |
| `RELAY_VISUAL_COUNTS`, `RELAY_RENDER_PASSES` exported | `point-light-expo/src/render-profile.ts:38`, `:116` | used only inside `render-profile.ts`. Drop the `export` keyword (or inline them); the module's real interface is `RELAY_RENDER_SLOTS` + `renderSlot` + `RELAY_RENDER_PROFILE`. |
| `ION_LIGHT_ID`, `VIOLET_LIGHT_ID` exported | `point-light-expo/src/lights.ts:10-11` | used only to build `EXPO_LIGHT_IDS` two lines below. Drop the `export`. |
| `TraversalCameraFrame` / `TraversalCameraRig` / `RelayVisualBatches` / `CombatCameraFrame` etc. as *exports* | many | ~30 exported types with no external importer. Low value individually; worth one sweep. |

**Acceptance for the whole of C1:** a single script — `rg -n '^export (const|type|function)' <demo>/src`
piped through a reference check — reports **zero** exports with no consumer outside their defining
file, except the ones explicitly whitelisted in D3 (test-only seams). `tsc --noEmit` and the demo's
test suite pass unchanged. No new test needed: deleting an unreferenced export cannot change
behaviour, and the typechecker proves it.

### C2. `traversal-study` — the `procedural` landmark channel

`src/environment.ts:26` declares `export type ProceduralLandmark = never`; `:96` builds
`PROCEDURAL_LANDMARKS: readonly never[] = []`; `:99` and `:103` thread it through
`backgroundCompositionAt`'s return type. The renderer reads only `composition.catalog`
(`renderer.ts:377`). It is a tombstone for a removed feature.

**Chesterton's fence check:** `tests/environment.test.ts:40` asserts `composition.procedural.length === 0`
with the message *"flat atmosphere panels and debug-like bars must be removed"*. The channel is
kept alive **on purpose**, to stop the panels coming back. That intent is legitimate and must
survive the deletion.

**Proposed change:** delete the type, the constant and the field; rewrite the test to assert the
intent directly — e.g. every entry in `BACKGROUND_CATALOG_LANDMARKS` has an `asset` in the
`EnvironmentAsset` union, i.e. every background object is a real GLB and none is a procedural quad.

**Acceptance:** `rg 'procedural|Procedural' traversal-study/src` returns zero hits; the replacement
assertion in `environment.test.ts` fails if a non-catalog landmark type is reintroduced (verify by
temporarily adding one).

### C3. `traversal-study` — `BACKGROUND_LAYERS`

`src/environment.ts:28-33` declares four named depth layers at `z = -4.8, -10, -17, -24`. Nothing
at runtime reads it: every landmark's `z` is authored inline at `:50`, `:64`, `:77`, `:89`, and
those values (`-20.5`, `-12.5`, `-6.5`, `-23`, `-18.5`, `-10.2`) **do not match the table**. The
only consumer is `tests/environment.test.ts:12`.

This is duplicated-and-diverged data inside one file, already diverged. The `layer` field on every
landmark (`:17`, `:41`, `:59`, `:74`, `:86`) is likewise write-only at runtime; only
`environment.test.ts:29` reads it, to assert "at least 3 distinct layers".

**Proposed change:** delete `BackgroundLayer`, `BACKGROUND_LAYERS`, `EnvironmentLayerId` and the
`layer` field. Replace the test's intent — "the background has depth separation" — with an
assertion on the actual `z` values (e.g. at least three distinct `z` buckets spanning ≥ 15 units).

**Acceptance:** `rg 'BACKGROUND_LAYERS|EnvironmentLayerId|\.layer\b' traversal-study` returns zero
hits; the replacement assertion fails when all landmarks are moved to a single `z`.

### C4. `traversal-study` — `PlatformInstance.lap`

`src/simulation.ts:75` `lap: 0` — typed as the literal `0`, assigned `0 as const` at `:148`, never
changed. It is the residue of an endless-runner design. `tests/simulation.test.ts:256` asserts
`platform.lap === 0` — a test that a constant is its own value.

**Delete the field and that assertion.**
**Acceptance:** `rg '\blap\b' traversal-study` returns zero hits.

### C5. `point-light-expo` — three quarters of `RelayOnboardingCue`

`src/onboarding-cues.ts:1-33` defines a four-field cue type. The runtime reads exactly one field:
`onboarding.ts:73` uses `cue.label`. `kind`, `relayMarkerCounts` and `field` are read **only** by
`tests/onboarding.test.ts:10-16`, which asserts that the literals equal themselves.

`AGENTS.md` explicitly forbids "worthless test files that test content/prose/frozen words". This is
that test, and it is holding twenty lines of dead schema in place.

**Proposed change:** reduce `RELAY_ONBOARDING_CUES` to the four labels (or drop the type entirely
and let `RELAY_ONBOARDING_ROWS` hold strings). Delete `onboarding.test.ts:8-17`. Keep
`onboarding.test.ts:19-49` — the opacity/lifetime test is real behaviour.

**Acceptance:** `rg 'relayMarkerCounts|RelayOnboardingCue' point-light-expo` returns zero hits;
`tests/onboarding.test.ts` still contains the `relayOnboardingOpacity` assertions and passes.

**Needs owner confirmation** only if `relayMarkerCounts: [1,2,3]` was meant to drive the relay
identity markers. It does not today — `relay-visuals.ts:204-221` derives the counts from
`relayIndex + 1` independently. That is itself a small duplication, and deleting the cue field
removes it.

### C6. `combat-arena` — `catalogParts`

`combat-visuals.ts:79`, `:84-87`. Read only by `tests/presentation.test.ts:189`
(`assert.ok(warden.catalogParts > anchor.catalogParts)`). No runtime consumer.

**Delete the field and that assertion.**
**Acceptance:** `rg catalogParts combat-arena` returns zero hits.

### C7. Assets referenced by nothing

I checked `point-light-expo/scripts/pack-catalog-models.mjs:24-28,44-48,63-67`: the normal maps
(`*_nor_gl_1k.jpg`) are downloaded, hash-verified and listed in `imageUris`, then **not packed**
into the runtime GLB. They are ~3 MB of committed assets that nothing renders.

**Do not delete them.** Remediation Phase 2 item 2 explicitly plans to start using them. This is
the one case where "referenced by nothing" is correct — the fence has a documented reason
(`point-light-expo/README.md:64-65,90-93`) and a scheduled removal date. Flagged here only so a
future dead-asset sweep does not delete them by accident.

---

## D. Shallow modules and pass-through layers

### D1. `point-light-expo/src/frame-scratch.ts` — 18 lines, one `Float32Array(3)`

The entire module is a named wrapper around `new Float32Array(3)` and three index assignments. It
has one consumer (`renderer.ts:14`, `:172`, `:234`) and one test (`tests/render-batches.test.ts:45-48`).
Its interface (a type, a factory, a setter) is larger than the thing it hides.

**Proposed change:** inline into `renderer.ts` — `const cameraPosition = new Float32Array(3)`, then
three assignments where `setCameraPosition` is called. Delete `frame-scratch.ts` and the four test
lines. `traversal-study/src/renderer.ts:338` and `combat-arena/src/renderer.ts:103` already do
exactly this, in one line each.

**Acceptance:** `frame-scratch.ts` no longer exists; `point-light-expo/src` contains no import of
it; `renderer.ts` stays under 300 lines; `tsc --noEmit` clean.

### D2. `point-light-expo/src/reliquary-models.ts` — three factories that differ by a constant

`:193-215` exports `createReliquaryModelBatch`, `createRockModelBatch` and `createStumpModelBatch`.
All three are three-line calls to `createCatalogModelBatch(renderer, capacity, <descriptor>, deps)`.
Three public names for one operation with one varying argument.

**Proposed change:** export `createCatalogModelBatch(renderer, capacity, descriptor, deps?)` plus
the three frozen descriptors. `renderer.ts:120-131` then reads
`createCatalogModelBatch(renderer, cap, DEAD_TREE)`.

**Acceptance:** `reliquary-models.ts` exports one factory; `tests/catalog-model.test.ts:154,168`
updated to call it (the DI seam it exercises is preserved — see D3); test count unchanged.

Related, in the same file: `DEAD_TREE_RUNTIME_URL`, `ROCK_MOSS_RUNTIME_URL`,
`TREE_STUMP_RUNTIME_URL` (`:15-23`) are exported but consumed only at `:57`, `:64`, `:71` in the
same file. Drop the `export`.

### D3. Dependency-injection seams — which are load-bearing and which are not

I checked every `*Dependencies` type against its callers:

| Seam | Injected by a test? | Verdict |
|---|---|---|
| `CombatRendererDependencies` (`renderer.ts:74`) | **yes** — `tests/resources.test.ts:212,228,248,276` | keep |
| `ArenaAssetDependencies` (`arena-assets.ts:53`) | **yes** — `tests/resources.test.ts:46,73` | keep |
| `ShipAssetDependencies` (`ship-assets.ts:50`) | **yes** — `tests/resources.test.ts:89,105` | keep |
| `CombatProjectionDependencies` (`combat-projection.ts:208`) | **yes** — `tests/resources.test.ts:176,199` | keep |
| `ReliquaryModelDependencies` (`reliquary-models.ts:27`) | **yes** — `tests/catalog-model.test.ts:154,168` | keep |
| `RelayOnboardingDependencies` (`onboarding.ts:22`) | **yes** — `tests/onboarding-resources.test.ts:8-11` injects through an `as unknown as` cast | keep |
| `EnemyBehaviorPort` (`combat-ai.ts:10`) | n/a — real internal seam, `simulation.ts:216` | keep |
| `ProjectileCollisionPort` (`combat-projectiles.ts:10`) | n/a — real internal seam, `simulation.ts:339` | keep |

**All six look like ceremony and none of them are** — they are how the resource-leak tests work,
which is exactly the kind of integration test at a system cut-point the rubric asks for.
**Chesterton's fence holds; leave every one of them.**

A note on method: a grep for `RelayOnboardingDependencies` across `src` and `tests` returns hits
only inside `onboarding.ts`, which made it look dead. It is not —
`tests/onboarding-resources.test.ts:8-11` injects a fake through an `as unknown as` cast that never
names the type. **Any future dead-code sweep in these demos must check call sites, not just type
names.** Item 16 has been withdrawn from the ranked worklist for this reason.

### D4. `combat-arena` — `SHIP_PRESENTATION_SPANS` re-exported twice

`combat-hulls.ts:80-86` rebuilds an object from five `HullContract.span` fields that are already
reachable as `PLAYER_HULL_CONTRACT.span` and `ENEMY_HULL_CONTRACTS[role].span`. Then
`ship-assets.ts:16,33` imports it and re-exports it unchanged. Two layers that add a name and
nothing else. The only consumer is `tests/presentation.test.ts:133,145-147,187-188`, which could
read the contracts directly.

**Proposed change:** delete `SHIP_PRESENTATION_SPANS` from both files; the test reads
`ENEMY_HULL_CONTRACTS[role].span`.
**Acceptance:** `rg SHIP_PRESENTATION_SPANS combat-arena` returns zero hits; `tests/presentation.test.ts`
passes with only the import line changed.

### D5. Three ways to write an instance row (point-light-expo)

- `batch.set(index, offsetVec, scaleVec, colorVec, materialVec, yaw)` — `render-batches.ts:90` — **dead**
- `batch.setValues(index, …13 scalars)` — the real one
- `setSurface(batch, index, …)` / `setGlow(batch, index, …)` — `relay-visuals.ts:35-65` — a third
  wrapper that reorders `setValues`' arguments into vec-ish groups

Deleting `set()` (item 2) removes one. The `setSurface`/`setGlow` pair is genuinely useful — it is
where the default `yaw = 0` / `phase = 0` / `motion = 0` live — so keep it, but it should be the
*only* wrapper.

**Acceptance:** `render-batches.ts` exposes `clear`, `setValues`, `upload`, `draw`, `dispose`,
`program` and nothing else; `tests/render-batches.test.ts` passes unchanged.

### D6. `combat-arena` — `ENEMY_VISUAL_PROFILES`, a 32-entry precomputed table

`combat-visuals.ts:104-125` builds `4 roles × 8 states = 32` frozen objects at module load, so that
`enemyVisualProfile` (`:127-129`) can be a table lookup. But the only state-dependent field is
`emissive`, which is a five-branch function (`stateEmissive`, `:90-97`). The table is 22 lines to
avoid a two-line object literal.

**Chesterton's fence check:** `tests/presentation.test.ts:181` asserts
`enemyVisualProfile(a) === enemyVisualProfile(b)` — **reference** equality — so the table exists to
guarantee zero per-frame allocation. That is a real reason: `enemyVisualProfile` is called for
every active enemy in three places per frame (`combat-projection.ts:124`, `arena-composition.ts:106,143`,
`ship-assets.ts:196`).

**Revised proposal:** keep the identity guarantee, shrink the construction. Build the table from
`ROLE_SHAPES` × `stateEmissive` in a single `Object.freeze` expression rather than two nested `for`
loops over two hand-written arrays (`ENEMY_ROLES`, `ENEMY_STATES`) that duplicate the `EnemyRole`
and `EnemyState` unions declared in `combat-state.ts:12-21`. Those two arrays are the actual
problem: they are a hand-maintained copy of a type union that TypeScript will not check.

**Acceptance:** adding a new `EnemyState` to `combat-state.ts` causes a **compile error** in
`combat-visuals.ts` rather than a silent `undefined` at runtime; `tests/presentation.test.ts:181`
(reference equality) still passes.

---

## E. Over-parameterisation — constants wearing a parameter's clothes

### E1. `foundry.shader.ts` — `uModel` is always the identity matrix

`renderer.ts:171` `const identity = mat4.identity()`, `:246` `uniforms.uModel.set(identity)` — for
every surface batch, every frame. The shader then does `uModel.mul(vec4(rotated,1)).xyz`
(`foundry.shader.ts:99`) and `uModel.mul(vec4(rotatedNormal,0)).xyz` (`:111`) — two dead 4×4
multiplies per vertex, across four programs.

**Delete** `uModel` (`:55`, `:88`, `:99`, `:111`), the `identity` constant and the per-frame write.
Regenerate `foundry.shader.gen.ts`.

**Acceptance:** `rg uModel packages/demos/antiky/point-light-expo` returns zero hits including
`.gen.ts`; the demo's committed capture is pixel-identical (this is provably a no-op, so any pixel
change means the regeneration went wrong).

### E2. `traversal-model.shader.ts` — `uTint` is always `[1,1,1]`

`renderer.ts:200` `tint: Vec3 = [1,1,1]`, and **all thirteen** call sites (`:302-314`) pass either
nothing or the literal `[1,1,1]`. `traversal-model.shader.ts:54` multiplies by it anyway.

**Delete** `uTint` (`:23`, `:46`, `:54`), the `tint` parameter (`renderer.ts:200`, `:232`) and the
`[1,1,1]` arguments at `:307`, `:310-314`.

**Acceptance:** `rg 'uTint|tint' traversal-study/src` returns zero hits;
`traversal-model.shader.gen.ts` regenerated with no uncommitted diff on a second `npm run shaders:prod`.

### E3. Uniform counts that are almost entirely constant

`point-light-expo/src/shaders/reliquary-model.shader.ts` declares **30 uniforms**;
`reliquary-floor.shader.ts` declares **28**; `foundry.shader.ts` declares **24**. Of those:

- 12 per program are light data (`u{Ember,Ion,Violet}{Position,Color,Power,Radius}`), rewritten
  every frame at `renderer.ts:184-195` and `:260-271`. **Only the three `Power` values change** —
  positions, colours and radii come from the frozen `EXPO_LIGHT_DEFINITIONS` (`lights.ts:19-53`)
  and are never mutated anywhere in the demo (checked: no writer exists).
- 8 more (`uAmbientColor`, `uAmbientStrength`, `uExposure`, `uRelayLightStrength`, `uFogColor`,
  `uFogStart`, `uFogEnd`, `uFogMaximumMix`) are set **once** at construction (`renderer.ts:137-170`)
  and never again.

So of 30 uniforms, 3 vary at runtime.

**Proposed change (safe, before remediation):** hoist the 9 static light uniforms into the same
construction-time loop as the ambient/fog block (`renderer.ts:137-160`), leaving `setLights`
(`:180-196`) to write only the three powers. `renderer.ts:258-271` collapses from 14 lines to 4.
**Do not** collapse the ambient/fog uniforms into shader constants — the remediation plan makes
exposure and fog runtime-varying.

**Acceptance:** `setLights` writes exactly three uniforms; the per-frame uniform-write count in
`render` drops from 62 to 26 (countable by grep on `renderer.ts:243-274`); the demo's capture is
pixel-identical; `tests/renderer-resources.test.ts` passes unchanged.

### E4. `RELAY_RENDER_PROFILE` — measurement machinery for a static scene

`render-profile.ts:11-141` builds a slot-range allocator, a capacity derivation, a pass table and a
measurements object. It is a genuinely deep module — `renderSlot(range, i)` hides real complexity
and gives a bounds error a home (`:25-30`, "define errors out of existence" done right). **Keep it.**
The only change is C1's export trimming.

### E5. `combat-arena` — `SURFACE_CAPACITY = 68` vs actual usage

`combat-projection.ts:16-23`: `SHADOW_START = 25`, `GAUGE_START = 32`, `SIGNAL_GAUGE_START = 60`,
and signals write up to `offsets.gauge + 7 = 67`. Capacity 68. The arithmetic is correct but the
chain of four derived constants is fragile — a single added structure instance at
`arena-environment.ts:20-42` silently shifts everything and overruns.

**Proposed change:** derive the layout the way `point-light-expo` already does, with a slot-range
table (`render-profile.ts:11-23`) rather than four running offsets, so an overrun throws a
`RangeError` naming the range instead of corrupting a neighbour.

**Acceptance:** a unit test that requests one instance past each range's end throws; capacity
constants are computed, not literal; `tests/resources.test.ts` passes unchanged.
**Write the test first** — there is no current coverage of the overrun (AGENTS.md requires it).

---

## F. Duplicated-and-diverged **inside one demo**

This is the category the remediation plan warns about ("duplicated bugs silently diverging"), and
it is the highest-value non-scar-tissue work here.

### F1. `traversal-study` — three different answers to "what is the ground height at x"

| Function | File:line | Rule |
|---|---|---|
| `supportAt` | `simulation.ts:161-171` | highest platform whose top ≤ `y + 0.14`, using `width*0.5 − 0.05` |
| `courseTopAt` | `renderer.ts:282-288` | **first** platform in array order with `|Δx| ≤ width*0.5`, no inset, no highest-wins |
| `courseTop` | `inspection.ts:330-333` | `.find()` — same as `courseTopAt`, different loop |

Wherever two platforms overlap in `x`, the simulation lands the courier on one and the renderer
draws the contact shadow, the checkpoint flags (`renderer.ts:393`), the delivery flag (`:395`), the
landing ring (`:454`) and the delivery ring (`:452`) against a different one. The inspector reports
a third. This is `traversal-study`'s version of combat-arena's three sun directions.

**Proposed change:** one exported `groundTopAt(x, time)` in `course-query.ts` (see A1), implementing
the simulation's rule (highest-wins, with the inset as a named constant). `renderer.ts` and
`inspection.ts` import it.

**Risk: medium.** This can move the contact shadow and flags visibly. **Write the test first:**
assert that for every checkpoint and delivery `x` in `COURSE_BEATS`, the value returned to the
renderer equals the top of the platform the simulation would land on. `tests/simulation.test.ts:264`
already reaches into `platformInstancesNear` for a similar check and is the right place.

**Acceptance:** `rg 'courseTopAt|courseTop\b' traversal-study` finds only the import and the single
definition; the new equality test passes; `tests/visual-contract.test.ts` passes unchanged.

### F2. `combat-arena` — two palettes

`arena-signals.ts:4-7` declares its own `CYAN`, `WHITE`, `WARM`, and they differ from
`COMBAT_PALETTE` (`combat-visuals.ts:4-13`):

| | arena-signals | COMBAT_PALETTE |
|---|---|---|
| cyan | `[0.08, 0.72, 0.92]` | `[0.045, 0.66, 0.9]` |
| white | `[0.82, 0.90, 1.00]` | `[0.84, 0.91, 1.00]` |
| warm | `[1, 0.24, 0.07]` | `[1, 0.19, 0.035]` |

The onboarding cue arrows and the retry cue are drawn in a slightly different cyan and a
noticeably different warm from every other cyan and warm object in the frame.

**Proposed change:** delete the four locals in `arena-signals.ts` and import `COMBAT_PALETTE`.
`DARK` (`:7`) has no `COMBAT_PALETTE` equivalent; add it there as `ink`.

**Acceptance:** `arena-signals.ts` declares no colour literal; `rg '\[0\.08, 0\.72, 0\.92\]' combat-arena`
returns zero hits. Visual change is deliberate and small — capture before/after.

### F3. `combat-arena` — hull dimensions hand-copied from generated data

`combat-visuals.ts:83-88` hard-codes per-role `width`/`length`:

| Role | `ROLE_SHAPES` | `SHIP_FOOTPRINTS` (generated from the shipped GLBs) |
|---|---|---|
| rusher | 1.41 / 2.19 | 1.4094126 / 2.1908034 |
| gunner | 1.92 / 2.01 | 1.9176616 / 2.0130313 |
| shield-anchor | 1.94 / 2.60 | 1.9323802 / 2.5967739 |
| warden | 4.81 / 4.60 | 4.8106183 / 4.6010855 |

These are rounded transcriptions of `ship-footprints.gen.ts`, which is regenerated by
`scripts/intake-quaternius-ships.mjs` and already reachable as `ENEMY_HULL_CONTRACTS[role].span`
(`combat-hulls.ts:42`). They are consumed at `combat-projection.ts:126` and
`arena-composition.ts:111-112,150` to place hit flashes and hardpoint emitters — so if an asset is
ever re-intaken, the emitters silently drift off the hull.

The give-away that someone already noticed: `tests/presentation.test.ts:187-188` asserts
`warden.width >= SHIP_PRESENTATION_SPANS.warden.width * 0.9` — a tolerance test that exists purely
to detect the drift the duplication created.

**Proposed change:** delete `width`/`length`/`height` from `RoleShape`; `enemyVisualProfile` returns
`{ emissive, tint, hardpoints }` and the three call sites read
`ENEMY_HULL_CONTRACTS[enemy.role].span.width / .length`.

**Acceptance:** `rg 'profile\.width|profile\.length' combat-arena` returns zero hits;
`tests/presentation.test.ts:187-188` is replaced by an exact equality (no `* 0.9` tolerance),
and that exact test passes.

### F4. Already in the remediation plan, restated for completeness

- Three sun directions in `combat-arena` (`ship-model.shader.ts:65-66`, `arena-model.shader.ts:62`,
  `arena-surface.shader.ts:62`).
- Three fog ranges (`ship-model.shader.ts:77`, `arena-model.shader.ts:72`,
  `arena-surface.shader.ts:72`) fading to three different near-blacks.
- `traversal-study` tone-maps in 1 of 3 shaders (`traversal-surface.shader.ts:72` yes;
  `traversal-model.shader.ts:56` and `traversal-glow.shader.ts:57` no).
- `traversal-study` fog fades to `(0.55,0.65,0.66)` (`traversal-model.shader.ts:56`) while
  `traversal-surface.shader.ts:71` fades to `(0.52,0.63,0.65)` and the clear colour is
  `(0.38,0.57,0.68)` (`renderer.ts:297`) — **three** different "sky" colours in one frame.

That last one is not in the plan. It belongs in the "one agreed fog range per demo" quick win,
extended to `traversal-study`.

**Acceptance for F4:** a per-demo invariant test — parse every `*.shader.ts` under the demo and
assert that all `normalize(vec3(...))` light directions are identical and all `smoothstep(a, b, …)`
fog ranges are identical, or that any difference carries a `// deliberate:` comment on the line
above. This is the "pipeline-invariant test" the remediation plan already proposes; extend it to
sky/fog colour.

---

## G. Do not port this forward

When the render remediation lands, these should be **deleted rather than adapted**. Listing them
so nobody spends effort making them work in the new pipeline.

| Delete, don't port | Why the new pipeline makes it obsolete |
|---|---|
| The whole wash-knob block (`reliquary-model.shader.ts:164-168`) | managed colour makes it actively harmful |
| The floor grey-wash (`reliquary-floor.shader.ts:113`, `:122`) | same |
| `uGradeColor` / `uGradeMix` (`traversal-model.shader.ts:24-25`) | real material response + real UVs replace it |
| `vWash` (`traversal-model.shader.ts:42`) | a hemisphere ambient does this properly |
| The three-step toon ramp (`traversal-model.shader.ts:51-52`) | replaced wholesale by the new BRDF; do not port the band constants |
| `min(specGGX, …)` clamps (two shaders) | an energy-conserving GGX does not need a ceiling |
| Per-instance `emissive` on rocks/stumps (`reliquary-model-layout.ts`) | baked AO + hemispheric ambient do the lifting |
| Blob-shadow instances drawn through the **lit** path (`relay-visuals.ts:112-130`, `combat-projection.ts:240,245`, `traversal-study/src/renderer.ts:425`) | the plan replaces these with a dedicated unlit soft-edged shader; do not port the "make the base colour very dark so it stays darker than the floor" trick |
| `uExposure` as a per-material uniform (`presentation.ts:9`) | exposure moves to the single post stage; three shaders should not each own it |
| The `pulse` self-illumination sines (`foundry.shader.ts:183`, `reliquary-model.shader.ts:178`) | ±6–8% breathing on *every* surface, added because nothing else in the frame moves; bloom and real specular replace it |
| `heightGlow` (`arena-surface.shader.ts:65`) and `heightHaze` (`traversal-surface.shader.ts:70`) | hand-rolled fake aerial perspective; real fog + bloom supersede |

**Acceptance for G as a whole:** after Phase 1 lands in a demo, `rg` for each identifier in that
demo's `src` returns zero hits. Make this a checklist item on the Phase 1 PR for each demo rather
than a separate task.

---

## H. Where tests already protect you, and where you must write one first

| Change | Protected by | Verdict |
|---|---|---|
| C1 dead-export deletion | `tsc --noEmit` | sufficient — no test needed |
| Item 2 (dead `set()`) | `tests/render-batches.test.ts` (point-light), `tests/resources.test.ts` (combat) | sufficient |
| E1/E2 (`uModel`, `uTint`) | none directly | provable no-op; verify with a capture diff, no test |
| F1 (three ground functions) | partial — `tests/simulation.test.ts:248-266` | **write the equality test first** |
| F2 (two palettes) | none | visual only; capture before/after, no test |
| F3 (`ROLE_SHAPES`) | `tests/presentation.test.ts:133-147,184-189` | sufficient — tighten the tolerance as the new assertion |
| A1 split | `tests/simulation.test.ts` (385 lines) | sufficient |
| A2 split | `tests/visual-contract.test.ts` (180 lines) | sufficient |
| A6 inspection hoist | `tests/inspection.test.ts` | **add a snapshot-equality assertion first** |
| E5 (combat capacity ranges) | none | **write the overrun test first** |
| B1–B5 scar tissue | none — these are visual | gate on the capture loop the plan proposes (`npm run demos:shoot`); do not land blind |
| C2/C3 (procedural, layers) | `tests/environment.test.ts` — but the test encodes the *old* shape | **rewrite the assertion in the same commit**, and verify it fails when the removed thing is reintroduced |

---

## I. Secondary demos — brief

`packages/demos/brometal/*` and `packages/demos/threejs/*` are small (280–420 lines each) except
`town-study` (12,125), which is out of scope by size and is the repository's strongest artifact.
Two things worth naming:

1. **`StudioGameEntry` is copy-pasted verbatim into every `studio-game.ts`** —
   `brometal/luminous-reef/src/studio-game.ts`, `brometal/shader-study/src/studio-game.ts`,
   `brometal/solar-forge/src/studio-game.ts`, and the two `threejs/*` equivalents, all 16 identical
   lines. This is a *host contract*, not a rendering capability, so it is not covered by the
   hand-roll policy — but it is also five files of ~16 lines, which is squarely in "a little
   duplication is better than a premature abstraction" territory. **No action recommended**;
   noted only so nobody mistakes it for drift.

2. **`orbital-atlas`' resize guard is confirmed broken.** `threejs/orbital-atlas/src/game.ts:210-217`
   compares `canvas.width` (device pixels) against `clientWidth` (CSS pixels). With
   `setPixelRatio(2)` active they can never be equal, so `setSize` + `updateProjectionMatrix` run
   **every frame**. `threejs/glass-garden/src/game.ts:247-255` has the same structure and needs the
   same check. Already Phase 4 item 6 in the remediation plan; confirmed here.

Nothing else in those two directories rises to the level of complexity worth a line item.

---

## J. What I deliberately did **not** recommend

- **No shared package, module or helper between demos.** Not once. Every fix above is inside a
  single demo's `src`.
- **No removal of the resource-lifetime / disposal-stack machinery**
  (`point-light-expo/src/resource-lifetime.ts`, `traversal-study/src/resource-scope.ts`,
  `combat-arena/src/resource-lifetime.ts`). Three different shapes for the same job across three
  demos — but each is exercised by that demo's own resource tests, and consolidating them is
  exactly the cross-demo extraction this work is forbidden to do. Within each demo they are
  cohesive and correct.
- **No removal of `combat-digest.ts`** (131 lines of hand-rolled quad-FNV). It exists because
  `packages/framework/src/sessions/engine-session/runtime.ts:216-221` caps the digest at 256
  characters and combat state is too large to `join(':')` the way `traversal-study` does. Real
  constraint, correct solution.
- **No removal of the simulation `*Options` seams.** `RelaySimulationOptions`
  (`point-light-expo/src/simulation.ts:101-105`) looks like unused configuration but is used
  16 times across three test files to construct deterministic scenarios.
- **No rewrite of game logic.** The plan says don't, the tests are good, and I found no complexity
  there worth the risk.

---

## K. Open questions for the owner

1. **The 27 "ambience" filler instances** in `point-light-expo` (`render-profile.ts:48-50`,
   populated at `relay-visuals.ts:222-235`, `:329-340`, `:424-437`) — decorative geometry on
   procedural rings with no gameplay meaning. The diagnosis calls the arena a "debris pile"; this
   is the same instinct applied to the reliquary. Delete, or is this deliberate set dressing that
   Phase 3 will replace with something better?
2. **Per-instance `iTint` micro-variation** on the catalog models (B5) — compensation, or authored
   art?
3. **`markedScale` / `markedMinimumAlpha`** (B7) — gameplay affordance or contrast patch?
4. **`RELAY_ONBOARDING_CUES.relayMarkerCounts`** (C5) — was this meant to drive the relay identity
   markers, which today derive their count independently at `relay-visuals.ts:204-221`?
5. ~~`tests/onboarding-resources.test.ts` — does it inject a fake overlay dependency?~~
   **Answered: yes** (`:8-11`, via an untyped cast). Item 16 withdrawn.
