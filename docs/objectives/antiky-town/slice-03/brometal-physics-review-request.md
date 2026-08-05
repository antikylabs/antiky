# Request for BroMetal Input: Physics Authority and GPU Residency

## Context

Antiky is a WebGPU game framework that uses BroMetal for GPU work. Its `EngineSession` owns fixed
simulation steps and can run in a browser, a headless test, or a future server process.

We are about to move a tested kinematic character motor into the reusable framework. The motor
calculates movement, grounding, slopes, steps, walls, and collision contacts. Those results affect
gameplay, inspection, and future online authority.

We want to make the right long-term CPU and GPU decision before publishing this framework boundary.

## Proposed direction

We think physics authority and execution location are separate decisions:

- A local or offline game is authoritative in its local session host.
- A shared online or PvP game is authoritative in its server session.
- Synchronous gameplay physics starts with a portable CPU implementation so it can run in browsers,
  headless tests, client prediction, and servers.
- GPU-resident physics is preferred when its state and the systems that consume it can remain on the
  GPU.
- Presentation physics such as particles, cloth, debris, and visual crowds should run on the GPU
  when practical.
- Normal gameplay should not require a CPU-to-GPU-to-CPU round trip during every fixed step.

The important distinction is that moving isolated physics math to the GPU may not help when
TypeScript gameplay code needs the result immediately for collision, damage, triggers, artificial
intelligence, or inspection. That would require asynchronous GPU readback. Moving a complete
workload and its consumers to the GPU can avoid that problem.

## Slice 03 decision

For the current character motor, we plan to:

- Ship a synchronous CPU gameplay-movement implementation.
- Keep BroMetal and WebGPU types out of its public contract.
- Keep the game-specific collision adapter private.
- Publish a completed actor snapshot at an explicit simulation boundary.
- Treat this as one reusable gameplay-physics path, not Antiky's universal physics system.
- Leave GPU-resident physics as a separate pipeline instead of pretending CPU and GPU physics can
  implement the same synchronous interface.

A local game could later choose GPU-authoritative simulation, but it would need an explicit
asynchronous snapshot boundary for CPU inspection, saves, and CPU-side game logic. Online gameplay
would remain server-authoritative even if a future server used GPU acceleration internally.

## Questions

1. Does this division align with BroMetal's philosophy and intended use?
2. Are we drawing the boundary between BroMetal and gameplay simulation in the right place?
3. What BroMetal patterns would you recommend for physics state that remains GPU-resident across
   compute and render work?
4. If a game needs occasional CPU snapshots of GPU-resident state, what synchronization or readback
   pattern would you recommend?
5. Are there useful GPU physics workloads we are overlooking that can avoid per-step readback?
6. Which assumptions here would you change before we record the architecture decision?

