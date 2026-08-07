# Slice 02 Owner Input

## Status

`ANSWERED`

## Purpose

Slice 02 adds the first fixed-step `EngineSession`. It connects Antiky Town, the development UI,
the CLI, MCP, and future Studio clients to the same session clock and controls.

The Slice 02 goal reads this file before it changes code. A `PENDING` answer stops the goal.

## How to answer

Replace each `PENDING` value with `APPROVE` or your preferred direction. Add a short note when you
change the recommendation. Change the status to `ANSWERED` after all answers are complete.

## Inherited direction

- Slice 01 is complete.
- Use the minimal fixed-step session option from the implementation plan.
- CLI, Studio, MCP, the Town UI, and tests use the same Framework services.
- MCP exposes Tools. It does not duplicate the operations as Resources.
- BroMetal `0.15.0` is the current, verified feature baseline.
- Keep `town-study` runnable as the reference.
- Record important accepted facts as durable domain events. Keep frequent simulation state
  temporary unless a game enables a bounded replay or audit policy.

## Approved framework boundary

The answers in this file select reusable mechanisms. They do not make Antiky Town's current game
policy a Framework rule.

- Framework supplies the fixed clock, ordered execution, stable IDs, explicit input, revisions,
  immutable inspection, and a command boundary.
- Framework does not require a durable event for every step, input, position, velocity, or physics
  result. It does not select a replay format or a retention period.
- A game can later attach a bounded input journal, checkpoints, state hashes, or selected traces to
  its authoritative session. Those features are optional policies with their own proven use cases.
- A local game can treat its browser session as authoritative. In server-authoritative multiplayer,
  the server session owns accepted input and canonical history. Client prediction records remain
  temporary and untrusted.
- Antiky Town keeps its browser lifecycle, keyboard-to-movement mapping, Town system adapter, and
  history choices private. Do not promote them to public Framework APIs from this slice alone.

A later slice must prove a second consumer or a broader architecture requirement before it adds a
general host API, journal API, checkpoint API, or high-frequency event policy to Framework.

## Question 1: Should we accept a narrow game-host lifecycle ADR now?

### Context

[`UNDER_REVIEW_A.md` candidate 13](../../../../adr/UNDER_REVIEW_A.md#13-game-client-host-lifecycle-and-semantic-input)
is necessary for this slice. The browser currently owns input, pause, visibility, and the render
loop. `EngineSession` must own fixed simulation time and step assignment.

Implementation needs an accepted ownership boundary before it moves this work.

### Recommendation

Approve a narrow ADR before implementation. Let a thin host own canvas and browser events. Let
`EngineSession` own the fixed clock, system order, lifecycle, and step IDs. Keep the first semantic
movement-input adapter private to Antiky Town. Promote it only after another game host or prediction
feature proves a public contract.

This adds one transitional adapter. It avoids publishing a general input framework from one game.
The host observes raw platform events, but it does not become an event store or gameplay authority.
In an online game, the authoritative server session accepts inputs and owns canonical history.

### Owner answer

`APPROVE WITH CONDITIONS`

 The only weakness is that the recommendation does not explicitly state the rendering-frequency rule. I would
  strengthen the eventual ADR with:

  > Each presentation callback may run zero or more fixed simulation steps, followed by at most one render
  > preparation and GPU submission. GPU state remains derived and nonauthoritative. Normal operation performs no
  > GPU readback.

  So: the current recommendation is correct, but that sentence would prevent someone from later interpreting “one
  fixed step” as “one GPU update and draw per fixed step.”

## Question 2: What fixed-step and long-frame policy should the session use?

### Context

Godot and Phaser commonly use 60 fixed updates each second. Unity and Unreal cap catch-up work.
Antiky Town already limits outer frame time to `0.05` seconds, and its character motor uses
`1/60`-second steps.

### Recommendation

Use a `1/60`-second fixed step. Accept at most `0.05` seconds from one browser frame. Run at most
three fixed steps in one frame. After the limit, discard complete excess steps, keep a fractional
remainder smaller than one step, and report the discarded time.

The simulation slows after a stall instead of spending unbounded CPU time to catch up.

### Owner answer

`APPROVE`

## Question 3: What must pause, resume, and single-step do?

### Context

The current pause button stops the BroMetal loop. Browsers also stop frame callbacks in background
tabs. Development tools need one-step control without rebuilding the world or accidentally
catching up all paused time.

### Recommendation

Pause the session and stop its render loop while keeping CPU and GPU resources alive. Resume with a
new browser-time baseline and no catch-up for paused time. Allow single-step only while paused.
Single-step runs exactly one fixed tick, keeps the session paused, and renders one frame so the
result is visible. An explicit user or tool pause prevents visibility recovery from auto-resuming.

This preserves current GPU-saving behavior. The host needs a small paused-frame render path.

### Owner answer

`APPROVE`

## Question 4: Which session Tools should humans and agents use?

### Context

The required meanings are session and clock inspection, pause, resume, and one fixed step. A lost
response must not cause an automatic retry to step twice.

### Recommendation

Add `get_session_status`, `pause_simulation`, `resume_simulation`, and `step_simulation` to the
existing typed development client. Make pause and resume idempotent. Require
`expectedCompletedStepCount` for single-step and reject a stale value. Expose the same names through
MCP and `antiky tool`.

The expected count adds one read before a scripted step. It makes retries safe and the result
unambiguous.

### Owner answer

`APPROVE`

## Question 5: Should Slice 02 add the requested CLI ID generator?

### Context

The feedback file requests one supported way to make IDs so projects do not encode the current
UUID structure themselves. Slice 02 adds `SessionId` beside world, entity, and command IDs.

### Recommendation

Add `antiky generate id <world|entity|command|session>`. Print the ID alone by default for easy
copying. Add `--json` for scripts. Call Framework ID factories instead of generating IDs in CLI
code.

This adds a small public CLI command. It avoids four separate commands and keeps future ID-format
changes behind Framework.

### Owner answer

`ALTERNATIVE`

The entint was for the framework to have a id generator, not the cli. So that the game can call it when it needs to generate an ID. Its fine if CLI reuses that, but the ID Generation should probably live in the framework yeah?

## Question 6: What future simulation-history boundary must Slice 02 preserve?

### Context

Antiky records important authored changes and gameplay results as durable domain events. It does not
record every fixed step, position, velocity, physics contact, animation update, or render value by
default.

Some games need more evidence. A competitive game may keep server-accepted input batches, periodic
runtime checkpoints, state hashes, or selected position traces. A local game may keep similar data
when its local `EngineSession` is authoritative. Browser input and prediction traces are not
canonical in a server-authoritative game.

These records have different purposes:

- The domain event stream stores important accepted facts.
- A simulation input journal stores accepted semantic input by step.
- Runtime checkpoints and state traces store selected high-frequency state.
- Client prediction buffers and raw device traces stay temporary and untrusted.

### Recommendation

Keep the default selective. Do not emit a durable event for each step or movement update. In Slice
02, preserve only the internal facts that a later authoritative journal needs: the completed step,
input sequence, immutable semantic input used by that step, and tested state digest.

Do not add durable input storage, a replay file format, a public journal interface, retention rules,
or per-position history in this slice. A later bounded journal or checkpoint adapter must attach to
the authoritative `EngineSession`, not the browser host. In online play, the server validates and
records accepted input; the client keeps only a limited prediction and diagnostic window.

This keeps simple games small without preventing competitive games from selecting richer history.

### Owner answer

`APPROVE`

This approval preserves optional richer history. It does not turn Antiky Town's selective event
policy into a universal Framework default. Competitive games can record more data at their
authoritative server session without making every browser-hosted game pay that storage and API
cost.

## Work that does not need owner input

The implementation agent confirms the BroMetal baseline and guarded shader patch, selects exact
test fixtures, allocates run resources, measures clock and render behavior, regenerates shaders,
and records evidence.

The agent must add a new owner question only if a finding changes product scope, visible behavior,
a public contract, or an accepted architecture decision.
