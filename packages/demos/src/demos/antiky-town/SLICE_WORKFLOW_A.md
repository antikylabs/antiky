# Slice Delivery Workflow

**Status: Proposed working agreement**

## Purpose

This guide gives every Antiky Town slice the same shape. It prevents the team from inventing a new
process for each slice.

A slice is a small, complete change that a person can see or use. It must also prove the framework
path that supports the change. A slice is not complete when the code only compiles. It is complete
when its behavior, tests, inspection data, failure handling, and measurements all pass.

This guide has two companion documents:

- [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) is the copyable plan contract.
- [`slice-01-plan.md`](slice-01-plan.md) applies the contract to the first market lamp.

Update this guide and the template when the framework adds a new feature area that later slices
must check. Do not rewrite the process only because one slice needs a special task.

## Writing rule

Write slice documents in ASD-STE100 style. Use short, direct sentences. Use active voice. Put one
instruction in each sentence. Define a technical term before you use it. Keep a required product or
API name when a simpler word would change its meaning.

Use a table only when it makes an exact comparison or mapping easier to read. Explain the purpose of
a large table before it starts. A new team member must be able to read the plan without knowing the
implementation first.

## The three document roles

| Document | Purpose | When it changes |
| --- | --- | --- |
| This workflow | Defines how the team plans, runs, and closes all slices | When the shared way of working changes |
| Slice plan template | Defines every required plan section and evidence table | When every future slice must answer a new question |
| One real slice plan | Defines one outcome, its work, its gates, and its proof | During planning and implementation of that slice |

The workflow and template are rules. A real slice plan is an executable contract.

## Terms

| Term | Meaning |
| --- | --- |
| Outcome | The one useful result that the slice delivers |
| Reference | The current behavior, image, data, or measurement that the slice must preserve or change |
| Capability | Code that exists now and has a test or a working consumer |
| Hypothesis | A claim that a capability is missing; the team must test the claim |
| Gate | A condition that must pass; points cannot offset a failed gate |
| Evidence | A repeatable result that proves a claim |
| Checkpoint | A small implementation stage that leaves the repository in a valid state |
| Drift | A change to the framework, architecture, or slice scope after the plan snapshot |
| CPU | Central processing unit; it owns authoritative game state in the normal render path |
| GPU | Graphics processing unit; it receives prepared render data and does not own game authority |

Planned code is not an existing capability. An ADR, architecture guide, issue, or type name can
describe intent. It does not prove that the API exists.

## The operating rule

Write the complete slice plan before feature implementation starts. Then run the plan as the source
of truth.

For Slice 01, the intended goal command is:

```text
/goal implement packages/demos/src/demos/antiky-town/slice-01-plan.md until complete
```

The agent that runs this goal must follow these rules:

1. Read the whole plan and every document in its required-reading table.
2. Stop at the readiness gate if a required choice or earlier slice is not complete.
3. Do not select an owner choice without approval.
4. Do not weaken an acceptance criterion to make the result pass.
5. Treat each `REQUIRED` row as a hard gate.
6. Use the named framework capabilities before creating replacements.
7. Test a missing-capability hypothesis before adding framework code.
8. Keep work inside the slice scope.
9. Add a failing regression test first for a reported error.
10. Keep the reference available until parity or an approved difference is proved.
11. Record direct evidence in the plan as work completes.
12. Commit small, working checkpoints.
13. Mark the goal complete only after the final audit passes.

If a gate needs new authority, the agent must report the exact gate and ask for the missing choice.
It must not invent permission to continue.

## How to prepare a slice

### 1. Copy the template

Copy `SLICE_PLAN_TEMPLATE_A.md` to `slice-NN-plan.md`. Replace every placeholder. Remove all template
instructions that do not describe the real slice.

The real plan must name:

- One owner.
- One outcome.
- One selected implementation option.
- One reference.
- One complete verification command.
- The current repository revision and review date.

### 2. Take a framework alignment snapshot

Inspect the repository. Do not rely only on design documents.

Record:

- The Git revision.
- The framework package exports.
- The source files for each capability that the slice plans to use.
- The tests that prove each capability.
- The earlier slices that are complete.
- The ADRs and architecture rules that affect ownership or public APIs.
- The active development and inspection tools.

Mark a capability as `USE` only when real code supplies the required behavior. Use `EXTEND` when
the code exists but lacks one proved behavior. Use `CREATE` when the repository does not contain the
capability. Use `DEFER` when the slice does not need it.

### 3. State one outcome

Use one sentence that names the user-visible or developer-visible result. Then list the behaviors
that prove the result.

Also list non-goals. A non-goal protects the slice from attractive work that belongs later.

A good outcome crosses a real boundary. For example:

```text
An accepted command changes one market lamp, and the new value is visible and inspectable.
```

“Build the entity system” is not a good slice outcome. It names a solution but not a useful result.

### 4. Capture the reference

Record the current state before implementation changes it. Use the smallest useful set of proof:

- A route and clear reproduction steps.
- Stable IDs and values from structured inspection, when available.
- A screenshot or frame capture for appearance.
- Test output for behavior.
- Draw, upload, timing, and resource counts for rendering work.

State which differences are allowed. If no difference is approved, the slice must preserve the
reference outside its named outcome.

### 5. Inventory what exists

List each needed capability. Name the real API, source path, and proof. Do not write “framework
handles this” without a symbol or a test.

The inventory answers these questions:

- What framework code can the slice use as-is?
- What demo code is a reference but must not become framework code?
- What tool can produce evidence?
- What planned feature is still absent?
- What code would cross an ownership boundary?

### 6. Test missing-capability hypotheses

Keep hypotheses separate from expected work. For each hypothesis:

1. State why the capability appears to be missing.
2. Name a quick probe.
3. Record the result.
4. Choose `USE`, `EXTEND`, `CREATE`, or `DEFER`.

This step prevents a new abstraction when a narrow existing API is sufficient.

### 7. Define expected framework work

List only framework code that the slice outcome needs. Each addition must name:

- Its package and owner.
- Its public or private surface.
- The complexity that it hides.
- Its first consumer.
- Its unit and integration tests.
- The rule that will show whether a later slice can reuse it.

Prefer a deep, narrow module over many general interfaces. Keep a new implementation private until
a second use proves a stable public shape.

### 8. Compare implementation options

Write at least two credible options when the choice affects ownership, public contracts, data
layout, or long-term cost. State benefits, costs, and evidence that would justify the larger option.

Record the selected option and its approver. A recommendation is not an approval.

### 9. Draw the data and authority path

Show where the request starts, where authority makes the decision, and how accepted state reaches
the visible result. Name each state copy.

For a mutable render feature, the path normally has this shape:

```text
caller
  -> command boundary and trusted context
  -> authoring state and accepted event
  -> runtime projection
  -> render projection and changed range
  -> render driver
  -> BroMetal
```

Do not serialize data between normal modules in one process. Do not let render state become the
authoritative game state.

### 10. Define proof before implementation

Name tests and evidence before code work starts. Include:

- Success behavior.
- Invalid input.
- Missing permission.
- Duplicate and stale requests, when applicable.
- Small update and complete rebuild parity.
- Structured inspection.
- Reload and reconnect behavior.
- Failed update recovery.
- Resource creation and disposal.
- Reference appearance.
- Relevant performance limits.

If the slice cannot name a repeatable way to prove a claim, the claim is not ready.

### 11. Run the readiness gate

Every required readiness row must be `PASS`. `BLOCKED` means that an external choice or earlier
slice prevents work. `FAIL` means that the team can do the work now but has not done it. `N/A`
requires a written reason.

Do not start feature implementation while a required row is `BLOCKED` or `FAIL`.

### 12. Implement checkpoints

Each checkpoint must:

- Deliver one coherent part of the outcome.
- Add or update tests with the code.
- Leave the repository buildable.
- Record new evidence.
- Use a short one-line commit message.

Do not start the next checkpoint when the current checkpoint has an unexplained failure.

### 13. Close with evidence

Run the complete verification command. Fill every acceptance row and rubric row. Record command,
inspection, measurement, and visual evidence at the point where each claim appears.

Run the goal audit after the normal tests. The audit asks whether the completed result satisfies the
original outcome, not only whether all task boxes have checks.

## Evidence rules

Use the strongest evidence that fits the claim.

| Claim | Strong evidence | Supporting evidence only |
| --- | --- | --- |
| State changed correctly | Automated test plus versioned inspection record | Screenshot |
| Invalid request made no change | Automated test with before and after digest | Log text without state proof |
| A person can see the result | Reproduction steps plus visual capture | Code review alone |
| One render entry changed | Structured changed-range data or a test spy | Visual capture |
| Upload cost stayed within limit | Recorded byte and write counts from a named tool | Frame rate alone |
| Reload recovered safely | Automated or scripted reload evidence with runtime IDs | “It worked for me” |
| Resource lifecycle is correct | Creation and disposal counts with tests | No visible error |

Evidence must include enough context to repeat it:

- Repository revision.
- Command or tool.
- Relevant configuration.
- Expected result.
- Actual result.
- Artifact or output location, when one exists.

A plan checkbox is not evidence. A screenshot cannot prove identity, permission, revision, or
authority. Structured inspection cannot prove visual quality. Use both when the outcome needs both.

## Standard matrices

Every real plan uses these matrices. The template supplies their full forms.

### Readiness matrix

| ID | Required gate | Status | Evidence or blocker |
| --- | --- | --- | --- |
| `PRE-NN` | One testable condition | `PASS`, `FAIL`, `BLOCKED`, or `N/A` | Direct proof or exact missing item |

### Capability inventory

| Need | Required behavior | Existing API and path | Existing proof | Decision |
| --- | --- | --- | --- | --- |
| One capability | What the slice needs | Real symbol and source file | Test or working consumer | `USE`, `EXTEND`, `CREATE`, or `DEFER` |

### Missing-capability hypotheses

| ID | Hypothesis | Probe | Result | Decision |
| --- | --- | --- | --- | --- |
| `HYP-NN` | A capability appears missing | Small read-only check or experiment | What the probe found | `USE`, `EXTEND`, `CREATE`, or `DEFER` |

### Framework additions

| ID | Addition | Owner and surface | Complexity hidden | Proof | First consumer |
| --- | --- | --- | --- | --- | --- |
| `FW-NN` | Narrow capability | Package and public/private choice | The difficult detail inside it | Named tests | Slice feature |

### Acceptance ledger

| ID | Required result | Evidence method | Status | Evidence |
| --- | --- | --- | --- | --- |
| `AC-NN` | Observable result | Test, inspection, measure, or capture | `PASS`, `FAIL`, or `N/A` | Direct result and location |

## BroMetal and CPU-to-GPU rules

BroMetal owns typed GPU work. Antiky owns authoritative state, projections, inspection, and render
preparation. The slice plan must keep this boundary clear.

For each render-related slice, answer all of these questions:

1. Which CPU state is authoritative?
2. Which accepted change marks render data dirty?
3. How does a stable ID resolve to a compact render slot before the frequent loop?
4. What exact bytes or ranges can change?
5. When does Antiky send the change to BroMetal?
6. Does the current BroMetal API support that update size?
7. Which resources stay alive?
8. What happens when creation or update fails?
9. How does disposal happen exactly once?
10. Which measurement proves the result?

Apply these rules:

- Keep CPU state authoritative. Do not read GPU state back to decide game behavior.
- Permit no GPU-to-CPU readback in the normal update path unless the plan names and justifies it.
- Resolve persistent text IDs before a frequent render loop.
- Upload static data once for each content version.
- Keep stable resources and render slots when a small value changes.
- Mark only the affected entry or range dirty in Antiky render state.
- Reuse typed arrays, staging data, and small frame blocks when measurement shows that they matter.
- Send small frame constants once for each frame or pass when the driver supports it.
- Do not rebuild geometry, programs, textures, or unrelated buffers for a scalar change.
- Do not scan the full world, replay events, parse JSON, or compare persistent IDs in the draw loop.
- Keep the last valid resource set when a replacement fails and safe recovery is possible.
- Count CPU-to-GPU bytes, writes, queue submissions, changed ranges, draws, resource creation, and
  disposal.

Do not promise a smaller GPU write than the current BroMetal API can perform. First record the
actual behavior. If a BroMetal change would help renderers in general, make a separate measured
proposal. If it only helps Antiky Town, keep the solution in the Antiky adapter.

[`webgpu_inspector`](https://github.com/brendan-duncan/webgpu_inspector) can provide optional GPU
capture and validation evidence. Pin a reviewed version or commit. Do not load it in production. It
does not replace Antiky entity, command, revision, or permission inspection.

## Required tool review

A plan must name the tools that it will use and the claim that each tool proves.

| Tool area | Use |
| --- | --- |
| Framework tests | Prove rules without a browser or BroMetal |
| Demo integration tests | Prove the framework-to-town adapter and reference mapping |
| Type checking and import checks | Prove package and ownership boundaries |
| Antiky inspection service | Prove stable IDs, values, revisions, diagnostics, and changed ranges |
| Antiky command tools | Exercise the same command service as tests and future Studio UI |
| Browser and frame capture | Prove reachability and appearance |
| BroMetal diagnostics or a pinned GPU inspector | Prove low-level GPU work and validation facts |
| Repository check command | Prove the integrated workspace still passes |

Use one source of truth for each fact. Tests, MCP adapters, and future Studio panels must read the
same typed inspection service. They must not each rebuild world facts in a different way.

## Readiness hard gates

Every plan must include these gates when they apply:

- The owner approved the implementation option.
- Every earlier slice is complete.
- The framework alignment snapshot is current.
- The reference and allowed differences are recorded.
- The outcome, non-goals, and failure behavior are clear.
- Stable identity and runtime schema needs are resolved or included in the slice.
- Required inspection and command contracts exist or are included in the slice.
- Tests and the complete verification command are named.
- Reload, reconnect, and disposal behavior are defined.
- Security and authority rules are defined.
- Performance limits and measurement tools are named.
- Open ADR work that changes this slice is resolved.

Unrelated ADR research does not block a slice.

## Success rubric

Hard gates decide whether completion is possible. The rubric checks the quality of the completed
result. Do not average scores. Every applicable row must score `3`.

| Score | Meaning |
| --- | --- |
| `0` | No result or no evidence |
| `1` | Partial result or a one-time manual claim |
| `2` | Repeatable main path, but an edge, boundary, or required proof is missing |
| `3` | Complete result with repeatable direct evidence |

Score these dimensions:

| Dimension | A score of 3 requires |
| --- | --- |
| Outcome and scope | The named result works, non-goals stayed out, and differences are approved |
| Framework alignment | Every used capability maps to real code and proof; drift is recorded |
| Framework design | New code has clear ownership, hides complexity, and avoids unproved general APIs |
| Correctness | Success, rejection, duplicate, stale, rebuild, and regression paths pass when applicable |
| Inspectability | A versioned structured view reports IDs, values, revisions, and diagnostics |
| Render efficiency | Changed ranges and actual CPU-to-GPU work meet named limits with no unjustified readback |
| Failure and recovery | Invalid input and failed replacement preserve safe state and return stable errors |
| Lifecycle and security | Authority is explicit; start, reconnect, reload, dispose, and shutdown are safe |
| Reference and performance | Appearance and measured budgets match the reference or an approved difference |
| Reproduction and handoff | One command runs verification; evidence, docs, and commits let another person repeat it |

Use `N/A` only when the plan explains why the dimension cannot apply. An `N/A` row does not hide
missing work.

## Completion rule

A slice is complete only when all of these statements are true:

1. Every required readiness and acceptance row is `PASS`.
2. Every applicable rubric dimension scores `3`.
3. Every `N/A` row has an accepted reason.
4. The complete verification command passes from a clean start.
5. The evidence names the final Git revision or final patch state.
6. The reference remains available.
7. The plan has no unresolved placeholder, blocker, or owner choice.
8. The final goal audit confirms the original outcome.

If any statement is false, the status stays `NOT COMPLETE`.

## What to do when the framework changes

Framework work is expected during these slices. Use this update loop:

1. Record the discovered need in the real plan.
2. Test the missing-capability hypothesis.
3. Add the smallest capability that makes the slice work.
4. Add its direct tests and one consumer test.
5. Update the capability inventory and alignment revision.
6. Add a template question only if all later slices must answer it.
7. Update this workflow only if the shared process or rubric changes.
8. Record the change in the plan drift log.

Do not edit a completed slice plan to claim that it used a later API. Its evidence is a historical
record. Add a short note that names the later replacement when necessary.

## Stop conditions

Stop implementation and report the exact condition when:

- An owner decision is missing.
- An earlier required slice is not complete.
- The reference cannot be reproduced.
- An architecture choice changes package ownership or a public contract.
- The current tool cannot produce required evidence and the plan does not include the tool work.
- A change would expand the slice into a later feature.
- A safe recovery or security rule is unknown.

A difficult task is not a stop condition. Continue with safe, in-scope work when the plan gives a
clear contract.
