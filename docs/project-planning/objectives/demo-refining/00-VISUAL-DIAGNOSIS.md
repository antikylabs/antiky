# Visual Diagnosis — What I Actually See

**Date:** 2026-08-10
**Method:** ran each demo at current HEAD via `npm run antiky -- dev`, captured the canvas at
1600×900 @2× DPR in headless Chromium with WebGPU (Metal). Captures are in
`evidence-captures/`. This is what the demos look like *today*, not what the READMEs claim.

The screenshot at the repo root (`combat-arena-runtime.png`) is stale — it shows torus-knot
placeholders. Ignore it. The captures in this folder are current.

---

## The one-sentence answer

The demos are not blocky because of the models. They are blocky because **nothing in any of
these scenes casts a shadow, and almost nothing has a bright side and a dark side.** Fix
those two things and the same assets will look several tiers better.

---

## The three captures, read one at a time

### 1. `traversal-study-canvas.png` — the platformer (target: LittleBigPlanet)

This is the weakest of the three and the most useful, because it isolates the problem: the
assets are fine and the image is still bad.

What I see:

- **Every surface is one flat colour.** The platform top is one green, its side is one
  orange, the rocks are one grey. Kenney's platformer kit ships textures; none are on screen.
  A surface with a single unvarying colour is what "blocky" *is*, regardless of polygon count.
- **There is no key light.** Compare the top face of a platform to its side face — they differ
  in hue because they are different materials, not because one faces the sun and one doesn't.
  Turn the scene greyscale in your head: nearly every pixel lands on the same value. That is
  a scene lit by ambient only, and ambient-only lighting is what makes 3D read as clay.
- **No shadows.** The player's "shadow" is a hard-edged black ellipse decal that reads as a
  hole punched in the platform, not as a shadow. Nothing else — not the rocks, not the tree,
  not the clouds — darkens anything below it.
- **The sky is a single flat blue fill.** No gradient from horizon to zenith, no sun, no
  atmosphere. This is the default clear colour, not a sky.
- **No aerial perspective.** The far platform on the right is exactly as saturated and as
  contrasty as the near one. Real distance desaturates and lightens toward the sky colour;
  that cue is how the eye reads depth. Without it the scene is a flat collage.
- **Composition is unmanaged.** ~60% of the frame is empty sky, the player is small and
  off-centre-left, and the bottom-right quadrant is dead. Nothing directs the eye.
- **The HUD is a pile of coloured 3D boxes floating in the sky** at upper-left, disconnected
  from everything. It reads as broken geometry, not as a heads-up display.
- **Clouds are pure-white low-poly blobs** with zero shading — no form, no soft edge, no
  translucency.

Zooming to 1:1 on a platform edge (`evidence-captures/` + a 3× nearest-neighbour crop) confirms
edges are *clean* — BroMetal defaults to 4× MSAA and it is working. Aliasing is not a current
defect. It becomes one the moment we add an HDR buffer; see the AA note below.

LittleBigPlanet's entire look is material texture, soft shadow, warm bounce light, depth of
field and a vignette. Not one of those five is present here. None of them requires better models.

### 2. `point-light-expo-canvas.png` — the lighting showcase (target: League of Legends)

The most frustrating one, because it uses genuinely high-quality Poly Haven photoscanned rocks
and throws away everything that makes them good.

What I see:

- **The ground is a hard-edged quad floating in a black void.** You can see the trapezoid's
  crisp corners cut against pure black. There is no horizon, no backdrop, no fog fading the
  boundary out. This single detail is the loudest "unfinished student project" signal an image
  can send.
- **The point lights do not light anything.** This demo's entire premise is point lights. The
  lights are visible — glowing orbs with ring decals — but look at the rock behind the orange
  orb: it is not warmer than the rock ten metres away. There is no falloff gradient across any
  surface, no coloured bounce, no shadow cast away from any light. The demo fails to
  demonstrate its own headline feature.
- **The coloured tints are a flat multiply over an entire rock**, so the pink rock and the
  green rock read as coloured plastic rather than as stone lit by a coloured lamp. A light
  should paint a *gradient* across a surface; here it paints a *fill*.
- **Photoscanned rock rendered as flat cardboard.** These meshes carry high-frequency surface
  detail. With no directional light and no normal mapping, all of it collapses. The green rocks
  at bottom-left are literally uniform green silhouettes.
- **The light orbs are faceted low-poly spheres.** Look at the pink and orange orbs — you can
  count the polygon edges. A light source should be a soft glowing sprite that blooms, never a
  hard polygonal ball.
- **The ring VFX are flat 2D circles** at constant width laid on the ground, with no soft edge
  and no glow.
- **Everything sits in one muddy mid-value green.** No true blacks in the scene, no highlights.
- **The overlay is a hard 1px-red-bordered black box with terminal typography** — it reads as
  debug output, not as game UI.
- **Props are misplaced**: the wooden arches at the top float, clipped by the ground plane edge.

League of Legends is stylised and low-detail *by choice*, and it still reads as premium because
it has: a strong directional key light, real shadows, heavy rim lighting on characters,
saturated bloom on every ability effect, and a fog/vignette that pushes the frame's edges dark
so the centre pops. Zero of those are here.

### 3. `combat-arena-canvas.png` — the arena (target: Rocket League)

The strongest of the three — the Quaternius ships are legible and the arena has real structure —
but it still fails the same way.

What I see:

- **The whole image occupies a narrow dark-blue value band.** There is no bright side and no
  dark side to anything. Everything is roughly 15–35% luminance. This is why it reads as murky.
- **Nothing casts a shadow.** The ships float above the floor with no contact shadow; the arena
  walls cast nothing onto the floor; the crevice where wall meets floor has no ambient
  occlusion darkening. Every object looks pasted on rather than sitting in the space.
- **The floor tiles are matte flat colour.** Rocket League's floor is glossy and reflects the
  stadium lights and the cars — that reflection is most of what sells the scale and the polish.
  Here the floor is a diagram.
- **The VFX read as flat decals.** The red/blue/white targeting rings are hard-edged
  constant-width circles with no glow. The cyan bar at bottom-centre looks like a UI rectangle
  that fell into the world. Nothing blooms.
- **The rim props are a junk pile.** The yellow squiggly cables looping around the perimeter are
  the single ugliest element on screen — they read as random noodles. The crates and blocks
  around the rim are at mismatched scales and arbitrary rotations, so a stadium reads as debris.
- **The background is a black void** with a 1-pixel-dot starfield (which will crawl and shimmer
  badly in motion, since it can't be filtered) and one soft blue ellipse with visible banding.
- **Framing is uncommitted.** The arena bleeds off the bottom and both sides, and the camera is
  a locked high three-quarter that is neither a readable tactical top-down nor a cinematic
  chase. The player ship is tiny and dead-centre in a sea of empty floor.

---

## Ranked by visual gain per unit of work

These are ordered by how much the image improves per day of engineering. The first four are
worth more than everything below them combined.

| # | Fix | Why it matters | Rough effort |
|---|-----|----------------|--------------|
| 1 | **One directional key light + shadow map** | Gives every object a lit side, a dark side, and a shadow that plants it on the ground. This alone removes the "clay" and the "floating". | Medium — one extra render pass, shared by all demos |
| 2 | **HDR scene buffer + bloom + a single tonemap at the end** | Today each material tonemaps itself, so there is no HDR buffer and nothing can glow. Lights, VFX and emissives all read as flat decals because of this. | Medium |
| 3 | **Ambient occlusion** (baked vertex AO is enough to start) | Darkens crevices and contact points. This is the difference between "objects in a scene" and "objects pasted on a backdrop". | Small–Medium |
| 4 | **Preserve AA once we go HDR** | Not a defect today — 4× MSAA is on and working. But BroMetal forces `passSamples = 1` for any offscreen pass, so **the moment we render to an HDR target we silently lose all anti-aliasing.** This must be solved as part of #2, not after. | Small, but blocking |
| 5 | **A real sky/backdrop + distance fog on every demo** | Kills the floating-quad-in-a-void problem and restores depth cues. Today the platformer's "sky" is literally `clearColor: [0.38, 0.57, 0.68]` (`traversal-study/src/renderer.ts:297`). | Small |
| 6 | **Use the assets' own textures and normals** | The models ship material data the renderers are discarding in favour of a flat instance tint. | Medium |
| 7 | **Hemispheric ambient instead of a flat constant** | Sky colour from above, ground bounce from below. Nearly free, and it is what stops flat-lit objects looking dead. | Trivial |
| 8 | **Composition and camera pass per demo** | Framing, focal hierarchy, dead space, prop scale/rotation discipline. No code, pure art direction. | Small, per demo |
| 9 | **Colour grading + vignette** | The final 10% that makes a frame look authored rather than rendered. | Small |

## The three root causes behind all of the above

Everything in the tables above traces back to three decisions in the code.

### Root cause 1 — no demo ever renders anywhere except straight to the screen

```
$ grep -rn "createRenderTarget|drawTo" packages/demos/antiky/*/src
(no matches)
```

Not one antiky demo creates an offscreen render target. Every frame is drawn once, directly to
the swapchain. That single fact makes shadow maps, HDR, bloom, ambient occlusion, depth of
field, and colour grading all *structurally impossible* — every one of them needs at least one
offscreen pass. This is not a tuning problem; the pipeline has no place to put those features.

Compounding it: `tonemapACES()` is called inside each material's fragment shader
(`ship-model.shader.ts`, `arena-surface.shader.ts`, `reliquary-model.shader.ts`, …). Tone
mapping is by definition the *last* step of a frame. Doing it per-material means every effect
that composites afterwards is compositing onto already-crushed values, which is exactly why our
VFX read as flat stickers instead of light.

### Root cause 2 — the asset pipeline destroys the material data on the way in

Two per-demo scripts actively throw away fidelity that was already downloaded and committed:

- `traversal-study/scripts/normalize-quaternius.mjs:237-238` never reads `TEXCOORD_0`. It
  replaces every vertex's UV with `paletteU = (materialIndex + 0.5) / colors.length` — a lookup
  into an N×1-pixel PNG built from `baseColorFactor` alone. The shipped `cloud-large`,
  `cloud-small` and `coastal-cliff` textures are literally **1×1 pixels**. That is the precise,
  mechanical reason the platformer has no textures: they were deleted at build time.
- `point-light-expo/scripts/gltf-pack-lib.mjs:89` runs `delete material.normalTexture` —
  normal maps are downloaded, hashed, committed to the repo, and then discarded, because the
  runtime shader has no tangent basis to use them with.

Kenney's models ship `TANGENT` data. Nothing reads it.

### Root cause 3 — colour is unmanaged end to end

Textures upload as `rgba8unorm`, never `rgba8unorm-srgb` (`brometal/dist/runtime/webgpu.js:836-842`),
and BroMetal exposes no way to ask for an sRGB format. So every albedo texture is fed into the
lighting maths still gamma-encoded. Combined with a flat constant ambient, this is what produces
the milky, low-contrast look — and it is also why the shaders have accumulated correction knobs
like `uDiffuseLift`, `uTextureContrast` and `uSaturation` that mix the albedo toward grey. Those
knobs are scar tissue: they were added to fight a symptom whose cause is the missing transfer
function, and they destroy material definition in the process.

## The honest caveat on the reference targets

Rocket League and LittleBigPlanet are hand-modelled, hand-textured productions with art teams.
Kenney and Quaternius kits will never get there on asset fidelity alone, and chasing that is the
wrong goal.

But the gap you are looking at right now is **not** an asset-fidelity gap. It is a lighting,
shadow, post-processing and composition gap, and those are all engineering and art-direction
work on the assets you already have. The realistic and correct target is *best-in-class
stylised* — the tier of Astro Bot, Untitled Goose Game, or Monument Valley — which is reached
through lighting and grading, not through polygon budgets. That target is achievable here.
