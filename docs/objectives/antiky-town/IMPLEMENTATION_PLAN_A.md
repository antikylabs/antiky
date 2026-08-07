# Antiky Town implementation direction

**Status: Current direction — Slices 00 through 02 complete; next slice in planning**

## Goal

Make Antiky Town a playable game that proves useful Antiky capabilities through visible results.
Keep each capability private to the game until a second consumer or measured need proves a reusable
Framework boundary.

[`slice-list.md`](slice-list.md) is the only active roadmap. This document defines stable direction.
It does not duplicate the slice order.

## Shipped baseline

Antiky Town is a standalone project at
[`packages/demos/antiky-town`](../../../packages/demos/antiky-town/README.md). It currently supplies:

- One game module for CLI, Studio, website, and test hosts.
- A fixed-step `EngineSession`.
- Point-light commands, inspection, and correction.
- Town rendering, shaders, physics, assets, and semantic game inspection.

Town Study is a separate standalone project. It owns its own necessary source. It is not a source
package for Antiky Town.

Antiky has no Nexus dependency or qualified Nexus and BroMetal integration. It also has no public
Framework asset registry or shipped-game package contract.

## Stable boundaries

Apply these accepted decisions to every Town slice:

- [Framework ADR 0018](../../adr/framework/0018-select-physics-authority-and-execution-independently_H.md)
  separates physics authority from the execution device.
- [Framework ADR 0019](../../adr/framework/0019-use-rapier-for-cpu-physics-and-nexus-for-gpu-physics_H.md)
  selects Rapier for CPU physics and Nexus for GPU physics.
- [Framework ADR 0020](../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)
  keeps game code separate from CLI, Studio, website, and test hosts.

The following rules also apply:

- Keep each demo standalone. Do not import source, build helpers, or runtime support from another demo.
- Keep host code, servers, process control, canvas creation, and raw device events outside the game module.
- Keep BroMetal inside the render driver and Nexus inside a private physics adapter.
- Keep Antiky types at public, saved-data, command, event, inspection, and snapshot boundaries.
- Add a complete player-visible behavior before a general abstraction.
- Extract a Framework service only after the behavior or a second game proves the boundary.
- Keep raw run output and temporary verification out of Git. Keep durable facts in `slice-summary.md`.

## Next visible result

The next slice must qualify Nexus with BroMetal and then move the playable hero through that path.
It must preserve the approved collision behavior and show the result in the running Town.

For the local game, `EngineSession` can accept authoritative GPU physics state. GPU work can use that
state during the same simulation step. Normal simulation must not wait for per-step CPU readback.
A bounded GPU snapshot can support later inspection only when the slice defines its size and delay.

Keep this integration private to Antiky Town until the result proves a reusable interface. Do not
publish a general physics API, duplicate CPU and GPU character systems, or move Nexus types across an
Antiky boundary.

## Readiness for the next slice

The next plan stays `NOT READY` until all these conditions are true:

- Research uses current primary Nexus, BroMetal, WebGPU, and browser sources.
- The plan identifies the selected Nexus and BroMetal versions.
- A bounded probe proves that the selected versions can share the required WebGPU device and work order.
- Qualification tests cover startup, movement, collision, device loss, cleanup, and unsupported hardware.
- The plan names the authoritative state, same-step GPU consumers, and any delayed CPU snapshot.
- The plan defines a visible hero outcome and approved collision reference.
- The owner answers each product or risk question that changes the result.

If qualification fails, record the result and keep the current Town playable. Do not hide a failed
qualification behind a CPU implementation with the same slice name.

## Selection after the next slice

After the hero result passes, select one next player-visible Town feature from the unordered backlog.
Do not pre-commit a long framework sequence. Let the observed game result and measured boundaries
select the next work.

Possible later work includes NPC behavior, Town interaction, selection, assets needed by a visible
feature, rendering improvements, and global illumination. Durable storage, online play, and release
contracts stay outside the gameplay roadmap until a concrete result needs them.
