# BroMetal Town

This folder contains the existing Town Study implementation. It uses BroMetal and TypeScript
directly. The public route remains `town-study`.

This demo is the visual, behavior, and performance reference for the planned Antiky Framework port
in [`../antiky-town/`](../antiky-town/).

Keep this implementation working while the port advances. Do not make it depend on the new port.
Shared assets can remain shared, but framework behavior must prove itself in `antiky-town` first.

`createTownGameFactory` accepts one optional slot-zero base-power source. With no source, including
the `town-study` route, all authored practical-light defaults and presentation flicker are unchanged.

The private `TownRuntime` seam separates CPU updates from one render call. `createTownGameFactory`
keeps the original Town Study timing adapter. Antiky Town uses `createTownRuntimeFactory` through
its own private fixed-step host. The seam does not move Town state or BroMetal types into Framework.
