# Slice Delivery Workflow

**Status: Proposed working agreement**

## Purpose

This guide gives every Antiky Town slice the same shape. It prevents the team from inventing a new
process for each slice.

A slice is a small, complete change that a person can see or use. It must also prove the framework
path that supports the change. A slice is not complete when the code only compiles. It is complete
when its behavior, tests, inspection data, failure handling, measurements, and affected user-facing
documentation all pass.

This guide has these companion documents:

- [`SLICE_PLAN_TEMPLATE_A.md`](SLICE_PLAN_TEMPLATE_A.md) is the copyable plan contract.
- [`slice-list.md`](slice-list.md) is the short, changeable slice roadmap.
- [`slice-00/plan.md`](slice-00/plan.md) applies the contract to the development harness.
- [`slice-00/owner-input_H.md`](slice-00/owner-input_H.md) is a real owner-input example.
- [`slice-01/plan.md`](slice-01/plan.md) applies the contract to the first market lamp.

Update this guide and the template when the framework adds a new feature area that later slices
must check. Do not rewrite the process only because one slice needs a special task.

This workflow also applies provider-neutral lessons from
[Cloudflare's Agent Development Lifecycle](https://blog.cloudflare.com/agent-development-lifecycle/).
It does not require Cloudflare products. It requires each delivery run to be reproducible,
observable, reversible, and limited to approved authority.

## Writing rule

Write slice documents in ASD-STE100 style. Use short, direct sentences. Use active voice. Put one
instruction in each sentence. Define a technical term before you use it. Keep a required product or
API name when a simpler word would change its meaning.

Use a table only when it makes an exact comparison or mapping easier to read. Explain the purpose of
a large table before it starts. A new team member must be able to read the plan without knowing the
implementation first.

Keep a real slice plan at 300 lines or fewer. If it becomes longer, move shared rules to this
workflow. Record run-specific facts in the evidence receipt. Put owner questions in the separate
owner-input file.

An owner can approve a longer plan when the slice has an unusual safety or migration need. Record
the reason in the plan.

## The document roles

| Document | Purpose | When it changes |
| --- | --- | --- |
| This workflow | Defines how the team plans, runs, and closes all slices | When the shared way of working changes |
| Slice plan template | Defines the short structure of a real slice plan | When every future slice must answer a new implementation question |
| One real slice plan | Defines one outcome, its work, its gates, and its proof | During planning and implementation of that slice |
| Owner-input file | Gives the owner only the questions that need human judgment | When a product, visual, scope, or public-contract question changes |
| Slice outputs | Stores run receipts, confirmation checks, facts, measurements, and supporting artifacts | During one named slice run |
| Slice list | Gives the next short slice sequence | After every slice run |
| User-facing documentation | Explains how to use the shipped framework, CLI, and Studio behavior | In the same checkpoint that changes that behavior |

The workflow and template are rules. A real slice plan is an executable contract.

## Slice folder

Keep each slice contract and its delivery outputs together:

```text
slice-NN/
  plan.md
  owner-input_H.md       optional; only when owner judgment is required
  verification/           temporary; remove after completion
    verify.mjs           complete slice check
    tests/               tests for slice-specific evidence and policy
  outputs/
    README.md
    {run-id}/
      receipt.json
      confirmation-checks.md
      facts.json
      measurements.json  when measurements apply
      captures/           when captures apply
      logs/               when logs apply
```

Keep product and framework implementation in `packages/`. Do not copy implementation files into the
slice folder.

Keep temporary verification code in the active slice's `verification/` folder. This code can include
the complete check, fixtures, browser controls, probes, report code, and tests for those files. Do
not create a shared verification framework for slice work. A small amount of duplication is better
than permanent infrastructure for short-lived delivery work.

Do not add slice commands or tests to the root package manifest or a product package manifest. Do
not put slice verification code in the repository `scripts/` folder. After a slice is complete,
delete its `verification/` folder. Keep its plan and saved results in `outputs/`.

Keep durable usage guidance in `docs/user-facing-docs/`. It is product documentation, not a slice
output. The slice receipt links each page that the run changed.

Each run writes to a new output directory. It must not overwrite an earlier run. The receipt lists
each stored output and its digest.

`confirmation-checks.md` gives a short human summary. `facts.json` contains machine-readable facts.
The other outputs exist only when the plan needs them.

Do not store credentials, tokens, private keys, or other secrets in a slice output.

## Owner input

If a slice needs owner judgment, create `slice-NN/owner-input_H.md`. Link it in the plan control
block and make it the first required-reading item.

The owner-input file must contain:

- One short summary of the slice.
- The direction that the owner already supplied.
- One section for each open question.
- Enough context to understand the effect without reading the plan.
- One recommendation and the relevant trade-off.
- One `Owner answer` block directly below each question.
- One status that is `WAITING FOR OWNER` or `ANSWERED`.

The owner answers each question inline. The answer can be `APPROVE` or a replacement direction. The
goal runner must read the complete file and apply the answers. A `PENDING` answer blocks
implementation that depends on it.

Do not put implementation chores in the owner-input file. The implementation agent captures
baselines, selects exact tool versions, pins dependencies, allocates ports and worktrees, runs
tests, and records evidence.

An agent can add a new question and its context. It must not write the owner's answer. If the slice
needs no owner decision, state that fact in the plan and do not create an empty owner-input file.

## Terms

| Term | Meaning |
| --- | --- |
| Outcome | The one useful result that the slice delivers |
| Reference | The current behavior, image, data, or measurement that the slice must preserve or change |
| Capability | Code that exists now and has a test or a working consumer |
| Hypothesis | A claim that a capability is missing; the team must test the claim |
| Gate | A condition that must pass; points cannot offset a failed gate |
| Owner input | A human-owned file with the decisions that an implementation goal must consume |
| Evidence | A repeatable result that proves a claim |
| Slice output | A confirmation, fact, measurement, receipt, capture, or log that one run creates outside product code |
| Checkpoint | A small implementation stage that leaves the repository in a valid state |
| Drift | A change to the framework, architecture, or slice scope after the plan snapshot |
| Run | One named execution of an approved slice plan |
| Attempt | One execution or retry of a step within a run |
| Run setup | The recorded source, environment, configuration, and isolated resources for a run |
| Evidence receipt | A machine-readable record that links the run, actions, results, and artifacts |
| Last-known-good revision | The latest checkpoint that passed its required proof |
| Correlation ID | An ID that links one action to its logs, results, and artifacts |
| CPU | Central processing unit; it owns authoritative game state in the normal render path |
| GPU | Graphics processing unit; it receives prepared render data and does not own game authority |

Planned code is not an existing capability. An ADR, architecture guide, issue, or type name can
describe intent. It does not prove that the API exists.

## The operating rule

Write the complete slice plan before feature implementation starts. Then run the plan as the source
of truth.

For Slice 00, the intended goal command is:

```text
/goal implement docs/objectives/antiky-town/slice-00/plan.md until complete
```

For Slice 01, the intended goal command is:

```text
/goal implement docs/objectives/antiky-town/slice-01/plan.md until complete
```

The agent that runs this goal must follow these rules:

1. Read the whole plan, its owner-input file when one exists, and every required-reading document.
2. Create a run ID and freeze the run setup before the first implementation change.
3. Use a dedicated worktree, ports, runtime, and artifact location when another run can overlap.
4. Stop when the owner-input status or a required answer is pending.
5. Stop at the readiness gate if a required earlier slice is not complete.
6. Do not select or rewrite an owner answer.
7. Do not weaken an acceptance criterion to make the result pass.
8. Treat each required completion statement as a hard gate.
9. Use programmatic controls for routine work and repeatable evidence.
10. Use the named framework capabilities before creating replacements.
11. Test a missing-capability hypothesis before adding framework code.
12. Keep work inside the slice scope.
13. Add a failing regression test first for a reported error.
14. Keep the reference available until parity or an approved difference is proved.
15. Link direct evidence to the run, attempt, checkpoint, and relevant product IDs.
16. Classify a failure before a retry. Use only the retry rule in the plan.
17. Keep a tested path to the last-known-good revision.
18. Commit small, working checkpoints.
19. Update affected pages in `docs/user-facing-docs/` with the checkpoint that changes behavior.
20. Update `slice-list.md` from the run's facts before closeout.
21. Mark the goal complete only after all checks pass and the saved results are complete.

If work needs new owner authority, the agent adds one question with context to the owner-input file.
It reports the exact blocked work. It must not invent permission to continue.

An owner can make a product or visual judgment. Record the reviewer, decision, and supporting
artifact. A routine click that has no programmatic form is a missing tool capability. Record it as a
hypothesis. Do not hide it as a human review step.

## How to prepare a slice

### 1. Create the slice folder

Create `slice-NN/`. Copy `SLICE_PLAN_TEMPLATE_A.md` to `slice-NN/plan.md`. Replace every placeholder.
Remove all template instructions that do not describe the real slice.

If the slice needs owner judgment, also create `slice-NN/owner-input_H.md`. Link it from the control
block and required-reading list. Do not copy the questions into the plan.

Create `slice-NN/outputs/README.md`. The goal writes each run to `slice-NN/outputs/{run-id}/`.

Create `slice-NN/verification/` when the slice needs executable verification. Put all temporary
verification code in that folder. Do not add a root package command for it. Delete the folder after
the final results are saved and checked.

The real plan must name:

- One owner.
- One outcome.
- One selected implementation option or one linked owner question.
- One reference.
- One complete verification command.
- The current repository revision and review date.
- One receipt at `slice-NN/outputs/{run-id}/receipt.json`.
- One isolation rule and one software rollback rule.
- Each affected user-facing documentation area, or `N/A` with a reason.

### 2. Research the feature area

Do significant research before you select the slice design. Compare the approaches in relevant
game frameworks. Include Phaser, Godot, Bevy, Unity, Unreal Engine, and another applicable
framework when they have useful prior work.

Use current primary sources. Prefer official manuals, API references, source code, release notes,
and maintainers' design documents. A list of framework names is not research. Explain each relevant
approach, its trade-offs, and the part that does or does not fit Antiky.

Research BroMetal for every slice. Record:

- The installed BroMetal version and the command that reports it.
- The latest published BroMetal version and the source that reports it.
- Whether the installed version is current.
- The relevant BroMetal APIs, limits, ownership rules, design principles, README guidance, and
  release notes.
- The upgrade work that the slice needs, or `N/A` with a reason.

The installed version must match the latest published version before implementation starts. If an
upgrade is unsafe or outside the slice, put the exception and its effect in the owner-input file.
An approved exception must name the version that the slice will use.

Put the concise research result in the slice plan. Link the sources that support its design. Do not
create a separate research document unless the result will help more than one slice.

### 3. Review architecture decisions

Read the accepted ADRs and architecture guides that affect the slice. Also read
[`UNDER_REVIEW_A.md`](../../adr/UNDER_REVIEW_A.md) in full. Do not review only the items that a
search result finds.

Record these results in the slice plan:

- The accepted decisions that control ownership, public contracts, safety, and scope.
- Each relevant item in `UNDER_REVIEW_A.md`, or a statement that no item is necessary for the
  slice.
- The effect of each necessary decision on the slice.

If an item in `UNDER_REVIEW_A.md` is necessary, add a question to the slice owner-input file. Link
the item. Explain why implementation needs the decision. Give one recommendation and its
trade-off. Keep the plan status `NOT READY` until the owner answers the question and the required
ADR work is complete.

Do not block a slice on an unrelated ADR or architecture question.

### 4. Take a framework alignment snapshot

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

### 5. Define the execution contract

Define how one agent can run the plan without sharing hidden state with another run. Freeze the
contract before the first implementation change.

State the slice-specific isolation, permission, retry, and rollback rules in the plan. Record these
run-specific values in the evidence receipt instead of pre-filling a large plan table:

- A unique run ID and attempt IDs that increase.
- The source revision, worktree, branch, dependency lock hash, and configuration hash.
- Exact tool, runtime, browser, device, viewport, locale, time-zone, seed, and network facts that can
  affect the result.
- Explicit ports, temporary locations, service IDs, build IDs, runtime IDs, and artifact locations.
- The events that start or resume work. Use bounded polling only when no event source exists.
- The delivery permissions for reads, writes, commands, network use, deployment, and secrets.
- Failure classes, retry limits, checkpoint resume rules, and software rollback.
- The version and location of the machine-readable evidence receipt.

Use `N/A` with a reason in the receipt when a field cannot affect the slice. Do not record a secret
in a digest input, log, receipt, or artifact.

### 6. State one outcome

Use one sentence that names the user-visible or developer-visible result. Then list the behaviors
that prove the result.

Also list non-goals. A non-goal protects the slice from attractive work that belongs later.

A good outcome crosses a real boundary. For example:

```text
An accepted command changes one market lamp, and the new value is visible and inspectable.
```

“Build the entity system” is not a good slice outcome. It names a solution but not a useful result.

### 7. Capture the reference

Record the current state before implementation changes it. Use the smallest useful set of proof:

- A route and clear reproduction steps.
- Stable IDs and values from structured inspection, when available.
- A screenshot or frame capture for appearance.
- Test output for behavior.
- Draw, upload, timing, and resource counts for rendering work.

State which differences are allowed. If no difference is approved, the slice must preserve the
reference outside its named outcome.

### 8. Inventory what exists

List each needed capability. Name the real API, source path, and proof. Do not write “framework
handles this” without a symbol or a test.

The inventory answers these questions:

- What framework code can the slice use as-is?
- What demo code is a reference but must not become framework code?
- What tool can produce evidence?
- What planned feature is still absent?
- What code would cross an ownership boundary?

### 9. Test missing-capability hypotheses

Keep hypotheses separate from expected work. For each hypothesis:

1. State why the capability appears to be missing.
2. Name a quick probe.
3. Record the result.
4. Choose `USE`, `EXTEND`, `CREATE`, or `DEFER`.

This step prevents a new abstraction when a narrow existing API is sufficient.

### 10. Define expected framework work

List only framework code that the slice outcome needs. Each addition must name:

- Its package and owner.
- Its public or private surface.
- The complexity that it hides.
- Its first consumer.
- Its unit and integration tests.
- The rule that will show whether a later slice can reuse it.

Prefer a deep, narrow module over many general interfaces. Keep a new implementation private until
a second use proves a stable public shape.

### 11. Compare implementation options

Write at least two credible options when the choice affects ownership, public contracts, data
layout, or long-term cost. State benefits, costs, and evidence that would justify the larger option.

Put an owner choice and its context in the owner-input file. Record an engineering choice in the
plan. A recommendation is not an approval.

### 12. Draw the data and authority path

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

### 13. Define proof before implementation

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
- Run-setup validation and resource isolation.
- Evidence-receipt validation and end-to-end correlation.
- Retry, resume, and software rollback behavior.
- Delivery permissions and after-completion ownership.
- User-facing documentation links, examples, and checks when public behavior changes.

If the slice cannot name a repeatable way to prove a claim, the claim is not ready.

### 14. Run the readiness gate

The owner-input file must be `ANSWERED`. Every required earlier slice must be complete. The plan
must name all code, proof, security, and recovery work that the outcome needs.

Baseline capture, dependency selection, tool selection, resource allocation, and run setup can be
the first implementation checkpoint. These tasks do not require owner action.

### 15. Implement checkpoints

Each checkpoint must:

- Deliver one coherent part of the outcome.
- Add or update tests with the code.
- Leave the repository buildable.
- Record new evidence.
- Record the run, attempt, correlation, and checkpoint IDs for the evidence.
- Update affected user-facing documentation in the same checkpoint as the behavior.
- Use a short one-line commit message.

Do not start the next checkpoint when the current checkpoint has an unexplained failure.

### 16. Close with evidence

Run the complete verification command. Record each completion check and rubric result in the
evidence receipt. Keep a short completion checklist in the plan.

Run the goal audit after the normal tests. The audit asks whether the completed result satisfies the
original outcome, not only whether all task boxes have checks.

Validate the machine-readable receipt. Resolve each recorded failure. Complete the learning and
after-completion records. A final green run does not erase an earlier unexplained failure.

## User-facing documentation rule

Update `docs/user-facing-docs/` when a slice changes a public API, command, configuration, workflow,
or visible behavior. Use the matching area:

- `framework/` for framework APIs, concepts, examples, and integration guidance.
- `cli/` for commands, configuration, output, errors, startup, and cleanup.
- `studio/` for Studio workflows, controls, state, and CLI or framework integration.

The plan names the expected pages. If implementation discovers another affected page, update it and
record the drift. Describe only behavior that the slice ships. Keep commands and examples valid.
Update or remove stale guidance when behavior changes.

If no user-facing documentation changes, record `N/A` and the reason in the receipt. A slice cannot
use `N/A` when it changes how a person uses the framework, CLI, or Studio.

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

- Run ID, attempt ID, and correlation ID when an action has one.
- Repository revision.
- Command or tool.
- Relevant configuration.
- Expected result.
- Actual result.
- Artifact or output location, when one exists.

The complete verifier writes its outputs to `slice-NN/outputs/{run-id}/`. Every run writes:

- `receipt.json` with the versioned output manifest and completion result.
- `confirmation-checks.md` with the short human-readable verification result.
- `facts.json` with stable machine-readable facts learned or confirmed by the run.

Write `measurements.json`, `captures/`, and `logs/` only when the plan needs them.

The receipt must contain:

- The slice ID, run ID, source revision, final revision, and checkpoint commits.
- The run-setup values or their hashes.
- Every attempt, failure class, retry, resume, and rollback result.
- The build, service, runtime, command, event, projection, and capture IDs that apply.
- Every readiness, acceptance, and rubric result.
- Each artifact location and its digest when the artifact is stored.
- Process measures for retries, interventions, permission escalations, flaky checks, and blocked time.
- The final completion result.

Write the receipt to a temporary file. Validate it. Then rename it to the final path. A reader must
never see a partial receipt. A Markdown table can summarize the receipt. It cannot replace the
receipt.

A plan checkbox is not evidence. A screenshot cannot prove identity, permission, revision, or
authority. Structured inspection cannot prove visual quality. Use both when the outcome needs both.

## Run, retry, and rollback rules

### Isolation and programmatic control

Each run has its own writable worktree and resources. Give overlapping runs different
ports, services, runtimes, temporary locations, and artifact locations. A resource collision must
fail the readiness check. Do not silently select a different resource.

Use the same target environment for the reference and result. Record all facts that can change the
comparison. The target can be a local browser for a local demo. A hosted preview is not required
when the slice does not deploy software.

Routine build, test, inspection, capture, rollback, and cleanup operations must have a command or
typed tool. Prefer build and runtime events that start or resume the next step. If an event source is
not available, define a bounded wait and timeout. Do not require an agent to watch a dashboard.

### Failure classes

Classify each failed attempt before the next action.

| Class | Meaning | Required action |
| --- | --- | --- |
| `EXPECTED_REJECTION` | The product correctly rejected invalid, stale, duplicate, or unauthorized input | Record the proof; do not retry the request |
| `TRANSIENT` | A tool or service failed without evidence of a code defect | Check health; use the named bounded retry rule |
| `DEFECT` | The same input and run setup produce a wrong result | Add or update proof; fix the cause before a new attempt |
| `STALE_RUN` | Source, configuration, build, runtime, or reference identity does not match the run setup | Invalidate the evidence; reconstruct or start a new run |
| `AUTHORITY_BLOCK` | The action needs an owner choice or permission that the run does not have | Stop and request the exact authority |
| `EVIDENCE_FAILURE` | The claim can be true, but required proof is missing, corrupt, or unlinked | Repair the evidence path; do not mark the claim as passed |

An unexplained flaky result is a defect. A later green attempt does not cancel it.

Each retry must increment the attempt ID. Record the cause, delay, changed conditions, and result.
Do not retry a deterministic defect, expected product rejection, stale command, or authority block.
Resume from a passing checkpoint only when its revision and run-setup facts still match.

### Software rollback

Domain correction and software rollback are different operations. A command can correct game state.
A software rollback restores a prior working code and configuration revision.

Each plan must name:

- The last-known-good revision or artifact.
- The conditions that start rollback.
- The programmatic rollback or compensating action.
- The effect on schemas, saved data, and in-memory state.
- The checks that prove the restored revision is safe.

Preserve shared Git history. Use a new corrective or revert commit when committed work must be
removed. Record the rollback and its proof in the receipt.

### Delivery permissions

The evidence receipt must list each operation that changes the repository, runtime, network,
deployment, or an external system. The plan must name unusual or high-risk authority that is
specific to the slice.

For each changing operation, record the required capability, allowed scope, grant source, expiry,
revocation method, and audit evidence.

Start with no production, secret, network, deployment, or external-message authority. Add only the
authority that the approved slice needs. Product permissions do not grant delivery permissions, and
delivery permissions do not grant product permissions.

## Standard evidence shapes

Every run records these shapes in its evidence receipt. A real plan includes a table only when the
table helps a reviewer understand a slice-specific relationship.

### Run setup

| Field | Required value or rule | Run value and evidence |
| --- | --- | --- |
| Run identity | Stable run ID and attempt IDs that increase | Actual IDs from the verifier |
| Source and dependencies | Revisions and hashes | Recorded values |
| Runtime and target | Exact versions and comparison profile | Recorded values |
| Isolated resources | Worktree, ports, services, runtime, and artifact location | Allocation proof |

### Delivery permissions

| Operation | Required capability | Allowed scope | Grant and expiry | Audit evidence |
| --- | --- | --- | --- | --- |
| One changing operation | Narrow permission | Exact target | Owner or policy; end condition | Receipt entry or external record |

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

[`webgpu_inspector`](https://github.com/brendan-duncan/webgpu_inspector) is a design reference. Do
not make it an Antiky dependency or a required evidence tool. Build required inspection into Antiky
and BroMetal. Keep engine meaning in Antiky's typed inspection service.

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
| Native Antiky render diagnostics and BroMetal test instrumentation | Prove low-level GPU work and validation facts |
| Repository check command | Prove the integrated workspace still passes |

Use one source of truth for each fact. Tests, MCP adapters, and future Studio panels must read the
same typed inspection service. They must not each rebuild world facts in a different way.

## Readiness hard gates

Every plan or evidence receipt must cover these gates when they apply:

- The owner-input file is answered and the goal uses its answers.
- Every earlier slice is complete.
- The plan contains significant current research from relevant game frameworks.
- The installed BroMetal version matches the latest published version, or the owner approved a
  specific exception.
- The plan records the accepted ADR, architecture, and complete `UNDER_REVIEW_A.md` review.
- Each necessary item in `UNDER_REVIEW_A.md` has an answered owner question and completed ADR work.
- The framework alignment snapshot is current.
- The reference and allowed differences are recorded.
- The outcome, non-goals, and failure behavior are clear.
- Stable identity and runtime schema needs are resolved or included in the slice.
- Required inspection and command contracts exist or are included in the slice.
- Tests and the complete verification command are named.
- Reload, reconnect, and disposal behavior are defined.
- Security and authority rules are defined.
- Performance limits and measurement tools are named.
- The run setup is complete and its resources are isolated.
- Routine controls and evidence are programmatic.
- Delivery permissions are explicit and limited to the slice.
- Failure classes, retry limits, resume rules, and rollback are defined.
- The evidence receipt has a writer, validator, version, and location. A bootstrap checkpoint can
  supply the base tool before other implementation work starts.
- After-completion ownership, feedback, and retirement rules are defined.
- Open ADR work that changes this slice is resolved.
- Affected user-facing documentation and its checks are named, or `N/A` has a valid reason.

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
| Reproduction and handoff | One command runs verification; user-facing docs, evidence, and commits let another person repeat it |
| Autonomous execution | The run is isolated, permissioned, traceable, resumable, and free of unexplained retries |
| Operation and learning | Health, feedback, rollback, retirement, and unexpected-result dispositions are recorded |

Use `N/A` only when the plan explains why the dimension cannot apply. An `N/A` row does not hide
missing work.

## Completion rule

A slice is complete only when all of these statements are true:

1. Every required completion check and receipt gate is `PASS`.
2. Every applicable rubric dimension scores `3`.
3. Every `N/A` row has an accepted reason.
4. The complete verification command passes from a clean start.
5. The evidence names the final Git revision or final patch state.
6. The reference remains available.
7. The plan has no unresolved placeholder or blocker. Its owner-input file has no pending answer
   when that file exists.
8. The run state is `CLOSED`.
9. The evidence receipt validates and links every required result.
10. Every failed attempt has a resolved classification and disposition.
11. The after-completion contract names its owner and feedback path.
12. The final goal audit confirms the original outcome.
13. The run outputs are inside the slice folder and the receipt lists them.
14. Affected pages in `docs/user-facing-docs/` match the shipped behavior and pass their checks.
15. `slice-list.md` reflects the facts learned during the run.

If any statement is false, the status stays `NOT COMPLETE`.

## What to do when the framework changes

Framework work is expected during these slices. Use this update loop:

1. Record the discovered need in the real plan.
2. Test the missing-capability hypothesis.
3. Add the smallest capability that makes the slice work.
4. Add its direct tests and one consumer test.
5. Update `docs/user-facing-docs/framework/` when public use or behavior changes.
6. Update the capability inventory and alignment revision.
7. Add a template question only if all later slices must answer it.
8. Update this workflow only if the shared process or rubric changes.
9. Record the change in the plan drift log.

Do not edit a completed slice plan to claim that it used a later API. Its evidence is a historical
record. Add a short note that names the later replacement when necessary.

## Learning and after-completion rule

Classify each unexpected result or owner intervention at closeout. Use one of these dispositions:

1. Add a regression test for a product defect.
2. Add an enforced shared rule when all later slices need the rule.
3. Record a framework or tool capability hypothesis when automation is missing.
4. Record an accepted product decision when the result is not a defect.

Record unplanned interventions, retries, flaky checks, permission escalations, missed checks, and
blocked time. Use the completed receipt as an evaluation case for later delivery runs. Change the
shared workflow only when the lesson applies to later slices. Do not add a global rule for one local
exception.

Update `slice-list.md` after each slice run. A new fact can add an unknown slice, reorder planned
slices, remove unnecessary work, or change a later slice direction. Keep each list item to one short
sentence or name.

Each completed plan must also name:

- The owner of the delivered behavior.
- The health signals and verification command.
- The human-feedback and agent-finding paths.
- The regression and rollback triggers.
- The deprecation or retirement path.

Use `N/A` with a reason when the slice has no deployed service or continuous monitor.

## Stop conditions

Stop implementation and report the exact condition when:

- An owner decision is missing.
- An earlier required slice is not complete.
- The reference cannot be reproduced.
- An architecture choice changes package ownership or a public contract.
- The current tool cannot produce required evidence and the plan does not include the tool work.
- The run setup changed and makes prior evidence stale.
- A required operation exceeds the delivery permissions.
- A deterministic failure remains after its retry classification.
- Safe software rollback is undefined.
- A change would expand the slice into a later feature.
- A safe recovery or security rule is unknown.

A difficult task is not a stop condition. Continue with safe, in-scope work when the plan gives a
clear contract.
