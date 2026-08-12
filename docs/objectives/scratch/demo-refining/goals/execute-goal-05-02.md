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

### A preliminary sample of the atlas, which may sink this item entirely

Sampling the Kenney platformer atlas (512x512, embedded in the GLBs) at each distinct V, using the
first U seen with that V, returns a **smooth monotonic gradient** rather than discrete swatches:

```
0.275 rgb 61,63,75    0.324 rgb 66,69,81    0.410 rgb 75,78,92
0.300 rgb 63,66,78    0.340 rgb 67,70,83    0.425 rgb 76,80,94
0.307 rgb 64,67,79    0.375 rgb 71,74,88    0.450 rgb 79,82,97
```

Every step is one or two units brighter than the last, in the same hue. **If that holds, V is not
carrying material identity at all — it is carrying a continuous shade position**, and "route material
IDs into the V channel" is the wrong model for this kit. You would be quantising a gradient into
bands that mean nothing.

**Verify before building anything.** Two things could make this sample misleading: the U taken is
simply the first one seen with that V and may not be representative, and the sampled region may be a
background area rather than the palette. Open the atlas, look at it, and sample a proper grid before
concluding. But do that *first* — the whole item rests on the answer, and the goal's model of this
kit has already been wrong once.

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
