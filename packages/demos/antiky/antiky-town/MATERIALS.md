# Where world-space projection applies in antiky-town, and where it does not

This demo is the repository's only 2.3D artifact and the only one whose art is atlas-and-sprite based
rather than model-and-material based. Goal 05's material work therefore applies unevenly here, and
this file records the decision for every surface — including the four where the answer was no.

Written because "we applied triplanar to the town" is not a decision anyone can check, and because
the most likely way to get this demo wrong looks like noise rather than like a bug.

## The rule that decides everything below

**Never project an atlas.**

World-space projection derives texture coordinates from position and surface normal and ignores UVs
entirely. That is exactly what makes it useful for a tiling texture, and exactly what makes it
destructive for an atlas: an atlas's UVs are authored placement information saying which rectangle of
one image belongs to which face. Ignore them and a projection samples straight across tile boundaries
and composites unrelated tiles into every surface.

So: the atlas keeps its UVs and decides colour. A separate tiling normal map — which carries no tile
layout at all — is projected and decides only which way the surface faces. The two never compete.

## Surface by surface

| Surface | Shader | Detail normal | Why |
|---|---|---|---|
| Voxel town surfaces | `town-voxel` | **Yes**, rate 0.55, strength 0.5 | Axis-aligned box faces are the ideal case: each face lands almost entirely on one projection, so the three-way blend is nearly a straight lookup with none of the smearing curved geometry shows. |
| Props | `town-prop` | **Yes**, rate 0.55, strength 0.42 | Same reasoning. Weaker than the voxel surfaces because props are smaller in frame and read as objects rather than architecture. |
| Awnings | `town-awning` | **Yes**, rate 0.55, strength 0.42 | Same. Cloth wants surface tooth more than stone does, but the awnings are thin and mostly seen at a glancing angle, so a heavier setting reads as dirt. |
| Water features | `town-water-features` | **Yes**, rate 0.55, strength 0.30 | World-space projection is the natural parameterisation for water anyway. Lightest of the four: the surface already carries a Fresnel term doing most of the visual work. |
| Open water | `town-water` | **No** | Builds its normal from `waterNormal(vWorld.x, vWorld.z, uTime)` — an animated wave function. A static tiling normal on top would add non-moving tooth to moving water, which reads as a dirty lens rather than as a surface. The goal's table listed this shader as a yes; the source says otherwise, and the source wins. |
| Foliage cards | `town-foliage` | **No** | Alpha-cut billboards with `uCutoff` at 0.35. Projection on a card that turns to face the camera swims, because the projection is fixed in the world and the card is not. It already has wrapped diffuse *and* a transmission term, which is the correct treatment for a leaf card and is what goal 05 would otherwise have added. |
| Actor sprites | `town-sprite` | **No** | Pixel-art sprite atlas at `filter: 'nearest'`. Projection would destroy it outright. Goal 04 already reverted an sRGB decode on this atlas for a related reason — its shading is painted in, so treating it as reflectance crushes every townsperson to orange-brown. |
| Shadow passes | `town-*-shadow` | **No** | They write depth-from-light, not appearance. A normal has nothing to contribute to a distance. |
| Post pass | `town-post` | **No** | Operates on a finished image with no surfaces in it. |

## Rim light

`town-prop` and `town-awning` gained an always-on rim tinted by `uSkyColor`. `town-voxel` and both
water shaders already hand-rolled a Fresnel term before this goal, and `town-foliage` already had
wrapped diffuse — goal 05's claim that no demo used Fresnel was about BroMetal's uncalled
`fresnel()` helper, not about the technique, which was already here in five places.

## What was measured

With the detail normal in and out, **40.6% of the frame changed** — mean delta 10.2/765 among changed
pixels, maximum 110. Local contrast moved 7.993 to 8.069.

That number is worth holding onto, because the same change measured as doing *nothing* in
`point-light-expo`. The difference is that this demo already has a directional sun, a sky/ground
ambient split and five depth-from-light shadow passes, so a perturbed normal has something to
modulate. A detail normal is not a visual improvement on its own; it is an amplifier for whatever
directional light already exists.

## Still open here

- **SH-9 irradiance.** This demo has a two-term `uSkyColor`/`uGroundColor` split, which is already
  direction-dependent — so unlike the other demos, SH-9 is an upgrade to something real rather than a
  replacement for a flat constant. It is the fairest test in the repository of whether nine
  coefficients earn their bake step over two hand-picked colours, and it has not been run yet.
- **Atlas gutters.** The three world atlases still declare no gutter, which `pipeline-invariants`
  reports. That is goal 14, not this one.
- **The `brometal/town-study` twin** shipped byte-identical copies of twelve of these shaders and is
  now diverged, because it is a fifth demo goal 05 does not name. Nothing is broken by that — it
  compiles its own copies — but the two are no longer the same shaders.
