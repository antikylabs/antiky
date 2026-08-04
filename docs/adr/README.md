# Architecture Decision Records

An Architecture Decision Record (ADR) records one important decision about the Antiky architecture.
It explains why the decision was necessary and what results we expect.

An ADR is a short, permanent record. It is not a proposal, a design specification, or an
implementation plan.

Core Contributors write and own ADRs after they make an architecture decision. Contributors propose
changes through an [Antiky Improvement Proposal (AIP)](../aip/README.md).

An accepted AIP can produce no ADR, one ADR, or more than one ADR. Each ADR must make sense without
the AIP. When applicable, the ADR must also link to the AIP.

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

### Studio

- [0001: Let users choose their AI coding tools](studio/0001-ai-integrations_H.md)
- [0002: Keep the Studio web editor independent from Tauri](studio/0002-tauri-portable-web-editor_H.md)
- [0003: Attach each feedback comment to its exact target](studio/0003-contextual-feedback-queue_H.md)
- [0004: Make CLI and Studio use the same engine services](studio/0004-share-engine-services-with-cli_H.md)

## Minimal format

This format is based on the original ADR format from Michael Nygard. Each ADR has five parts:

- Title
- Status
- Context
- Decision
- Consequences.

Each short record contains one important decision. Record numbers always increase. The project keeps
records after a new decision replaces them.

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
