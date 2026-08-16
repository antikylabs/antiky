# Execute goal 17: reconcile the architecture record and prepare owner decisions

## Prerequisites

- [Goal 99](_completed/execute-goal-99.md) is complete. This goal needs R1 and the resolved R2 through
  R4 findings from its [summary](_completed/summary-goal-99.md).
- Read all accepted Framework, CLI, and Studio ADRs, not only the records named by the older audits.
- Read [`08-ADR-IMPACT.md`](../08-ADR-IMPACT.md),
  [`recent-architecture-learnings-2026-08-10.md`](../../scratch/recent-architecture-learnings-2026-08-10.md),
  and [`UNDER_REVIEW_A.md`](../../../../adr/UNDER_REVIEW_A.md) as proposals, not authority.
- This goal can run beside Goals 16 and 18. It does not own their code or dependency files.

### Needed from the owner before starting

Nothing. This goal can audit the record, update proposal material, and prepare decision-ready drafts.
It must stop before it changes an accepted `_H` record or files a new accepted ADR without the
owner's explicit decision and instruction.

## `/goal` objective

Produce one current architecture decision packet from the two overlapping audits and the accepted
record that now exists. The packet must separate already-resolved decisions, implementation work,
owner-approved clarifications, and genuinely missing architecture decisions.

This goal delivers the ADR reconciliation requested by Goal 99 R1 at
[`execute-goal-99.md:81`](_completed/execute-goal-99.md), the candidate set in
[`recent-architecture-learnings-2026-08-10.md:10-23`](../../scratch/recent-architecture-learnings-2026-08-10.md),
and the older candidate analysis in [`08-ADR-IMPACT.md:307-486`](../08-ADR-IMPACT.md).

## Required outcome

When the work is complete, the repository must have:

1. `16-ADR-RECONCILIATION.md`, a source-backed matrix that gives every candidate in the two audits
   one disposition: accepted record, implementation work, proposed decision, clarification needing
   owner instruction, dormant trigger, or withdrawn duplication;
2. `17-ADR-PROPOSALS.md`, outside `docs/adr/`, containing decision-ready draft proposals for each
   genuinely missing decision, with the four-part `write-adrs suggest` analysis;
3. `docs/adr/UNDER_REVIEW_A.md` updated so its open candidates agree with the current accepted ADRs
   and consolidate overlapping asset and presentation candidates;
4. an explicit reconciliation of these five likely missing decisions: reproducible visual evidence,
   general asset provenance and derivation, native Studio command routing, game-owned presentation
   projection and GPU-resource lifetime, and the linear-color transfer boundary;
5. a separate proposed clarification packet for CLI ADR 0001's frozen tool enumeration and Framework
   ADR 0021's verified STE defects, with the owner action and `tag-hash.sh` sequence named; and
6. an explicit no-action result for resolved or rejected candidates, including render-driver
   ownership, explicit random seeds, local BroMetal patching, renderer selection, dynamic ports,
   one-command launch, and private website publication details.

## In scope

- **Accepted-record reconciliation.** Check Framework ADRs 0003, 0009, 0010, 0013, 0020, 0021,
  and 0022; CLI ADRs 0001 through 0003; and Studio ADRs 0002, 0005, 0006, and 0007. Expand the set
  when another accepted record bears on a candidate.
- **Proposal consolidation.** Broaden under-review candidate 11 from voxel-only wording to the
  general catalog/source/runtime asset boundary if the code evidence supports it. Sharpen candidate
  14 around game presentation and render-driver resource ownership without inventing one shared
  projection framework.
- **New candidates.** Add proposal entries for visual-evidence authority, native Studio commands,
  and linear color only if no accepted record already decides them.
- **Clarifications.** Preserve the exact current text before any future owner-approved edit to CLI
  ADR 0001 or Framework ADR 0021. This goal documents the edits; it does not perform them.
- **Terminology and STE.** List necessary technical nouns and verbs, audit draft ADR text against
  ASD-STE100 Issue 9, and report machine checks separately from human judgment.

## Required tests and evidence

At minimum, prove:

- every claim that a decision is missing cites current code or accepted ADRs, not an objective or
  implementation plan as its authority;
- every candidate from `08-ADR-IMPACT.md` sections 2 and 3 and all four candidates in the recent
  architecture note appears exactly once in the reconciliation matrix;
- ADR 0021 resolves the old render-owner and patch-policy candidates, and ADR 0022 resolves GPU-ID
  selection, without duplicating either decision;
- the visual-evidence proposal distinguishes stable architectural ownership from browser versions,
  pixel limits, and retention values that remain versioned policy;
- the asset proposal distinguishes catalog identity, verified source intake, and derived runtime
  artifacts, and states its relationship to under-review candidate 11;
- the Studio proposal preserves the portable `EditorHost` boundary and CLI project authority;
- the presentation proposal preserves separate authoring, runtime, render, and GPU-resource state
  and does not require a premature shared projection framework;
- all relative links in the two new planning documents and `UNDER_REVIEW_A.md` resolve;
- the STE machine report and the judgment audit are recorded separately; and
- `git diff --check` exits zero.

## Explicit non-goals

- Do not create or modify an accepted `_H` ADR without a later explicit owner instruction.
- Do not assign an ADR number to a proposal or put a draft inside `docs/adr/`.
- Do not cite Goal 99, either architecture-learning note, or an objective as authority inside draft
  ADR text. Use them only to find current facts and accepted constraints.
- Do not turn implementation details such as dynamic ports, browser revisions, pixel limits,
  package versions, or current demo probes into architecture decisions.
- Do not create a capture-process ADR, seeded-RNG ADR, general promotion-rule ADR, or fixed-step-rate
  ADR; the prior audit already showed why those are implementation or governance questions.
- Do not rewrite accepted ADRs only to make their language cleaner.

## Engineering constraints

- Follow `docs/adr/AGENTS.md`, `docs/adr/README.md`, the `write-adrs` workflow, and the repository's
  Simplified Technical English requirements for any draft record.
- Keep one important decision per proposed draft. State benefits, costs, and reversal impact.
- A proposal must say what breaks without the decision and what changes if the owner accepts it.
- Preserve human ownership visibly: proposal status is not `Accepted`, and proposed numbers are
  informational only.
- Make a short focused documentation commit without coauthor tags and preserve unrelated worktree
  changes.

## Completion definition

The goal is complete only when the two audits, the under-review list, current code, and accepted ADRs
agree in one traceable matrix; every genuinely missing decision has a reviewable proposal; every
resolved or non-architectural item is withdrawn explicitly; and the owner can decide the remaining
items without first repeating this investigation.

If evidence does not establish that a decision is missing, withdraw the candidate. If a proposal
would change an accepted decision, stop at the proposal and name the supersession path instead of
editing the old record in place.
