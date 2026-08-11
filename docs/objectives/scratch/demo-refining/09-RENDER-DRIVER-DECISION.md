# Render Driver — Decision Write-Up and Draft ADR

**Date:** 2026-08-10
**Status:** owner decision made. This is the write-up plus a draft record ready to place.

Nothing here is authoritative. `docs/adr/` is. This document exists so the reasoning survives, and
so placing the record is mechanical. **Note that an ADR may not cite a planning document as
authority** (`docs/adr/README.md`), so the draft below stands on facts alone and does not reference
this file or any other document in `docs/objectives/`.

---

## The decision, in plain language

1. **Build a `BroMetalRenderDriver`, owned by the framework.** It is the framework's one component
   that speaks BroMetal. It owns programs, textures, render targets, buffers, GPU state, and
   disposal.
2. **It is BroMetal-specific by name and by design.** No backend abstraction, no plugin seam, no
   `ThreeBackend`. The name is the decision — `BroMetalRenderDriver`, not `RenderDriver` with a
   BroMetal implementation behind it.
3. **The driver is the default path, and it is not a close call.** Games use the framework for
   rendering. A game module *may* hand-write BroMetal, but 99% of the time it should not. Direct
   BroMetal use is an escape hatch for work the driver cannot yet do — and when a game reaches for
   it, that is a signal the driver is missing a feature, not that the game chose well. Such a
   module owns its own resources, gets no driver features, and inherits no later improvements.
4. **Other renderers stay compatible, not funded.** A Three.js game opens in Studio, and the MCP
   talks to it, if it is wrapped in a host the CLI understands. Engineering effort goes to
   BroMetal. Porting later is accepted as cheap.
5. **Local BroMetal patches are fine, and temporary.** Patch what we need. Send a focused upstream
   pull request for each patch so it can be retired. No separate record is needed for the
   `postinstall` patch step — it is normal practice with a stated exit.

### Why no backend abstraction

Portability comes from the **data contract**, not from a swappable backend. Framework code hands
the driver Antiky render data — IDs, pipeline keys, assets, typed updates — and never a BroMetal
object. Because of that contract, a second driver is a separate implementation of the same input,
sharing no code with the first. Each driver stays deep and uses its backend fully.

An abstraction over BroMetal and Three.js would fail on altitude. BroMetal is a shader compiler
with a thin runtime, and takes buffers and WGSL. Three.js is a scene graph, and takes meshes and
materials and owns the pipeline itself. A shared interface must sit at one of those heights, and
either choice discards the other backend's value. Designed against one real backend, the interface
would end up BroMetal-shaped regardless of intent.

The right acceptance test is therefore **"can a second driver be written without changing the
framework"** — not "can the backend be swapped without changing the interface."

---

## What record to write

### One new ADR, superseding framework/0006

`docs/adr/README.md` says a **changed** decision gets a new ADR, and the old one becomes
`Superseded by`. In-place tagging is only for a clarification. This is a change: ADR 0006 says
*"Only an Antiky-owned `RenderDriver` will use BroMetal directly"*, and item 3 above permits a game
module to use BroMetal directly. So supersede rather than amend.

The new record also resolves the conflict between framework/0006 and the later studio/0007, which
says the game module *"initializes and resizes the renderer"* and *"disposes its renderer
resources"* across all four renderer choices. Today a reader cannot tell which record governs a
framework game that uses BroMetal.

### No second ADR for the other-renderer position

Item 4 restates studio/0007, which already decides that renderer choice lives in the game module
and that Three.js is not a framework render driver. Effort allocation is a product priority, not an
architecture decision. Writing an ADR for it would add a record that decides nothing new.

---

## Draft — `docs/adr/framework/0021-brometal-render-driver-ownership_H.md`

> Written to the ADR writing standard (ASD-STE100): active voice, one topic per sentence, no
> semicolons, short sentences, consistent terms. Review before placing.

```markdown
# 0021: Own BroMetal in a BroMetal render driver

## Status

Accepted

Supersedes [0006: Keep BroMetal inside the Antiky render driver](0006-brometal-render-driver_H.md).

## Context

BroMetal compiles shaders and controls graphics processing unit (GPU) resources for Antiky.

Antiky Framework must run without a GPU and without a browser. Servers, storage, headless tests,
Studio, and the agent protocol all use the framework without a renderer. A test enforces this rule.
Framework source cannot import BroMetal.

Antiky games need shadow maps, high-dynamic-range render targets, and post-processing passes. Each
of these features needs an off-screen render target. Today each game builds these features again.
Different games in this repository disagree about basic scene values, such as the direction of the
key light.

ADR 0006 gives all direct BroMetal use to one Antiky-owned render driver. The later ADR
[studio/0007](../studio/0007-framework-first-allow-others_H.md) gives renderer setup and resource
disposal to the game module. A reader cannot tell which record controls a framework game that uses
BroMetal. This record removes that conflict.

BroMetal is pre-1.0 software. A future move to a different WebGPU library is possible.

## Decision

We will build a render driver with the name `BroMetalRenderDriver`. The framework will own it.

The driver will use BroMetal directly. The driver will own these resources:

- BroMetal programs
- Textures
- Render targets
- Buffers
- GPU state
- Disposal of these resources.

Framework code outside the driver will not use BroMetal. Framework code will send Antiky render
data to the driver. This data will use Antiky IDs, pipeline keys, assets, and typed updates. This
data will not contain BroMetal objects.

The driver is specific to BroMetal. We will not add a backend abstraction layer inside the driver.
We will not add a second backend behind the same interface.

Antiky games will use the driver for rendering work. This path is the default path.

A game module can use BroMetal directly. This path is an exception. A game module must use this
path only when the driver cannot do the necessary work.

If a game module uses BroMetal directly, that module owns its own BroMetal resources. The framework
gives no driver features to that module.

When Antiky games need a render feature, we will add that feature to the driver.

Antiky selects other renderers only in the game module. Antiky gives its engineering effort to
BroMetal.

Changes that Antiky contributes to BroMetal must help renderers in general or correct an error.

Antiky can patch BroMetal locally. For each patch, Antiky will send a focused pull request to the
BroMetal project. An accepted pull request removes the need for that patch.

## Consequences

- The framework, server, storage, Studio, and protocol code run without BroMetal or a Document
  Object Model (DOM).
- One driver and its tests contain all BroMetal details. BroMetal upgrades are easier to control.
- Antiky controls render order, dependency inspection, and safe resource replacement.
- A move to a different WebGPU library needs a new driver. The new driver reads the same Antiky
  render data. The two drivers share no code. We accept this port cost.
- Render extraction must convert Antiky state into the input format of the driver.
- A game module that uses BroMetal directly must supply its own render features. That module also
  accepts the framework work that the driver would do for it. That module does not receive later
  driver improvements.
- The driver must grow to hold the render features that games need. If many games use BroMetal
  directly, the driver is incomplete. That result is a signal to add driver features.
- A local BroMetal patch is temporary. Each patch needs an upstream pull request.
- Some GPU features can need changes to BroMetal.
```

---

## Placement checklist

1. Review the draft against ASD-STE100. I am not a certified writer against that standard.
2. Create `docs/adr/framework/0021-brometal-render-driver-ownership_H.md`. `0021` is the next free
   number — framework records currently end at `0020`.
3. Tag `0006` **before** editing it, while `HEAD` still holds the old text:
   ```sh
   ./docs/adr/tag-hash.sh docs/adr/framework/0006-brometal-render-driver_H.md \
     "Prior version before ADR 0021 superseded this decision."
   ```
4. Change `0006`'s status to `Superseded by [0021](0021-brometal-render-driver-ownership_H.md)`.
   Do not delete it and do not reuse its number.
5. Add `0021` to the Framework list in `docs/adr/README.md`.
6. Consider whether `studio/0007` needs an in-place clarification pointing at `0021` for the
   framework-plus-BroMetal case. It is not wrong, but it is the record a reader hits first.
7. Fix `packages/website/PRODUCT.md:85` and the three website pages. They tell the public "the
   current Framework render driver uses BroMetal" as a **Current** claim. No driver exists yet, so
   it is a **Direction** claim under PRODUCT.md's own taxonomy at `:87-96`. This is now a dated
   statement rather than a wrong one, but it should not ship as Current until the driver does.

---

## What this changes in the plan

The decision **does not change what gets built first**, and it improves the plan in one way: the
promotion target now has a name.

- **Track B stays per-demo.** Prove the shadow map, HDR target, and post chain inside
  `point-light-expo` first, then a second demo. Extracting a driver from two working
  implementations is the slice process working as intended. Building the driver from zero would
  abstract from one implementation, which is the failure this decision avoids.
- **The `08-ADR-IMPACT.md` gate on Track B is now resolved.** Work may proceed once `0021` is
  placed, because game-module BroMetal ownership becomes explicitly permitted rather than
  ambiguous.
- **Track E gains a destination.** "Promote to the framework when the slice is ready" now means
  "move into `BroMetalRenderDriver`", which makes the exit criteria writable.
- **The driver is where the render features finally live.** Shadow maps, the HDR target, tone
  mapping, bloom, and grading are driver responsibilities in the end state. The per-demo copies are
  the proving ground, not the destination.
- **The two BroMetal patches are unaffected.** Both correct errors, so both satisfy the
  contribution clause carried into `0021`.

**Patching is settled.** Build the two patches now. `0021` carries the practice: patch locally,
send a focused upstream pull request for each one, retire the patch when it is accepted. My earlier
suggestion that the `postinstall` patch step needed its own record is withdrawn — it is normal
dependency practice with a stated exit, and an ADR for it would decide nothing.

**One thing to watch during Track B.** The ADR makes the driver the default and direct BroMetal use
an exception. The demos are currently the exception, by design, because the driver does not exist.
That is fine and expected. But the moment the driver ships, every demo still hand-writing BroMetal
is carrying a claim that the driver cannot do its work — and that claim should be checked, not
assumed. A good acceptance criterion for the driver is that `point-light-expo` moves onto it and
deletes its own BroMetal resource ownership entirely.
