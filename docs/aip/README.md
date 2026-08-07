# Antiky Improvement Proposals

Antiky Improvement Proposals (AIPs) are how contributors propose meaningful changes to Antiky. An
AIP may address a feature, product direction, development process, governance rule, architecture, or
another improvement that benefits from discussion and alignment. AIPs are not limited to
architectural changes.

Small, self-contained fixes may go directly through the contribution process described in
[CONTRIBUTING.md](../../CONTRIBUTING.md). Use an AIP when a change is broader, introduces important
tradeoffs, or needs agreement before implementation.

## Ownership and review

- Any contributor may write and submit an AIP.
- The author owns the proposal and revises it in response to review.
- Core Contributors review AIPs and decide whether to accept them.
- Acceptance approves the proposal's direction. It does not turn the AIP into an architecture
  record.

## Lifecycle

- **Draft:** The author is developing the proposal and seeking early feedback.
- **Submitted:** The proposal is ready for review and a decision.
- **Accepted:** Core Contributors approved the proposed direction.
- **Rejected:** Core Contributors considered the proposal and declined it.
- **Withdrawn:** The author removed the proposal from consideration.
- **Superseded:** A newer AIP replaces the proposal; link the replacement in the status.

Draft and submitted AIPs may change as contributors refine the idea. Retain AIPs after a final
decision so the alternatives and discussion remain available as project history.

## Relationship to ADRs

An accepted AIP may produce zero, one, or several
[Architecture Decision Records](../adr/README.md):

- AIPs can cover improvements that require no architectural decision and therefore no ADR.
- When an AIP leads to an architectural decision, Core Contributors write the ADR after making that
  decision.
- Each resulting ADR should link its source AIP while remaining understandable on its own.
- The AIP preserves the proposal and deliberation; the ADR is the authority on the architecture that
  was ultimately chosen.

The usual flow is:

`Contributor proposes an AIP → Core Contributors decide → Core Contributors record any ADRs → implementation`

## What to include

Keep an AIP complete but concise, preferably under 500 lines. Include:

1. Its current status.
2. What the proposal changes.
3. Why the change is valuable.
4. The proposed approach and scope.
5. Alternatives that were considered.
6. Positive, negative, and neutral effects.
7. What happens if the project does not adopt it.
8. Any likely architectural decisions that Core Contributors may need to record as ADRs.
