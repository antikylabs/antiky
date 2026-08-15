# 0022: Use GPU IDs to select Framework entities

## Status

Accepted

## Context

Antiky Studio must select the Framework entity that produced a displayed pixel.

GPU selection reads a GPU ID from a target. A GPU ID is a temporary numeric alias for one selectable item in one frame.

[ADR 0004](0004-23d_H.md) requires selection for 2D, 3D, and 2.3D games. [ADR 0011](0011-stable-ids-and-runtime-aliases_H.md) permits a render batch to use a temporary numeric alias.

ADR 0011 prohibits durable or global use of the alias. [ADR 0021](0021-brometal-render-driver-ownership_H.md) gives GPU work and BroMetal resources to the `BroMetalRenderDriver`.

[ADR 0018](0018-select-physics-authority-and-execution-independently_H.md) states that GPU readback is asynchronous. [Studio ADR 0007](../studio/0007-framework-first-allow-others_H.md) prohibits Studio from inspecting renderer objects.

The current frame contract can send numeric data to an off-screen target. But the current driver cannot read a target or send a selection result.

CPU selection cannot prove that Framework received the GPU result.

## Decision

Antiky Framework will supply GPU selection for entities in a displayed frame.

Each selectable item will receive one GPU ID in one frame. The driver will write each GPU ID to a selection target.

The driver will read the selected pixel asynchronously. It will keep an ID map for that frame.

The ID map will connect each GPU ID to its stable `EntityId`. The driver will keep the map until readback finishes or Framework rejects the result.

The driver will find the stable `EntityId` before it sends a result across the driver boundary.

Framework will use the stable `EntityId` for selection data.

The driver will send this data to Framework. It will not send GPU IDs, BroMetal objects, or GPU resources.

Studio will use this data to select and examine the same Framework entity.

Antiky can also have CPU selection, but CPU selection cannot replace GPU selection.

## Consequences

Studio can associate a displayed pixel with the stable Framework entity that produced it. GPU selection stays in the Framework driver boundary.

The driver gets an asynchronous result path. An ID map is necessary for each pending result. The map uses memory and needs lifecycle rules.

GPU selection adds GPU work and readback latency. BroMetal must supply readback, or Antiky must use the ADR 0021 patch procedure.

Tests must include stale readback, no-hit results, ID replacement, disposal, and Studio data. Renderer-only game modules do not get this Framework function.

CPU selection stays possible, but it cannot be the only proof. The target format, ID encoding, readback API, and selection user interface stay as code choices.
