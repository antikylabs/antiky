# Skill-library implementation plan — working folder

Written: 2026-08-10.

## What this is

A proposal for building a skill library that helps agents build better games with Antiky Framework,
BroMetal, and Antiky Studio.

It is **not** new research. The research already exists, dated 2026-08-09, in
[`docs/objectives/skill-research/`](../../skill-research/) — roughly 5,300 lines across eleven
reports plus three execution goals and three scaffold skill packages. This folder closes the gap
between that research and an implementable plan, and grounds it in evidence that did not exist when
the research was written.

## What is new since the research

In August 2026 a highly capable coding agent was tasked with building AAA-quality game demos in this
repository. It produced `point-light-expo`, `combat-arena`, and `traversal-study`. The owner judged
the result poor, and a four-agent audit documented — with `file:line` citations — exactly how and
why it failed. That audit lives in [`../demo-refining/`](../demo-refining/).

It is a natural experiment, and it is the most valuable input a skill library for this repository
could have: it replaces reasoning about what agents *might* get wrong with an inventory of what one
actually did get wrong, on this codebase, under these constraints.

Three findings from it reorganise the research's conclusions:

1. **The agent could program.** Simulation, input, collision, and encounter code is sound and
   tested. It failed at rendering architecture, colour management, asset handling, art direction,
   and self-verification.
2. **The agent was working blind.** No shader shows evidence of having been looked at after it was
   written. The repository ships a complete capture and inspection toolchain; none of it was used.
3. **The agent was honest.** The READMEs contain no overclaiming. This was an accurate agent with
   no feedback loop — which means the fix is a mandatory observation step, not more truthfulness
   instructions.

## Documents

| Document | What it answers |
| --- | --- |
| [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) | The plan. Reconciles the research against the audit, names the first skills in priority order, specifies the self-verification loop and its automated guards, revises the evaluation harness, and sequences the work into independently executable phases with bounded acceptance criteria |
| [failure-mode-taxonomy.md](failure-mode-taxonomy.md) | The audit's observed failures classified into ten classes, each mapped to the intervention that would actually have caught it — skill, lint, gate, or nothing — with `file:line` evidence throughout |
| [skill-specs.md](skill-specs.md) | Full specification per proposed skill: recurring job, trigger prompts, inputs and outputs, stop condition, the non-obvious project knowledge it carries, acceptance criteria, and which documented defect it would have prevented |

Read `IMPLEMENTATION-PLAN.md` first. The other two are supporting detail it links into.

## Status: proposal only

**This folder changes nothing.** No source code, script, test, skill package, or committed research
document was modified to produce it. Nothing was installed.

The plan recommends several changes to the committed research folder
[`docs/objectives/skill-research/`](../../skill-research/). **Those recommendations have not been
applied**, and that folder is untouched. They are:

- **Re-aim [`execute-goal-01.md`](../../skill-research/goals/execute-goal-01.md)'s task clusters.**
  Its catalog, schemas, validator, lifecycle states, and matched-baseline method are all correct and
  reused unchanged. Its three clusters — gameplay work, rendering work, asset sourcing — should
  become frame construction, asset intake fidelity, visual self-verification, and a demoted gameplay
  cluster used to detect over-triggering.
- **Defer [`execute-goal-02.md`](../../skill-research/goals/execute-goal-02.md) (slice planning) and
  [`execute-goal-03.md`](../../skill-research/goals/execute-goal-03.md) (gameplay
  implementation).** Both target areas where the baseline agent already succeeded. Deferred, not
  cancelled — their evaluation machinery is reused.
- **Replace all three scaffold skills** rather than revising them. Applied faithfully,
  `build-antiky-games`, `write-brometal-shaders`, and `source-game-assets` would have prevented none
  of the observed defects. This substantially shortcuts goal 01's scaffold-audit deliverable.
- **Revise five candidates in
  [`recommended-library.md`](../../skill-research/recommended-library.md)** and mark four as clearly
  wrong as a starting point. The detail is in the plan's §4.1.
- **Promote [`01-RENDERING-VOCABULARY.md`](../demo-refining/01-RENDERING-VOCABULARY.md) and the
  visual diagnosis out of `scratch/`** into stable references, since the skills depend on them as
  shared language.

If these are accepted, the committed research's report map should also gain links to whatever of
this folder survives review.
