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
