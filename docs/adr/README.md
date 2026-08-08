# Architecture Decision Records

An Architecture Decision Record (ADR) records one important decision about the Antiky architecture.
It explains why the decision was necessary and what results we expect.

An ADR is a short, permanent record. It is not a proposal, a design specification, or an
implementation plan.

Core Contributors write and own ADRs after they make an architecture decision. Contributors propose
changes through an [Antiky Improvement Proposal (AIP)](../aip/README.md).

An accepted AIP can produce no ADR, one ADR, or more than one ADR. Each ADR must make sense without
the AIP. When applicable, the ADR must also link to the AIP.

> Note from the creator: ADRs and AIPs form the foundation of what we state as true about the game engine and systems surrounding it. It is what we hold AI accountable to as it builds. It is what allows us to not have to inpsect every line of code AI writes. We inspect every line of ADRs and AIPs. We inspect every line of GOOD_ENGINEERING and every line of VISION_DIRECTION. These things are non-negotiables. With this and smartly placed AGENTS.md and CLAUDE.md files along with good planning practices, AI becomes extremely well versed and directionally aligned with our decisions and desires. If you find something at fault in an ADR or accepted AIP, please do raise an issue loudly! Disasterous ADRs can be disasterous for the platform.

## Records

### Framework

- [0001: Represent world data with entities and components](framework/0001-entity-component-system_H.md)
- [0002: Record only events that need durable history](framework/0002-event-sourcing_H.md)
- [0003: Use one engine API for humans and agents](framework/0003-agent-native_H.md)
- [0004: Give equal support to 2D, 3D, and 2.3D games](framework/0004-23d_H.md)
- [0005: Share one ability system across Antiky games](framework/0005-game-ability-system_H.md)
- [0006: Keep BroMetal inside the Antiky render driver](framework/0006-brometal-render-driver_H.md)
- [0007: Use commands to change world state](framework/0007-commands-as-mutation-boundary_H.md)
- [0008: Let EngineSession own worlds](framework/0008-engine-session-owns-worlds_H.md)
- [0009: Keep authoring, runtime, and render state separate](framework/0009-separate-state-projections_H.md)
- [0010: Serialize data only when it crosses a real boundary](framework/0010-serialize-at-boundaries_H.md)
- [0011: Use stable IDs and temporary numeric aliases](framework/0011-stable-ids-and-runtime-aliases_H.md)
- [0012: Let the server decide online game state](framework/0012-server-authoritative-simulation_H.md)
- [0013: Give the simulation all inputs explicitly](framework/0013-explicit-simulation-inputs_H.md)
- [0014: Apply approved sandbox changes through commands](framework/0014-promote-sandbox-commands_H.md)
- [0015: Support WebGPU only](framework/0015-webgpu-support-only_H.md)
- [0016: Give platform work to the game host](framework/0016-give-platform-work-to-game-host_H.md)
- [0017: Stop an engine session after a game-code fault](framework/0017-stop-engine-session-after-game-code-fault_H.md)
- [0018: Select physics authority and physics execution independently](framework/0018-select-physics-authority-and-execution-independently_H.md)
- [0019: Use Rapier for CPU physics and Nexus for GPU physics](framework/0019-use-rapier-for-cpu-physics-and-nexus-for-gpu-physics_H.md)
- [0020: Keep game code and game hosts in different modules](framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)

### CLI

- [0001: Use MCP Tools for local development operations](cli/0001-use-mcp-tools-for-development_H.md)
- [0002: Supply CLI project services through a library API](cli/0002-supply-cli-project-services-through-a-library-api_H.md)
- [0003: Make CLI project services the development authority](cli/0003-make-cli-project-services-the-development-authority_H.md)

### Studio

- [0001: Let users choose their AI coding tools](studio/0001-ai-integrations_H.md)
- [0002: Keep the Studio web editor independent from Tauri](studio/0002-tauri-portable-web-editor_H.md)
- [0003: Attach each feedback comment to its exact target](studio/0003-contextual-feedback-queue_H.md)
- [0004: Make CLI and Studio use the same engine services](studio/0004-share-engine-services-with-cli_H.md)
- [0005: Use one Antiky project manifest](studio/0005-use-one-antiky-project-manifest_H.md)
- [0006: Use CLI project services directly](studio/0006-use-cli-project-services-directly_H.md)
- [0007: Use Antiky Framework first and select the renderer in the game module](studio/0007-framework-first-allow-others_H.md)

## Minimal format

This format is based on the original ADR format from Michael Nygard. Each ADR has five parts:

- Title
- Status
- Context
- Decision
- Consequences.

Each short record contains one important decision. Record numbers always increase. The project keeps
records after a new decision replaces them.

An ADR must contain the facts and requirements that support its decision. An ADR must not use an
objective, goal, feedback record, or implementation plan as authority. A planning document can link
to an ADR. An ADR cannot link back to that planning document.

The [MADR minimal template](https://github.com/adr/madr/blob/4.0.0/template/adr-template-minimal.md)
also includes the options that authors considered. Antiky usually keeps that analysis in the related
AIP. An ADR includes it only when readers need it to understand the decision.

Use this template:

```markdown
# NNNN: Short decision title

## Status

Accepted

## Context

Describe the facts, limits, and needs that make the decision necessary.

## Decision

State the decision in active voice. For example, write "We will..."

## Consequences

Describe the benefits, costs, and other results of the decision.
```

Keep the format small. Add links or a short list of options only when the context or AIP does not
contain necessary information.

## Status values

- **Accepted.** The decision controls new work.
- **Deprecated.** The project keeps the decision for history, but it does not control new work.
- **Superseded.** A newer ADR replaces the decision. Name and link the new ADR in the status.

New ADRs usually have the `Accepted` status. Core Contributors make the decision before they add the
ADR. Proposal and review information belongs in the AIP or pull request.

## File and writing rules

- Name records `NNNN-short-title_H.md`, using the next four-digit number. Numbers are never reused.
- Core Contributors write, approve, and own ADRs. The `_H` suffix follows the ownership rule in the
  [documentation index](../README.md#document-ownership).
- Keep one important architecture decision in each record.
- Link the related AIP in the context when one exists.
- Link other evidence only when it helps readers understand the decision.

## Writing standard

All ADRs must use
[ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/). Use the current issue of the
standard.

These rules are especially important for Antiky ADRs:

- Use approved words and established technical terms.
- Give one meaning to each term. Use the same term each time.
- Explain an uncommon Antiky or software term when it first occurs.
- Use active voice.
- Keep one topic in each sentence.
- Use no more than 25 words in a descriptive sentence.
- Use a vertical list when it makes complex text easier to understand.
- Do not use a semicolon.
- Use an `-ing` word only when the standard approves it or it is a technical term.
- Put a condition before the result when the reader must know the condition first.

Do not remove a necessary technical detail only to make a sentence shorter. Explain the detail with
short sentences and consistent terms.

## Changing a decision

An accepted ADR is a historical record. When a decision changes, create a new ADR. Change the old
status to `Superseded by` and link the new ADR. Do not delete the old ADR or reuse its number.

For a clarification that must be made in place, tag the committed version before editing it:

```sh
./docs/adr/tag-hash.sh docs/adr/0001-example.md "Clarified the boundary of the decision."
```

The script adds a revision-history entry. The entry contains the current full Git commit hash and an
optional explanation. Run the script while `HEAD` still contains the previous text. Then, edit the
ADR.

## Research sources

- [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/), the required writing
  standard for Antiky ADRs.
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
  the original short ADR format from Michael Nygard.
- [ADR Templates](https://adr.github.io/adr-templates/), a comparison of common ADR formats.
- [MADR 4.0 minimal template](https://github.com/adr/madr/blob/4.0.0/template/adr-template-minimal.md).
  This short format includes the options that authors considered.
