# A framework for the first generation of AI-native games

Game engines were designed around one assumption: a human is the primary user. Every editor,
workflow, abstraction, and debugging tool grew outward from a person sitting at the keyboard.
Agents were added later, usually as another way to generate code for a system that still could not
explain itself to them.

Antiky Framework is an open-source, headless TypeScript game framework built from a different
assumption: the agent is a first-class user of the game engine.

That changes more than the interface. It changes the language, the runtime, the world model, the
rendering path, the development loop, and the evidence the engine must produce. An agent should not
have to infer what happened from a screenshot and hope. It should be able to ask the game, change the
game, run the game, observe the result, and prove whether the change worked.

This is the foundation we are building first for Antiky Labs games - and for anyone who wants to
explore what game development becomes when humans supply the intent and agents can work with the
full system.

## Imagine the loop

You describe how a creature should move. The agent changes the game code, launches a bounded
session, and runs a repeatable scenario. It inspects the creature, its relationships, the events
that mattered, and the state before and after the change. It captures what the player would see and
checks the result against the performance budget. When the movement is technically correct but does
not feel right, you make the creative call and send the agent back with better direction.

No hidden editor state. No separate automation world. No pretending that generating code is the
same thing as understanding a game.

The agent and the human are looking at the same world.

## AI-native is an architectural choice

TypeScript is not incidental to the Framework. Models have extensive TypeScript examples to learn
from, and the language sits naturally beside the browser, the DOM, Canvas, and WebGPU. An agent can
work across game logic, engine systems, host integration, and rendering without translating its
intent through several unrelated languages and toolchains.

BroMetal carries that idea onto the GPU. Shader programs are expressed through a TypeScript DSL and
compiled to WGSL before the game runs. This keeps TypeScript-to-WGSL translation out of the play
loop; the browser still creates WebGPU pipelines at runtime. The Framework can make CPU and GPU work
explicit for each subsystem and reduce unnecessary conversation between them. Its own rendering
path is WebGPU-only, keeping that path focused instead of hiding several backends behind one
abstraction.

Agents can work at the level the problem demands. They can use Framework systems, write game code,
create BroMetal shaders, or add focused TypeScript where the Framework does not yet reach. The point
is not to trap an agent inside a collection of high-level tools. The point is to give it a coherent
stack it can understand all the way down.

## One world, one contract

An AI-native engine cannot have one privileged path for the editor, another for automation, and a
third for the shipped game. Humans, agents, Studio, CLI, services, and tests must meet the engine
through the same commands, queries, events, diagnostics, and visual captures.

MCP translates that engine contract into tools an agent can use. It is how an agent launches and
controls a session, plays the game, inspects the world, observes results, and iterates while it
works. But MCP is not the architecture. It is an adapter to the same engine API every other client
uses.

That shared contract keeps power honest. Being allowed to see the world does not grant permission to
change it. Agent changes begin in bounded sandboxes and reach an authoritative world only through
explicit commands and narrow grants. Stable entity identities, runtime schemas, semantic queries,
and ordered world mutation give both humans and agents something durable to refer to. Important
authored changes and durable results become history without pretending that every live simulation
value belongs in an event log.

The result is not merely an engine an agent can operate. It is an engine that can tell an agent what
is true.

## Proof is part of creation

An agent can produce a plausible change in seconds. Plausibility is not enough.

The Framework is being shaped to produce evidence: targeted queries, revision diffs, GPU readback,
diagnostics, causal events, deterministic scenarios, input traces, visual captures, and performance
budgets. When game code fails, mutation should stop without destroying the session's value for
inspection and cleanup. When a change succeeds, the evidence should show why.

This does not remove human judgment. It protects it. Metrics can expose a broken frame, a missed
budget, or an unexpected state transition. They cannot decide whether a jump feels alive, whether a
world invites curiosity, or whether a moment is worth remembering. Agents bring speed and reach;
people remain the authority on taste.

## We are growing an engine from games

Antiky Labs games are the Framework's first customer. We are not designing a universal engine in
the abstract and waiting for a game to justify it. We build complete slices of real games, find the
systems that deserve to be shared, and move those systems into the Framework when they have earned
their place.

That is how support for 2D, 3D, and the space between them will grow. It is how reusable abilities,
assets, materials, physics, rendering features, and online-world services will grow. Each begins
with a game that needs it, not a box on an engine feature matrix.

This choice has a cost: the Framework will be narrower before it is broad. We accept that cost
because a small system proven by a complete game is more valuable than a large system made of
promises.

## The Framework stands on its own

The Framework runs headless. A game can build, run, test, host, and ship without Antiky Studio.
Game modules own their rules, systems, shaders, and assets; hosts own the canvas and platform work.
The Studio is a powerful visual client - a human gateway into the same world - but it is not the engine
and it is not the source of truth.

This boundary matters. It keeps the game real outside the tool. It lets tests exercise the same
system players use. It lets agents work through code, CLI, and MCP without requiring a graphical
editor. And when Studio is present, its control and visual feedback make that same system easier for
a person to understand and direct.

## Built in the open, with the future stated honestly

Today, the Framework is pre-release and is not yet a published npm product. It has fixed-step
sessions, stable identities, bounded inspection, captures, and a working point-light path. The
BroMetal driver and the first Framework-backed game slices are emerging. General component
services, sandboxes, selection, physics, shared abilities, and online play are direction - not
finished promises.

We will qualify those systems in real games before claiming them. We will keep CPU and GPU authority
explicit. We will validate boundaries where data crosses a process, network, worker, trust zone, or
storage layer. We will let comparative evidence - not ambition - make future performance claims.

But the direction is clear.

The next game engine should not treat an agent as a faster typist. It should give the agent a world
it can understand, an interface it can share, and evidence it can reason from. It should give the
human more room for intent, imagination, and judgment.

That is the Framework we are building.
