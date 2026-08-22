# Antiky Framework demos

The four demo workspaces sit directly under this directory. Each project uses Antiky Framework for
simulation or authoring state and BroMetal for rendering. Open its `.antiky` manifest in Studio to
run the same portable game module that the website stages.

- **Antiky Town** - a walkable voxel town with Framework-owned lamp authoring.
- **Combat Arena** - a compact action loop with Framework-owned combat state.
- **Point Light Expo** - a focused gallery for editable practical lights and custom shaders.
- **Traversal Study** - a deterministic platform course with checkpoints and hazards.

Run a project from the repository root:

```bash
npm run dev -- demos antiky-town
npm run dev -- demos combat-arena
npm run dev -- demos point-light-expo
npm run dev -- demos traversal-study
```

## Asset scripts

The demos commit generated textures, material tables, lighting data, and licensed source assets so a
normal build does not download or regenerate art. The root npm commands below are the maintained
operator boundary. Commands that require arguments forward everything after `--` to the script.

| Script | Named command and operator | Output | Verification |
| --- | --- | --- | --- |
| `scripts/bake/sh9-irradiance.mjs` | `npm run demos:assets:bake-sh9 -- --slug <hdri> --demo <slug> --name <prefix>` | `<demo>/src/sh9-irradiance.gen.ts` | target demo typecheck and shader/material tests |
| `scripts/bake/vertex-occlusion.mjs` | `npm run demos:assets:bake-vertex-occlusion -- <input.glb> <output.gen.ts>` | requested deterministic TypeScript table | `node --test packages/demos/tests/vertex-occlusion.test.mjs` |
| `scripts/build/detail-normal.mjs` | `npm run demos:assets:build-detail-normal` | identical detail-normal texture and receipt in all four demos | `packages/demos/tests/pipeline-invariants.test.mjs` |
| `scripts/build/kit-materials.mjs` | `npm run demos:assets:build-kit-materials -- <kit-dir> <demo> <NAME>` | `<demo>/src/kit-materials.gen.ts` | `packages/demos/tests/material/invariants.test.mjs` |
| `scripts/build/lighting-ramp.mjs` | `npm run demos:assets:build-lighting-ramp` | `traversal-study/src/lighting-ramp.gen.ts` | `packages/demos/tests/material/invariants.test.mjs` |
| `scripts/build/texture-atlas.mjs` | `npm run demos:assets:build-texture-atlas -- --padded <descriptor.json>` | padded atlas or layer directory and descriptor | `packages/demos/tests/build-texture-atlas.test.mjs` |
| `scripts/build/vfx-billboard.mjs` | `npm run demos:assets:build-vfx-billboard` | VFX texture in Combat Arena, Point Light Expo, and Traversal Study | `packages/demos/tests/pipeline-invariants.test.mjs` |
| `scripts/embed-glb-images.mjs` | `npm run demos:assets:embed-glb-images -- <texture-dir> <model.glb> [...]` | target GLBs with external images embedded | demo asset and build tests |
| `scripts/install/kenney-kit.mjs` | `npm run demos:assets:install-kenney -- --slug <kit> --demo <demo> --models <names>` | selected verified GLBs and `antiky-assets.json` receipt | demo asset and material tests |
| `scripts/install/nasa-imagery.mjs` | `npm run demos:assets:install-nasa` | bounded Combat Arena imagery and receipt | Combat Arena build and asset tests |
| `scripts/install/poly-haven-material.mjs` | `npm run demos:assets:install-poly-haven -- --slug <material> --demo <demo>` | verified maps and provenance receipt | demo asset and material tests |

`scripts/asset-fidelity-policy.mjs` is not an operator command. Installers, packers, and invariant
tests import it directly; it is the shared checked policy for required mesh attributes, material
maps, and atlas gutters.

Run the maintained cross-demo checks after changing paths, generators, or committed outputs:

```bash
npm run demos:verify
node --test packages/demos/tests/build-texture-atlas.test.mjs \
  packages/demos/tests/dev-host.test.mjs \
  packages/demos/tests/shader/output-parity.test.mjs \
  packages/demos/tests/vertex-occlusion.test.mjs
```
