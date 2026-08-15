# Execute goal 14: give Antiky a way to build and check texture atlases

## Prerequisites

- **Goal 04** — `pipeline-invariants.test.mjs` carries the tile-boundary measurement this goal
  generalises, and `packages/demos/scripts/asset-fidelity-policy.mjs` is where an atlas rule belongs.
- **Not** [goal 15](execute-goal-15.md). That goal adds array textures to BroMetal, which is the
  better long-term answer. This goal is deliberately built so it serves either renderer: it slices
  and describes, and the output format follows what the renderer can consume.

## `/goal` objective

An atlas packs many textures into one image. The GPU shrinks that image to draw distant surfaces,
and shrinking averages neighbouring pixels — so near a tile's edge it averages in **the tile next
door**. Stone picks up the grass beside it in the file and shows a wrong-coloured fringe.

Give Antiky one way to build an atlas that does not do that, and one measurement that proves it.

## Where the line sits between this goal and BroMetal

The owner's question, settled: **is this a BroMetal thing or a game-engine thing?** Both, split on a
rule worth keeping.

> If WebGPU can do it and BroMetal does not expose it, it is a BroMetal gap.
> If it is about how assets are authored, packed, verified or shipped, it is Antiky.

| Piece | Owner |
| --- | --- |
| Array textures, mip-level clamping | **BroMetal** — [goal 15](execute-goal-15.md) |
| Slicing an authored image into tiles or layers | **Antiky** — this goal |
| The JSON companion that describes the layout | **Antiky** — this goal |
| The tile-boundary measurement | **Antiky** — this goal |
| How one shader addresses its atlas | The demo that owns the shader |

BroMetal has no asset pipeline and should not grow one. Antiky already has the CLI, the asset
receipts and the frame measurements, so this is where it goes.

## The measured state today

**A correction first, because this goal was originally written around a number that was wrong.**
The measurement said "25.3% of samples taken across a tile boundary come out a colour in neither
tile". That is a statement about *palette overlap*, not about bleeding, and an audit showed it
inverted: extruding each tile's edge — the fix this goal proposes — moved it from 25.3% to **31.8%**,
and the only thing that reached zero was flattening every tile to one colour. It also excluded a
6-pixel border from the colours it compared against, which inflated it roughly threefold, and
sampled only one tile row of three.

That test has been replaced by a structural one, and the honest measurement is this: mip a tile
inside the atlas, mip the same tile in isolation, and compare their borders. The isolated tile is
ground truth because it has no neighbour to bleed from.

| atlas | mean border error | worst |
| --- | --- | --- |
| as shipped | **15.1 / 255** | 124 |
| with a crude extruded gutter | 14.4 / 255 | 129 |

Padding now moves the number the right way, which is the minimum a measurement of bleeding must do.
A worst-case border error of 124 out of 255 is half the range on some tile edge.

The three facts that make it structural rather than a tuning problem:

- **There is no padding.** `town-material-atlas-v1.json` declares no gutter and the shader addresses
  tiles as `(column + uv) / 4` with no inset, so a sample at a tile's edge sits exactly on the
  boundary.
- **The grid does not land on pixels.** 1254 / 4 = **313.5**, so the boundary falls *between* texels
  313 and 314 and even a half-texel inset cannot be expressed exactly.
- **The tiles are not power-of-two.** 313.5 x 418 means each mip level rounds differently and the
  boundary moves as the chain descends.

## Required outcome

1. **An atlas tool** at `packages/demos/scripts/build-texture-atlas.mjs` whose core job is
   **slicing**: read a source image and a tile map, and produce one clean tile per entry. Slicing is
   what both renderer routes need — padded tiles today, array layers once goal 15 lands — so it is
   the part built to last.
2. **Two emit modes over that one slicer:**
   - `--layers`, writing each tile as its own image plus a manifest. This is the shape goal 15
     consumes, and it is the mode that makes bleeding impossible rather than merely unlikely.
   - `--padded`, re-laying tiles into a single atlas at power-of-two sizes with a gutter, and
     **extruding** each tile's edge pixels into that gutter rather than filling it with transparent
     or black — a mip average must find more of the same material, not a hole. This is the mode that
     works against BroMetal as it is today.
3. **A gutter width derived, not guessed.** A texel at mip N averages 2^N source texels, so a tile
   clean to mip N needs at least 2^N pixels of extrusion. State the deepest mip a town surface
   selects at its far plane and size the gutter from that.
4. **A JSON companion that describes the layout** rather than implying it: each tile's inner
   rectangle in normalised coordinates, the gutter width, the emit mode, and a hash of the input
   image. The shader must be able to address a tile without recomputing a grid assumption.
5. **The three world atlases rebuilt** in `--padded` mode — material, prop, vegetation — with their
   JSON companions and `imageSha256` receipts regenerated.
6. **The four town shaders addressing the inner rectangle.** `town-voxel`, `town-awning`,
   `town-prop` and `town-foliage` compute `(column + uv) / 4` today. They must read the tile rect
   from the layout instead, so a change to the atlas cannot silently desynchronise from the shader.
7. **The structural invariant green on all three atlases** — each declaring a gutter and publishing
   per-tile rectangles. `pipeline-invariants.test.mjs` already reports exactly what each atlas is
   missing, with its grid arithmetic, so the work is enumerated before it starts.
8. **A rule in `asset-fidelity-policy.mjs`** so a future atlas cannot arrive without a declared
   gutter, in the same shape as the existing attribute and material-map rules.
9. **The actor sprite atlas measured and left alone.** It loads `filter: 'nearest'` with no
   anisotropy and no mips, so it is not at risk today. Record the number. **Do not add mips to it.**

## In scope

- The tool, its two emit modes, the three rebuilt atlases, the shader addressing change, the policy
  rule, and the generalised measurement.
- A note in the tool's header on why extrusion rather than a transparent gutter, because the next
  person will otherwise reach for the obvious wrong thing.

## Required tests and evidence

- **The structural invariant green**, and proven able to fail: rebuild one atlas with a zero gutter
  and watch it go red.
- **The border-error measurement reported before and after**, using the isolated-tile comparison
  above. It must go **down**. A measurement of bleeding that does not improve when you add padding
  is measuring something else, which is exactly how the first version of this goal went wrong.
- **A slicer test on a synthetic atlas** of two deliberately distant colours. Assert the gutter holds
  the extruded edge colour rather than black or transparent, that the inner rectangle addresses only
  original pixels, and that a mip-4 average taken across the boundary stays inside one tile's gamut.
- **Both emit modes tested.** `--layers` must produce one image per tile with no gutter and no
  cross-tile pixels at all — that is the mode goal 15 will consume, and it should be correct before
  anything depends on it.
- **Determinism**: the tool run twice on the same input produces byte-identical output.
- **A capture before and after** for `antiky-town` with the mid-tone and local-contrast numbers
  stated. The fix should barely move them; a large move means the addressing change was wrong rather
  than the padding working.
- **Look at a tile boundary at distance in both captures.** This goal's whole subject is a visible
  fringe, and the previous atlas result was wrong precisely because nobody looked.
- `npm test` green. `npm run demos:verify` reports its state with every remaining failure explained.

## Explicit non-goals

- **Do not re-author the atlas art.** The three atlases are generated images with no generator
  script (`provenance.generator` records the image model). This goal re-lays existing pixels.
- **Do not add mips or anisotropy to the sprite atlas.** Pixel art wants neither, and goal 04 already
  reverted an sRGB decode on it for a related reason.
- **Do not patch BroMetal here.** That is goal 15, with its own review.
- **Do not build a general texture-packing framework.** Three atlases with one layout is not a
  packing problem, and `GOOD_ENGINEERING_H.md` is direct about abstracting early.

## Engineering constraints

- Tests are required for code changes (`AGENTS.md`).
- Short one-line commit messages. No coauthor tags.
- Preserve unrelated dirty worktree changes.
- Asset receipts carry hashes; regenerate them rather than editing them by hand.

## Completion definition

Complete when the slicer emits both modes with tests, the three world atlases carry a derived gutter,
the shaders address the inner rectangle, the generalised measurement is green and proven to fail
without a gutter, the sprite atlas has a recorded number and no changes, and a fresh `antiky-town`
capture has been looked at beside the previous one.

## Why this outlives the three atlases

The owner's instinct when this was found: *"I have a feeling this will pop back up on sprite sheets
and sprite maps."* That is correct and worth writing down.

Every atlas has this property. It stays hidden while a texture is drawn at roughly its authored size
with `nearest` filtering, and appears the moment anything is minified, mipped, filtered or rotated —
which is exactly what happens when a 2D game adds a zoom-out, a parallax layer, or a rotating sprite.
The actor atlas is safe **today** because of how it happens to be sampled, not because it was built
correctly.

So the lasting deliverable is not three rebuilt atlases. It is a slicer and a measurement: a way to
build an atlas that cannot bleed, and a check that says whether it does.
