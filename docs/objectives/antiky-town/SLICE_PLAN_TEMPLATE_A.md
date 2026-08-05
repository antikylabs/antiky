# Slice Plan Template

**Status: Template — copy this file; do not implement it**

Use this template with the [Slice Delivery Workflow](SLICE_WORKFLOW_A.md). A real slice plan is a
short human-readable contract. It is not a blank execution ledger.

Keep the real plan at 300 lines or fewer. Remove all template instructions and unused sections.
Record run-specific facts in the evidence receipt.

Create the plan as `slice-NN/plan.md`. Create `slice-NN/outputs/README.md` with the output layout
from the workflow.

If the slice needs owner judgment, create `slice-NN/owner-input_H.md`. Follow the
[owner-input rules](SLICE_WORKFLOW_A.md#owner-input). Put each question, context, recommendation,
and inline answer block in that file. Do not copy the questions into the plan.

---

# Slice `<NN>`: `<short name>`

`<If owner input exists: For a short review, answer the questions in the linked owner-input file.>`

## Control

| Field | Value |
| --- | --- |
| Status | `<NOT READY, READY, IN PROGRESS, NOT COMPLETE, or COMPLETE>` |
| Outcome | `<one useful result>` |
| Owner input | `<link to owner-input_H.md, or NONE>` |
| Architecture decisions | `<links or NONE>` |
| Depends on | `<earlier slice or NONE>` |
| Alignment revision | `<full Git revision>` |
| Complete check | `<one temporary command; replace it with the saved result when complete>` |
| Evidence | `docs/objectives/<objective>/slice-<NN>/outputs/{run-id}/receipt.json` |

`<State that the goal runner must read the owner-input file and stop on a pending answer. Remove
this text when no owner-input file exists.>`

Goal command:

```text
/goal implement docs/objectives/<objective>/slice-<NN>/plan.md until complete
```

## Review summary

In five bullets or fewer, state what the slice adds and what it does not add.

- `<change>`
- `<change>`
- `<important non-goal>`

## Outcome

`<One sentence that names the observable result.>`

### Observable behavior

- `<main success behavior>`
- `<structured inspection behavior>`
- `<safe failure behavior>`

### Non-goals

- `<related work for a later slice>`
- `<general abstraction that this result does not prove>`

## Chosen shape

Show the smallest useful relationship diagram when three or more clients, owners, or state copies
interact.

```text
<caller> -> <shared service> -> <authority> -> <visible result>
```

| Owner | Owns in this slice | Does not own |
| --- | --- | --- |
| `<package or system>` | `<responsibility>` | `<protected boundary>` |

Put unresolved product choices in the owner-input file. Record important engineering choices here.
Compare a second option only when the choice affects ownership, a public contract, or long-term
cost.

## Required reading

- `<owner-input link first, when it exists>`
- `<relative link to SLICE_WORKFLOW_A.md>`
- `<relevant ADR, architecture guide, reference source, and engineering guide>`

## Research and decision review

- Relevant frameworks: `<current primary sources, approaches, trade-offs, and Antiky result>`
- BroMetal: `<installed version, latest published version, check command, relevant design rules,
  and upgrade result>`
- Accepted decisions: `<ADRs and architecture rules that control this slice>`
- `UNDER_REVIEW_A.md`: `<necessary item and owner-input question, or NONE with a reason>`

Do significant research. Do not list framework names without a result. The installed BroMetal
version must be current unless the owner approved a specific exception in the owner-input file.
Read `UNDER_REVIEW_A.md` in full. A necessary unresolved item keeps the plan `NOT READY`.

## Current state and reference

State only the current facts that affect the slice:

- `<implemented capability and proof>`
- `<missing capability>`
- `<reference behavior or appearance>`

Name the Git alignment revision in the control table. Mark planned code as missing. Do not describe
a design document as working code.

The implementation agent captures any missing runtime baseline in the first checkpoint. Baseline
capture is not owner work.

## Deliverables

### Framework

- `<small framework addition, owner, first consumer, and protected import boundary>`
- `<or state that no framework code is needed and explain why>`

### Integration and tools

- `<host, demo, CLI, Studio, MCP, or test adapter work>`
- `<versioned contract or config>`

### User-facing documentation

- `<affected page under docs/user-facing-docs/framework, cli, or studio>`
- `<documentation check, or N/A with a reason when public use does not change>`

For each fact, name one source of truth. UI, CLI, MCP, and tests can adapt the fact. They must not
calculate different versions of it.

## Data and authority path

Include this section when the slice changes authoritative state.

```text
<request>
  -> <validation and trusted context>
  -> <authoritative decision>
  -> <state copies>
  -> <visible or stored result>
```

State the ID, revision, permission, and order rules. State which copy is authoritative.

## Safe behavior

| Event | Required result |
| --- | --- |
| `<invalid input or missing permission>` | `<stable rejection and unchanged state>` |
| `<failed update or replacement>` | `<last valid or explicit safe state>` |
| `<reload, reconnect, or disposal>` | `<identity and cleanup rule>` |

State the security boundary, data-size limit, and production-exclusion rule when they apply.

## CPU-to-GPU path

Include this section only when the slice changes rendering work. Otherwise, remove it.

- Authoritative CPU state: `<state>`
- Changed Antiky range: `<range>`
- Actual BroMetal update unit: `<measured unit>`
- Normal GPU readback: `<zero or approved reason>`
- Stable resources: `<resources>`
- Failure and disposal: `<rule>`
- Measurements: `<bytes, writes, draws, creation, and disposal proof>`

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | `<baseline and run preflight when needed>` | `<record or check>` | `<short message>` |
| `CP-01` | `<coherent code and tests>` | `<test or evidence>` | `<short message>` |
| `CP-02` | `<integration and completion>` | `<complete behavior>` | `<short message>` |

Each checkpoint includes its tests. Each checkpoint leaves the repository in a working state.

## Test plan

Name the concrete boundaries and cases. Use a table only when exact mapping helps.

- `<unit or contract cases>`
- `<integration success and failure cases>`
- `<reload, recovery, security, and cleanup cases>`
- `<reference and performance cases>`
- `<user-facing documentation links, commands, and examples>`
- `<complete repository and slice verification commands>`

For a reported error, add a failing regression test before the fix.

Put all temporary verification code in this slice's `verification/` folder. Do not add the command
or its tests to a package manifest. Do not create a shared root verification library. After the
slice is complete, delete its `verification/` folder and keep only the saved results in `outputs/`.

## Completion checks

- [ ] `<owner-input status is ANSWERED, when applicable>`
- [ ] `<observable outcome works>`
- [ ] `<structured service reports the same result>`
- [ ] `<invalid input leaves safe state>`
- [ ] `<reference and performance limits pass>`
- [ ] `<security, lifecycle, and cleanup pass>`
- [ ] `<affected user-facing documentation matches the shipped behavior, or N/A has a reason>`
- [ ] `<repository check passes>`
- [ ] `<complete slice check passes from one clean start>`
- [ ] `<evidence receipt validates and links all required proof>`

## Run and evidence rule

Reference the shared workflow for normal isolation, permissions, retries, rollback, and receipt
content. Add only rules that are special to this slice.

- Isolation: `<slice-specific collision or resource rule>`
- Retry: `<small retry bound or shared rule>`
- Rollback: `<last passing checkpoint, trigger, action, and proof>`
- Special authority: `<new permission or NONE>`
- After completion: `<owner, health check, and feedback path>`

Record actual revisions, environment values, ports, identities, dependency versions, attempts,
measurements, and artifacts in the evidence receipt. Do not pre-fill empty tables in the plan.

List every changed page under `docs/user-facing-docs/` in the receipt. If none changed, record `N/A`
and the reason.

Write `receipt.json`, `confirmation-checks.md`, and `facts.json` under this slice's
`outputs/{run-id}/` directory. Add measurements, captures, and logs only when the plan needs them.

Update `../slice-list.md` from the run's facts before closeout.

Write a `slice-summary.md` that tells the owner/human what they need to know about the slice development, what changed in the repo, what was added to CLI/Framework/Studio, and how to test. Also note any decisions that were made that might require an ADR. Keep it simple and straight forward and put it under this slice's directory.
