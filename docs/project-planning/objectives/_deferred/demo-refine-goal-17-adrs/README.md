# Deferred architecture reconciliation from demo-refining

**Status:** Deferred as acceptable architecture debt
**Deferred:** 2026-08-16
**Original work:** Demo-refining Goal 17
**Owner action now:** None

## Why this work is deferred

The owner chose to finish the demo-refining objective without another architecture-review cycle.
The repository has accepted records that govern current implementation, and none of the candidate
decisions blocks Goals 16, 18, or 19. Deferring this work changes no runtime behavior and authorizes
no architecture change.

The cost is deliberate. Some repeated boundaries remain documented only in code and planning
evidence. Two accepted ADRs also contain clarification or language debt. That debt is acceptable
until one of the observable triggers below occurs.

This packet is a restart point, not authority. Current code and accepted ADRs win whenever they
disagree with these files.

## What was deferred

[The original goal contract](execute-goal-17.md) had two phases:

1. Reconcile the older demo ADR audit, recent architecture evidence, current code,
   `UNDER_REVIEW_A.md`, and every relevant accepted Framework, CLI, and Studio ADR.
2. Present the resulting proposals and exact clarification diffs to the owner. Submit only the
   decisions the owner explicitly accepts.

The goal was not executed and produced none of its deliverables. No reconciliation matrix or
proposal packet was created. No ADR number was assigned. No accepted `_H` record or
`UNDER_REVIEW_A.md` entry changed.

## Candidate decisions preserved for later

| Candidate | Stable question | Reopen when |
|---|---|---|
| Reproducible visual evidence | Does the CLI development authority own capture identity, freshness, reproducibility, and bounded retention as one architecture contract? | Evidence semantics change, another service consumes captures, or release decisions depend on stronger proof. |
| Asset provenance and derivation | Which record is authoritative across catalog identity, verified source intake, and derived runtime artifacts? | Another asset pipeline appears, publication needs provenance enforcement, or mutable provider data causes ambiguity. |
| Native Studio command routing | Must every native menu, picker, and operating-system action become the same typed action used by the portable editor and CLI project authority? | Studio adds its next native integration or a second project-state path appears. |
| Presentation projection and resource lifetime | Which game-owned projection boundary feeds render data, and which render-driver boundary owns GPU allocation and disposal? | Another implementation repeats the boundary, resource ownership becomes ambiguous, or shared extraction is proposed. |
| Linear-color transfer boundary | Where must source decoding, linear rendering, tone mapping, and output encoding occur? | A new backend or post-process path appears, or two render paths disagree about transfer functions. |

These are candidates, not decisions. A future review must first prove that accepted ADRs do not
already settle them.

## Accepted-record debt preserved for later

| Record | Debt | Reopen when |
|---|---|---|
| CLI ADR 0001 | Its frozen MCP tool enumeration no longer describes the full tool surface. The architectural rule still holds. | The tool surface changes again or the owner requests a record-accuracy pass. |
| Framework ADR 0021 | The Issue 9 machine audit reported 37 errors, 11 warnings, and 6 informational findings. Some findings are real; others are technical-term or Markdown-parser noise. | The owner authorizes language repair or a substantive change already requires a revision. |

Do not edit either accepted record only to make prose look cleaner. Preserve the old text and use
the tag-hash workflow after explicit owner instruction.

## Decisions already settled or not architectural

Do not reopen these items as new ADRs without new contradictory evidence:

- ADR 0021 settles BroMetal render-driver ownership and the local-patch policy.
- ADR 0022 settles GPU-facing Antiky identifier selection.
- Explicit random seeds are implementation work under ADR 0013.
- Renderer selection is already a game-module decision.
- Dynamic ports, browser revisions, pixel limits, retention values, package versions, current demo
  probes, and one-command launch behavior are versioned implementation policy.
- Private website publication details do not need another decision while the existing candidate
  remains adequate.

## Evidence retained here

- [`sources/08-ADR-IMPACT.md`](sources/08-ADR-IMPACT.md) is the older candidate and compliance audit.
  Many line numbers and implementation facts are historical and must be refreshed.
- [`sources/recent-architecture-learnings-2026-08-10.md`](sources/recent-architecture-learnings-2026-08-10.md)
  records the four later decision areas.
- [`sources/0021-FINAL-DRAFT-FOR-APPROVAL.md`](sources/0021-FINAL-DRAFT-FOR-APPROVAL.md) preserves
  the original ADR 0021 language review and owner-approval context. The live accepted ADR remains
  authoritative.

The accepted ADRs and [`docs/adr/UNDER_REVIEW_A.md`](../../../../adr/UNDER_REVIEW_A.md) remain in
their authoritative locations and are not copied into this packet.

## Restart procedure

1. Read the live accepted Framework, CLI, and Studio ADRs and verify their integrity tags.
2. Refresh every code path, package version, pull-request state, and public claim cited by the
   retained audits.
3. Build one source-backed reconciliation matrix. Give every old candidate exactly one current
   disposition.
4. Draft genuinely missing decisions outside `docs/adr/`. Keep one decision per proposal and audit
   it against ASD-STE100 Issue 9.
5. Present the matrix, proposals, and exact clarification diffs at one owner checkpoint.
6. After explicit owner decisions, assign current ADR numbers, submit accepted records, apply only
   authorized clarifications, update indexes, and run the old/new tag-hash verification.
7. Record rejected and deferred candidates so no ambiguous backlog remains.

Do not resume by moving this folder back into demo-refining or executing the old contract without
refreshing it. Start a current architecture objective and use this packet as historical evidence.

## Effect on demo-refining

Goal 17 is removed from the active demo-refining sequence. Goals 16 and 18 can proceed independently,
and Goal 19 still depends only on its existing Goal 16 file lock and Goal 18 observation seam.
Architecture reconciliation is not a completion condition for those goals or for closing the
demo-refining objective.
