# Antiky Town rendering

This folder is Antiky Town's private BroMetal renderer, simulation, physics, and shader source.
It is duplicated deliberately so this project builds without another demo or shared demo package.

`createTownRuntimeFactory` accepts one optional slot-zero base-power source. With no source, all
authored practical-light defaults and presentation flicker are unchanged.

The private `TownRuntime` seam separates CPU updates from one render call. Antiky Town uses
`createTownRuntimeFactory` through its own fixed-step host. The seam does not move Town state or
BroMetal types into Framework.
