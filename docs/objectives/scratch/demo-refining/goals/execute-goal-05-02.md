# Execute goal 05-02: material identity for the palette kits

Part 2 of 4 of what remains in [goal 05](execute-goal-05.md). Covers **item 7**, and serves
**AC-M2**.

## `/goal` objective

The Kenney and Quaternius kits ship one palette image per model and address it with a single UV
coordinate, so every face of a model is the same material. A crate, its metal banding and its rope
are all "the crate colour". Route a material identity through the UV-V channel so a shader can tell
them apart.

## The measured state — **the goal's version of this was wrong, measured against the shipped assets**

| model | distinct V | note |
| --- | --- | --- |
| `block-grass-large.glb` (Kenney platformer) | **3** | 168 verts, 2 distinct U |
| `room-small.glb` (Kenney modular-space) | **30** | 8,184 verts, 14 distinct U |
| `spitfire-blue.glb` (Quaternius ships) | **1,217** | a real unwrap over a 2048² albedo |
| `courier.glb` (Quaternius platformer) | **1** | `v = 0.5`, and a **91-byte** image |

Goal 05 says "every Kenney GLB would fail (single V)". It would not. **Kenney's palette atlas already
addresses different swatches by different V** — that is how the kit works, and the routing this item
was going to build is largely already in the art.

So AC-M2's first half — "at least two distinct V values" — **already passes for three of these
four**. The one that genuinely fails is `courier.glb`, and it fails for the reason goal 04 was
written about: `normalize-quaternius.mjs` flattened it to a single V against a 91-byte image.

**What is actually missing is the second half: the LUT.** Nothing declares what a given V *means*
materially. `0.525` selects a green swatch and `0.725` a grey one, and no code anywhere says the
first is grass and the second stone, or what roughness either should have.

That makes this item much smaller than written, and differently shaped:

- **Do not rewrite the Kenney GLBs.** Their V channel is already carrying identity. Read it.
- **Do declare a LUT** mapping V ranges to material properties, per kit, and have the model shaders
  look up roughness and whatever else they consume from it rather than applying one set per mesh.
- **`courier.glb` and its siblings are the real asset problem**, and they belong with goal 04's
  concerns rather than this one: a 91-byte texture is not something a LUT can rescue. Decide whether
  to re-pack them from source or accept them as flat-shaded, and record which.
- **Leave the Quaternius ships alone.** 1,217 distinct V over a 2048² albedo is authored work.

## The V distribution, measured across each whole kit

| kit | distinct V | range | first values |
| --- | --- | --- | --- |
| Kenney platformer (`traversal-study`) | **50** | 0.275 – 0.975 | 0.275 0.300 0.307 0.316 0.324 0.325 0.331 0.340 0.349 0.375 |
| Kenney modular-space (`combat-arena`) | **33** | 0.005 – 0.975 | 0.005 0.065 0.068 0.077 0.091 0.110 0.132 0.155 0.245 0.525 |

They cluster: tight groups (0.307–0.340) separated by gaps, which is a palette atlas addressed by
row. The identity is real and it is already there.

### The atlas, looked at

It is a **grid of flat colour swatches** — roughly sixteen columns by four rows of saturated brights,
pastels, greys, browns, greens and pinks, each swatch a solid colour with a slight vertical shade
gradient. **V selects a row, U selects the swatch within that row.**

A first pass at this sampled the atlas using the first U seen with each V and read back a smooth
monotonic gradient, which suggested V was carrying a continuous shade rather than an identity. That
was wrong, and the way it was wrong is worth recording: the U it happened to pick was 0.969 — the
far-right column, which is black in one row and near-grey in others — so it sampled a single column
down the atlas and quite reasonably found a gradient. **Sample a grid, not a line.**

### What that means for this item

The identity is two-dimensional. V does select a row and the rows are coherent — brights, pastels,
neutrals, mixed — but they are organised by **colour family, not by material**. Nothing in the atlas
says a swatch is metal or cloth; it is a palette.

So a LUT mapping V to roughness is not *derived* from the art, it is **authored on top of it**: a
person decides that the brown row reads as wood and should be rough. That is a legitimate thing to
do and it is what this item has to be, but it should be written down as an art decision rather than
presented as reading identity the kit already carries. The kit carries colour identity. Material
identity is being added.

Which also means the honest unit of work is per *swatch*, not per V band — and that a shader wanting
roughness needs both U and V, not just V. Goal 05's framing of "route material IDs into the UV-V
channel" assumes a one-dimensional identity the art does not have.

**What the LUT cannot be derived from is this table.** Knowing that a row sits at V≈0.32 does not say
whether it is grass, metal or cloth — that needs someone to open
`assets/kenney/*/…` alongside these numbers and name each row. That is an art judgement and it is the
first task of this step, not a detail of it. Do not infer material properties from V ordering; the
rows are laid out by hue, not by roughness.

A workable shape once the rows are named:

- A LUT constant per kit, mapping a V band to `{ name, roughness, metalness }`.
- **A test that every observed V falls inside a declared band** — that is AC-M2's second half, and it
  is what stops the LUT silently drifting from the art. The measurement above is reproducible: parse
  every GLB in the kit and collect `TEXCOORD_0`'s V channel.
- The model shaders reading roughness from the band rather than applying one value per mesh.

## What has landed

- **`packages/demos/scripts/build-kit-materials.mjs`** samples the atlas embedded in the kit's own
  GLBs on a 16x4 grid and emits `src/kit-materials.gen.ts` — 64 swatches, 46 in use, each with its
  measured colour and an assigned roughness.
- **The roughness rule lives in one function**, `roughnessFor`, and is stated rather than implied: a
  saturated bright reads as painted or moulded and takes a tighter highlight; a desaturated or dark
  swatch reads as stone, bark or worn metal and scatters. Disagree with it there, in one place,
  instead of editing generated numbers.
- **AC-M2 is green**, in the two-dimensional shape the art actually has: every UV emitted by every
  model in the platformer kit lands on a declared swatch, and every mesh carries at least two
  distinct V values.

**Still to do:** the shaders reading it. `traversal-model` and `arena-model` still apply one
roughness per mesh. The lookup needs both UV components — `row = floor(v * 4)`,
`column = floor(u * 16)` — and the same table generated for the modular-space kit.

## Required outcome

1. **An asset step that assigns material IDs** and writes them into `TEXCOORD_0`'s V channel for the
   kit models the two demos use.
2. **A LUT constant** naming what each ID means — roughness, metalness, and whatever else the demo's
   shader consumes — so an ID is a decision written down rather than a magic number.
3. **The shaders reading it.** `traversal-model` and `arena-model` look up material properties by V
   rather than applying one set to a whole mesh.
4. **`antiky-town` exempt**, and the record says so: its atlas already carries per-face material
   identity by design.

## Required tests and evidence

- **AC-M2**: for every kit GLB processed, the emitted `TEXCOORD_0` contains at least two distinct V
  values, and every V maps to a declared ID in the LUT. This is a unit test on the asset step.
- **Determinism**: the step run twice on the same input produces byte-identical output.
- **Nothing is destroyed.** Goal 04 exists because `normalize-quaternius.mjs` flattened authored UV
  information. Assert the U channel is unchanged and that the models still render.
- A capture per demo, looked at. `npm test` green.

## Explicit non-goals

- Do not re-UV anything in Blender.
- Do not invent materials the demo does not use. Two or three IDs that mean something beat eight that
  do not.
