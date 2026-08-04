# Slice 01 Owner Input

## Status

`ANSWERED`

## Purpose

This file contains the Slice 01 questions that need product-owner judgment. You do not need to read
the complete [Slice 01 plan](plan.md) to answer them.

The Slice 01 goal reads this file before it changes code. A `PENDING` answer stops the goal.

## How to answer

Replace each `PENDING` value with `APPROVE` or your preferred direction. Add a short note when you
change the recommendation.

When all answers are complete, change the status at the top to `ANSWERED`.

## Inherited direction

Slice 01 inherits these decisions:

- Slice 00 must be complete.
- CLI, Studio, MCP, and tests use the same framework services.
- Studio does not own a second engine API.
- The current `town-study` route remains the reference during the port.

## Question 1: Is one market lamp the first complete framework feature?

### Context

The west market lamp already has a stable place in the current town. Its base power can move through
authoring, runtime, render, inspection, and undo without moving the complete town at once.

This change gives a visible result and tests the complete framework path.

### Recommendation

Use `Market Lamp West 01`. Start at power `1.05`. Let one authorized command set power from `0`
through `4`. Require correction-based undo and no unrelated visual change.

### Owner answer

`APPROVE`

## Question 2: How much general framework structure should Slice 01 add?

### Context

One lamp needs stable IDs, two component records, one command, a small accepted-event history,
projections, and inspection.

A generic registry or complete entity-component-system could support future objects. The repository
does not yet have a second consumer that proves those shapes.

### Recommendation

Build a narrow feature-first lamp service. Keep its maps and storage private. Add a general API only
after another feature proves the shared boundary.

### Owner answer

`REPLACE`

Build reusable point-light parts that support more lamps. Use `Market Lamp West 01` as the first
visible consumer. Do not hard-code the framework to one lamp. Add broader framework abstractions
only after another feature proves the shared boundary.

## Work that does not need owner input

The implementation agent captures baselines, assigns the fixed UUIDv7 fixture, selects test tools,
allocates run resources, measures BroMetal writes, and records evidence.

The agent must add a new owner question only if a finding changes product scope, the visible result,
a public contract, or an accepted architecture decision.
