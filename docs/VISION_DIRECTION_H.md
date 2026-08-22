# Vision & Direction

Antiky Labs, and all of the packages and systems in this repository, have two main goals:

1. Build our own online ARPG using the 2.3D art direction we have established for the game.
2. Build the framework and studio we need to iterate on and create that game.

The framework and studio are built on top of BroMetal for graphics rendering. They are AI-native so
that AI can help us build the game beyond basic integrations.

## Who we are building for

We want the Antiky Framework to be lightweight, straightforward, and reusable. We should be able to
use it across multiple games and demos, while allowing others to build on top of it as they see fit.

However, the primary user is Antiky Labs - ourselves. We will consider proposals and directions that
do not conflict with the direction of the games we are building.

## Framework foundations

The framework will be founded on its data and entity systems, along with the concepts of worlds and
engine sessions. Worlds and sessions will let us sandbox changes and work on systems without
interacting with the main world. Agents will be able to build, grow, and test systems without
affecting that world, then compare the results.

The framework will also be event-sourcing-native. Major state changes will happen through commands
and events so that they can be replayed and undone.

We also want to build repeatable systems, including systems such as the game ability system.

## How we work

We build technical demos that explore the direction we want to go. We keep those demos as close to
raw proofs of concept as possible: reuse the BroMetal and Antiky Framework pieces that exist today,
then hand-write what does not.

When something is missing, we categorize it:

- Is this a BroMetal capability?
- Is this an Antiky Framework capability?
- Is this an Antiky Studio capability?
- Can we make it repeatable, or is it custom to Emberwyrd itself?

When a feature belongs to BroMetal, Antiky Framework, Antiky Studio, or Emberwyrd, we implement it
in the project that owns it.

In this way, the systems naturally grow over time to support the development of our game and other
games. This keeps us from trying to boil the entire ocean. We do not want to create a perfect game
engine out of the gate. We want to create individual slices, foundations, and incremental features
as we need them.

## The Studio experience

Our vision is that, eventually, we will be able to do 95% of our work through Antiky Studio. We will
talk to Claude Code or Codex through an integrated terminal, and those tools will interact directly
with a live canvas editor in the Studio.

We will also interact with that editor ourselves. In detached mode, we can work directly with a
scene and move objects around. In play mode, the editor locks us into the player's camera view.

To support this workflow, the framework will have native MCP and session systems that run locally in
developer mode. Claude Code, Codex, and the Studio will be able to connect to those systems and
inspect scenes directly.

We also want feedback to be directly connected to the thing it describes. We should be able to click
any item in the Studio and submit feedback that includes the selected resource and its details.
Instead of giving general feedback such as, "The grasses are not green enough," we can click a blade
of grass and say, "This grass is not green enough." The feedback will include the entity IDs and
full world hierarchy for that object, giving the AI a direct place to inspect and change instead of
making it guess what we meant.

## The broader goal

We hope the Antiky Framework and Antiky Studio become valuable tools for AI-native developers who
want to build true, production-grade games rather than one-shot AI demos.

We also want to contribute to BroMetal, continue its growth, and help build an ecosystem and
community around it for game builders.

We understand that parts of this direction may conflict with current game industry standards around
AI, but we believe this is the direction of the future. We want to enable it, and we want to be a
positive force for enablement.

We will push back against negativity and against hostile or toxic cultures in game development and
AI development.

We are a company that believes in enabling others to be successful.
