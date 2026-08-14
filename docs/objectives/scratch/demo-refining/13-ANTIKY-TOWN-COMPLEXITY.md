# Complexity inventory — `antiky-town`

**Date:** 2026-08-14
**Scope:** `packages/demos/antiky/antiky-town` — 11,678 handwritten `src` lines.
**Rubric:** `docs/GOOD_ENGINEERING_H.md`, the same one applied to the other three demos in
`04-COMPLEXITY-REDUCTION.md`.
**Why this document exists:** `04-COMPLEXITY-REDUCTION.md:5` excluded this demo from every audit the
sweep was built on. `goals/execute-goal-09.md` requires the inventory to exist and be committed
before anything here is deleted. Nobody has previously checked which fences here have reasons.

---

## How to read the 2.3D labels

`antiky-town` is the repository's only 2.3D artifact: pixel-art sprites composited into a voxel
world. A thing that looks like duplication may be the deliberate sprite-path and voxel-path
expression of one idea, and deleting it would remove the only 2.3D expression of something the other
demos do in 3D. Every finding below is therefore labelled **SPRITE**, **VOXEL**, or **neither**, and
where the label is the reason to keep something, that is said outright.

The single most important instance: `practicalRadiance` exists twice and differs in two ways. One
difference is legitimate 2.3D (voxel geometry carries baked AO, a billboard has none). The other is
drift (a wrap constant of 0.18 against 0.20). See §5.3.

---

## 1. Headline

Three findings outrank everything else.

1. **Ground height on the bridge is answered by three incompatible rules, disagreeing by up to
   1.03 m** — 1.7 macro voxels on a 0.62 m scale. This is `traversal-study`'s three-ground-functions
   defect, present here at larger scale. §5.1.
2. **Two test files never run.** `tests/ambient-contract.test.ts` and
   `tests/water-depth-contract.test.ts` are referenced by no runner anywhere in the repository.
   One of them describes itself as existing "so the audit's conclusion cannot be quietly undone".
   It can. §6.
3. **The demo's authored uniform values are usually not the values the shader uses.** Eleven hidden
   multipliers sit between a `.set()` call site and the arithmetic consuming it. `uExposure` is
   authored 1.45 and applied as 0.9425. §4.2.

A fourth, smaller but live: **a sprite prop floats 1.56 m above the canal water**, because the
placement query cannot express "there is no ground here". §5.2.

**This demo is meaningfully better engineered than the three in the original audit.** It has a real
post pass, a matched sRGB decode/encode pair, a genuinely energy-conserving BRDF in two shaders, and
several comments that document a decision *not* to take a compensating shortcut. The finding is not
carelessness. It is that corrections were applied per-shader, at different times, and never
collapsed — so `uSunIntensity` now means six different things.

---

## 2. Files over the rubric's thresholds

Over 800 lines ("should normally be decomposed"):

| Lines | File | Verdict |
|---|---|---|
| 2292 | `src/town/art/town.ts` | decompose — five responsibilities |
| 1286 | `src/town/physics/character-motor.ts` | **keep whole** — genuinely cohesive |
| 1224 | `src/town/index.ts` | decompose — three responsibilities |

Over 500 ("needs a cohesion review"):

| Lines | File | Verdict |
|---|---|---|
| 671 | `src/town/art/town-foliage.ts` | pass, with one split |
| 579 | `src/town/art/town-water-features.ts` | **pass** — a well-formed deep module |
| 541 | `src/town/art/voxel-surface-mesh.ts` | pass, with one split |
| 519 | `src/town/shaders/town-voxel.shader.ts` | **pass** — one shader, indivisible |
| 474 | `src/town/art/sprite-batch.ts` | pass |

Three files hold 4,802 lines, 41% of the handwritten source.

**`town.ts` (2292)** welds five things together: palette and material table (`:10-258`);
`VoxelBuilder`, the authoring API over `VoxelSurfaceGrid` (`:260-552`); the world coordinate and
height contract (`:554-720`) — *the important one, see §5.1*; a 1,215-line building kit of 30
independent authoring functions (`:723-1938`); and ground assembly plus `buildTownWorld`
(`:1940-2292`). The building kit is a catalogue, not a module: it has no internal coupling beyond
the shared `VoxelBuilder`, so splitting it is mechanical.

**`index.ts` (1224)** welds scene config (`:79-252`), 490 lines of straight-line program and uniform
construction (`:254-744`), physics and actor construction (`:745-847`), and the frame loop
(`:849-1163`). The 254–744 block is the cohesion failure and §5.4 is the bill for it.

**`character-motor.ts` (1286) should not be split** despite being the second-largest file. It is one
deep module — sweep/overlap/probe in, a kinematic motor out, `CharacterWorldAdapter` the only seam —
with 284 lines of real behavioural test. Splitting it would manufacture shallow modules. Chesterton's
fence applies. It should only shed the dead adapter noted in §3.

---

## 3. Dead and vestigial exports — checked by call site

**Method note, and it matters.** `04-COMPLEXITY-REDUCTION.md:502-506` withdrew a finding because a
test injected a fake through an `as unknown as` cast that never named the type. That hazard was
checked for here first: `grep -rn "as unknown as" src/ tests/` returns **zero hits** in this package,
and the only casts in any test name their types. Separately, three tests read source files as *text*
rather than importing them, so a symbol with no import hits can still be pinned by a regex — each
finding below was checked against those three as well.

| # | Declaration | Sprite/Voxel | Verdict |
|---|---|---|---|
| 1 | `src/town/index.ts:1170`, `:1195`, `:1224` — `createTownGameFactory` and the default export | neither | **delete** (~26 lines) |
| 2 | `src/town/art/town.ts:19`, `:134`, `:2074-2086`, `:2219` — `TownWorld.props` | **SPRITE** | **delete** |
| 3 | `src/town/art/sprite-batch.ts:3`, `:16`, `:23` — three `QUAD_POSITIONS*` constants | **SPRITE** | **delete**, keep the doc comment |
| 4 | `src/town/art/town.ts:122-128`, `:448-461`, `:2215` — `TownWorld.voxels` legacy cube path | **VOXEL** | needs a test first |
| 5 | `src/town/physics/character-motor.ts:537`, `:553-602` — `VoxelCharacterWorldAdapter` | **VOXEL** | **keep — see below** |
| 6 | `src/game.ts:6-10`, `:11` — named re-exports | neither | **delete** |
| 7 | `src/town/index.ts:214` — duplicate `TownDemoOptions` re-export | neither | **delete** |
| 8 | `src/town/art/town.ts:147`, `:2257` — `TownWorld.extent`, write-only | neither | **delete** |
| 9 | `src/town/art/town.ts:152`, `:2261` — `surfaceHeight`, `@deprecated`, never called | neither | **delete** |
| 10 | `src/town/art/town.ts:29,31,32,33` — four write-only `TownWalker` fields | **SPRITE** | **delete** |
| 11 | `src/town/art/voxel-surface-mesh.ts:22,23,24` — three write-only stats fields | **VOXEL** | needs a test first |
| 12 | `src/render/point-light-adapter.ts:14` — passthrough type alias | neither | **delete** |

### Finding 1 is not a dead export, it is a dead architecture

`createTownGameFactory` (`index.ts:1170-1192`) hand-rolls delta-time, `renderer.present` and
disposal. Line 1195 runs it at module load; line 1224 exports it as default. `src/game.ts:3` is the
only importer of `./town/index.ts` in the package and it imports only `createTownRuntimeFactory`.
The demo replaced this with `createAntikyTownDemoFactory` + `EngineSession`
(`src/composition.ts:85`, `src/gameplay/game-host.ts:51`), which supply fixed-step and
pause/resume/step. An entire superseded game loop is sitting live beside its replacement, still
running a module-level side effect. `TownGameFactory` (`src/town/town-runtime.ts:30`) exists solely
as its return type and dies with it.

### Finding 5 is the one to keep, and the 2.3D rule is why

`VoxelCharacterWorldAdapter` is a complete, never-instantiated 50-line lazy voxel broadphase.
By grep it is as dead as anything in this document. It should still stay:
`grep -rln "VoxelSurfaceGrid|VoxelCharacterWorldAdapter|compileVoxelSurfaceSource"` matches only
this package and its `town-study` twin. **No other demo in the repository has voxel meshing or voxel
physics at all.** This class is the only voxel-native collision broadphase that exists, in the only
2.3D demo — which today flattens its voxel town into a hand-authored AABB list
(`index.ts:745-755`) instead of using it. Deleting it discards the sole implementation of a
capability this demo demonstrably wants. Removing it is a product decision, not a cleanup.

### Findings 4 and 11 need an assertion added before removal

`TownWorld.voxels` is built on every world build and read by exactly one consumer:
`town-validation.ts:207` compares `first.voxels.count !== second.voxels.count` for determinism.
That signal is redundant — `validateTownDeterminism` already compares the mesh FNV-1a fingerprint
(`:196`) and vertex/triangle counts (`:201-204`), which strictly dominate a cell count. Assert those
first, then delete. Same shape for `culledInternalFaceCount`: it is the headline number proving
greedy meshing actually culls interior faces, so the right move is to assert on it, not remove it.

### Over-exported but live (not dead)

`buildTownWaterfallMesh` / `buildTownFountainMesh` / `mergeTownWaterFeatureMeshes`
(`town-water-features.ts:196,491,543`), `createCrossedCardGeometry` / `createOrganicTrunkGeometry`
(`town-foliage.ts:159,205`), `TOWN_WATER_FEATURE_KIND`, `TOWN_VEGETATION_ATLAS_GRID`,
`TOWN_AWNING_STYLE_INDEX`, the `TOWN_PROP_ATLAS_*` constants, `TOWN_MATERIALS`, `TOWN_MESH_BUDGET`,
`QUAD_UVS` / `QUAD_INDICES`. All used inside their defining file; dropping `export` is safe, but no
code is dead.

`getAntikyTownGameHost` (`gameplay/game-host.ts:113`) has no production reader — its five consumers
are all in `tests/composition.test.ts`. It is the test seam, not dead code.

---

## 4. Scar tissue and uniforms that never vary

### 4.1 Uniform census

| Shader | Declared | Written once | Re-uploaded unchanged per frame | Actually varies |
|---|---|---|---|---|
| `town-voxel.shader.ts` | **50** | 35 | 5 | **10** |
| `town-sprite.shader.ts` | **42** | 26 | 4 | 12 |
| `town-water.shader.ts` | 31 | 22 | 3 | 6 |
| `town-post.shader.ts` | **31** | 22 | 6 | **3** |
| `town-foliage.shader.ts` | 25 | 19 | 4 | 2 |
| `town-awning.shader.ts` | 23 | 18 | 3 | 2 |
| `town-prop.shader.ts` | 22 | 18 | 3 | 2 |
| `town-water-features.shader.ts` | 21 | 16 | 3 | 2 |

Two are deletable with no gate, being constants wearing a parameter's clothes — the same defect as
`uModel` and `uTint` in the other demos:

- **`uDofTransition` and `uDepthReject`** — `index.ts:1127` and `:1130` re-upload the literals `10`
  and `3` every frame. Not derived from anything.
- **`uColorKey` / `uUseColorKey`** — `index.ts:554-555`, `:566-567` set `[1,0,1]` and `0` and are
  never written again. Because the flag is `0`, `keyedAlpha()` (`town-sprite.shader.ts:29-33`)
  reduces to `return texelSample.w`. The magenta chroma-key path, its helper and four uniforms are
  dead. **SPRITE.**

### 4.2 The authored value is usually not the effective value

Eleven hidden multipliers sit between a call site and the arithmetic. The clearest:

| Authored at | Value | Shader applies | Effective |
|---|---|---|---|
| `index.ts:722` `uExposure` | 1.45 | `town-post.shader.ts:278` `× 0.65` | **0.9425** |
| `index.ts:723` `uSaturation` | 1.07 | `:293` `1 + (s−1) × 0.68` | 1.0476 |
| `index.ts:725` `uGradeStrength` | 0.16 | `:282` `× 0.72` | 0.1152 |
| `index.ts:734` `uAtmosphereStrength` | 0.21 | `:272` `× 1.4` | 0.294 |

The exposure case is the sharpest: `index.ts:722` carries an unusually good comment explaining that
1.45 was re-derived after the sRGB decode landed and deliberately not raised to 1.8 — and the
number it so carefully derived is multiplied by 0.65 twelve lines into the shader. Note the
atmosphere factor points the *other* way, so these are not one global trim.

`restrainedWarm(color, chroma)` (`town-post.shader.ts:30-34`) mixes an authored colour toward grey
and is applied at chroma 0.58, 0.52, 0.5 and 0.46. At 0.46, **54% of the authored colour is replaced
by grey**: `uSkyHorizon` is authored `[1.08, 0.47, 0.2]` and renders as roughly `[0.88, 0.52, 0.35]`.
This is structurally `uTextureContrast` from audit B2, applied to authored sky colours.

### 4.3 The canonical scar-tissue patterns, fixed in some shaders and not others

**The `min(specGGX, …)` clamp.** `ART_DIRECTION.md` correctly records that the water shaders traded
the distribution-only `specGGX` for energy-conserving Cook-Torrance and that "the `min(…, 3)`
ceilings left with the helper that needed them". True — for water. But `town-voxel.shader.ts:495`
still reads `min(specGGX(...), 1.8)` (**VOXEL**) and `town-prop.shader.ts:262` reads
`min(specGGX(...), 1.4)`. The fix landed on water only; the town's stone, plaster and timber — most
of the frame — are still clamped by a magic ceiling. Meanwhile `town-awning.shader.ts:267` and
`town-foliage.shader.ts:267` use hand-rolled Blinn-Phong. **Three specular models in one frame, one
of them correct.**

**The ambient lift.** Four hard-coded blue-biased floors at four different values:
`town-voxel.shader.ts:432` `(0.055, 0.068, 0.1)` (**VOXEL**), `town-prop.shader.ts:257`
`(0.042, 0.054, 0.08)`, `town-awning.shader.ts:274` `(0.04, 0.052, 0.078)`, and a fourth applied to
dark pixels in post at `town-post.shader.ts:296-297`. Three of them sit upstream of a post pass
already doing the same job. `town-foliage` and both water shaders have none, so the same shadowed
surface reads differently depending on which shader drew it. This is audit B1's `uDiffuseLift`,
four ways.

**`uSunIntensity` means six things.** Each consumer applies its own scalar to the same
`SUN_COLOR`: voxel `× 0.55`, prop `× 0.52`, awning `× 0.5`, foliage none, water `× 3`,
water-features `× 3`. `town-voxel.shader.ts:442` states the reason plainly — "the 0.55 energy trim
keeps the broader-spectrum key below ACES clipping" — which is a symptom description. There is no
meaning to stone, wood and cloth differing by 5%; they were tuned independently until each stopped
looking wrong. Compounding it, `town-voxel.shader.ts:439` mixes the authored sun toward white at
0.48, discarding about half its saturation, while foliage and both water shaders use it raw.

### 4.4 Chesterton's fences that hold — do not touch these

- **Foliage's separate sun** (`index.ts:473-496`, `[1, 0.82, 0.58]` at 1.05). Looks exactly like
  scar tissue; is not. Twenty-two lines document that it was tested, that full-strength sun clips
  red before green and yellows the canopy, and — decisively — that the yellow version *measures*
  higher local contrast (9.25 against 8.63) while looking worse. An owner-level art call with a
  measurement and a stated reason to distrust the measurement.
- **The post pass's `uSunColor`** `[2.15, 1.02, 0.39]` (`index.ts:740`). A different quantity from
  the light's colour — the emissive sun disc, deliberately above 1 so it survives tone-mapping.
- **`detailRate` / `detailStrength` as local consts** in four shaders, with a comment explaining
  that nothing varies them so a uniform would be binding plumbing for a number that never moves.
  This is the demo applying this very rubric, correctly, and it is the counter-example worth citing
  when arguing about the other 35 uniforms.
- **`tintVariation` in `town-foliage.ts`** and **`AO_VISIBILITY`** in `voxel-surface-mesh.ts:93`.
  Authored per-plant jitter and a standard voxel corner-occlusion ramp.
- **The atlas UV inset** `mix(0.02, 0.98, …)` at `town-voxel.shader.ts:315-316` (**VOXEL**) is
  compensation — it is a gutter implemented per-pixel because `MATERIALS.md` records that the three
  world atlases declare no gutter — but that document also schedules the real fix as goal 14. A
  fence with a date on it. Flag, do not remove.

### 4.5 Where the evidence does not settle it

Three items should not be classified from code alone, and each has a stated experiment:

1. **`textureStrength = 0.66` and the `0.13` chroma mix** (`town-voxel.shader.ts:354-355`). Only 13%
   of the atlas's chroma survives. The comment argues intent ("authored vertex color stays the
   source of palette identity"), which reads as real. Settle by forcing both to 1.0 and capturing:
   noisy-but-not-wrong means art direction, hue shifts away from `PALETTE` means scar tissue.
2. **`cavityTint`** (`town-voxel.shader.ts:490`). Cool cavities are physically defensible, but this
   is the third independent implementation of "shadows go blue" in one shader path.
3. **`keyShadow = shadow * shadow`** (`town-voxel.shader.ts:443`). The comment says squaring restores
   a target key/fill ratio that the authored `uShadowStrength` of 0.7 does not produce — which reads
   as compensation. But squaring also changes penumbra shape non-linearly, which would make it a
   legitimate transfer function. It needs a name either way.

---

## 5. The same question answered two different ways

### 5.1 ★ Ground height on the bridge — three rules, up to 1.03 m apart — **VOXEL**

This is the highest-value finding in the document and it is `traversal-study`'s defect at scale.

| Rule | Function | `file:line` |
|---|---|---|
| A | `bridgeHeight(gz)` | `town.ts:584-587` — integer table `[1,1,2,2,3,3,2,2]` |
| B | `bridgeRampGridHeight(gz)` | `town.ts:590-595` — continuous `1.5 − t + sin(tπ)·1.35` |
| B′ | `bridgeSurfaceGridHeight(gz)` | `town.ts:597-609` — rule B quantised to the 1/3 detail lattice |

Four more wrap them: `groundHeightGrid` (`:611` → A), `topSurfaceGrid` (`:663` → B′ on bridge, A
off), `walkSurfaceHeight` (`:2173` → B′), and `townGroundHeightAt` (`:1951` → A, *and this is the
test-facing export*).

Measured disagreement between the walk surface and the `groundHeightGrid` surface:

| grid z | rule A (m) | rule B′ (m) | delta |
|---|---|---|---|
| 11 | 0.930 | 1.137 | −0.207 |
| 15 | 2.170 | 1.343 | **+0.827** |
| 16 | 2.170 | 1.137 | **+1.033** |
| 18 | 1.550 | 0.517 | **+1.033** |

Both rules are voxel-side. This is *not* a sprite/voxel pair — it is two eras of the same geometry,
rule A predating the fine detail lattice, never reconciled.

Consequences, at three confidence levels:

- **Certain and structural.** `bridge()` authors its deck and parapets against B′
  (`town.ts:1365,1380,1386,1441,1461`) and its spandrels, piers and arch extent against A
  (`:1403,1406,1453`). They cannot line up. Arithmetically certain; needs a capture to characterise.
- **Certain, hidden by a counter-move.** `detailPavedGround` (`:1986`) emits a paved slab on every
  bridge tile at rule A height, invisible only because `bridge()` carves it away at `:1362`. That
  carve works *only* because both sides happen to use rule A. One rule deleting what another wrote.
- **Latent.** Everything placed via `groundHeightGrid` — trees, benches, carts, pots, crates, sprite
  props — would float or sink by up to 1.03 m on the bridge. Every current placement was checked:
  none is on the bridge. A landmine, not a live bug.

**The test gap is the crux.** `town-validation.test.ts:55-72` samples `walkSurfaceHeight` across the
bridge and asserts the step gate, so **rule B′ is well protected**. `townGroundHeightAt`, which the
grass test measures with, returns **rule A**. Each rule is tested against itself; nothing asserts
they agree. A test asserting `topSurfaceGrid(gx,gz) === walkSurfaceHeight(gx·VOXEL_SIZE,
gz·VOXEL_SIZE)` for every bridge cell **does not exist and would fail today.**

### 5.2 ★ "Is there ground here at all?" — and a prop standing on the wrong answer

`groundHeightGrid` (`town.ts:611-616`) has no canal case and falls through to `return 0` for open
water. `canWalk` (`:2206-2212`) does know the canal is not walkable.

Sprite props are placed with `groundHeightGrid` (`:2098`), and the placement table at `:2091`
contains `[-27, 18, 'map-kit', 0.56, 0.12]`. Verified independently: `CANAL_MIN_Z = 11`,
`CANAL_MAX_Z = 18`, `BRIDGE_MIN_X = -5`, `BRIDGE_MAX_X = 5` (`town.ts:554-557`), so `isCanal(-27,18)`
is true and `isBridge` is false. No ground voxel is placed there, `groundHeightGrid` returns 0, and
the prop lands at `(0 + 0.5) × 0.62 = +0.31 m` against a `WATER_LEVEL` of `−1.25` (`town.ts:15`).

**The `map-kit` sprite prop hovers about 1.56 m above the canal water, inside the
`town.water.canal.west` collider.** SPRITE-related placement, caused by a VOXEL-side query that
cannot express "no ground". `town-validation.test.ts` asserts the prop count and types but never
asks whether a prop is standing on anything.

### 5.3 ★ `practicalRadiance` — one name, two bodies, half deliberate

The repo has an excellent, documented, enforced answer to shader-helper duplication:
`town-voxel.shader.ts:69-82` explains that BroMetal's MVP resolves only module-level helpers, so
each shader must declare its own copy, and `pipeline-invariants.test.mjs` asserts every copy is
byte-identical after normalisation. That pattern correctly governs `channelToLinear`/`decodeSrgb`
(four copies, verified identical, enforced at `pipeline-invariants.test.mjs:687-692`) and
`specularGGX` (two copies, enforced at `:890-901`).

`practicalRadiance` is outside that pattern and has drifted:

| | `town-voxel.shader.ts:30-46` | `town-sprite.shader.ts:35-47` |
|---|---|---|
| `ao` parameter and term | yes, `× (0.55 + 0.45·ao)` | **absent** |
| wrap constant | `0.18 + 0.82 · max(...)` | `0.20 + 0.80 · max(...)` |

**The AO difference is legitimate 2.3D and must be kept** — voxel geometry carries baked
`aLocalAo`, a billboard has none. **The wrap constant is not.** "How far does light wrap past the
terminator" is one physical question; there is no reason a standee's answer is 0.20 and a wall's is
0.18. Two points, no comment, no enforcement. The fix is to decide which constant is right and add
`practicalRadiance` to `pipeline-invariants.test.mjs` beside `specularGGX`.

### 5.4 The fog / shadow / sky contract, restated eight times, three values drifted

Eight programs each get a hand-copied block in `index.ts`. Three disagree:

| Uniform | world | water | waterFeature | awning / prop / foliage / actor |
|---|---|---|---|---|
| `uFogStrength` | 0.22 | **0.2** | **0.2** | 0.22 |
| `uShadowBias` | **0.00042** | **0.00085** | **0.00085** | 0.00055 |
| `uShadowStrength` | **0.7** | **0.64** | **0.64** | 0.72 |
| `uSkyColor` | `SKY_COLOR` | **`[0.2,0.34,0.58]`** | **`[0.2,0.34,0.58]`** | `SKY_COLOR` |

Fog at `index.ts:329-332, 351-354, 377-380, 404-407, 433-436, 504-507, 573-576, 605-608`; shadow at
`:334-336, 357-358, 382-383, 409-411, 438-440, 509-511, 578-580, 610-612`; sky at `:314, 346, 372,
400, 429, 497, 590`. `SKY_COLOR` is `[0.24, 0.38, 0.68]` (`:84`) — the two water programs use an
anonymous literal instead, with no comment. Same question, a named answer for six programs and an
unnamed different one for two.

Related: `uPracticalPosInvRangeSq0..7` and `uPracticalColorPower0..7` are hand-unrolled three times
(`:622-643`, `:668-695`).

### 5.5 Smaller divergences

| Finding | `file:line` | Label |
|---|---|---|
| **Atlas UV sub-rect computed three times, two different insets** — 0.5 texel in `sprite-batch.ts:182-189` and again inlined in `town-dynamic-props.ts:286-291`; **1.5 texel** in `town-foliage.ts:411-423`, unexplained. All three are the billboard path, so this is duplication, not a 2.3D pair. No test covers any of them. | above | **SPRITE** |
| **The same lamp declared twice** — `index.ts:138` and `content/point-lights.ts:28-33` agree today, and nothing keeps them agreeing; the adapter carries only `power`, so moving the lamp through the authoring service does not move the render. `tests/point-light-adapter.test.ts:85-87` asserts the *authoring* copy, so the two can diverge with the test green. | above | neither |
| **Identical bodies, contradictory comments** — `town-water-features.ts:124-141` and `:143-160` both push `a,c,b,b,c,d`; `:137` and `:156` give mutually exclusive reasons. One comment must be wrong. | above | neither |
| **Inverted `side > 0` winding in one file** — `town-dynamic-props.ts:135-136` against `:243-244`. Plausibly correct (XZ sheet against XY card, so `side` means a different axis) but undocumented. Flagging, not asserting. | above | **SPRITE** |
| `normalize3` three ways — `index.ts:216` and `town-water-features.ts:358` return garbage silently, `town-foliage.ts:646` throws | above | neither |
| Sprite quad extent four ways; the live one is computed, the three dead constants describe a 64px atlas the demo no longer ships | `sprite-batch.ts:3,16,23` vs `:52-53` | **SPRITE** |
| FNV-1a twice, once with inline magic numbers and once with named constants | `voxel-surface-mesh.ts:504-511`, `index.ts:159-178` | VOXEL / neither |
| Camera lens declared twice; the constructor's `fovY: 0.56` is overwritten every frame and never used | `index.ts:805`, `:923` | neither |
| `report({ drawCalls: 16 })` is a literal while the real count varies with six guards | `index.ts:844` | neither |

### 5.6 The `fract(sin(...))` hash — correcting the goal's premise

`execute-goal-09.md` states that `src/town/art/town.ts:2192` carries "a sixth copy" of the hash.
Both halves need correcting:

- The line in **this** demo is **`town.ts:2289-2291`**. Line 2192 is the corresponding line in the
  `town-study` twin.
- **antiky-town contains exactly one copy**, used consistently at about 30 call sites. Six is the
  **repo-wide** count: three generated WGSL shaders under `packages/demos/brometal/*`, the
  `town-study` twin at `:2192`, `combat-arena/src/combat-state.ts:179` (different multipliers, same
  magic constant), and this one.

So this is **not** a within-demo divergence and nothing here should be deleted for it. Cross-demo
duplication is explicitly accepted (`04-COMPLEXITY-REDUCTION.md:11-22`).

---

## 6. ★ Test protection — and the hole in it

`package.json`'s `test` script names its files explicitly. What actually runs:

| Test | Runs | Kind |
|---|---|---|
| `tests/composition.test.ts` | yes | behavioural |
| `tests/point-light-adapter.test.ts` | yes | behavioural — but see §5.5 |
| `tests/render-interpolation.test.ts` | yes | **source-text regex on `index.ts`** |
| `src/town/physics/character-motor.test.ts` | yes | behavioural — real coverage |
| `src/town/practical-light-input.test.ts` | yes | behavioural |
| `src/town/art/town-validation.test.ts` | yes (vitest) | behavioural |
| `src/town/art/town-grass-distribution.test.ts` | yes (vitest) | behavioural |
| **`tests/ambient-contract.test.ts`** | **no** | source-text regex |
| **`tests/water-depth-contract.test.ts`** | **no** | source-text regex |
| `tests/visual-budget.test.mjs` | only via root `demos:verify` | budget |

**The two contract tests are referenced by nothing.** Verified: they appear in no `package.json`, no
`.mjs` runner, no CI file, and there is no vitest config that would sweep them up — the only hits
for their names anywhere in the repository are the files themselves. This matters twice over:
`ambient-contract.test.ts:13` describes its assertions as existing "so the audit's conclusion cannot
be quietly undone", and it can be; and their file-path pinning is the stated blocker on splitting
`town.ts` and `index.ts`, so that blocker is currently unenforced.

`visual-budget.test.mjs` sitting outside `npm test` is **deliberate and documented**
(`pipeline-invariants.test.mjs:22-25`). The two orphans carry no such note — this reads as omission,
not design.

Note also that `tests/render-interpolation.test.ts` and `tests/water-depth-contract.test.ts` assert
on *source text*, so they do not protect a refactor — they actively block one, and would go red on a
behaviour-preserving move.

---

## 7. Recommended order

| Rank | Item | § | Gate |
|---|---|---|---|
| 1 | Wire up or rewrite the two orphaned test files | 6 | none — do this first, everything else is safer after |
| 2 | Bridge ground height: three rules, up to 1.03 m apart | 5.1 | write the equality test first; it fails today |
| 3 | `map-kit` prop floating over the canal | 5.2 | write a "every prop stands on ground" test first |
| 4 | Lamp declared twice; adapter carries only power | 5.5 | needs a test that the two agree |
| 5 | `practicalRadiance` into the enforced-duplication pattern | 5.3 | decide the wrap constant first |
| 6 | Delete findings 1, 3, 6, 7, 12 and the dead chroma-key path | 3, 4.1 | **ungated** — mechanical, ~90 lines |
| 7 | Delete findings 2, 8, 9, 10 together | 3 | ungated; all touch `buildTownWorld`'s return literal |
| 8 | `uDofTransition` / `uDepthReject` per-frame literals | 4.1 | ungated |
| 9 | Collapse the fog/shadow/sky contract | 5.4 | gated on a capture |
| 10 | `min(specGGX)` clamps and the four ambient lifts | 4.3 | gated — these are the real scar tissue |
| 11 | Decompose `town.ts` and `index.ts` | 2 | blocked on rank 1 |

Ranks 1–3 are where the value is. Rank 6–8 are the ungated deletions goal 09 can land immediately.
Ranks 9–10 are this demo's equivalent of the other three demos' section B and want the same
gate: a before/after capture and a passing visual budget.

---

## 8. What this inventory deliberately does not recommend

- **No shared package, module or helper between demos.** The 3,934 byte-identical lines shared with
  `packages/demos/brometal/town-study` are noted as a fact, not a defect — cross-demo duplication is
  accepted by policy.
- **No removal of `VoxelCharacterWorldAdapter`** (§3, finding 5).
- **No removal of the atlas UV inset** (§4.4) — its fix is scheduled as goal 14.
- **No rewrite of game logic**, per goal 09's non-goals.
- **No re-tuning of any knob.** Every item above is delete, collapse, or re-derive-and-record.
