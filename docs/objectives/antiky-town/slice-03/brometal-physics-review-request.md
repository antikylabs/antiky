# Physics Authority and CPU/GPU Execution

The current recommendation is too blunt because it treats “authoritative” and “runs on the CPU” as
the same decision.

My recommendation is:

> Decide the physics architecture now, but implement only the physics path Slice 03 actually needs.

Authority and execution location are separate:

| Situation | Authority | Likely execution |
| --- | --- | --- |
| PvP or shared online world | Server `EngineSession` | CPU initially |
| Client prediction for PvP | Not authoritative | Usually CPU using compatible movement logic |
| Offline or local game | Local `EngineSession` | CPU or GPU, depending on the workload |
| Particles, cloth, debris, or visual crowds | Presentation only | GPU whenever practical |
| Gameplay collision inspected every step | Local or server host | CPU unless the dependent gameplay also lives on the GPU |

The important GPU rule should be:

> Push a physics workload to the GPU when its state and its consumers can remain on the GPU.

Pushing isolated math to the GPU is not automatically beneficial. If TypeScript gameplay code
needs the answer during the same fixed step—for collision, damage, grounding, triggers, artificial
intelligence, or inspection—we must send the result back to the CPU. WebGPU readback is
asynchronous and would create exactly the round trip BroMetal is trying to avoid.

For Slice 03, the character motor affects authoritative position, collision, non-player character
behavior, inspection, headless tests, and future server simulation. A CPU implementation is
therefore a genuinely reusable framework component, not Town-specific work. It can serve:

- Browser games
- Headless testing
- Server simulation
- Client prediction
- Studio and Model Context Protocol inspection

What we should avoid is presenting that motor as Antiky's universal physics architecture.

I would revise the Architecture Decision Record around three principles:

1. Physics authority belongs to the session host.

   A local game's client host may be authoritative. An online game's server host is authoritative.

2. Physics execution is selected by workload.

   Synchronous gameplay physics starts with a portable CPU implementation. GPU-resident physics is
   encouraged when its results can remain on the GPU.

3. Crossing the CPU/GPU boundary must be explicit.

   Do not use per-step GPU readback in the normal gameplay loop. A game that deliberately uses
   GPU-authoritative local simulation must accept an asynchronous snapshot boundary for saves,
   inspection, and CPU-side logic.

For implementation, I would pay these upfront costs now:

- Define the CPU character contract as a synchronous gameplay-collision contract, not a generic
  GPU/CPU backend.
- Keep BroMetal and WebGPU types out of that contract.
- Keep Town's collision-world adapter private.
- Mark completed snapshots as the boundary between authoritative state and its consumers.
- Leave room for a separate GPU-resident physics pipeline instead of pretending it can implement
  the same synchronous interface.
- Avoid building that GPU pipeline until a real workload proves what it needs.

The proposed answer to Slice 03 owner question 1 is:

> Accept a physics-authority ADR now, but change the proposed direction. Separate authority from
> execution location. Online gameplay is server-authoritative; local gameplay is authoritative in
> its local session host. Slice 03 provides a portable CPU character-movement implementation
> because its results feed synchronous gameplay, inspection, headless execution, and future server
> simulation. Antiky should prefer GPU-resident physics for presentation and client-local workloads
> whose state and consumers can remain on the GPU. Normal gameplay must not depend on per-step GPU
> readback.

This gives Antiky a long-term decision without forcing Slice 03 to prematurely build two physics
engines.
