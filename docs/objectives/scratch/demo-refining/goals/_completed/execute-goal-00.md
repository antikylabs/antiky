# Execute goal 00: settle the render-driver architecture record and the public claims

## `/goal` objective

Place the owner's `BroMetalRenderDriver` decision into `docs/adr/`, supersede the record it changes,
and bring the shipped public copy back in line with what the codebase can actually prove today.

This goal writes records and corrects claims. It writes no renderer code, no driver, and no
framework code. Its output is: one new ADR, one superseded ADR with an intact revision history, an
updated ADR index, a recommendation on `studio/0007`, corrected website copy, and one recorded
compliance gap that a later goal implements.

The reviewed draft in `docs/objectives/scratch/demo-refining/09-RENDER-DRIVER-DECISION.md:78-161` is
the input. The owner must approve the final ADR text before it is committed. Core Contributors own
ADRs (`docs/adr/README.md:9-11`, `docs/adr/AGENTS.md`), and an agent may create or change an `_H`
ADR only under explicit human instruction.

## Required outcome

When the work is complete, the repository must have:

1. `docs/adr/framework/0021-brometal-render-driver-ownership_H.md`, containing the five required
   parts (Title, Status, Context, Decision, Consequences) from `docs/adr/README.md:60-99`, with a
   Status of `Accepted` and a `Supersedes` link to `framework/0006`;
2. `docs/adr/framework/0006-brometal-render-driver_H.md` carrying a `## Revision history` entry with
   a real 40-character Git commit hash produced by `docs/adr/tag-hash.sh`, and a Status changed from
   `Accepted` (`0006:5`) to `Superseded by` with a resolving link to `0021`;
3. `0021` listed in the Framework section of `docs/adr/README.md`, appended after the `0020` entry
   at `docs/adr/README.md:40`, with no number reused (`docs/adr/README.md:115`);
4. a written recommendation, decided by the owner and not guessed by the agent, on whether
   `docs/adr/studio/0007-framework-first-allow-others_H.md` needs an in-place clarification pointing
   at `0021` for the framework-plus-BroMetal case;
5. zero occurrences in shipped web copy of "the current Framework render driver uses BroMetal" or
   any equivalent phrasing stated as a **Current** claim under the taxonomy at
   `packages/website/PRODUCT.md:87-96`; and
6. a recorded, not implemented, statement of the ADR 0013 compliance gap, naming the clause and the
   evidence, and naming goal 11 as the owner of the implementation.

## In scope

- Review the draft ADR text at `09-RENDER-DRIVER-DECISION.md:78-161` against the writing standard in
  `docs/adr/README.md:122-142` and the audit workflow in `docs/adr/AGENTS.md`. Report the language
  audit separately from the format and link checks. Do not report ASD-STE100 Issue 9 compliance if
  the official standard was not read — say which validation could not be done.
- Present the final ADR text to the owner for approval before committing it. Record the approval.
- Run the tag-hash step in the correct order. `docs/adr/tag-hash.sh` stamps
  `git rev-parse --verify HEAD`, so the command must run while `HEAD` still holds 0006's old text:

  ```sh
  ./docs/adr/tag-hash.sh docs/adr/framework/0006-brometal-render-driver_H.md \
    "Prior version before ADR 0021 superseded this decision."
  ```

  Only after that entry exists may 0006's Status line change. A hash stamped after the edit points
  at the wrong commit and the revision history becomes useless.
- Update the Framework list in `docs/adr/README.md` and confirm every local link in `0021` and in
  `0006` resolves to a file that exists.
- Read `docs/adr/studio/0007-framework-first-allow-others_H.md:41-42`, which gives renderer
  initialization, resizing, and resource disposal to the game module across all four renderer
  choices. Decide whether a reader who lands there first is misled once `0021` exists. Present the
  recommendation with the exact text of the proposed clarification. If the owner accepts it, tag
  `studio/0007` with `tag-hash.sh` before editing it, under the same ordering rule.
- Correct the Current-tense claims. The known occurrences are:
  - `packages/website/PRODUCT.md:85`
  - `packages/website/PRODUCT.md:158`
  - `packages/website/src/app/page.tsx:193`
  - `packages/website/src/app/framework/page.tsx:124`
  - `packages/website/src/app/thesis/page.tsx:203`
  Treat that list as a starting point, not as complete. Grep the whole of `packages/website` for
  "render driver", "RenderDriver", and "render driver uses BroMetal" and fix every hit that reads as
  a present-tense capability claim.
- Restate the corrected claims at the honest status. No `BroMetalRenderDriver` exists in the
  codebase, so under `PRODUCT.md:87-96` the claim is **Direction**: supported by an accepted decision
  but not a public capability. Keep BroMetal's attribution and links intact — that requirement at
  `PRODUCT.md:157-159` is separate from the driver claim and must survive the edit.
- Record the ADR 0013 gap in this repository's planning record only.
  `docs/adr/framework/0013-explicit-simulation-inputs_H.md:17-21` requires the simulation to receive
  "Random seeds or random streams" as an explicit input. No seed exists anywhere: the evidence is at
  `docs/objectives/scratch/demo-refining/08-ADR-IMPACT.md:116-147`. State the gap, name goal 11 as
  the implementer, and stop.

## Required tests and evidence

At minimum, prove:

- `sh docs/adr/tests/tag-hash.test.sh` passes, and `npm test` is no worse than it was before this goal
  started (it is red on `main` for an unrelated reason — see goal 01 — so record the before and
  after failure sets rather than claiming green);
- `0006` contains exactly one new revision-history entry, its hash is 40 hexadecimal characters, and
  `git cat-file -t <hash>` resolves to a commit that is an ancestor of the tagging commit;
- `git show <that hash>:docs/adr/framework/0006-brometal-render-driver_H.md` still shows Status
  `Accepted`, which proves the tag was taken before the edit and not after;
- no ADR number is reused: `ls docs/adr/framework/` shows exactly one `0021-` file and no second
  file at any existing number;
- every relative link in `0021` and in the changed part of `0006` resolves — check each path with
  `test -f`;
- `grep -rn "current Framework render driver" packages/website` returns zero results, and a broader
  `grep -rin "render driver" packages/website` returns only Direction-labelled or historical
  statements, each one listed in the handoff with its new wording;
- the existing website tests still pass (`packages/website/tests/site-shell.test.mjs` and its
  siblings), and no new frozen-prose test is added — `AGENTS.md` forbids tests that assert copy; and
- `git diff --check` is clean.

The handoff must list the exact ADR paths, the tag-hash command and its output hash, the owner
approval record, every corrected claim with before and after text, and the `studio/0007`
recommendation with its decision.

## Explicit non-goals

- Do not build `BroMetalRenderDriver`, any part of it, or any stub of it.
- Do not change any renderer, any shader, any demo, or any framework source file.
- Do not implement a seed, a random stream, or any ADR 0013 remediation. That is goal 11.
- Do not write a second ADR for renderer choice. `docs/adr/studio/0007-framework-first-allow-others_H.md`
  already decides that the game module selects the renderer, and effort allocation is a product
  priority rather than an architecture decision.
- Do not write an ADR for the `postinstall` BroMetal patch step. Local patching with an upstream pull
  request per patch is settled practice with a stated exit, and a record for it would decide nothing.
- Do not delete `0006`, rewrite its Context or Decision, or reuse its number.
- Do not rewrite any other existing `_H` ADR for style, sentence length, or Issue 9 conformance.
  `docs/adr/AGENTS.md` requires explicit owner instruction for that.
- Do not cite `docs/objectives/` from inside any ADR. `docs/adr/README.md:71-73` forbids an ADR from
  using a planning document as authority.

## Engineering constraints

- `packages/demos/antiky/antiky-town` is in scope for this objective, like every other demo. This
  goal changes no demo code, but nothing about antiky-town is restricted.
- Demos hand-roll rendering per demo until `BroMetalRenderDriver` exists. Do not extract a shared
  render package in this goal or propose one as a side effect of the ADR.
- Tests are required for code changes (`AGENTS.md`). This goal changes records and copy, so it adds
  no new test; if it does touch code, the test rule applies in full. When fixing a reported bug,
  write the failing regression test first.
- Use short one-line commit messages. Never add coauthor tags.
- Capture PNGs are not committed. `.antiky/` is gitignored and `*.png` is tracked by Git LFS. The
  committed evidence artifact is a metrics sidecar, not an image.
- Preserve unrelated dirty worktree changes. The branch already carries demo and website edits that
  belong to other work.
- The ADR is human-owned. The agent drafts and audits, the owner approves, and the approval happens
  before the commit rather than after it.

## Completion definition

The goal is complete only when `0021` exists in owner-approved final text, `0006` carries a
correctly ordered revision-history hash and a `Superseded by` status, the ADR index lists `0021`,
the `studio/0007` question has an owner decision recorded either way, every Current-tense render
driver claim in `packages/website` is corrected to Direction, and the ADR 0013 gap is written down
with goal 11 named as its implementer.

If the owner does not approve the ADR text within this goal, place nothing. Leave `0006` untagged
and unedited, report the exact blocking question, and keep the goal active. A half-placed
supersession — a tagged 0006 with no 0021, or a 0021 with 0006 still `Accepted` — is worse than no
change at all.
