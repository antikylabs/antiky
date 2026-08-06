# 0018: Select physics authority and physics execution independently

## Status

Accepted

## Context

Authoritative physics state is the physics state that Antiky accepts as correct. Physics authority
identifies the `EngineSession` that can accept authoritative physics state.

Physics execution identifies the device that calculates a physics result. A central processing unit
(CPU) and a graphics processing unit (GPU) are execution devices.

For an online game, a client cannot accept a physics result as authoritative game state.
[ADR 0012](0012-server-authoritative-simulation_H.md) gives this authority only to a server
`EngineSession`.

Some client physics results are only for graphics. Particles, cloth, debris, water, and secondary
animation are examples.

Some client code must use a physics result in the same simulation step. Camera rules, prediction,
inspection, and game logic are examples.

GPU readback copies GPU data to the CPU. GPU readback is asynchronous. The CPU receives readback
data in a subsequent simulation step.

GPU work can calculate physics state. Subsequent GPU work can use that state in the same simulation
step without GPU readback.

A GPU snapshot copies a specified quantity of GPU state for CPU use.

[ADR 0016](0016-give-platform-work-to-game-host_H.md) keeps GPU state nonauthoritative. In that
decision, usual simulation work does not wait for GPU readback.

Antiky must have one rule for physics authority and one rule for physics execution.

## Decision

For each world, one `EngineSession` will own physics authority. The execution device does not have
physics authority.

For an online game, only a server `EngineSession` can accept authoritative physics state.

A client will send inputs or intended actions. The client will not send a calculated physics result
as authoritative game state.

The server will calculate physics results. It will use game rules to calculate related game changes.

The server will accept these results as authoritative game state:

- Position
- Collision
- Damage
- Inventory changes
- Shared world changes.

A client can use server state and the explicit client inputs from
[ADR 0013](0013-explicit-simulation-inputs_H.md) to calculate temporary physics results. The client
can use these results for prediction or graphics.

A server result can correct or replace each client result.

Antiky will use GPU execution if only GPU work must use the physics state in that simulation step.
CPU code can use a subsequent GPU snapshot.

Antiky can use CPU execution if CPU code must use the result in the same simulation step.

A server will first use CPU execution. After tests identify a performance limit, the server can use
GPU execution.

For a local game, the local `EngineSession` can accept authoritative physics state. It can select CPU
or GPU execution for each physics workload.

Usual simulation work will not wait for GPU readback. Each readback request must identify the
snapshot and its data limit.

A GPU snapshot stays temporary. A different decision can add durable storage for the snapshot.

This decision does not change [ADR 0002](0002-event-sourcing_H.md). A GPU snapshot is not a durable
event.

This decision does not select a physics library, solver, or public application programming
interface (API).

## Consequences

- Online clients cannot set authoritative physics state.
- Client GPU work can keep temporary physics state on the GPU.
- Usual simulation work has no data round trips between the CPU and GPU.
- GPU work can use GPU-only physics state in the same simulation step.
- CPU code cannot read GPU-only physics state in the same simulation step.
- Client prediction can be different from server state.
- The client must correct an incorrect prediction.
- A headless server can use CPU physics without graphics support.
- GPU work on a server does not change server authority.
- Each physics workload must identify its result as authoritative or temporary.
- Each physics workload must identify the code that uses its result.
- Physics library selection can change without a change to this decision.

## Revision history

- `40991f9dd41f9e2b996c22f5875d77990ddd2c45` — Clarified same-step GPU use and GPU-to-CPU readback.
