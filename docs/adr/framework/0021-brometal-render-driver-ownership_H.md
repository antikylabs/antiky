# 0021: Own BroMetal in a BroMetal render driver

## Status

Accepted

Supersedes [0006: Keep BroMetal inside the Antiky render driver](0006-brometal-render-driver_H.md).

## Context

BroMetal compiles shaders and controls graphics processing unit (GPU) resources for Antiky.

Antiky Framework must operate without a GPU and without a browser. Servers, storage, headless tests,
Studio, and the agent protocol use the framework without a renderer. A test enforces this rule.
Framework source cannot import BroMetal.

Antiky games need shadow maps, off-screen render targets, and light values greater than 1.0. Each of
these features needs more than one render pass. Today each game builds these features again.
Different games in this repository do not agree about basic scene values. An example is the
direction of the key light.

ADR 0006 gives all direct use of BroMetal to one Antiky-owned render driver. The later ADR
[studio/0007](../studio/0007-framework-first-allow-others_H.md) gives renderer initialization and
resource disposal to the game module. A reader cannot see which record controls a framework game
that uses BroMetal. This record removes that conflict.

BroMetal is pre-1.0 software. A move to a different WebGPU library is possible.

## Decision

We will build a render driver with the name `BroMetalRenderDriver`. The framework will own this
driver.

The driver will use BroMetal directly. The driver will own these resources:

- BroMetal programs
- Textures
- Render targets
- Buffers
- GPU state
- Disposal of these resources.

Framework code outside the driver will not use BroMetal. Framework code will send Antiky render data
to the driver. This data will use Antiky identifiers, pipeline keys, assets, and typed updates. This
data will not contain BroMetal objects.

The driver is specific to BroMetal. We will not add a backend abstraction layer in the driver. We
will not add a second renderer library behind the same interface.

Antiky games will use the driver for render work. This path is the default path.

A game module can use BroMetal directly. This path is an exception. A game module must use this path
only when the driver cannot do the necessary work.

If a game module uses BroMetal directly, that module owns its own BroMetal resources. The framework
gives no driver features to that module.

When Antiky games need a new render feature, we will add that feature to the driver.

Antiky selects a different renderer only in the game module. Antiky gives its engineering effort to
BroMetal.

Changes that Antiky contributes to BroMetal must help renderers in general or correct an error.

Antiky can patch BroMetal locally. For each patch, Antiky will send a focused pull request to the
BroMetal project. An accepted pull request removes the need for that patch.

## Consequences

- The framework, server, storage, Studio, and protocol code operate without BroMetal and without a
  Document Object Model (DOM).
- One driver and its tests contain all BroMetal details. BroMetal upgrades are easier to control.
- Antiky controls render order, dependency inspection, and safe resource replacement.
- A move to a different WebGPU library needs a new driver. The new driver reads the same Antiky
  render data. The two drivers share no code. We accept this cost.
- Render extraction must change Antiky state into the input format of the driver.
- A game module that uses BroMetal directly must supply its own render features. That module also
  accepts the framework work that the driver does. That module does not receive later driver
  improvements.
- The driver must grow to hold the render features that games need. If many games use BroMetal
  directly, the driver is incomplete. That result is a signal to add driver features.
- A local BroMetal patch is temporary. Each patch needs an upstream pull request.
- Some GPU features can need changes to BroMetal.
