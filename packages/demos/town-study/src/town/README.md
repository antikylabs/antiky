# Town Study rendering

This folder is Town Study's private BroMetal renderer, simulation, physics, and shader source.
It is duplicated deliberately so this project builds without another demo or shared demo package.

`createTownGameFactory` accepts one optional slot-zero base-power source. With no source, including
the `town-study` route, all authored practical-light defaults and presentation flicker are unchanged.

The private `TownRuntime` seam separates CPU updates from one render call. `createTownGameFactory`
keeps the original Town Study timing adapter without moving Town state or BroMetal types into
Framework.
