# Antiky Town roadmap

This file is the only active Town roadmap. Update it after each completed slice or a material
qualification result.

## Completed

- Slice 00 — Complete: Add the development host and minimum inspection path.
- Slice 01 — Complete: Change one market lamp through the shared Framework service.
- Slice 02 — Complete: Add the fixed-step `EngineSession` clock and controls.

## Next slice — Planning

Qualify the Nexus and BroMetal integration, then move the playable hero through a GPU physics path.
Preserve approved collision behavior and use no per-step CPU readback.

No executable plan exists yet. Before the slice can become `READY`, complete the dependency research,
bounded integration probe, failure design, owner decisions, and visible reference required by
[`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md).

## Unordered backlog

Choose one player-visible result after the hero slice. Current candidates include:

- Add repeatable NPC movement through the qualified physics path.
- Add one useful Town interaction with selection, inspection, edit, and undo.
- Improve Town lighting, including a qualified global-illumination direction.
- Add an asset boundary only when a visible feature requires it.
- Improve Town render preparation where measurements show a real problem.

Framework extraction follows proof. Website delivery, Studio polish, documentation infrastructure,
and planning-evidence cleanup do not become Town gameplay slices.
