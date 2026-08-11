# 0006: Keep BroMetal inside the Antiky render driver

## Status

Superseded by [0021: Own BroMetal in a BroMetal render driver](0021-brometal-render-driver-ownership_H.md)

## Context

BroMetal compiles shaders and manages graphics processing unit (GPU) resources for Antiky. It does
not define:

- World data
- Gameplay rules
- Saved data
- Networking
- Studio behavior
- Agent protocols.

BroMetal types and resources must not spread into those parts of Antiky. That direct dependency
would make renderer changes difficult. It would also prevent the core runtime from running without
a renderer.

## Decision

Antiky will use BroMetal as its rendering backend. Only an Antiky-owned `RenderDriver` will use
BroMetal directly.

The driver will own:

- BroMetal programs
- Textures
- Render targets
- Buffers
- GPU state
- Disposal of these resources.

Other framework code will send Antiky render data to the driver. This data will use Antiky IDs,
pipeline keys, assets, and typed updates. It will not contain BroMetal objects.

Changes that Antiky contributes to BroMetal must help renderers in general or correct an error.

## Consequences

- The framework, server, storage, Studio, and protocol code can run without BroMetal or a Document
  Object Model (DOM).
- One adapter and its tests contain all BroMetal details.
- The adapter makes BroMetal upgrades easier to manage.
- Render extraction must convert Antiky state to the efficient input format of the driver.
- Antiky controls render order, dependency inspection, and safe resource replacement.
- Some GPU features can require changes to BroMetal.

## Revision history

- `4c35b270f3da017454b12dd75e104b0c50355818` — Prior version before the plain-language rewrite.
- `f403e4b2d125d7d13cb69c6cead4866c9f340023` — Prior version before ADR 0021 superseded this decision.
