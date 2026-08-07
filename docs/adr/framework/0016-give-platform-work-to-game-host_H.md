# 0016: Give platform work to the game host

## Status

Superseded by [ADR 0020](0020-keep-game-code-and-game-hosts-in-different-modules_H.md)

## Context

A game host is an adapter between a game platform and an `EngineSession`. For a browser game, the
platform includes the canvas, device events, visibility signals, and presentation callbacks.

A presentation callback is a browser callback for one graphics frame. Its rate can change. The
browser can stop these callbacks when page visibility changes. The callback rate must not control
simulation time.

Semantic input contains a game action. It does not contain a raw device event. Examples include
movement direction and an ability request. A game can use semantic input for headless tests,
replay, remapping, and online prediction.

In [ADR 0008](0008-engine-session-owns-worlds_H.md), the `EngineSession` owns world authority and
runtime lifecycle. In [ADR 0013](0013-explicit-simulation-inputs_H.md), the simulation receives
explicit inputs and uses a fixed simulation step.

In [ADR 0006](0006-brometal-render-driver_H.md), the render driver owns BroMetal and graphics
resources. One boundary for input, time, and graphics work is necessary for these owners.

## Decision

We will give platform work to the game host. We will give simulation work to the `EngineSession`
and graphics work to the render driver.

The game host will own these platform items:

- The canvas
- Raw device events
- Platform time
- Focus, visibility, and window-size signals
- Presentation callback requests and cancellation
- Platform listener removal.

The game host will convert raw device events into immutable semantic input batches. A game-owned
input adapter will do this work.

The first game host and input adapter will be private Antiky Town code. This decision will not add a
general game host API.

The game host will send elapsed platform time, platform signals, and semantic input to the
`EngineSession`. It will not change world state.

The `EngineSession` will own these runtime items:

- The fixed simulation clock
- Step IDs and input sequence
- Pause reasons
- System and command order
- Authoritative world state
- Lifecycle and disposal of owned services.

Visibility suspension and a user or tool pause will use different pause reasons. Visibility
recovery will remove only the visibility reason.

When the session resumes, the host will start a new platform-time baseline. Paused time will not
cause catch-up work.

Each presentation callback can run zero or more fixed simulation steps. After those steps, it can do
at most one render preparation and one GPU submission.

The CPU will make GPU state from authoritative world state. GPU state will be nonauthoritative.
Usual operation will use no GPU readback. The GPU will not supply simulation input.

The render driver will own BroMetal, WebGPU resources, graphics errors, and disposal. Graphics work
will not make a simulation decision.

Each semantic input batch will be immutable after the `EngineSession` accepts it. The
`EngineSession` will give the batch a completed-step ID and an input sequence.

Raw device events and platform timestamps will not become durable domain events. A journal can use
the authoritative `EngineSession` as its data source. It will not use a browser host as its data
source.

An online server session will own authoritative accepted-input history. A client can keep a small
prediction or diagnostic buffer.

This decision adds no durable journal, replay format, retention policy, or position history.

## Consequences

- Browser, headless, and server hosts can use one session model.
- Tests can run simulation steps without a canvas or GPU.
- No presentation callback can cause one GPU submission for every fixed step.
- Usual operation uses no CPU-to-GPU round trips.
- The host must reject callbacks from an old session generation and remove each platform listener
  one time.
- Antiky Town needs one private game host and one private semantic input adapter.
- A second game or host can supply evidence for a public API.
- Games can select their authoritative history policy.
- The Framework default will not include high-rate history.
- Server-authoritative games keep authoritative simulation history on the server.
