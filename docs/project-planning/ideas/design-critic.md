# A critic for design choices, not just for defects

**Recorded:** 2026-08-12
**Status:** a real gap, found the expensive way. Not yet a plan.
**Origin:** owner, after the third camera-shake round — "we did have a bad *game design* choice, and
no way to have a critic gut check us on it."

## What happened

The camera took three rounds to get right, and the tooling came out of it well: each round the
defect was **identified** rather than guessed at. The measurement named the cause every time.

- Round 1: "shakes and judders too much" → trauma model rebuilt, autocorrelation 0.697 → 0.273.
- Round 2: "still shakes on a regular interval" → the shake was innocent (1.4% of frames). The
  camera had no smoothing, and a threat switch moved the look-at target **0.4046 units in one
  frame**. Eased, plus hysteresis: 0.0466, zero snapping frames.
- Round 3: "that jumping still makes me nauseous, turn that shit off" → off.

Every round measured correctly, fixed what it measured, and shipped a camera the owner could not
stand to look at. **The measurement was never wrong. The design was.**

## The gap, stated precisely

The repository can now answer *"is this frame well-formed?"* and *"is this motion well-formed?"*
with numbers an agent can act on. It cannot answer **"should this exist at all?"**

Nothing in the harness could have said: *a third-person camera that leads velocity, swings with aim,
lurches at threats, drops on dash and shakes on impact is five simultaneous sources of unrequested
motion, and that is a nausea risk regardless of how smoothly each one is implemented.*

That is not a measurement failure. It is a missing **review**, and it is upstream of every budget:
by the time a budget exists, the decision it measures has already been made.

## Why the existing critics do not cover it

The critic recorded in the [demo-refining archive](../objectives/_archives/demo-refining-summary.md)
judged **whether a measurement measured what it claimed**. It caught a real error —
`luminanceSpread` tracked peak brightness rather than contrast. That is a critic for *instruments*.

What is missing is a critic for *intent*: given what this feature is trying to do, is doing it a
good idea, and does the way it is proposed have a known failure mode?

## What it would need to be useful

The trap is obvious and worth naming first: **a design critic that produces plausible-sounding
opinions is worse than none**, because it launders a guess into a review. It would have to be
grounded in something checkable.

Candidates, cheapest first:

- **Known failure modes as a checklist, not a vibe.** Camera motion sickness has established causes:
  motion the player did not initiate, competing simultaneous motion sources, movement without a
  fixed reference. A critic that asks "how many independent things move this camera, and how many
  did the player ask for?" would have flagged the answer — five, and none — before any of it shipped.
- **Accessibility as a hard gate.** Vestibular sensitivity is the clearest case: it affects real
  people, the mitigations are well documented, and "reduce motion" is a setting every other medium
  ships. This one probably deserves to be a rule rather than a critic's opinion.
- **The owner as the ground truth, asked earlier.** Three rounds is the real cost here. A rendered
  before-and-after pair costs minutes now that captures work, and would have surfaced the objection
  on round one.

## What this does not need

It does not need a new agent, a taxonomy, or a scoring rubric yet. **One documented failure-mode
checklist for camera and motion, applied by hand to the next feature, would test whether the idea
has legs** — the same discipline `executable-requirement-contracts.md` argues for: write the second
and third by hand before building anything that generates them.

## Related

- [Demo-refining archive](../objectives/_archives/demo-refining-summary.md) — the completed
  measurement and correction history
- `agent-legible-quality-measurement.md` — what the measurement side can and cannot do
- `executable-requirement-contracts.md` — where a design rule would bind if it became checkable
