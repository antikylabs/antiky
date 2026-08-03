# Architecture Decision Records

Architecture Decision Records (ADRs) capture the important architectural choices that shape Antiky.
Each record preserves one decision, the forces behind it, and the effects future contributors need
to understand.

ADRs are short systems of record, not proposals, design specifications, or implementation plans.
Core Contributors write and own ADRs after making an architectural decision. Contributors propose
changes through an [Antiky Improvement Proposal](../aip/README.md); when an accepted AIP produces an
architectural decision, each resulting ADR links that AIP while remaining understandable on its own.

An accepted AIP may produce zero, one, or several ADRs. Improvements without an architectural
decision need no ADR, while a broad proposal may require several independent architectural records.

## Records

### Framework

- [0001: Use semantic entities and components](framework/0001-entity-component-system_H.md)
- [0002: Selectively event-source durable state](framework/0002-event-sourcing_H.md)
- [0003: Give humans and agents one engine surface](framework/0003-agent-native_H.md)
- [0004: Support 2D, 3D, and 2.3D as first-class modes](framework/0004-23d_H.md)
- [0005: Build a reusable Antiky Ability System](framework/0005-game-ability-system_H.md)
- [0006: Keep BroMetal behind an Antiky render driver](framework/0006-brometal-render-driver_H.md)
- [0007: Use commands as the mutation boundary](framework/0007-commands-as-mutation-boundary_H.md)
- [0008: Put EngineSession above World](framework/0008-engine-session-owns-worlds_H.md)
- [0009: Separate authoring, runtime, and render state](framework/0009-separate-state-projections_H.md)
- [0010: Serialize only at real boundaries](framework/0010-serialize-at-boundaries_H.md)
- [0011: Use stable IDs and disposable runtime aliases](framework/0011-stable-ids-and-runtime-aliases_H.md)
- [0012: Make online simulation server-authoritative](framework/0012-server-authoritative-simulation_H.md)
- [0013: Make simulation inputs explicit](framework/0013-explicit-simulation-inputs_H.md)
- [0014: Promote sandbox changes through commands](framework/0014-promote-sandbox-commands_H.md)

### Studio

- [0001: AI Integration](studio/0001-ai-integrations_H.md)
- [0002: Host a portable web editor in Tauri](studio/0002-tauri-portable-web-editor_H.md)
- [0003: Attach queued feedback to specific targets](studio/0003-contextual-feedback-queue_H.md)

## Minimal format

This format is a small adaptation of Michael Nygard's original ADR format. Nygard identifies five
essential parts: title, status, context, decision, and consequences. His guidance also recommends one
significant decision per short record, monotonically increasing numbers, and preserving superseded
records. The [MADR minimal template](https://github.com/adr/madr/blob/4.0.0/template/adr-template-minimal.md)
adds considered options; Antiky normally keeps that analysis in the originating AIP and repeats it in
an ADR only when it is necessary to understand the decision.

Use this template:

```markdown
# NNNN: Short decision title

## Status

Accepted

## Context

Describe the facts, constraints, and competing forces that make a decision necessary.

## Decision

State the decision in active voice: "We will ..."

## Consequences

Describe the positive, negative, and neutral results of the decision.
```

The format is intentionally small. Add links or a brief list of considered options only when they
preserve rationale that is not available in the context or originating proposal.

## Status values

- **Accepted:** The decision governs the project.
- **Deprecated:** The decision is retained for history but should no longer guide new work.
- **Superseded:** A newer ADR replaces this decision; name and link the replacement in the status.

ADRs normally enter the repository as `Accepted` because Core Contributors have already made the
decision. Proposal and review state belongs in the originating AIP or pull request, not in the
permanent ADR lifecycle.

## File and writing rules

- Name records `NNNN-short-title_H.md`, using the next four-digit number. Numbers are never reused.
- Core Contributors author, approve, and own ADRs; the `_H` suffix follows the ownership convention
  in the [docs index](../README.md#document-ownership).
- Keep one architecturally significant decision in each record.
- Write context neutrally, state the decision in full sentences, and include drawbacks as well as
  benefits under consequences.
- Link the originating AIP in the context when one exists. Link other evidence when it materially
  explains the decision.

## Changing a decision

Accepted ADRs are historical records. When a decision changes, normally create a new ADR and mark
the old one `Superseded by` the new record. Do not delete the old record or reuse its number.

For a clarification that must be made in place, tag the committed version before editing it:

```sh
./docs/adr/tag-hash.sh docs/adr/0001-example.md "Clarified the boundary of the decision."
```

The script appends a revision-history entry containing the current full Git commit hash and the
optional explanation. Run it while `HEAD` still represents the previous version, then make the edit.

## Research sources

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
  Michael Nygard's original lightweight ADR proposal.
- [ADR Templates](https://adr.github.io/adr-templates/), a comparison of the Nygard, MADR, and
  Y-statement formats maintained by the ADR organization.
- [MADR 4.0 minimal template](https://github.com/adr/madr/blob/4.0.0/template/adr-template-minimal.md),
  a compact alternative that makes considered options explicit.
