# Orbital Atlas

A pure Three.js kinetic solar sculpture. Nested groups model orbital hierarchy while physical
materials, a point-light sun, a 720-shard animated instance field, and a deterministic star field
create a dense scene with visible motion from the first frame.

```sh
npm run antiky -- dev --project packages/demos/threejs/orbital-atlas/orbital-atlas.antiky
```

Studio hosts this module and exposes its lifecycle and measurements without an Antiky Framework or
BroMetal dependency.

## Technique provenance

The animated shard field adapts the dynamic `InstancedMesh` update pattern from the official
Three.js r185 [`webgl_instancing_dynamic`](https://github.com/mrdoob/three.js/blob/r185/examples/webgl_instancing_dynamic.html)
example: instance matrices use `DynamicDrawUsage`, are rewritten each frame, and upload in one
instanced draw. Three.js and its examples are distributed under the
[MIT license](https://github.com/mrdoob/three.js/blob/r185/LICENSE).
