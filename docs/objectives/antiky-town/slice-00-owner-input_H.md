# Slice 00 Owner Input

## Status

`WAITING FOR OWNER`

## Purpose

This file contains the Slice 00 questions that need product-owner judgment. You do not need to read
the complete [Slice 00 plan](slice-00-plan.md) to answer them.

The Slice 00 goal reads this file before it changes code. A `PENDING` answer stops the goal.

## How to answer

Replace each `PENDING` value with `APPROVE` or your preferred direction. Add a short note when you
change the recommendation.

When all answers are complete, change the status at the top to `ANSWERED`. Then run the goal from
the Slice 00 plan.

## Direction already recorded

Your review on 2026-08-04 supplied these requirements:

- Slice 00 starts the `@antiky/cli` package and the `antiky` command.
- Antiky Framework owns semantic inspection and engine measurements.
- The CLI owns local launch, process, build, connection, and cleanup work.
- CLI and Studio are separate clients of the same engine services.

[ADR 0004](../../adr/studio/0004-share-engine-services-with-cli_H.md) records the CLI and Studio
decision.

## Question 1: Which town must the CLI launch first?

### Context

The working town is the `town-study` demo in the current Next.js host. The `antiky-town` folder is
still an empty port target.

A new host or a pass-through `antiky-town` route would add migration work before Antiky has its
first framework behavior.

### Recommendation

Use the current `town-study` route and Next.js host for Slice 00. Slice 01 will create the first real
`antiky-town` framework consumer.

### Owner answer

`PENDING`

## Question 2: Which clients must Slice 00 prove?

### Context

The CLI, Studio, MCP, and tests must use the same engine services. Studio does not have a working UI
or host yet.

Adding a Studio UI to Slice 00 would make the harness slice much larger. Deferring all agent access
would leave the shared inspection boundary unproved.

### Recommendation

Prove direct framework inspection, CLI inspection, and MCP inspection in Slice 00. Supply a stable
connection contract for Studio, but do not build a Studio panel or desktop host in this slice.

### Owner answer

`PENDING`

## Question 3: Is WebGPU Inspector required for completion?

### Context

WebGPU Inspector can show GPU objects, commands, and validation details. It cannot report Antiky
session authority, build state, engine state, or semantic measurements.

Making the browser extension mandatory would add a browser-specific dependency to the normal
development loop.

### Recommendation

Keep WebGPU Inspector optional. Use it for difficult GPU faults and later render work. Use Antiky's
own inspection service for Slice 00 acceptance evidence.

### Owner answer

`PENDING`

## Work that does not need owner input

The implementation agent will do this work:

- Capture the current launch, visual, update, failure, and cleanup baselines.
- Select and record a supported local WebGPU browser and MCP test client.
- Select narrow dependencies and pin their exact versions in the lock file.
- Allocate a clean worktree, explicit ports, browser profile, and evidence directory.
- Measure startup, update, payload, and cleanup behavior.
- Run all tests and record the evidence receipt.

The agent must ask a new owner question only if a finding changes product scope, a public contract,
or an accepted architecture decision.
