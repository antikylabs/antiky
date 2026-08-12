# The Words You Need

You said you don't have the language to tell an agent what's wrong with a render. This is that
language. Each entry is: the term, what it means in one plain sentence, what it looks like when
it's missing, and the sentence you can paste at an agent to demand it.

Read the **Value structure** and **Shadows** sections first. Those two account for most of what
is wrong with our demos.

---

## Tier 1 — the things that are actually broken

### Value structure

**What it is.** "Value" is how light or dark a pixel is, ignoring colour. A good frame has a
deliberate spread: some near-black, some near-white, most in between. Artists check this by
looking at the image in greyscale.

**Missing looks like.** Everything sits in a narrow band of middle grey. The image reads as
"muddy", "flat", or "washed out". Objects don't separate from each other.

**Say this:** *"The scene has no value structure — squint at it and everything is the same
brightness. Establish a key light so surfaces have a clearly lit side and a clearly unlit side,
and widen the histogram so we actually reach near-black and near-white."*

### Key / fill / rim (three-point lighting)

**What it is.** The standard lighting recipe. The **key** is the one bright dominant light that
defines form. The **fill** is a dimmer light from the opposite side that keeps shadows from
going pure black. The **rim** (or back light) is a light behind the subject that puts a bright
outline along its edge, separating it from the background.

**Missing looks like.** Objects merge into the background. Nothing has shape. Rim light is what
makes League of Legends champions pop off the terrain; it's the cheapest "premium" trick there is.

**Say this:** *"Set up proper key/fill/rim. One dominant directional key, a cool low-intensity
fill from the opposite side, and a rim light on hero objects to separate them from the background."*

### Shadow map (cast shadows)

**What it is.** An extra render pass that draws the scene from the light's point of view and
records how far away the nearest surface is. The main pass then checks each pixel against that
record: if something was closer to the light, this pixel is in shadow.

**Missing looks like.** Objects float. They look pasted on top of the ground rather than sitting
on it. This is the single loudest amateur tell in a 3D image.

**Say this:** *"There are no cast shadows. Add a shadow map pass for the directional key light,
with PCF filtering so the edges are soft rather than a hard jagged step."*

Related terms you'll want:
- **PCF (percentage-closer filtering)** — sampling the shadow map several times around a point
  and averaging, so shadow edges are soft instead of pixel-stepped.
- **Shadow acne** — false dark stripes on lit surfaces from depth-comparison rounding error.
  Fixed with a "depth bias".
- **Peter-panning** — the shadow detaching from the object's feet, from too much depth bias.
- **Cascaded shadow maps (CSM)** — splitting the view distance into several shadow maps so
  nearby objects get crisp shadows and distant ones get cheap ones. Needed for large outdoor scenes.

### Contact shadow / ambient occlusion (AO)

**What it is.** The soft darkening in crevices, in inside corners, and right where two objects
touch. Physically it's "how much of the sky can this point actually see".

**Missing looks like.** Everything looks like it's hovering a millimetre off everything else.
Corners look inflated. Objects don't feel connected.

**Say this:** *"Add ambient occlusion. Bake vertex AO into the static geometry at minimum, and
add a screen-space AO pass if the budget allows. Right now nothing has contact darkening."*

### Blob shadow

**What it is.** The cheap fake — a dark ellipse projected under a character instead of a real
shadow. Perfectly legitimate in stylised games *if it's soft-edged and translucent*.

**Missing/wrong looks like.** Ours is a hard-edged opaque black ellipse, which reads as a hole
in the floor. A blob shadow must have a soft falloff and low opacity.

### HDR + tone mapping + exposure

**What it is.** **HDR** means the renderer works with brightness values above 1.0 while
computing, so a lamp can genuinely be 50× brighter than a wall. **Tone mapping** is the final
step that squeezes that huge range down into the 0–1 the monitor can show, in a filmic way that
rolls highlights off gently instead of clipping them to flat white. **Exposure** is the dial
that decides what counts as "middle grey" before tone mapping. ACES and AgX are the two standard
tone-mapping curves.

**Missing looks like.** Bright things clip to a flat white blob with a hard edge. Nothing can
glow. The image looks either crushed or washed out with no way to fix it.

**Our specific bug:** each material tone-maps *itself* inside its own fragment shader. That means
there is no HDR scene buffer at all, so bloom is impossible and every additive effect composites
on top of an already-tone-mapped image, which is why our VFX read as flat stickers.

**Say this:** *"Render the scene into an HDR (float) render target, apply exposure and a single
ACES tone-map once at the end of the frame in a post pass, and remove the per-material
tonemapACES calls. Nothing should tone-map before compositing."*

### Bloom

**What it is.** The glow that spills out of very bright areas, mimicking light scattering inside
a camera lens and inside your eye. Technically: take the HDR image, keep only pixels above a
brightness threshold, blur that heavily (usually as a chain of progressively smaller
downsampled blurs), add it back.

**Missing looks like.** Lights, magic effects, engine trails and emissive panels look like flat
coloured shapes rather than things that emit light. This is 80% of why League of Legends
abilities feel powerful and ours feel like clip art.

**Say this:** *"Add a bloom pass — threshold the HDR buffer, run a mip-chain downsample/upsample
blur, composite additively before tone-mapping."*

### Anti-aliasing (AA)

**What it is.** Removing the stair-step jaggies on diagonal edges. **MSAA** does it in hardware
during rasterisation (highest quality for geometry edges, costs memory). **FXAA / SMAA** do it
as a cheap post-process on the finished image. **TAA** blends across frames (best quality,
introduces ghosting).

**Missing looks like.** Every silhouette edge is visibly stair-stepped, and in motion those
edges crawl and shimmer.

**Say this:** *"Enable MSAA on the main pass, and if the render-target path can't support it,
add an FXAA post pass. Every edge in the current build is aliased."*

---

## Tier 2 — materials and surfaces

### PBR (physically based rendering)

**What it is.** The industry-standard way to describe a surface with a small set of physically
meaningful numbers instead of ad-hoc fudge factors:

- **Albedo / base colour** — the surface's actual colour with no lighting in it.
- **Roughness** — 0 is a mirror, 1 is chalk. This is the single most expressive material dial.
- **Metallic** — 0 for non-metals, 1 for metals. There is no meaningful in-between.
- **Normal map** — a texture that fakes fine surface bumps by perturbing the surface direction,
  so a flat polygon can look like scratched, dented or woven material.
- **AO map** — baked crevice darkening.
- **Emissive** — light the surface produces itself.

The lighting maths for this is called a **BRDF**; the standard one is **Cook-Torrance GGX**.
"Energy conserving" means a surface can never reflect more light than hits it.

**Missing looks like.** Everything is the same material. Metal looks like plastic looks like
stone. Nothing has a highlight that tells you what it's made of.

**Say this:** *"Replace the ad-hoc Lambert-plus-fudge lighting with a proper energy-conserving
Cook-Torrance GGX BRDF driven by albedo/roughness/metallic, and sample the normal map."*

### Specular highlight and Fresnel

**What it is.** The **specular highlight** is the bright spot where the light reflects straight
at the camera; its tightness tells you the roughness. **Fresnel** is the physical fact that
every surface becomes more mirror-like at grazing angles — which is why a road looks shiny in
the distance and matte at your feet.

**Missing looks like.** Surfaces look dry and dead. No sense of wet, polished, or glossy.

### Image-based lighting (IBL) / environment map

**What it is.** Lighting the scene from a photo (or render) of an environment wrapped around it,
so objects pick up colour and reflections from their surroundings. The cheap version is a
**hemispheric ambient**: sky colour from above, ground-bounce colour from below.

**Missing looks like.** A flat constant ambient, which makes shadowed areas look like grey paint.

**Say this:** *"Replace the flat constant ambient with at minimum a hemispheric ambient — sky
colour from above, ground bounce from below — and ideally a prefiltered environment map for
specular reflections."*

### sRGB vs linear (colour management)

**What it is.** Monitors are non-linear: a pixel value of 0.5 is not half as bright as 1.0.
Lighting maths only works in **linear** space. So the correct pipeline is: decode textures from
sRGB to linear on read → do all lighting in linear → encode back to sRGB on write. Colour
textures (albedo) are sRGB. Data textures (normal, roughness, metallic) are linear and must
*not* be decoded.

**Wrong looks like.** Getting this backwards or doing it twice produces images that are either
washed out and milky, or crushed and over-contrasty — and no amount of tweaking light
intensities will fix it, because the error is in the transfer function.

**Say this:** *"Audit the colour pipeline end to end. Albedo textures must be sampled as sRGB,
normal/roughness/metallic as linear, all lighting done in linear space, and exactly one
sRGB encode at present time. Confirm there's no double gamma."*

---

## Tier 3 — depth, atmosphere, composition

### Aerial perspective / atmospheric perspective / fog

**What it is.** Distant things lose contrast and saturation and shift toward the sky's colour,
because you're looking through kilometres of air. Height fog is the same idea pooled in low ground.

**Missing looks like.** Far objects are exactly as punchy as near ones, and the image reads as a
flat collage with no depth.

**Say this:** *"Add distance fog tuned to the sky colour, and height fog in the low areas. Right
now there are no aerial-perspective depth cues at all."*

### Depth of field (DOF)

**What it is.** Blurring what's out of the camera's focal plane. Used sparingly it says
"cinematic"; overused it says "mobile game menu".

### Vignette

**What it is.** Darkening the corners of the frame. Pushes the eye to the centre. Nearly free
and disproportionately effective.

### Colour grading / LUT

**What it is.** A final artistic colour adjustment applied to the whole frame — lift/gamma/gain,
saturation, a colour cast in shadows vs highlights. Usually baked into a **LUT** (look-up
table). This is the step that makes a frame look *authored*.

**Say this:** *"Add a colour-grading pass at the end — lift/gamma/gain plus a subtle split-tone,
cool shadows and warm highlights, then a vignette."*

### Silhouette and read

**What it is.** Whether you can identify an object from its black outline alone, and whether
the important thing in the frame is obviously the important thing. "Does it read?" is the
question artists ask constantly.

**Say this:** *"The player has no read — it's the same value and saturation as the environment
and it's not the focal point. Give it a rim light, raise its local contrast, and desaturate
the environment around it."*

### Composition terms worth knowing

- **Focal hierarchy** — the deliberate ordering of what the eye notices first, second, third.
- **Dead space** — a large area of frame doing no work. Our platformer capture is ~60% dead sky.
- **Framing / cropping** — our arena bleeds off three edges with no intent.
- **Scale discipline** — props of a kit must be placed at consistent, plausible sizes. Random
  scales and rotations read as debris, not as set dressing.

---

## Tier 4 — motion and feel (game-specific)

- **Game feel / juice** — the accumulated small responses that make input satisfying:
  screen shake, hit stop (freezing a frame or two on impact), squash and stretch, particle
  bursts, controller rumble, sound layering.
- **Anticipation and follow-through** — animation principles; a wind-up before an action and an
  overshoot after it.
- **Easing** — never move anything at a constant linear rate; use ease-in/ease-out curves.
- **Camera lag / spring damping** — the camera should follow the player with a spring, not be
  rigidly attached.
- **Telegraphing** — the visual warning that precedes an enemy attack, and its readability.
- **Frame-rate independence** — all motion scaled by delta time so it's identical at 30 and 144 fps.

---

## Words to use precisely, or not at all

Vocabulary is only useful while it stays specific. A term that gets reached for whenever something
is roughly nearby stops carrying information and starts hiding it — the reader assumes you named a
known thing, and goes looking in the wrong place.

### Seam

**Legitimate use — narrow.** A *UV seam* is where a mesh's unwrap is cut so a 3D surface can lie
flat on a 2D texture. It is a property of the unwrap, and it is where texture filtering and normal
maps visibly break on a model. If you mean that, say **UV seam** in full.

**Do not use it for anything else.** In particular, the edge between two tiles packed into a
texture atlas is a **tile boundary**, not a seam. Calling it a seam sends the reader to the mesh
unwrap when the problem is in how the image was packed — a different file, a different tool, a
different fix.

**Say this instead:**

| Instead of | Say |
| --- | --- |
| "seam" between atlas tiles | **tile boundary** or **tile edge** |
| "seam" where two meshes meet | **the join** or name the two objects |
| "seam" where a texture repeats visibly | **tiling repeat** |
| "seam" in a shadow or lighting term | name the actual term — shadow acne, peter-panning, light leak |

The same rule applies to any word here. If you cannot say what a term means in one plain sentence
and what it looks like when it is missing, it does not belong in a review.

---

## How to use this on an agent

Bad prompt: *"make it look better, more AAA."*

Good prompt: *"The scene has no value structure and no cast shadows. Add a directional key light
with a PCF-filtered shadow map, replace the flat constant ambient with a hemispheric ambient,
render into an HDR target, and do exposure + ACES tone-mapping once in a post pass instead of
per-material. Then add bloom and FXAA. Show me a before/after capture."*

The second one is checkable. That's the whole difference.
