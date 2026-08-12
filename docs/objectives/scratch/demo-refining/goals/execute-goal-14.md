# Execute goal 14: stop texture atlases bleeding across their tiles

## Prerequisites

- **Goal 04** — `pipeline-invariants.test.mjs` carries the tile boundary measurement this goal has to turn
  green, and the shared `asset-fidelity-policy.mjs` is where an atlas rule belongs.
- Nothing else. This goal owns `packages/demos/antiky/antiky-town/assets/textures/**`,
  `assets/sprites/**`, a new atlas tool under `packages/demos/scripts/`, and the atlas-addressing
  lines of the town shaders. No other goal owns those.

## `/goal` objective

An atlas packs many textures into one image. The GPU shrinks that image to draw distant surfaces,
and shrinking averages neighbouring pixels — so near a tile's edge it averages in **the tile next
door**. Stone picks up the grass beside it in the file and shows a wrong-coloured fringe.

Give the repository one way to build and address atlases that cannot do that, and prove it with a
measurement rather than by looking.

## The measured state today

Not a suspicion. `pipeline-invariants.test.mjs` samples across a tile boundary at mip levels 2, 3 and 4
and reports **25.3% of samples taken across a tile boundary come out a colour that is in neither of the two tiles**.
Painting one neighbouring tile solid magenta drives that to 73.3%, so the measurement discriminates.

Three facts make it worse than a tuning problem:

- **There is no padding.** `town-material-atlas-v1.json` declares no gutter and the shader addresses
  tiles as `(column + uv) / 4` with no inset, so a sample at the tile edge sits exactly on the boundary.
- **The grid does not land on pixels.** 1254 / 4 = **313.5**. The boundary falls *between* texels
  313 and 314, so even a half-texel inset cannot be expressed exactly.
- **The tiles are not power-of-two.** 313.5 x 418 means every mip level rounds differently and the
  tile boundary drifts as the chain descends.

## What is and is not available

**Texture arrays would delete this problem** — one tile per layer, mips built per layer, bleeding
impossible by construction. **BroMetal does not have them.** Its DSL exposes `sampler2D` and
`sampler3D` only, and the runtime has no array layer in `TextureOptions`
(`node_modules/brometal/dist/runtime/texture.d.ts`). Verified before this goal was written; do not
plan around it.

`sampler3D` is **not** a substitute. A 3D texture's mips blend along Z as well, so slices would
average into each other — the same defect by a different route.

**Mip clamping is also unavailable.** `TextureOptions` exposes `wrap`, `filter` and `anisotropy` and
nothing else, so a mip chain cannot be capped.

That leaves **padding with edge extrusion, plus a tile-clamped sample**, which is the fix this goal
builds. The texture-array gap belongs upstream — see the non-goals.

## Required outcome

1. **An atlas tool** at `packages/demos/scripts/build-texture-atlas.mjs` that takes a source image
   and its tile map and emits a padded atlas plus an updated JSON companion. It must:
   - slice on the declared grid;
   - **extrude** each tile's edge pixels outward into the gutter rather than filling it with
     transparent or black, because a mip average must find more of the same material, not a hole;
   - lay tiles at power-of-two sizes so the mip chain stays aligned as it descends;
   - write each tile's **inner rectangle** into the JSON in normalised coordinates, so the shader
     addresses the safe region rather than recomputing it from a grid assumption;
   - be deterministic — same input, same bytes — and record its input hash in the JSON.
2. **Gutter wide enough for the mip levels these surfaces actually reach.** Derive it, do not guess:
   a texel at mip N averages 2^N source texels, so a tile clean to mip N needs at least 2^N pixels of
   extrusion. State the deepest mip a town surface selects at its far plane and size the gutter from
   that.
3. **The three world atlases rebuilt** — material, prop, vegetation — with their JSON companions
   updated and their `imageSha256` receipts regenerated.
4. **The shaders addressing the inner rectangle.** `town-voxel`, `town-awning`, `town-prop` and
   `town-foliage` currently compute `(column + uv) / 4`. They must read the tile rect from a uniform
   or an instance attribute instead, so a change to the atlas layout cannot silently desynchronise
   from the shader that samples it.
5. **The tile-boundary check green** on all three atlases, promoted from one hard-coded file to a loop
   over every atlas the demo ships.
6. **A rule in `asset-fidelity-policy.mjs`** so a future atlas cannot arrive without a gutter, in the
   same shape as the existing attribute and material-map rules.
7. **The actor sprite atlas assessed, and left alone unless the measurement says otherwise.** It
   loads `filter: 'nearest'` with no anisotropy and no mips, so it is not currently at risk. Record
   the measurement. **Do not add mips to it.**

## In scope

- The tool, the three rebuilt world atlases, the shader addressing change, the policy rule, and the
  generalised tile boundary test.
- A short note in the tool's header on why extrusion rather than a transparent gutter, because the
  next person to build an atlas will otherwise reach for the obvious wrong thing.

## Required tests and evidence

- **The tile-boundary test, generalised**, running over every atlas in `assets/textures/` rather than one
  named file, at mip levels 2 through 5. It must fail if any atlas loses its gutter — prove that by
  rebuilding one atlas with zero padding and watching it go red.
- **A tool test with a synthetic atlas**: two tiles of known, deliberately distant colours. Assert
  the gutter contains the extruded edge colour rather than black or transparent, that the inner
  rectangle in the JSON addresses only the original pixels, and that a mip-4 average taken across
  the tile boundary stays inside one tile's gamut.
- **Determinism**: running the tool twice on the same input produces byte-identical output.
- **A capture before and after** for `antiky-town`, with the mid-tone and local-contrast numbers
  stated. The fix should not move them much; a large move means the addressing change was wrong
  rather than the padding working.
- **Look at a tile boundary at distance in both captures.** This goal's whole subject is a visible
  fringe, and a measurement that never gets looked at is how the previous atlas result was wrong.
- `npm test` green. `npm run demos:verify` reports its state with every remaining failure explained.

## Explicit non-goals

- **Do not re-author the atlas art.** The three atlases are generated images with no generator
  script (`provenance.generator` records the image model). This goal re-lays existing pixels; it
  does not paint new ones.
- **Do not add mips or anisotropy to the sprite atlas.** Pixel art wants neither, and goal 04
  already reverted an sRGB decode on it for a related reason.
- **Do not build a general texture-packing framework.** Three atlases with one layout is not a
  packing problem.
- **Do not patch BroMetal for texture arrays in this goal.** Record it as an upstream request with
  the measurement attached, following `docs/objectives/ideas/skill-text.md`. It is the right
  long-term answer and it is a separate piece of work with its own review.

## Engineering constraints

- Tests are required for code changes (`AGENTS.md`).
- Short one-line commit messages. No coauthor tags.
- Preserve unrelated dirty worktree changes.
- Asset receipts carry hashes; regenerate them rather than editing them by hand.

## Completion definition

Complete when the three world atlases carry a derived gutter, the shaders address the inner
rectangle, the generalised tile boundary test is green and proven to fail without padding, the sprite atlas
has a recorded measurement and no changes, and a fresh `antiky-town` capture has been looked at
against the previous one.

## Why this will come back

The owner's instinct when this was found: *"I have a feeling this will pop back up on sprite sheets
and sprite maps."* That is correct and worth writing down.

Every atlas has this property. It stays hidden while a texture is drawn at or near its authored size
with `nearest` filtering, and appears the moment anything is minified, mipped, filtered or rotated —
which is exactly what happens when a 2D game adds a zoom-out, a parallax layer, or a rotating
sprite. The sprite atlas is safe **today** because of how it happens to be sampled, not because it
is built correctly.

So the deliverable that outlives this goal is not the three rebuilt atlases. It is the tool and the
measurement: a way to build an atlas that cannot bleed, and a test that says so.
