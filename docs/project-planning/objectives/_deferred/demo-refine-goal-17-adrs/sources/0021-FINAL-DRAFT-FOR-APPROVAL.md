# ADR 0021 — final draft for owner approval

> **Status: APPROVED AND PLACED, 2026-08-11, commit `288cd76`.** This document is now the historical
> record of what was approved and on what basis. The live record is
> `docs/adr/framework/0021-brometal-render-driver-ownership_H.md`; if the two ever differ, the ADR
> wins. Kept because section 1 carries the language audit and the four terms still awaiting owner
> approval — see
> [`summary-goal-00.md`](../../../demo-refining/goals/_completed/summary-goal-00.md).

The text below was presented before placement. Per
`goals/_completed/execute-goal-00.md:149-152`, a half-placed supersession is worse than no change,
so nothing was written to `docs/adr/` until the owner approved both this text and the `studio/0007`
question.

---

## 1. Language audit — read this before approving

`docs/adr/AGENTS.md` requires ASD-STE100 **Issue 9** conformance and says plainly: *"If you cannot
read the official Issue 9 standard, do not claim compliance."* and *"Never report that an ADR is
ASD-STE100 compliant when you completed only format, link, sentence length, or automated checks."*

**I have not read the official Issue 9 standard.** It is a controlled document and I did not
retrieve it. So, reported separately as the workflow requires:

**What I did check (the AGENTS.md checklist, applied by hand):**

| Rule | Result |
|---|---|
| Active voice | Pass — every sentence in Decision and Consequences |
| One topic per sentence | Pass |
| 25-word limit on descriptive sentences | Pass — longest is 22 words |
| Multi-word nouns of three words or fewer | Pass — see the term list below |
| No semicolons | Pass — zero |
| No `-ing` word unless a technical noun | Pass, with two flagged terms below |
| Condition before result | Pass — "If a game module uses BroMetal directly, that module owns…" |
| Vertical-list items connect to their lead-in | Pass |
| No synonym only for variety | Pass — "driver", "render driver" and "game module" are each used one way |
| No technical noun used as a verb | Pass |

**What I could NOT check, and you should treat as unvalidated:**

- Every general word against the **Issue 9 controlled dictionary**. This is the substantive half of
  the standard and I did not do it.
- Approved **part of speech and word form** for each dictionary word.
- Whether Issue 9 permits my flagged terms as technical nouns.

**Terms needing your approval** (AGENTS.md workflow step 9):

| Term | Why flagged |
|---|---|
| `graphics processing unit (GPU)` | Contains "processing", an `-ing` form. Official industry term, defined on first use. Carried over from 0006, which already uses it. |
| `engineering effort` | "engineering" as a noun modifier. Common, but I cannot confirm dictionary approval. |
| `BroMetalRenderDriver` | A code identifier, not prose. Used once, in backticks. |
| `pre-1.0` | Version notation, not a dictionary word. |

Technical nouns declared and used with one meaning throughout: BroMetal, render driver, game module,
framework, shader, render target, shadow map, texture, buffer, GPU state, Antiky render data,
pipeline key, WebGPU library, Document Object Model (DOM), key light, pull request.

## 2. Format and link checks — separate from the language audit

| Check | Result |
|---|---|
| Five parts present (Title, Status, Context, Decision, Consequences) | Pass |
| Status value permitted by `README.md:101-107` | Pass — `Accepted` |
| Next unused number | Pass — framework runs `0001`–`0020`, so `0021` is next and reuses nothing |
| Filename rule `NNNN-short-title_H.md` | Pass |
| No `docs/objectives/` citation inside the ADR | Pass — `README.md:71-73` forbids it, and this draft cites none |
| Local links resolve | Verified at placement time with `test -f` |

## 3. The exact text to be placed

Path: `docs/adr/framework/0021-brometal-render-driver-ownership_H.md`

```markdown
# 0021: Own BroMetal in a BroMetal render driver

## Status

Accepted

Supersedes [0006: Keep BroMetal inside the Antiky render driver](0006-brometal-render-driver_H.md).

## Context

BroMetal compiles shaders and controls graphics processing unit (GPU) resources for Antiky.

Antiky Framework must operate without a GPU and without a browser. Servers, storage, headless tests,
Studio, and the agent protocol use the framework without a renderer. A test enforces this rule.
Framework source cannot import BroMetal.

Antiky games need shadow maps, off-screen render targets, and light values greater than 1.0. Each of
these features needs more than one render pass. Today each game builds these features again.
Different games in this repository do not agree about basic scene values. An example is the
direction of the key light.

ADR 0006 gives all direct use of BroMetal to one Antiky-owned render driver. The later ADR
[studio/0007](../studio/0007-framework-first-allow-others_H.md) gives renderer initialization and
resource disposal to the game module. A reader cannot see which record controls a framework game
that uses BroMetal. This record removes that conflict.

BroMetal is pre-1.0 software. A move to a different WebGPU library is possible.

## Decision

We will build a render driver with the name `BroMetalRenderDriver`. The framework will own this
driver.

The driver will use BroMetal directly. The driver will own these resources:

- BroMetal programs
- Textures
- Render targets
- Buffers
- GPU state
- Disposal of these resources.

Framework code outside the driver will not use BroMetal. Framework code will send Antiky render data
to the driver. This data will use Antiky identifiers, pipeline keys, assets, and typed updates. This
data will not contain BroMetal objects.

The driver is specific to BroMetal. We will not add a backend abstraction layer in the driver. We
will not add a second renderer library behind the same interface.

Antiky games will use the driver for render work. This path is the default path.

A game module can use BroMetal directly. This path is an exception. A game module must use this path
only when the driver cannot do the necessary work.

If a game module uses BroMetal directly, that module owns its own BroMetal resources. The framework
gives no driver features to that module.

When Antiky games need a new render feature, we will add that feature to the driver.

Antiky selects a different renderer only in the game module. Antiky gives its engineering effort to
BroMetal.

Changes that Antiky contributes to BroMetal must help renderers in general or correct an error.

Antiky can patch BroMetal locally. For each patch, Antiky will send a focused pull request to the
BroMetal project. An accepted pull request removes the need for that patch.

## Consequences

- The framework, server, storage, Studio, and protocol code operate without BroMetal and without a
  Document Object Model (DOM).
- One driver and its tests contain all BroMetal details. BroMetal upgrades are easier to control.
- Antiky controls render order, dependency inspection, and safe resource replacement.
- A move to a different WebGPU library needs a new driver. The new driver reads the same Antiky
  render data. The two drivers share no code. We accept this cost.
- Render extraction must change Antiky state into the input format of the driver.
- A game module that uses BroMetal directly must supply its own render features. That module also
  accepts the framework work that the driver does. That module does not receive later driver
  improvements.
- The driver must grow to hold the render features that games need. If many games use BroMetal
  directly, the driver is incomplete. That result is a signal to add driver features.
- A local BroMetal patch is temporary. Each patch needs an upstream pull request.
- Some GPU features can need changes to BroMetal.
```

## 4. `studio/0007` — my recommendation, your decision

`studio/0007:41-42` says the game module *"initializes and resizes the renderer"* and *"disposes its
renderer resources"*. That text is written across all four renderer choices, one of which is
"Antiky Framework with BroMetal". Once `0021` exists, that one case is wrong — the driver owns those
resources, not the game module.

**I recommend clarifying it**, because a reader looking up renderer ownership is more likely to land
on the Studio record than on `framework/0021`, and would take the wrong rule from it.

Proposed clarification, to be inserted after `studio/0007:42`:

```
These two statements apply to a game module that owns its renderer. If a game module uses the
framework render driver, that driver owns the renderer resources. Framework ADR 0021 gives the full
rule.
```

**The honest argument against:** no driver exists yet, so `0007:41-42` is accurate for every real
game module today, and a forward-looking clarification adds a record change for something not yet
built.

If you accept, `studio/0007` gets the same tag-hash-before-edit treatment as `0006`.

## 5. Also landing in this goal, needing no approval

- **Five website claims corrected** from Current to honest status. Full before-and-after in the
  handoff. No test asserts this copy (verified), and `AGENTS.md` forbids adding one that would.
- **The ADR 0013 gap recorded, not implemented.** `0013:17-21` requires the simulation to receive
  "Random seeds or random streams" as an explicit input. No seed exists in any demo. Goal 11
  implements it.
