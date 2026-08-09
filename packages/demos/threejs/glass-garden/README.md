# Glass Garden

A pure Three.js bioluminescent conservatory of transmission crystals, metallic stems, moving
practical lights, and a noise-sculpted landscape. A restrained bloom pass turns each animated
crystal core into a strong motion focal point without flattening the terrain detail.

```sh
npm run antiky -- dev --project packages/demos/threejs/glass-garden/glass-garden.antiky
```

Studio hosts this module and exposes its lifecycle and measurements without an Antiky Framework or
BroMetal dependency.

## Technique provenance

The terrain generation adapts the height-field technique from the official Three.js r185
[`webgl_geometry_terrain_raycast`](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_geometry_terrain_raycast.html)
example. Its PMREM-lit glass follows the physical material setup in
[`webgl_materials_physical_transmission`](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_materials_physical_transmission.html),
while the post-processing chain follows the official
[`webgl_postprocessing_unreal_bloom`](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_postprocessing_unreal_bloom.html)
example with `EffectComposer`, `RenderPass`, `UnrealBloomPass`, and `OutputPass`. Three.js and its
examples are distributed under the [MIT license](https://github.com/mrdoob/three.js/blob/r185/LICENSE).
