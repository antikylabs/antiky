# The place where humans direct AI-native game development

Traditional game editors were built to put every property within a person's reach. Antiky Studio
is built for a different creative relationship: people set the direction, agents carry out the
work, and the game itself stays visible between them.

The Studio is the human gateway to Antiky Framework. It is where you see what the agent sees,
understand what the game is doing, and turn anything meaningful on the screen into precise direction
for the next change. It is not an editor with an AI chat box added to the side. It is a workspace
designed around the conversation between human taste and machine execution.

The most important control is not another field in a property panel. It is the ability to point at
the exact thing you mean.

## Imagine giving feedback without rebuilding the context

You click the creature whose movement feels wrong. The Studio already knows the project, build,
runtime, world, entity, revision, and hierarchy behind that selection. You write, “Make this feel
heavier when it lands.” The agent receives your direction with the selected creature and the
relevant evidence attached.

Or you capture one part of the game and mark the place where the lighting breaks. You select an
event from the history and ask why it happened. You inspect a project value, attach a note, and
stage it beside two visual observations before sending all three as one coherent request.

You should not have to describe where you were looking before you can describe what you imagined.

The Studio should already know.

## Everything you can see can become context

The Studio begins as a place of observation. The live game, its entities, properties, activity,
diagnostics, events, and captures are not passive displays. Each is a potential feedback point.
Selection turns a visible object into stable Framework identity before it reaches the interface.
Inspection exposes a bounded, truthful projection instead of handing the UI - or an agent - raw access
to the world.

This changes the role of the editor. Rather than reproducing every operation as a bespoke form,
Studio helps a person inspect the game and tell an agent what should change. Direct authoring will
grow where it genuinely improves the work, but it will use the same validated commands as agents,
tests, and every other client. The interface never becomes a second source of game truth.

That tradeoff is deliberate. Studio will offer fewer manual editing surfaces at first than a
traditional engine editor. In return, every interaction can be designed for a development loop in
which the human does not have to perform every change by hand.

## Bring the agent you already trust

Antiky Labs is not building another coding agent. Studio is being designed to connect to the agents
people already use, with their existing providers, accounts, and plans.

ACP is the conversation layer. It lets Studio host a rich, streaming relationship with an
ACP-compatible coding agent and include selected objects, captures, events, diagnostics, and other
structured context in the request. A terminal remains available for terminal-shaped work, but a
terminal alone cannot provide the visual and semantic context the Studio understands.

MCP has a different job. It is the agent-to-engine API: the way an agent launches, controls,
observes, and inspects a game session. ACP carries the conversation between the person and the
agent. MCP lets the agent work with the game. Keeping those roles distinct makes the experience
powerful without blurring authority.

A permission prompt in the conversation cannot bypass Framework commands, grants, or revision
checks. Seeing an entity is not permission to mutate it. Attaching a comment does not change its
target. Studio can make agency feel immediate without making it invisible.

## A canvas that becomes the tool the moment needs

Game development does not have one permanent arrangement. Lighting asks for a viewport,
diagnostics, and captures. Asset work asks for a catalog, provenance, and previews. A simulation
problem asks for events, state, controls, and time. The Studio should not force every task through
the same fixed collection of panels.

That is why Studio is a canvas for mini apps. A mini app can bring the interface and services needed
for a particular kind of work, arrange them into a useful workspace, and participate in the same
context and feedback loop as the rest of Studio. An asset browser, shader workspace, game editor,
GPU tool, or focused utility can arrive when needed without turning the core Studio into a wall of
permanent controls.

Mini apps are not an invitation to expose the entire engine or desktop to plug-ins. They need stable
identity, declared capabilities, activation and disposal, isolated failures, and bounded access to
optional services. They can ask Studio to mount a viewport; they do not receive raw ownership of
the Framework world, Tauri host, renderer, or GPU. A flexible workspace is useful only if people and
agents can still trust its boundaries.

## Feedback should survive the conversation

Creative direction is too important to disappear inside a prompt transcript.

Studio's feedback model is intended to make a comment a durable project object: who created it,
what it referred to, which revision it observed, what evidence accompanied it, and whether it is
open, assigned, resolved, or reopened. Humans and agents can discuss the same feedback, connect it
to a proposed change, and attach the proof that the change addressed it.

The comment remains a request for attention, not a hidden command. The person or policy with
authority still decides what enters the game. This creates a creative record more useful than a
chat log: not just what was said, but what it meant, what changed, and how the result was judged.

Staging makes that record practical. A person can gather feedback from several places in the
Studio, review the bundle, add one larger direction, and then send the agent a coherent brief. The
workflow follows how creative judgment actually arrives - not always as one isolated instruction,
but as a set of connected observations.

## A window into the game, never the game itself

Studio is a visual client of the Framework. Games build, run, and ship without it. The same project
services that power the CLI are responsible for building, hosting, inspection, MCP, and cleanup;
Studio calls those services instead of inventing its own version of the world.

That separation keeps the project portable and the facts consistent. Engine state stays distinct
from process, build, and connection state. Editor cameras do not become game cameras. Preview
gestures do not become permanent authoring changes until one validated command commits them. Stale
selections and late results remain visibly stale instead of quietly attaching themselves to the
wrong project or revision.

It also makes Studio more useful. Because it is not carrying the engine inside its interface, it
can focus on the thing only it can do: help a person see, understand, and direct the work.

## What exists, and what comes next

Today, Studio is a portable React editor hosted first in a macOS Tauri application. It has a
launcher, recent projects, a live game view, native terminal, controls, inspection, activity, and a
settings page. Its four resizable panels are a working shell, not yet the composable workspace
described here.

The next proof is focused: native ACP conversation, selection that resolves to stable Framework
entities, and click-to-agent context. The broader mini-app contract, reusable GPU viewports,
persistent workspaces, durable feedback, sandboxes, and expanded authoring modes still need to be
designed and proven. Questions such as app isolation, agent transcripts, feedback retention,
multi-agent work, accessibility targets, and cross-platform packaging remain real decisions - not
details we will hide behind a mockup.

But the destination is not ambiguous.

The future of game development is not a person operating a larger control panel. It is a person
working at the level of intent - looking, pointing, judging, and imagining - while agents handle more of
the distance between an idea and a playable result.

Antiky Studio is the place where that relationship becomes visible.
