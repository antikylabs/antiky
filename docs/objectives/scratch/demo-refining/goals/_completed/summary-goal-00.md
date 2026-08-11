# Summary — goal 00: settle the render-driver architecture record and the public claims

**Completed:** 2026-08-11
**Commit:** `288cd76` — *Supersede ADR 0006 with 0021 BroMetal render driver ownership*
**Goal file:** [`execute-goal-00.md`](execute-goal-00.md)

## Action needed from the owner

One item. It does not block any later goal — ADR 0021 is placed, accepted, and usable today.

| # | What | Why it needs you | Blocks |
|---|---|---|---|
| 1 | **Complete the ASD-STE100 Issue 9 audit of ADR 0021, and approve or reject four terms.** The terms are `graphics processing unit (GPU)`, `engineering effort`, `BroMetalRenderDriver`, `pre-1.0`, with reasoning in [`../../0021-FINAL-DRAFT-FOR-APPROVAL.md`](../../0021-FINAL-DRAFT-FOR-APPROVAL.md). | `docs/adr/AGENTS.md` forbids an agent claiming Issue 9 compliance without reading the official standard, which I did not. The hand checklist passes; the controlled-dictionary validation — the substantive half — was not done. Only a human with the standard can close this. | Nothing |

**No bugs were found in this goal**, and no other item needs you. Everything else below is a record
of what was placed and why.

## What changed

| Artifact | Change |
|---|---|
| `docs/adr/framework/0021-brometal-render-driver-ownership_H.md` | **Created.** Status `Accepted`, supersedes 0006. |
| `docs/adr/framework/0006-brometal-render-driver_H.md` | Status `Accepted` → `Superseded by [0021]`. One revision-history entry added. |
| `docs/adr/studio/0007-framework-first-allow-others_H.md` | Three-sentence clarification after line 42, scoping renderer ownership and pointing at 0021. Tagged first. |
| `docs/adr/README.md` | `0021` appended to the Framework list. |
| `packages/website/PRODUCT.md` | Two claims corrected (`:85`, `:158`). |
| `packages/website/src/app/{page,thesis/page,framework/page}.tsx` | Three claims corrected. |
| `docs/objectives/scratch/demo-refining/10-ADR-0013-SEED-GAP.md` | **Created.** Compliance gap recorded, not implemented. |

## The decision recorded

The framework will own a `BroMetalRenderDriver`. It is BroMetal-specific: no backend abstraction
layer, no second renderer library behind the same interface. Antiky games use the driver by default.
A game module may use BroMetal directly, but only as an exception when the driver cannot do the
work — and when that happens, the ADR treats it as a signal that the driver is incomplete rather
than as a valid parallel path. Other renderers stay a game-module choice and are not funded.

This resolved a real contradiction in the record. `0006:25` said only an Antiky-owned `RenderDriver`
would use BroMetal directly. The later-accepted `studio/0007:41-42` gave renderer initialization and
disposal to the game module, across all four renderer choices. A reader could not tell which record
governed a framework game using BroMetal. `0021` removes that ambiguity.

## Owner decisions taken during the goal

1. **ADR 0021 text — approved as drafted.** Placed without modification.
2. **`studio/0007` — clarify.** The owner chose to add the scoping sentences rather than leave the
   record and revisit when the driver ships.

## Evidence

- **Tag-hash ordering proven, not assumed.** Both `0006` and `studio/0007` were tagged at
  `f403e4b2d125d7d13cb69c6cead4866c9f340023` *before* any edit.
  `git show f403e4b:…/0006-…md` still prints `Accepted`, and so does `studio/0007` at that hash.
  `git cat-file -t f403e4b` resolves to a commit. This is the check that distinguishes a correctly
  ordered tag from a useless one.
- `sh docs/adr/tag-hash.test.sh` passes.
- `0006` carries exactly one new revision entry (two total, was one). No ADR number reused —
  `framework/` holds exactly one `0021-` file and no duplicate numbers.
- All eight local ADR links resolve, verified from each file's own directory.
- `grep -rn "current Framework render driver" packages/website` returns zero. One "render driver"
  mention survives at `PRODUCT.md:86`, explicitly labelled Direction.
- `git diff --check` clean.
- No ADR cites `docs/objectives/` — `docs/adr/README.md:71-73` forbids it.

### Tests — no worse than baseline

| Suite | Before | After |
|---|---|---|
| `@antiky/website` | 43 pass / 0 fail | 43 pass / 0 fail |
| Repo-level chain | 16 pass / 1 fail | 16 pass / 1 fail |

The single failure is pre-existing and unrelated: `published skills use valid, matching skill names`
(`scripts/repository-policy.test.mjs:64`) fails `ENOENT` because `skills/` was deleted in `1062bd4`
while the test still reads it. **Goal 01 owns that fix.** Because `npm test` chains with `&&`, the
workspace suites do not run at all until it is fixed — so no full-repo green baseline exists yet.

No test was added. This goal changed records and copy, and `AGENTS.md` forbids tests that assert
prose.

## Outstanding — carried forward

Each item is either assigned to a later goal or listed in **Action needed** above.

| Item | Disposition |
|---|---|
| Issue 9 conformance unverified; four terms unapproved | **Needs owner** — item 1 above |
| ADR 0013 seed compliance gap, recorded not implemented | **Goal 11** implements it. No action. |
| `studio/0007` clarification | **Done in this goal.** No action. |

**ASD-STE100 Issue 9 conformance is unverified, and 0021 does not claim it.** `docs/adr/AGENTS.md`
states that format, link, and sentence-length checks do not constitute compliance, and that an agent
must not claim compliance without reading the official standard. I did not read it.

Checked by hand against the `AGENTS.md` checklist, all passing: active voice, one topic per
sentence, 25-word limit (longest 22), three-word noun limit, no semicolons, condition before result,
vertical-list lead-ins, no synonyms for variety, no technical noun used as a verb.

**Not checked:** every general word against the Issue 9 controlled dictionary, and approved part of
speech and word form for each. That is the substantive half of the standard.

**Four terms await owner approval**, listed with reasoning in
[`../../0021-FINAL-DRAFT-FOR-APPROVAL.md`](../../0021-FINAL-DRAFT-FOR-APPROVAL.md):
`graphics processing unit (GPU)`, `engineering effort`, `BroMetalRenderDriver`, `pre-1.0`.

## What this unblocks

Goals 06 and 07 build shadow passes, HDR targets and post-processing per demo — resources `0006`
reserved to a driver that does not exist. That work now sits on a record a reader can follow.
Goal 12 extracts the driver itself, and `0021` is the decision it implements.

Recorded but deliberately not acted on: the ADR 0013 seed gap
([`../../10-ADR-0013-SEED-GAP.md`](../../10-ADR-0013-SEED-GAP.md)), owned by goal 11.
