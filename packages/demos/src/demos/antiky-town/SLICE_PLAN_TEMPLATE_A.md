# Slice Plan Template

**Status: Template — copy this file; do not implement it**

Use this template with the [Slice Delivery Workflow](SLICE_WORKFLOW_A.md). Copy it to
`slice-NN-plan.md`, replace each placeholder, and remove all guide text.

Example outcome: “An accepted command changes one market lamp, and the new value is visible and
inspectable.”

A real plan must contain no unresolved placeholder. It must not use a score to offset a failed
gate.

Write the real plan in ASD-STE100 style. Use short, direct sentences. Define necessary technical
terms. Remove guide text after the plan supplies the real answer.

---

# Slice `<NN>`: `<short name>`

## Control block

| Field | Value |
| --- | --- |
| Status | `<DRAFT, NOT READY, READY, IN PROGRESS, NOT COMPLETE, or COMPLETE>` |
| Owner | `<person or team>` |
| Plan approver | `<person>` |
| Selected option | `<option ID and name>` |
| Selection state | `<PROPOSED or APPROVED>` |
| Depends on | `<earlier slices or NONE>` |
| Framework alignment date | `<YYYY-MM-DD>` |
| Framework alignment revision | `<full Git revision>` |
| Evidence revision | `<full Git revision or WORKTREE until final commit>` |
| Complete verification command | `<one command>` |
| Run state | `<NOT STARTED, ACTIVE, INTERRUPTED, or CLOSED>` |
| Evidence receipt format | `antiky.slice-receipt/v1` |
| Evidence receipt path | `<repo-relative path that includes the run ID>` |

`COMPLETE` is permitted only when every rule in the final completion declaration passes.

## Required reading

Read these documents before work starts.

| Document | Why it controls this slice |
| --- | --- |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines the shared gates, evidence rules, and rubric |
| `<path>` | `<ownership, architecture, ADR, reference, or tool rule>` |

## Goal

### Outcome

`<Write one sentence that names the useful and observable result.>`

### Why this slice exists

`<State the framework question that this outcome will answer.>`

### Observable behavior

At completion:

1. `<A person can see or use this behavior.>`
2. `<A structured query reports this state.>`
3. `<A failure has this safe and visible result.>`

### Non-goals

- `<A related feature that belongs in a later slice.>`
- `<A general system that the outcome does not yet prove.>`

### Approved differences from the reference

- `<Difference and approver, or NONE.>`

## Reference and baseline

| ID | Reference fact | How to reproduce or measure it | Stored evidence | Status |
| --- | --- | --- | --- | --- |
| `REF-01` | `<route, behavior, value, image, or metric>` | `<steps or command>` | `<path or output>` | `<PASS or FAIL>` |

State what must stay unchanged outside the slice outcome:

- `<appearance, behavior, count, or API>`

## Framework alignment snapshot

This table records code that exists at the alignment revision. A design document does not count as
an implemented capability.

| Area | Current fact | Direct evidence |
| --- | --- | --- |
| Framework exports | `<real public symbols or intentionally empty>` | `<entry-point path>` |
| Earlier slices | `<complete and incomplete slices>` | `<test, plan, or code path>` |
| Demo reference | `<working source behavior>` | `<source, route, and test>` |
| Development harness | `<available operations>` | `<source and verification>` |
| Structured inspection | `<available resources and tools>` | `<schema, source, and test>` |
| BroMetal boundary | `<version and relevant API behavior>` | `<package and source>` |
| Open architecture work | `<only work that can change this slice>` | `<ADR or architecture section>` |

### Drift rule

Before implementation resumes after a framework change:

1. Reinspect the changed exports, source, and tests.
2. Update this snapshot and the capability inventory.
3. Record the change in the drift log.
4. Rerun affected readiness rows.

## Execution contract

Freeze this contract before the first implementation change. Actual IDs can stay `PENDING` while
the plan is not ready. Record them before the run changes code or state.

### Run setup

| Field | Required value or rule | Run value and direct evidence |
| --- | --- | --- |
| Run ID and attempt IDs | `<stable run-ID format; IDs increase and are not reused>` | `<actual values or PENDING>` |
| Source and final revision | `<clean source rule; final revision rule>` | `<full revisions or PENDING>` |
| Worktree and branch | `<exclusive writable worktree and branch rule>` | `<paths and names or PENDING>` |
| Dependency lock | `<lock-file path and digest algorithm>` | `<digest or PENDING>` |
| Configuration | `<redacted resolved-config digest rule>` | `<digest or PENDING>` |
| Runtime tools | `<exact Node, package manager, OS, and architecture>` | `<versions or PENDING>` |
| Browser and GPU | `<supported browser, OS, adapter, and driver rule>` | `<values or PENDING>` |
| Visual profile | `<viewport, pixel ratio, camera, mode, and capture phase>` | `<values or PENDING>` |
| Deterministic inputs | `<seed, fixture, locale, time zone, clock, and network rule>` | `<values or accepted N/A>` |
| Isolated resources | `<explicit ports, services, runtimes, temporary paths, and artifact root>` | `<allocations or PENDING>` |
| Build and runtime identity | `<required service, build, and runtime IDs>` | `<actual IDs or PENDING>` |
| Start and resume events | `<events or bounded wait with timeout>` | `<source and evidence or PENDING>` |

If another run can overlap, it must not share a writable worktree, port, service, runtime, temporary
path, or artifact path. A collision fails readiness. Do not select a new resource silently.

### Delivery permissions

| Operation | Required capability | Allowed scope | Grant source | Expiry or revocation | Audit evidence |
| --- | --- | --- | --- | --- | --- |
| `<read, write, commit, local process, product command, network, deploy, or external action>` | `<narrow capability or NONE>` | `<exact files, service, account, or DENIED>` | `<owner, policy, or NONE>` | `<end condition>` | `<receipt field or external record>` |

List denied operations. Do not assume production, secret, network, deployment, or external-message
authority. Keep product authority separate from delivery permissions.

### Failure, retry, and resume

| Failure class | Detection rule | Maximum automatic retries | Required action and evidence |
| --- | --- | ---: | --- |
| `EXPECTED_REJECTION` | `<valid product rejection>` | `0` | `<record proof; do not retry request>` |
| `TRANSIENT` | `<tool or service failure with no defect evidence>` | `<small bound>` | `<health check, backoff, and receipt entry>` |
| `DEFECT` | `<repeatable wrong result in the same run setup>` | `0` | `<test or proof, fix, and new attempt>` |
| `STALE_RUN` | `<source, config, build, runtime, or reference mismatch>` | `0` | `<invalidate evidence and reconstruct or start a new run>` |
| `AUTHORITY_BLOCK` | `<missing choice or permission>` | `0` | `<stop and request exact authority>` |
| `EVIDENCE_FAILURE` | `<missing, corrupt, or unlinked required proof>` | `<small bound>` | `<repair evidence path; do not pass claim without proof>` |

Resume from checkpoint: `<checkpoint, digest, and revision match rule>`

An unexplained flaky result is a defect. A later green result does not erase it.

### Software rollback

| Field | Required answer |
| --- | --- |
| Last-known-good revision or artifact | `<target>` |
| Rollback triggers | `<failed checks, unsafe behavior, or other exact triggers>` |
| Programmatic action | `<revert or compensating operation; do not rewrite shared history>` |
| State and data effect | `<schema, saved-data, and in-memory compatibility>` |
| Proof after rollback | `<clean command, reference check, and health evidence>` |
| Receipt record | `<fields and artifact>` |

Domain correction does not replace software rollback.

## Readiness gate

Status values are `PASS`, `FAIL`, `BLOCKED`, and `N/A`. `N/A` needs an accepted reason. Do not start
feature implementation until every applicable row is `PASS`.

| ID | REQUIRED condition | Status | Direct evidence or exact blocker |
| --- | --- | --- | --- |
| `PRE-01` | The owner approved one implementation option | `<status>` | `<evidence>` |
| `PRE-02` | Every earlier required slice is complete | `<status>` | `<evidence>` |
| `PRE-03` | The framework alignment snapshot is current | `<status>` | `<evidence>` |
| `PRE-04` | The reference and approved differences are recorded | `<status>` | `<evidence>` |
| `PRE-05` | The outcome, non-goals, and failure behavior are explicit | `<status>` | `<evidence>` |
| `PRE-06` | Stable identity and schema needs are resolved or in scope | `<status>` | `<evidence>` |
| `PRE-07` | Inspection and command contracts exist or are in scope | `<status>` | `<evidence>` |
| `PRE-08` | Tests and the complete verification command are named | `<status>` | `<evidence>` |
| `PRE-09` | Reload, reconnect, and disposal behavior are defined | `<status>` | `<evidence>` |
| `PRE-10` | Security and authority rules are defined | `<status>` | `<evidence>` |
| `PRE-11` | Performance limits and measurement tools are named | `<status>` | `<evidence>` |
| `PRE-12` | Relevant architecture decisions are resolved | `<status>` | `<evidence>` |
| `PRE-13` | Required tools and supported environment are available | `<status>` | `<evidence>` |
| `PRE-14` | The run setup is frozen and its resources are isolated | `<status>` | `<evidence>` |
| `PRE-15` | Delivery permissions are explicit and sufficient | `<status>` | `<evidence>` |
| `PRE-16` | Failure, retry, resume, and software rollback rules are testable | `<status>` | `<evidence>` |
| `PRE-17` | Receipt tools and start or resume events exist, or a bootstrap checkpoint supplies them first | `<status>` | `<evidence>` |

## Existing capability inventory

Decision values are `USE`, `EXTEND`, `CREATE`, and `DEFER`.

| ID | Need | Required behavior | Existing API and path | Existing proof | Decision |
| --- | --- | --- | --- | --- | --- |
| `CAP-01` | `<capability>` | `<slice need>` | `<real symbol and path, or NONE>` | `<test or consumer, or NONE>` | `<decision>` |

Rules:

- `USE` must name working code and proof.
- `EXTEND` must name the one missing behavior.
- `CREATE` must show that the probe found no sufficient API.
- `DEFER` must state why the outcome does not need the capability.

## Missing-capability hypotheses

Do the probe before framework implementation starts.

| ID | Hypothesis | Why it appears missing | Probe | Result | Decision |
| --- | --- | --- | --- | --- | --- |
| `HYP-01` | `<claim>` | `<current evidence>` | `<small check or experiment>` | `<PENDING or finding>` | `<PENDING, USE, EXTEND, CREATE, or DEFER>` |

New discoveries go in this table before they become tasks.

## Expected framework additions

List the smallest expected additions. Do not list future platform work.

| ID | Addition | Owner and surface | Complexity hidden | Required tests | First consumer |
| --- | --- | --- | --- | --- | --- |
| `FW-01` | `<narrow capability>` | `<package; public or private>` | `<hard detail inside module>` | `<named tests>` | `<feature>` |

For each public addition, answer:

- Why must another package use it now?
- Why is a private function not sufficient?
- Which later evidence can cause the API to change?

## Implementation options and decision

### Option `<A>`: `<name>`

Approach: `<short description>`

Benefits:

- `<benefit>`

Costs:

- `<cost>`

Evidence that would justify this option: `<measurement or second consumer>`

### Option `<B>`: `<name>`

Approach: `<short description>`

Benefits:

- `<benefit>`

Costs:

- `<cost>`

Evidence that would justify this option: `<measurement or second consumer>`

### Decision record

| Field | Value |
| --- | --- |
| Proposed option | `<option>` |
| Approved option | `<option or PENDING>` |
| Approver | `<person or PENDING>` |
| Date | `<YYYY-MM-DD or PENDING>` |
| Reason | `<why this is the smallest safe choice>` |

## Data and authority path

```text
<caller>
  -> <validation and trusted authority>
  -> <authoring decision and accepted fact>
  -> <runtime projection>
  -> <render or other output projection>
  -> <visible result>
```

| Stage | Owns | Input | Output | Revision or order rule | Failure result |
| --- | --- | --- | --- | --- | --- |
| `<stage>` | `<authoritative or derived data>` | `<typed input>` | `<typed output>` | `<rule>` | `<stable result>` |

### Authority rules

- `<State who can request the change.>`
- `<State who supplies trusted identity and permissions.>`
- `<State what an untrusted caller cannot set.>`
- `<State which copy is authoritative.>`

## Contracts and limits

| Contract | Required fields | Limits and units | Version | Invalid result |
| --- | --- | --- | --- | --- |
| `<command, event, component, inspection record, or render update>` | `<fields>` | `<bounds>` | `<version>` | `<stable code>` |

Durable types must use stable text tags and explicit schema versions. Local typed calls do not need
encoding only because they cross a module boundary.

## Tool and evidence plan

| ID | Tool | Claim it proves | Command or operation | Required artifact |
| --- | --- | --- | --- | --- |
| `TOOL-01` | `<test runner, inspection resource, browser, profiler, or capture tool>` | `<one claim>` | `<exact use>` | `<output or path>` |

Use the typed inspection service as the source for tests, MCP, and future Studio views. A visual
capture supports appearance evidence. It does not prove semantic state.

Every routine build, test, inspection, capture, rollback, and cleanup operation needs a command or
typed tool. Record a manual product or visual judgment with the reviewer, decision, and artifact.

## Evidence receipt

The complete verifier writes and validates one `antiky.slice-receipt/v1` JSON receipt.

| Receipt area | Required content |
| --- | --- |
| Identity | Slice ID, run ID, attempt IDs, source revision, final revision, and checkpoint commits |
| Run setup | Recorded values or hashes for every run-setup row |
| Correlation | Checkpoint, operation, command, event, projection, build, service, runtime, test, and capture IDs that apply |
| Decisions | Readiness, acceptance, rubric, owner-review, and final-audit results |
| Recovery | Failure classes, retries, resumes, rollback actions, and results |
| Process | Intervention, retry, flaky check, permission escalation, missed check, and blocked duration |
| Artifacts | Stable locations and hashes when artifacts are stored |
| Result | Final status and completion time |

Receipt writer: `<command or tool>`

Receipt validator: `<command or tool>`

Evidence chain: `<run -> attempt -> checkpoint -> operation -> product IDs -> artifact>`

Write to a temporary file. Validate the content. Then rename it to the final path. A reader must
never see a partial receipt. Use `N/A` with a reason when a product ID does not apply.

## BroMetal and CPU-to-GPU plan

If the slice does not render, mark this section `N/A` and give a reason.

### Ownership and update path

| Question | Answer |
| --- | --- |
| Authoritative CPU state | `<state>` |
| Accepted change that marks data dirty | `<change>` |
| Stable ID to compact slot resolution | `<where and when>` |
| Smallest Antiky changed range | `<entry or byte range>` |
| Actual BroMetal update unit | `<measured API behavior>` |
| Update frequency | `<event-driven, frame, pass, or other>` |
| GPU readback | `<NONE, or justified operation>` |
| Resources that stay alive | `<buffers, programs, textures, geometry>` |
| Failed replacement behavior | `<last valid state or explicit failure>` |
| Disposal owner | `<owner and exactly-once rule>` |

### Budget

Use measured values. Do not enter a hoped-for value as a baseline.

| ID | Measure | Reference | Allowed result | Tool | Final result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `GPU-01` | CPU-to-GPU bytes for one accepted change | `<value or TO MEASURE>` | `<limit>` | `<tool>` | `<pending>` | `<PENDING>` |
| `GPU-02` | GPU-to-CPU readbacks in the normal path | `<value>` | `0` unless approved | `<tool>` | `<pending>` | `<PENDING>` |
| `GPU-03` | Unrelated render entries marked dirty | `<value>` | `0` | `<tool>` | `<pending>` | `<PENDING>` |
| `GPU-04` | Program, geometry, texture, and buffer recreation | `<value>` | `0` for a small value change | `<tool>` | `<pending>` | `<PENDING>` |
| `GPU-05` | Resource creation and disposal balance | `<value>` | Exactly once for each owner | `<tool>` | `<pending>` | `<PENDING>` |
| `GPU-06` | Extra GPU queue submissions caused by the change | `<value>` | `0` unless approved | `<tool>` | `<pending>` | `<PENDING>` |

### Round-trip checklist

- [ ] CPU state stays authoritative.
- [ ] The normal path has no unapproved GPU readback.
- [ ] Persistent IDs do not enter the frequent render loop.
- [ ] Static data uploads once for each content version.
- [ ] Only affected Antiky render entries or ranges become dirty.
- [ ] A scalar change does not rebuild geometry, programs, textures, or unrelated buffers.
- [ ] A scalar change does not add an unapproved GPU queue submission.
- [ ] The plan records actual BroMetal write behavior.
- [ ] Failed replacement keeps the last valid resources when safe.
- [ ] Owned GPU resources dispose exactly once.

## Structured inspection contract

| ID | Resource, query, or tool | Required fields or result | Bounds and version | Same service used by |
| --- | --- | --- | --- | --- |
| `INS-01` | `<operation>` | `<IDs, values, revisions, codes, ranges>` | `<version, page size, limits>` | `<tests, MCP, Studio>` |

Read operations must not change state. Change tools must call the same command service as local code
and return a structured result.

## Test plan

Name concrete files and cases before implementation.

| ID | Level | Test file or suite | Cases | Expected proof |
| --- | --- | --- | --- | --- |
| `TEST-01` | `<unit, contract, integration, visual, performance, or lifecycle>` | `<path>` | `<success and failures>` | `<claim>` |

### Regression-first rule

For a reported error:

1. Add a test that reproduces the error.
2. Run it and record the expected failure.
3. Fix the code.
4. Run the test and the affected suite again.

## Reload, reconnect, recovery, lifecycle, and security

| Change or event | Expected behavior | State guarantee | Evidence |
| --- | --- | --- | --- |
| Framework source change | `<update or restart>` | `<preserved or rebuilt state>` | `<test or operation>` |
| Demo source change | `<update or restart>` | `<guarantee>` | `<evidence>` |
| Shader or asset change | `<compile and replacement>` | `<last valid behavior>` | `<evidence>` |
| Configuration change | `<restart rule>` | `<guarantee>` | `<evidence>` |
| Inspection disconnect and reconnect | `<behavior>` | `<identity and revision rule>` | `<evidence>` |
| Runtime disposal | `<behavior>` | `<exactly-once rule>` | `<evidence>` |
| Invalid or unauthorized request | `<rejection>` | `<no state change>` | `<evidence>` |
| Run or evidence interruption | `<resume or reconstruct>` | `<checkpoint and run-setup match rule>` | `<evidence>` |
| Software rollback | `<programmatic action>` | `<last-known-good behavior and data rule>` | `<evidence>` |

List the stable diagnostic or rejection codes that the slice adds:

- `<CODE>`: `<meaning and safe details>`

## Implementation checkpoints

Each checkpoint includes code, tests, evidence, and one short commit.

| ID | Deliverable | Files or ownership | Tests and evidence | Commit message | Status |
| --- | --- | --- | --- | --- | --- |
| `CP-01` | `<coherent feature part>` | `<scope>` | `<named proof>` | `<short one-line message>` | `PENDING` |

Do not start a later feature from the main implementation plan during these checkpoints.

## Acceptance ledger

All applicable rows are hard gates.

| ID | REQUIRED result | Evidence method | Status | Direct evidence |
| --- | --- | --- | --- | --- |
| `AC-01` | The named outcome works through the complete path | `<method>` | `PENDING` | `<pending>` |
| `AC-02` | Structured inspection reports the same authoritative result | `<method>` | `PENDING` | `<pending>` |
| `AC-03` | Success and required failure tests pass | `<method>` | `PENDING` | `<pending>` |
| `AC-04` | Small updates and a complete rebuild agree | `<method>` | `PENDING` | `<pending>` |
| `AC-05` | Reload and recovery follow the defined rules | `<method>` | `PENDING` | `<pending>` |
| `AC-06` | Owned resources start and dispose safely | `<method>` | `PENDING` | `<pending>` |
| `AC-07` | Security and authority checks make rejected requests no-ops | `<method>` | `PENDING` | `<pending>` |
| `AC-08` | Reference and performance limits pass or have approved differences | `<method>` | `PENDING` | `<pending>` |
| `AC-09` | Package and import boundaries pass | `<method>` | `PENDING` | `<pending>` |
| `AC-10` | One clean-start verification command passes | `<method>` | `PENDING` | `<pending>` |
| `AC-11` | The run used the frozen setup and isolated resources | `<method>` | `PENDING` | `<pending>` |
| `AC-12` | The evidence receipt validates and links every required result | `<method>` | `PENDING` | `<pending>` |
| `AC-13` | Retries, resume, rollback, and delivery permissions followed the contract | `<method>` | `PENDING` | `<pending>` |
| `AC-14` | The learning and after-completion records are complete | `<method>` | `PENDING` | `<pending>` |
| `AC-15` | `<slice-specific required result>` | `<method>` | `PENDING` | `<pending>` |

## Success rubric

Scores: `0` no evidence, `1` partial or one-time manual result, `2` repeatable main path with a
missing edge or proof, `3` complete with repeatable direct evidence. Do not average scores.

| ID | Dimension | Score required | Current score | Evidence or gap |
| --- | --- | --- | --- | --- |
| `RUB-01` | Outcome and scope | `3` | `0` | `<gap>` |
| `RUB-02` | Framework alignment | `3` | `0` | `<gap>` |
| `RUB-03` | Framework design | `3` | `0` | `<gap>` |
| `RUB-04` | Correctness | `3` | `0` | `<gap>` |
| `RUB-05` | Inspectability | `3` | `0` | `<gap>` |
| `RUB-06` | Render efficiency | `<3 or N/A>` | `0` | `<gap or accepted N/A reason>` |
| `RUB-07` | Failure and recovery | `3` | `0` | `<gap>` |
| `RUB-08` | Lifecycle and security | `3` | `0` | `<gap>` |
| `RUB-09` | Reference and performance | `3` | `0` | `<gap>` |
| `RUB-10` | Reproduction and handoff | `3` | `0` | `<gap>` |
| `RUB-11` | Autonomous execution | `3` | `0` | `<gap>` |
| `RUB-12` | Operation and learning | `3` | `0` | `<gap>` |

## Evidence log

| Date | Run ID | Attempt | Revision | Evidence ID | Correlation ID | Command or operation | Result | Artifact or output |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| `<date>` | `<run ID or PLAN>` | `<number>` | `<revision>` | `<REF, PRE, TEST, GPU, INS, or AC ID>` | `<ID or N/A>` | `<exact use>` | `<result>` | `<path or inline output>` |

## Delivery failure and learning log

| Date | Run and attempt | Class | Unexpected result or intervention | Disposition | Evidence and status |
| --- | --- | --- | --- | --- | --- |
| `<date>` | `<IDs or PLAN>` | `<failure class or PROCESS_GAP>` | `<what happened>` | `<test, shared rule, capability hypothesis, or accepted decision>` | `<proof and OPEN or CLOSED>` |

Record unplanned interventions, retries, flaky checks, permission escalations, missed checks, and
blocked time. Keep every failed attempt. Do not replace it with only the final green result.

## After completion

| Area | Owner | Signal or source | Trigger | Required action |
| --- | --- | --- | --- | --- |
| Health | `<owner>` | `<verification, runtime, or diagnostic signal>` | `<failure condition>` | `<triage or recovery>` |
| Human feedback | `<owner>` | `<inbox or issue path>` | `<new report>` | `<triage path>` |
| Agent findings | `<owner>` | `<finding path>` | `<new finding>` | `<triage path>` |
| Regression and rollback | `<owner>` | `<test and last-known-good target>` | `<exact trigger>` | `<fix or rollback>` |
| Deprecation or retirement | `<owner>` | `<consumer and replacement evidence>` | `<retirement condition>` | `<approval and cleanup>` |

Use `N/A` with a reason when the slice has no deployed service or continuous monitor.

## Drift and discovery log

| Date | Change or discovery | Effect on the plan | Decision and approver |
| --- | --- | --- | --- |
| `<date>` | `<framework change or new need>` | `<inventory, scope, test, or limit change>` | `<decision>` |

## Final completion declaration

Current declaration: **NOT COMPLETE**

The owner can change this declaration to `COMPLETE` only when:

- [ ] Every applicable readiness row is `PASS`.
- [ ] Every applicable acceptance row is `PASS`.
- [ ] Every applicable rubric row scores `3`.
- [ ] Every `N/A` has an accepted reason.
- [ ] The complete verification command passes from a clean start.
- [ ] Evidence names the final revision or final patch state.
- [ ] The run state is `CLOSED`.
- [ ] The evidence receipt validates and links every required result.
- [ ] Every failed attempt has a resolved class and disposition.
- [ ] The after-completion record names its owner and feedback path.
- [ ] The reference remains available.
- [ ] No placeholder, blocker, or owner choice remains.
- [ ] The final audit confirms the original outcome.

Final evidence revision: `<revision or PENDING>`

Final audit result: `<PASS or PENDING>`
