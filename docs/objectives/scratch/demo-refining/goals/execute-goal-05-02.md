# Execute goal 05-02: material identity for the palette kits

Part 2 of 4 of what remains in [goal 05](execute-goal-05.md). Covers **item 7**, and serves
**AC-M2**.

## `/goal` objective

The Kenney and Quaternius kits ship one palette image per model and address it with a single UV
coordinate, so every face of a model is the same material. A crate, its metal banding and its rope
are all "the crate colour". Route a material identity through the UV-V channel so a shader can tell
them apart.

## The measured state

- Every Kenney GLB has a single V value.
- `normalize-quaternius.mjs:267` writes `v = 0.5` universally, so the platformer models fail harder.

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
