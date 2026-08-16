# 04 — BroMetal Studies, Three.js Baselines, and the Presentation Layer

**Audit date:** 2026-08-10
**Scope:** `packages/demos/brometal/{luminous-reef, solar-forge, shader-study, town-study}`,
`packages/demos/threejs/{orbital-atlas, glass-garden}`, the website presentation layer, and captured
evidence. Antiky Framework demos audited separately.
**Stance:** demoscene / graphics-portfolio producer. Judged on what a skeptical visitor sees in the
first five seconds, not on code cleanliness.

---

## 0. Executive summary

The headline problem is not that the demos are unfinished. It is that **the demos and their
presentation are actively arguing against the product.**

Four specific, damaging findings:

1. **The two Three.js "baseline" demos are the only demos that run for most visitors.** Eight of ten
   demos are `requiresWebGpu: true` (`packages/website/src/lib/demos.ts:68`, `:88`, `:106`, `:118`,
   `:153`, `:168`, `:184`). Only `orbital-atlas` and `glass-garden` are `false`
   (`packages/website/src/lib/demos.ts:200`, `:216`). Every other demo hard-fails to a text error
   card on Safari and Firefox (`packages/website/src/components/DemoStage.tsx:106-110`). On the
   majority of the desktop web, the Antiky/BroMetal story is an error message and the competitor's
   renderer is the only thing that moves.
2. **The Three.js demos use PBR, IBL, shadow maps, tone mapping, and bloom; the BroMetal demos are
   fullscreen 2D fragment shaders.** These are not comparable artifacts. `glass-garden` gets
   `MeshPhysicalMaterial` transmission, `PMREMGenerator`/`RoomEnvironment` IBL, shadow-casting point
   lights, and `UnrealBloomPass` in ~295 lines. The three BroMetal shader studies are a
   `createPlane({width:2,height:2})` quad with one procedural fragment function and no geometry,
   lighting, or post at all. The comparison the site sets up is one the site loses.
3. **Three of six committed Three.js runtime captures are 100% blank white frames.** Published
   evidence that the renderer produced nothing.
4. **Every demo's poster is a lie about what the demo looks like at runtime.** The Glass Garden
   poster is a bloom-blown pastel garden; the Glass Garden runtime capture is a near-black void with
   floating balloons. Same scene, same code.

Nothing here needs a rewrite. Most of it needs art direction, exposure discipline, and a
presentation layer that stops undercutting the work.

---

## 1. What each demo actually renders

### 1.1 Shader Study (BroMetal) — `packages/demos/brometal/shader-study/`

**Code:** `src/game.ts` (42 lines) binds a fullscreen quad and three uniforms
(`uTime`, `uAspect`, `uPointer`). All content lives in `src/shaders/aurora.shader.ts` (152 lines).

**Intent** (`src/shaders/aurora.shader.ts:56-59`): "Deliberately short: this shader exists to be read
next to the WGSL the compiler emits from it." That is an honest and defensible framing — this demo's
job is the *compiler*, not the picture.

**What it actually renders** (see poster `packages/website/media-masters/demos/shader-study.png`):
a night sky with three aurora bands, a moon, layered mountain silhouettes, a pine ridge, and a water
reflection. Four concrete rendering defects visible in the poster:

- **The aurora reads as three neon EKG traces, not curtains.** The culprit is the `striation` term,
  `pow(max(sin(p.x * 31 + warp * 11 + phase), 0), 8) * 1.05`
  (`src/shaders/aurora.shader.ts:37`). A `pow(sin, 8)` at frequency 31 makes ~30 hard, evenly
  spaced, near-identical vertical tick marks along each band. Real aurora striation is irregular in
  spacing, width, and intensity, and fades along the band. This produces a barcode.
- **The moon has hard square crater artifacts.** `hash21(vec2(floor(moonPoint.x*32), floor(moonPoint.y*32)))`
  (`src/shaders/aurora.shader.ts:100-102`) is a point-sampled value hash with no smoothing and no
  filtering, so the craters render as axis-aligned solid squares, clearly visible against the moon
  disc. It reads as a JPEG artifact or a broken texture, not a moon.
- **The pines render as 1px black spikes.** `pineSilhouette`
  (`src/shaders/aurora.shader.ts:42-54`) uses a taper of `(top - p.y) * (0.24 + seed * 0.08) + 0.005`
  against `localX`, which at the base of each tree is far narrower than a pine should be. The result
  is a row of ~40 identical black antennae along the ridge.
- **Visible banding in the sky gradient.** The base sky is a three-term smoothstep ramp
  (`src/shaders/aurora.shader.ts:75-78`) at very low luminance. `filmGrain(vUv, uTime) * 0.012`
  (`:149`) is applied *before* the ACES tonemap (`:150`), so the dither is compressed by the tone
  curve exactly in the dark range where it was needed. Dither should be applied after tonemapping, in
  display space, at roughly 1/255.

**Verdict:** Honest scope, but it is presented on `/demos` as a peer of nine other studies with the
tagline "One typed aurora shader compiled ahead of time for WebGPU"
(`packages/website/src/lib/demos.ts:144`). A viewer does not see a compiler. They see a Shadertoy
sketch with sampling artifacts. **The compiler claim needs a side-by-side TS→WGSL source panel on the
demo page or the demo does not make its argument.**

### 1.2 Luminous Reef (BroMetal) — `packages/demos/brometal/luminous-reef/`

**Code:** `src/game.ts` (28 lines), all content in `src/shaders/luminous-reef.shader.ts` (162 lines).

**What it actually renders** (poster `packages/website/media-masters/demos/luminous-reef.png`): this
is the weakest of the six on pure image quality. Specific defects:

- **The plankton field renders as literal hard-edged blue SQUARES.** This is the single most damaging
  artifact in the whole demo set. `packages/demos/brometal/luminous-reef/src/shaders/luminous-reef.shader.ts:139-142`:
  ```
  const particleCell = vec2(floor(p.x * 48), floor((p.y + uTime * 0.035) * 48));
  const particleSeed = hash21(particleCell);
  const plankton = smoothstep(0.987, 0.999, particleSeed) * (0.5 + sin(...) * 0.35);
  ```
  There is no local-coordinate distance test. The seed is constant across the entire cell, so every
  selected cell fills as a solid axis-aligned square. The poster shows dozens of these scattered
  across the frame. They read as dead pixels or a broken sprite atlas. Every other point-sprite in
  this repo does it correctly — compare `bubbleGlow` at `:129-137`, which does compute
  `length(bubbleLocal.sub(bubblePoint))`. This is a one-line-class bug, not a design choice.
- **The "caustics" read as cracked stained glass, not caustics.** `voronoi2` + `worleyEdge2`
  (`:79-82`) produce hard cell walls across the entire upper frame at uniform contrast. Real caustics
  have soft chromatic falloff, animate non-uniformly, and attenuate hard with depth. Here the cell
  pattern is applied at full strength to the background at all depths and reads as a fixed tiled
  overlay glued to the camera.
- **The kelp is a picket fence.** `kelpBlade` (`:45-57`) places one blade per cell at a fixed
  frequency of 5.7, and the coral does the same at 7.4 (`:114-121`), so the seabed is a near-uniform
  row of same-width strokes across the full frame width with no clustering, no overlap, no depth
  layering, and no size falloff toward the horizon.
- **No depth cue at all.** `depth` (`:72`) is a pure vertical gradient. There is no fog by distance,
  no defocus, no parallax between layers other than a global pointer offset (`:68-71`). Everything is
  in the same plane. The four jellyfish are flat radial gradients with three sine-wobbled lines.

**Verdict:** placeholder-tier. This is the demo most likely to make a graphics-literate visitor close
the tab.

### 1.3 Solar Forge (BroMetal) — `packages/demos/brometal/solar-forge/`

**Code:** `src/game.ts` (28 lines), `src/shaders/solar-forge.shader.ts` (105 lines).

**What it actually renders** (poster `packages/website/media-masters/demos/solar-forge.png`): this is
the strongest of the three shader studies and still has clear problems.

- **The rays read as a child's drawing of a sun.** `pow(max(sin(angle * 17 + angularFlow * 7 - uTime * 0.6), 0), 10)`
  (`src/shaders/solar-forge.shader.ts:79`) makes exactly 17 rays of identical width, identical
  intensity, and identical angular spacing. In the poster they appear as ~17 red zigzag spikes
  radiating symmetrically — visually this is closer to a clip-art sun or the Eye of Sauron than to a
  stellar corona. Real coronal structure is scale-free: it needs varied ray count, varied length, and
  intensity drawn from noise rather than a fixed harmonic.
- **The composition is dead-center and perfectly radially symmetric.** `center = p.sub(vec2(0.08, -0.015))`
  (`:41`) puts the subject within 4% of frame center. Combined with the 17-fold symmetry, the frame
  has no visual entry point, no negative-space tension, and nothing to look at second. A 5-10°
  camera tilt and an off-center subject would cost one line.
- **Banding in the corona.** `corona = 0.025 / max(abs(radius - coronaRadius), 0.018)`
  (`:77`) is an inverse-distance glow with no dither. Visible concentric contour rings in the
  falloff, made worse because ACES (`:103`) compresses precisely there.
- **The relativistic-beaming idea is the best thing in the set and is invisible.** `approachingDisk` /
  `recedingDisk` (`:90-91`) with a blue-shifted `vec3(1.45, 1.72, 2.8)` on the approaching side and
  a warm `vec3(2.75, 1.12, 0.22)` on the receding side (`:98-99`) is genuinely clever physics. In the
  poster the disk is a single thin overexposed white streak and the asymmetry is unreadable. The
  disk needs thickness, opacity ramping, and the beaming asymmetry pushed hard enough to be legible.

**Verdict:** one good idea (Doppler-beamed accretion disk) buried under clip-art rays and a symmetric
composition. **Highest ratio of achievable improvement to effort in the whole set.**

Also note: `packages/website/src/lib/demos.ts:159` calls this "a turbulent procedural eclipse" and
`:161` says "a black-hot core," while the shader implements a black hole with a photon ring
(`:72-73`), an accretion disk, and relativistic beaming. The copy undersells its own content.

### 1.4 Town Study (BroMetal) — `packages/demos/brometal/town-study/`

**This one does not belong in the same sentence as the other three.** It is ~9,000 lines across
`src/town/` — a real voxel surface mesher (`src/town/art/voxel-surface-mesh.ts`, 541 lines), a sprite
batcher (`src/town/art/sprite-batch.ts`, 474 lines), a character motor with tests
(`src/town/physics/character-motor.ts`, 1,286 lines), foliage (`src/town/art/town-foliage.ts`, 671
lines), water features (579 lines), dynamic props (323 lines), and twelve shader pairs including
dedicated shadow passes (`src/town/shaders/town-{voxel,sprite,prop,foliage,awning}-shadow.shader.ts`)
and a post pass (`src/town/shaders/town-post.shader.ts`, 277 lines).

**This is the only BroMetal artifact that demonstrates an engine.** It has a shadow pipeline, a
material system, batching, physics, and a post chain. It is also the file most in violation of the
repo's own size rule — `src/town/art/town.ts` is 2,194 lines against an 800-line decomposition
threshold (`docs/GOOD_ENGINEERING_H.md`, "File Size and Cohesion").

**Presentation problem:** it is listed fourth in the BroMetal group on `/demos` (order comes from
`packages/website/src/lib/demos.ts:124-139` — actually first in the BroMetal block, but the BroMetal
block itself sits below the Framework block), and its tagline "A living pixel cast inside a
golden-hour voxel town" (`:127`) sits in a visual list next to three flat-shaded fullscreen quads
that make it look like a member of the same family. **Town Study is doing 95% of the work and getting
25% of the billing.**

### 1.5 Orbital Atlas (Three.js) — `packages/demos/threejs/orbital-atlas/`

**Code:** `src/game.ts` (250 lines) + `src/scene-layout.ts` (24 lines).

**What it renders** (poster `packages/website/media-masters/demos/orbital-atlas.png`): a sun, two
planets, one moon, two torus orbit guides, 180 instanced octahedra, 1,400 points.

**It does not use the free wins Three.js hands you:**

- `renderer.shadowMap` is never enabled. There are no shadows anywhere in the scene.
- The sun is `MeshBasicMaterial` (`src/game.ts:71`) and the shards are `MeshBasicMaterial`
  (`:149-153`) — unlit. Only the two planets and the moon use `MeshStandardMaterial`
  (`:92-97`, `:108`, `:118-124`).
- There is no `scene.environment` / IBL, so the two PBR materials have nothing to reflect. They are
  lit by one `PointLight` (`:87`) and an `AmbientLight` (`:66`), which is why the poster's planets
  look like flat Illustrator gradients rather than lit spheres.
- No post-processing. `ACESFilmicToneMapping` is set (`:57`) but with nothing in the scene above
  1.0 luminance there is nothing for it to do.

**Composition and image defects in the poster:**

- **The additive halo over a near-black background produces a muddy brown ring.** `haloMaterial` is
  `AdditiveBlending` with `color: 0xff6828, opacity: 0.16` (`:73-80`) on a `SphereGeometry(1.72,…)`
  (`:72`). Because it is a *sphere* and not a sprite/billboard, and because it is barely larger than
  the 1.35-radius sun, it renders as a hard-edged opaque brown annulus around the sun rather than as
  a glow. It reads as dirt.
- **The ringed planet is cropped by the bottom frame edge** and sits in the lower-left corner while
  the sun sits above center-right — the frame has two competing subjects and no hierarchy.
- **The orbit guides are 1px aliased grey ellipses** (`TorusGeometry(radius, 0.012, 6, 192)`,
  `:141`) with `MeshBasicMaterial` at `opacity: 0.3` (`:138`). Radial segment count of 6 on a
  0.012-radius tube at that screen size is fine, but the near-1px screen width means visible
  stair-stepping despite `antialias: true`.
- **The 180 shards read as confetti litter**, not as an orbital field. They are unlit white
  octahedra at `opacity: 0.68` (`:149-153`) with per-instance HSL color (`:178`) scattered across two
  orbital bands with no size falloff by distance and no clustering.
- **The star field is invisible.** 1,400 additive points at `size: 0.065` (`:193`) on a radius-24
  sphere (`:41`) are sub-pixel at this camera distance. The poster's "stars" are a handful of faint
  dots.

**Real bug — per-frame renderer resize:** `src/game.ts:210-217`:
```
const resize = (): void => {
  const width = Math.max(1, canvas.clientWidth || 1280);
  const height = Math.max(1, canvas.clientHeight || 720);
  if (canvas.width === width && canvas.height === height) return;
  renderer.setSize(width, height, false);
  ...
};
```
`setPixelRatio` is set to `min(devicePixelRatio, 2)` at `:59`, and `setSize(w, h, false)` sets
`canvas.width = floor(w * pixelRatio)`. On any DPR≥2 display `canvas.width` is `2 * width`, so the
guard **never** short-circuits. `setSize` and `camera.updateProjectionMatrix()` run on every single
frame, reallocating the drawing buffer 60×/second. `glass-garden` does not have this bug — it tracks
`renderWidth`/`renderHeight` in closure variables instead
(`packages/demos/threejs/glass-garden/src/game.ts:244-256`). Orbital Atlas should copy that.

**Verdict:** this is the "control group" and it is the worst-looking artifact in the set. If the goal
was to show that a mainstream engine produces a flat result too, that goal is met — but by
handicapping Three.js, not by beating it, and a Three.js-literate visitor will spot the handicap
immediately.

### 1.6 Glass Garden (Three.js) — `packages/demos/threejs/glass-garden/`

**Code:** `src/game.ts` (295 lines) + `src/scene-layout.ts` (31 lines).

**This is the only demo in the set that uses a modern renderer as intended:**
`MeshPhysicalMaterial` with `transmission`/`thickness` (`src/game.ts:85-118`), `PMREMGenerator` +
`RoomEnvironment` IBL (`:58-59`), `shadowMap.enabled` (`:56`) with a shadow-casting `PointLight`
(`:230`), procedural `ImprovedNoise` terrain with per-vertex color (`:197-220`), and an
`EffectComposer` bloom chain (`:69-73`).

**And it is exposure-broken in both directions.**

The published poster (`packages/website/media-masters/demos/glass-garden.png`) is **catastrophically
blown out**. Every crystal is a white-hot ball with zero material read. You cannot tell that
`transmission: 0.72` (`:91`) is doing anything — the glass reads as opaque cotton candy. The terrain
is a flat lavender-grey wash with no surface detail despite 128×96 subdivision (`:197`). The two
arches are pure-white 1px strokes with a huge halo. The color separation between the cyan, violet,
and amber material variants (`:85-117`) is destroyed. **Highlight roll-off is gone; the frame is
~40% clipped.**

Root cause is stacked: `HemisphereLight` at intensity `1.35` (`:67`) + IBL environment (`:63`) +
three `PointLight`s at intensity 175/165/145 (`:227-229`) + `emissiveIntensity` 0.65–0.72 on every
glass material + `MeshBasicMaterial` cores authored **above 1.0** on purpose
(`new Color().setRGB(0.38, 1.55, 2.2)`, `:126-128`) + `UnrealBloomPass(…, strength 0.72, radius 0.42,
threshold 0.76)` (`:71`) — all at `toneMappingExposure = 1` (`:54`). The bloom threshold of 0.76 is
below almost everything in the scene, so nearly the entire frame blooms.

The runtime capture
(`packages/demos/threejs/glass-garden/.antiky/captures/capture-c01ffa42-c1e4-4fd4-877d-6ba5915aa4ea.png`)
is the **opposite failure and is far worse**: a near-black frame with five dim ovoid blobs and a
torus knot floating in a void. The terrain is completely invisible. There is **no shadow contact
anywhere** — the blooms have no grounding, so they read as balloons on sticks suspended in space
rather than plants rooted in ground. A single stray violet glow pool sits in the lower right,
disconnected from any object. The `HemisphereLight` ground color `0x12091e` (`:67`) and the terrain's
`lowColor = 0x071625` (`:200`) are both near-black, so the floor has effectively no albedo to catch
light from.

**Both images come from the same code.** That is the finding: the demo has no exposure control, so it
lands wherever the frame timing and camera angle put it. A demo that cannot reproduce its own poster
is not a demo.

The second capture (`capture-3357a5fc-…png`) is a **blank white frame** — see §3.

---

## 2. Purpose check: what are these supposed to prove?

### 2.1 The stated purpose

Three sources state it, and they agree:

- `packages/demos/threejs/README.md:3-5`: "These projects use Three.js without BroMetal or Antiky
  Framework. They demonstrate that Studio's host lifecycle, renderer measurements, development
  service, and agent connection are **renderer agnostic**."
- `packages/website/src/lib/demos.ts:50`: "Pure WebGL projects that prove the same portable game host
  can mount another renderer."
- `packages/website/PRODUCT.md:113-114` lists as *current evidence*: "Four current Antiky Framework
  studies, four pure BroMetal studies, and two pure Three.js studies in one portable website-owned
  game host."

**So the claim is narrow and architectural: the host contract is renderer-neutral. It is NOT a
quality comparison.**

### 2.2 Do they prove it?

**Structurally, yes — and cleanly.** Both Three.js demos implement the same 16-line
`StudioGameEntry` contract (`packages/demos/threejs/orbital-atlas/src/studio-game.ts`, 16 lines;
`glass-garden/src/studio-game.ts`, 16 lines) that the BroMetal demos implement
(`brometal/solar-forge/src/studio-game.ts`, 16 lines). Same `{canvas, pointer, report}` context, same
`{frame, dispose}` return, same `report()` measurement channel
(`orbital-atlas/src/game.ts:202-207`, `glass-garden/src/game.ts:236-241`). Both are registered
through the same `demo-publication.json` with `"renderer": "threejs"`
(`packages/website/demo-publication.json:93-113`) and served through the same
`demoModuleUrl` (`packages/website/src/lib/demos.ts:235-237`) and the same `DemoStage` component.
That is a genuine, verifiable, well-executed proof of the narrow claim.

### 2.3 The claim they accidentally make instead

**The problem is that nobody reads a demo page architecturally. They look at ten pictures.**

`/demos` renders all ten studies as visually identical `16/9` cards in one scrolling column
(`packages/website/src/app/demos/page.tsx:36-46`, styled by `.demo-entry-media` at
`packages/website/src/app/globals.css:250`). The only thing distinguishing "this proves host
portability" from "this is our rendering technology" is a group header
(`packages/website/src/app/demos/page.tsx:31-35`) and a `demo.pillar` label rendered in 10px
uppercase mono (`globals.css:255`). The visitor's actual takeaway is a leaderboard.

On that leaderboard:

- **Glass Garden's poster is, by a wide margin, the most "produced-looking" image in the set.** It has
  real materials, real bloom, real depth. It is also the demo that took the least engineering
  effort — 295 lines, mostly configuration — because `MeshPhysicalMaterial`, `PMREMGenerator`,
  `shadowMap`, and `UnrealBloomPass` are all free.
- **The three BroMetal shader studies have no lighting model, no shadows, no post, and no geometry.**
  Not because BroMetal cannot do those things — Town Study proves it can, with a full shadow pass per
  material class — but because those three demos are fullscreen quads.

So the visible comparison is: *"our renderer produces flat 2D noise fields; the mainstream renderer
produces lit 3D scenes."* That is the exact inverse of the intended message, and `PRODUCT.md:159`
("Preserve its attribution and useful links without presenting it as the Antiky Labs identity")
does not protect against it, because the damage is visual, not textual.

**The comparison is also unfair to BroMetal in the other direction:** Town Study is a far more
impressive engineering artifact than Glass Garden, and it is rendered invisible by being grouped with
the three quad demos.

### 2.4 The WebGPU asymmetry makes it worse

This is the finding I would escalate first.

`packages/website/src/lib/demos.ts` marks eight of ten demos `requiresWebGpu: true`. Only the two
Three.js baselines are `false` (`:200`, `:216`). `DemoStage` gates on this at
`packages/website/src/components/DemoStage.tsx:106-110`:

```
if (requiresWebGpu && !('gpu' in navigator)) {
  setError('This demo needs a browser with WebGPU support.');
  setPhase('error');
  return;
}
```

On Safari and on Firefox — a large share of the "skeptical technical visitor" audience named in
`PRODUCT.md:14-15` — the `/demos` page is **eight error cards and two working Three.js scenes.** The
page headline is "Run the work." (`packages/website/src/app/demos/page.tsx:17`) and the status line
claims "Ten live studies" (`:18`). For those visitors it is two.

Worse: the two that work are labeled "Three.js" and described as proving that the host "can mount
another renderer." The unintended reading is *"the only things that actually run here are the ones
that don't use their technology."*

**Recommendations (in priority order):**
1. Detect WebGPU once, at page level, and show a single honest banner ("8 of these 10 studies need
   WebGPU — try Chrome or Edge") instead of eight identical error cards.
2. Every WebGPU-gated demo already has a poster (`demoPosterUrl`, `packages/website/src/lib/demos.ts:239-241`).
   On a non-WebGPU browser, fall back to the poster with a "static capture" badge rather than to an
   error. A still frame is evidence; an error card is not.
3. Consider shipping a short looping video capture per demo as the no-WebGPU fallback. This is the
   single cheapest fix for the whole problem.

---

## 3. Captured evidence

### 3.1 Three of six committed Three.js captures are blank white frames

Under `packages/demos/threejs/*/.antiky/captures/`:

| File | Content |
|---|---|
| `orbital-atlas/.antiky/captures/capture-119b534d-3dac-40a6-8f33-f5dd8a35387d.png` | **100% blank white** |
| `orbital-atlas/.antiky/captures/capture-07c8aff3-9461-4cff-9074-c1c3483a2439.png` | **100% blank white** |
| `glass-garden/.antiky/captures/capture-3357a5fc-68a8-40ad-962d-be4d4b6a9df5.png` | **100% blank white** |
| `glass-garden/.antiky/captures/capture-c01ffa42-c1e4-4fd4-877d-6ba5915aa4ea.png` | near-black, unusable (see §1.6) |

Both Three.js demos set `preserveDrawingBuffer: true`
(`orbital-atlas/src/game.ts:54`, `glass-garden/src/game.ts:50`), which is exactly the flag you set so
that `toDataURL`/`readPixels` capture works. It is set, and the captures are still blank — so the
capture is firing before the first `frame()` call, or against the wrong canvas, or after a context
teardown. Blank-white (rather than blank-black) points at capturing an un-composited or
already-cleared canvas rather than at a render failure.

**This is a working-evidence defect, not just a cosmetic one.** `PRODUCT.md:88-118` builds the entire
public argument on an "Evidence status" ladder, and `PRODUCT.md:113-114` cites these two Three.js
studies as *current evidence*. Committed captures that are blank frames undercut that ladder
directly. Either fix the capture timing or delete the artifacts — do not leave blank PNGs in the
repo under a directory named `captures`.

**Also note the capture aspect:** the two non-blank captures are ~1963×916, roughly **2.14:1**, while
every poster master is 2560×1440 (16:9) and every stage container is `aspect-ratio: 16/9`
(`globals.css:250`). The capture pipeline and the presentation pipeline disagree about frame shape.

### 3.2 `combat-arena-runtime.png` (repo root, 2400×1540)

This is an Antiky Framework demo and is audited elsewhere, but it is a full-page capture that shows
the presentation layer, so the presentation observations apply:

- **The frame is cut off at the bottom.** The arena's lower rim, several props, and a magenta object
  at bottom-center are sliced by the viewport edge. The stage is taller than the fold.
- **Empty black gutters on both sides.** There are visible vertical seams at roughly x=80 and x=1920
  (in the 2400-wide original) where the stage ends and pure `#000` page background begins. The scene
  does not fill its own frame, and because both the scene background and the page background are
  near-black, the boundary reads as a rendering glitch rather than as a deliberate letterbox.
- **The d-pad overlay is enormous and badly placed.** It occupies roughly 260×260 px in the
  lower-left, directly on top of the arena floor, with a `rgba(5,5,6,.76)` panel behind it
  (`globals.css:110`). It is the second-brightest UI element in the frame and it is covering scene
  content.
- **Ghost UI in the top-left and top-right.** There are two faint clipped text fragments partially
  hidden behind the site header ("P…" at upper-left, a truncated readout at upper-right around
  x=1530). These are the paused/HUD chips rendering *underneath* the site header — a z-index/layout
  collision. `.stage-hud` is `position: absolute; z-index: 5; inset: 14px 14px auto`
  (`globals.css:102`), which places it 14px from the top of the *stage*, and the stage starts under
  the fixed site header.
- **Rendering: extremely flat.** Every object is a smooth unlit-looking gradient. There is **no
  shadow contact** between any torus knot and the arena floor — the knots have only faint elliptical
  glow rings beneath them, which read as decals rather than shadows, so nothing is grounded. The
  perimeter blocks have no ambient occlusion at their base. The arena floor is a large smooth
  radial gradient with visible **concentric banding** in the mid-tones.
- **The palette is unmodulated magenta/cyan/violet at near-full saturation** across ~15 objects with
  no value hierarchy, so the eye has nowhere to land. The white player character is the only
  desaturated element and is not visually privileged in any other way (it is small and off-center-left).
- **Aliasing** is visible on the perimeter block silhouettes and the thin ring geometry.

### 3.3 `home-desktop-qa.png` (repo root, 1440×7472)

A full-page desktop capture of `/`. As a page design it is disciplined and confident — strong
typographic hierarchy, generous whitespace, consistent 10px mono eyebrows, good rhythm. Problems are
concentrated in the **hero**, which is the only place a demo is visible:

- **The hero demo is running behind a large text overlay that covers its left third.** The headline
  block ("Build the world in your mind. Stay in the director's chair.") plus body copy plus three
  buttons sits directly on the arena. The most interesting part of the scene — the illuminated arena
  floor and the moving agents — is behind text.
- **The hero is severely letterboxed vertically.** The stage occupies roughly the top 250px of a
  7472px page; in the capture the arena is cropped top and bottom, showing only a horizontal band of
  it. `.home-hero > .stage { position: absolute; inset: 0 }` (`globals.css:122`) means the stage
  matches the hero's aspect, which at desktop width is very wide and short — so a 16:9 scene gets
  center-cropped hard.
- **Contrast between hero art and page background is near zero.** Both are near-black. There is no
  frame, no border, no gradient scrim boundary, so the hero art bleeds into the page and reads as a
  background texture rather than as a running program. A visitor may not register that it is live.
- **`.stage-hero .stage-status { color: transparent; background: transparent; }`
  (`globals.css:95`) makes the hero's loading state completely invisible.** During module fetch and
  WebGPU device acquisition the visitor sees a motionless poster with zero feedback. On a slow
  connection that is indistinguishable from a broken page. And on a non-WebGPU browser the hero
  falls to `phase === 'error'`, which for the hero variant renders the `.stage-fallback` card
  (`DemoStage.tsx:320-324`) — an error box as the first thing on the homepage.
- The bottom-left "N" badge and a small "Pause" control float over the art with no visual container
  tying them to the stage.

---

## 4. Presentation layer defects

Reading `packages/website/src/components/DemoStage.tsx`, `packages/website/src/app/demos/page.tsx`,
`packages/website/src/app/demos/[slug]/page.tsx`, and the `.stage*` rules in
`packages/website/src/app/globals.css:88-114`, `:240-270`, `:319-382`.

**P1 — Thumbnails never run on touch devices.** In the `variant === 'thumb'` branch
(`DemoStage.tsx:313-317`) the only children are a loading status and an "Open study" link. There is
**no `.stage-activate` button** — that is rendered only in the non-thumb branch (`:325-329`).
Activation for thumbs comes exclusively from `onPointerEnter` / `onFocusCapture` on the wrapper
(`:305, :307`). On a touch device there is no hover, and `.stage-thumb .stage-canvas { pointer-events: none }`
(`globals.css:109`) blocks the canvas from receiving the pointer anyway. **On mobile, `/demos` is ten
static posters.** The page promises "Ten live studies" (`demos/page.tsx:18`).

**P2 — Poster/stage aspect mismatch causes composition-destroying crops.** All poster masters are
2560×1440 (16:9). `.stage` uses `background-size: cover` (`globals.css:88`). The detail-page stage is
`height: min(68vw, 780px); min-height: 520px` (`globals.css:263`) — at a 1440px viewport with the
page gutter that is roughly 1300×780, i.e. **1.67:1**, so a 16:9 poster loses ~7% of its width.
At `min-height: 520px` on a narrow desktop it is worse. On mobile, `.deck-stage { height: 68svh }`
(`globals.css:371`) against a ~390px-wide viewport gives a **portrait** container — a 16:9 landscape
poster is cropped to roughly its middle 35%. For Orbital Atlas (whose ringed planet is already
clipped by the bottom edge of the master) and Shader Study (whose moon sits at the far right), the
subject is cropped out entirely on mobile. Only `combat-arena` has a mobile-specific poster
(`packages/website/src/lib/demos.ts:243-246`); the other nine do not.

**P3 — No per-demo aspect lock on the live canvas.** `.stage-canvas` is `width: 100%; height: 100%`
(`globals.css:90`) and each demo reads `canvas.clientWidth/clientHeight`. So the *live* scene is
composed for whatever container aspect the visitor happens to have. The two Three.js cameras are
authored for 16:9 (`orbital-atlas/src/game.ts:64`, `glass-garden/src/game.ts:65`) and then have their
aspect overwritten at runtime. A demo whose framing was tuned at 16:9 will be mis-framed everywhere
else, and there is no `object-fit`-style letterbox option. **These are cinematic pieces being shown
at an arbitrary crop.**

**P4 — The HUD advertises the wrong numbers.** `.stage-hud` renders fps / draws / instances chips
(`DemoStage.tsx:336-340`). For the three BroMetal shader studies `report()` sends `drawCalls: 1`
(`shader-study/src/game.ts:18`, `solar-forge/src/game.ts:12`, `luminous-reef/src/game.ts:12`). The
visitor sees a chip reading **"1 draws"** floating over the art. Without framing, "1" reads as
*trivial*, not as *efficient*. Meanwhile Glass Garden reports `drawCalls: bloomLayout.length * 3 + 7`
(`glass-garden/src/game.ts:238`) — a bigger, more impressive-looking number for the competitor's
demo. The metric that would actually flatter BroMetal (one draw call, zero textures, zero bytes of
asset download) needs a caption, not a bare integer.

**P5 — HUD collides with the site header on the hero.** See §3.2. `.stage-hud` positions at
`inset: 14px 14px auto` (`globals.css:102`) relative to the stage, and the hero stage starts beneath
the fixed header, so the chips render under it.

**P6 — The d-pad covers scene content.** `.stage-dpad` is a `3×44px` grid plus padding at
`left: 18px; bottom: 18px` (`globals.css:110`) with an opaque panel — roughly 150×150 CSS px
sitting on the art. It is shown whenever `controlMode === 'move'`, which is four demos
(`packages/website/src/lib/demos.ts:71, 88, 105, 138`), including on desktop where the keyboard
handler (`DemoStage.tsx:163-173`) already works. It should be touch-only and it should be smaller
and more transparent.

**P7 — No captions on the stage.** `demo.proves` (`packages/website/src/lib/demos.ts:63-67` etc.) is
well-written and specific — "One runtime projection drives custom BroMetal arena, trail, and impact
rendering" — but it lives in `.demo-notes` **below** the stage (`globals.css:268`). Nothing on or
beside the running canvas tells the viewer what to look at. For Solar Forge, "the leading edge of the
disk is blue-shifted because it is rotating toward you" would transform how that image is read, and
it appears nowhere.

**P8 — The `desaturate` treatment on paused/ready states dulls the first impression.**
`.stage[data-phase='ready'] .stage-canvas, .stage[data-phase='paused'] .stage-canvas { filter: saturate(0.9) brightness(0.9); }`
(`globals.css:93`). These demos are already too dark and too low-contrast; the default resting state
knocks another 10% off both.

**P9 — Errors are terminal text.** `.stage-fallback` (`globals.css:94`) renders the raw thrown
message. `DemoStage.tsx:208` can surface "The compiled game has no default game-module entry." and
`:221` "The compiled game returned an invalid game instance." to a public visitor. These are
developer strings on a marketing page.

---

## 5. Prioritized recommendations

**Tier 0 — credibility (do first)**
1. Delete or regenerate the three blank-white capture PNGs under
   `packages/demos/threejs/*/.antiky/captures/`. Fix the capture-timing bug that produced them.
2. Replace the eight-error-cards WebGPU experience with a single page-level banner plus poster
   fallbacks (`DemoStage.tsx:106-110`, `packages/website/src/lib/demos.ts:239-241`).
3. Fix Glass Garden's exposure so the runtime matches the poster. Lower `HemisphereLight` from 1.35
   (`glass-garden/src/game.ts:67`), raise the bloom threshold from 0.76 (`:71`), and set
   `toneMappingExposure` deliberately (`:54`). Give the terrain a non-black albedo (`:200`) so
   shadow contact is visible and the blooms stop floating.

**Tier 1 — image quality (highest value per hour)**
4. Luminous Reef: fix the square-plankton bug (`luminous-reef.shader.ts:139-142`) — add the
   local-distance test that `bubbleGlow` already uses at `:129-137`. This is a small change that
   removes the single most damaging artifact in the set.
5. Solar Forge: break the 17-fold ray symmetry (`solar-forge.shader.ts:79`), offset the composition
   (`:41`), and make the Doppler-beamed disk (`:90-99`) legible. Best idea in the set, currently
   invisible.
6. Shader Study: filter the moon craters (`aurora.shader.ts:100-102`), irregularize the striation
   (`:37`), widen the pines (`:42-54`), and move the dither after the tonemap (`:149-150`).
7. Orbital Atlas: enable `shadowMap`, add an environment map, replace the sphere halo with a
   billboarded sprite (`orbital-atlas/src/game.ts:72-80`), recompose so the subject is not cropped,
   and fix the per-frame `setSize` bug (`:210-217`) by copying Glass Garden's pattern
   (`glass-garden/src/game.ts:244-256`).

**Tier 2 — framing and billing**
8. **Promote Town Study.** It is the only BroMetal artifact that demonstrates an engine (shadow
   passes, batching, materials, physics, post) and it is currently billed identically to three
   fullscreen quads. Give it the hero slot in the BroMetal group and separate the three shader
   studies into a clearly-labeled "shader studies" subgroup so they are not read as the ceiling of
   BroMetal's capability.
9. Add on-stage captions from `demo.proves` so the viewer knows what to look at (P7).
10. Fix mobile: add an explicit activate button to the thumb variant (P1), add mobile posters or
    a per-demo safe-area/aspect policy (P2, P3).
11. Reframe the HUD so "1 draw call, 0 textures, 0 KB of assets" reads as the achievement it is (P4).

**Tier 3 — hygiene**
12. Decompose `packages/demos/brometal/town-study/src/town/art/town.ts` (2,194 lines) against the
    800-line threshold in `docs/GOOD_ENGINEERING_H.md`.
13. Correct the Solar Forge copy (`packages/website/src/lib/demos.ts:159-161`) — it says "eclipse"
    and "black-hot core" for what is actually a black hole with a photon ring and a relativistic
    accretion disk.
14. Replace developer error strings with visitor-facing copy (P9).

---

## 6. The one-line version

The architecture claim ("the host is renderer-agnostic") is proven cleanly and honestly. The visual
claim nobody meant to make ("the mainstream engine looks better than ours") is also being made, and
it is being made by three fullscreen-quad demos standing in for a renderer that — as Town Study
proves — can do far more.
