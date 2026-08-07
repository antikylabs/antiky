# Slice 03 Physics Architecture Addendum

## Status

This addendum controls Slice 03 planning after the acceptance of
[ADR 0019](../../../../adr/framework/0019-use-rapier-for-cpu-physics-and-nexus-for-gpu-physics_H.md)
and the owner answer to question 2.

Read this addendum with [`plan.md`](plan.md) and [`owner-input_H.md`](owner-input_H.md). Use this
addendum when the plan contains an older CPU assumption. This addendum does not answer a pending
owner question.

## Why the slice changed

The first Slice 03 plan selected CPU character simulation. It also proposed the current handwritten
character motor as a public Framework API.

The accepted ADRs and the owner answer now give different direction:

- [ADR 0018](../../../../adr/framework/0018-select-physics-authority-and-execution-independently_H.md)
  separates physics authority from the device that calculates physics.
- The local Antiky Town `EngineSession` can accept authoritative physics state that stays on the
  GPU.
- [ADR 0019](../../../../adr/framework/0019-use-rapier-for-cpu-physics-and-nexus-for-gpu-physics_H.md)
  selects Nexus for GPU physics and Rapier for CPU physics.
- The owner selected a complete GPU path for Slice 03. The owner rejected the proposed CPU path.

Slice 03 is not ready for implementation from the original plan. The slice must first select and
qualify a Nexus and BroMetal integration.

This local authority applies because Antiky Town does not need authority outside its local game
client. It does not make an online client authoritative. It does not create a general rule that all
client physics uses the GPU and all server physics uses the CPU.

## Terms

A kinematic character motor converts movement intent into movement that obeys collision rules. It
handles walls, slopes, steps, ground contact, and moving surfaces. Game code controls the character.
Forces do not control it as a normal dynamic rigid body.

The current TypeScript motor combines this movement policy with a handwritten CPU collision path.
Its behavior and tests are useful. Its synchronous object API is not a neutral API for both Nexus
and Rapier.

## Decisions that control the revised slice

### Authority and time

The local `EngineSession` owns the authority for the Antiky Town world. The GPU does not own
authority. Nexus calculates the physics state, and the local session can accept that GPU-resident
state as authoritative.

`EngineSession` remains the only clock owner. It assigns each fixed step. A character module must
not own a second accumulator, frame catch-up policy, or interpolation clock.

### Physics engines

The GPU path must use Nexus behind a private Antiky adapter. The slice must not ship the current
handwritten collision-query implementation as a separate CPU physics path. It can preserve reusable
movement policy only if that policy stays independent of the selected physics engine.

The slice does not need a CPU path only to make tests easier. If the shipped slice adds a CPU
physics path, that path must use Rapier behind a private Antiky adapter.

Public contracts, saved data, commands, events, and snapshots must use Antiky types. They must not
expose Nexus or Rapier types, objects, handles, or buffer layouts.

### GPU residency

Same-step physics consumers must run on the GPU when they need current GPU physics state. For this
slice, research must include collision work, NPC intent, actor state, state-digest work, camera
inputs, and render preparation.

The normal simulation and render path must not wait for GPU readback. BroMetal must consume an
Antiky-owned GPU projection of actor state. CPU inspection must use a bounded asynchronous snapshot
that identifies its simulation step.

The snapshot can be older than the current GPU state. `list_actors` and `get_actor` must report the
snapshot step. An inspection request must not start an immediate full-state readback.

GPU snapshots remain temporary inspection data. They are not domain events and do not change
[ADR 0002](../../../../adr/framework/0002-event-sourcing_H.md).

### BroMetal and Nexus ownership

Only the Antiky `RenderDriver` can use BroMetal directly, as required by
[ADR 0006](../../../../adr/framework/0006-brometal-render-driver_H.md). The private Nexus adapter owns
Nexus details. The integration must give every shared device, queue, buffer, and disposal action one
clear Antiky owner.

Physics code must not import BroMetal. Render code must not import Nexus. An Antiky contract must
describe the data that crosses between their private adapters.

### Faults and completed steps

The revised plan must define when a GPU physics step becomes a completed session step. It must also
define how validation errors, device loss, submission failures, snapshot failures, and late GPU
errors reach `EngineSession`.

An unexpected physics or game-code failure must enter the terminal fault state from
[ADR 0017](../../../../adr/framework/0017-stop-engine-session-after-game-code-fault_H.md). Inspection
must keep the last complete CPU-visible snapshot. Disposal must stay available. The session must
not repeat uncertain work.

## Nexus and BroMetal research gate

Research at least these three integration options before implementation:

1. Nexus writes actor state directly into a GPU buffer that the Antiky render driver can consume.
2. An Antiky compute projection converts private Nexus state into a stable render buffer before
   BroMetal draws it.
3. Antiky uses a GPU-to-GPU copy from Nexus-owned state into a render-driver-owned buffer.

The research must determine whether the current Nexus and BroMetal APIs can support each option. It
must compare these properties:

- WebGPU device and queue ownership.
- Command order between physics, gameplay, projection, and rendering.
- Buffer ownership, layout stability, and synchronization.
- CPU-to-GPU input uploads, GPU-to-GPU copies, and GPU-to-CPU readback.
- Error reporting, device loss, disposal, and session faults.
- Nexus feature gaps and version risk.
- Test support on the real WebGPU path.
- Changes that Antiky or BroMetal would need.

Select one option in the revised plan. Add an owner question if the option changes public API,
module ownership, visible behavior, or accepted architecture.

## Effect on the character API question

ADR 0019 does not decide whether Framework needs a public character movement API. It does decide
that the current handwritten CPU collision path cannot become the supported physics implementation.

Do not export the current `KinematicCharacterMotor` as proposed in the original plan. Keep its 13
regression tests and its collision behavior as reference evidence during Nexus qualification. Keep
the current demo runnable until the GPU path proves the approved behavior or records an approved
difference.

Question 3 remains an owner decision. Before that decision, the Nexus research must show the
smallest useful Antiky contract. A likely contract contains semantic movement intent, character
configuration, stable identity, and bounded inspection results. It must not promise a synchronous
CPU result from each character step. It must not require one mutable JavaScript motor object for
each actor.

The implementation can use a batched GPU character system behind that contract. A future Rapier
adapter can implement the same game meaning where a CPU path is necessary. Conformance tests must
test the shared meaning without requiring bit-for-bit equality between Nexus and Rapier.

## Original plan text that this addendum replaces

| Original direction | Controlling direction |
| --- | --- |
| Keep Slice 03 character physics on the CPU. | Use a complete Nexus GPU path after the integration research passes. |
| Publish the current motor as `KinematicCharacterMotor`. | Keep it as reference evidence. Decide a device-neutral public contract after research. |
| Publish a synchronous CPU actor snapshot after every step. | Keep authoritative state on the GPU. Publish bounded CPU snapshots asynchronously. |
| Let CPU code prepare all camera and render values from current actor state. | Move same-step consumers to GPU work or let CPU consumers use a later bounded snapshot. |
| Upload a complete actor pose batch for each rendered frame. | Keep actor state GPU-resident. Upload only necessary semantic inputs and use GPU projection or copy when required. |
| Use one exact actor digest as a general repeatability guarantee. | Define repeatability in the Nexus qualification plan. Do not assume bit-identical results across GPU models or between Nexus and Rapier. |
| Treat Nexus, Rapier, and GPU physics as non-goals. | Nexus integration and qualification are required. Rapier is required only if this slice ships a CPU path. |

## Readiness gate

Do not start Slice 03 implementation until all these items are complete:

- The owner-input file is `ANSWERED`.
- The three Nexus and BroMetal integration options have current primary-source and prototype
  evidence.
- The revised plan selects one integration option.
- The plan defines GPU step completion, ordering, snapshots, inspection, faults, and disposal.
- The plan replaces the synchronous CPU motor API with an approved Antiky contract or keeps that
  contract private.
- The plan defines qualification checks for Nexus and its BroMetal integration.
- The tests and measurements cover the real WebGPU path without per-step readback.

The final Slice 03 plan must remove or rewrite the superseded CPU sections. Do not implement two
character systems to preserve the old text.
