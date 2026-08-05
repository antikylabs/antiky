# Demo Source Layout

Each demo owns one folder under this directory. A demo keeps its entry point, private helpers,
tests, and shaders together.

Code that two or more demos use belongs in [`../shared/`](../shared/). The shared runtime and React
host remain directly under [`../`](../).

## Demos

| Folder | Purpose | Public route |
| --- | --- | --- |
| [`antiky-town/`](antiky-town/) | Town composition with framework-owned point-light authoring | `antiky-town` |
| [`brometal-town/`](brometal-town/) | Existing town written directly with BroMetal and TypeScript | `town-study` |
| [`shader-study/`](shader-study/) | Typed shader compilation study | `shader-study` |
| [`instance-storm/`](instance-storm/) | Internal instance rendering study | Not registered |
| [`sprite-depth/`](sprite-depth/) | Internal sprite depth study | Not registered |
| [`voxel-forge/`](voxel-forge/) | Internal voxel compilation study | Not registered |

Do not import private code from another demo. Move a proven shared capability to `shared` or the
framework instead.
