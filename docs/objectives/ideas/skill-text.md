# Skill text — patching a dependency and upstreaming the fix

**Recorded:** 2026-08-11, from doing it for real across BroMetal PRs
[#3](https://github.com/ericdrowell/brometal/pull/3)–[#7](https://github.com/ericdrowell/brometal/pull/7).
**Status:** raw material for a reusable skill, not a skill yet.

The job this covers: you depend on a library, you hit a defect or a missing capability, you cannot
wait for a release, and you do not want to fork. Patch locally, use it today, send the fix upstream,
delete the patch when it lands.

`docs/adr/framework/0021` is where this is a decision rather than a habit: *"Antiky can patch
BroMetal locally. For each patch, Antiky will send a focused pull request to the BroMetal project.
An accepted pull request removes the need for that patch."*

---

## 1. Local patches

### One file per contribution, not per file touched

```
scripts/patch-brometal.mjs              the runner
scripts/patch-brometal/
  discard.mjs                           8 replacements across 5 files — one PR, one module
  present.mjs
  render-target-filtering.mjs
  offscreen-multisampling.mjs
  attribute-buffer-defects.mjs
```

Split by **what you would send upstream**, because that is the unit that gets retired. `discard`
touches the builtins, the public surface, the analyzer, the emitter and the optimizer — five files,
one idea, one module. When the PR merges you delete exactly one file.

### Every module names its PR

Each module's header carries the upstream URL, the PR title, and the retirement instruction:

```js
/**
 * W A.1 — a per-target filter option on render targets.
 *
 * [why the patch exists, and what the original code's comment got right and wrong]
 *
 * **Upstream: https://github.com/ericdrowell/brometal/pull/3**
 * render target: allow linear filtering, keep nearest as the default
 *
 * Retire this file when #3 is merged or released. Nothing else needs changing —
 * remove the module, drop it from PATCHES in ../patch-brometal.mjs, and from the
 * scripts/ allowlist in ../repository-policy.test.mjs.
 */
```

Without this, six months later nobody knows whether a patch is still needed.

### The runner's four jobs

1. **Find every installed copy.** npm places a workspace dependency wherever hoisting allows, and
   that changes with the dependency graph. Ours moved from hoisted to nested-in-eight-workspaces
   during a version bump. A runner that patches only the first copy it finds **fails silently** —
   the app just runs an unpatched dependency.
2. **Guard the version.** Refuse to run against anything but the exact expected version. A patch
   applied to a version you have not checked is worse than no patch.
3. **Fail on a moved target.** If the "before" text is absent, throw. Never no-op.
4. **Be idempotent.** `postinstall` runs on every install. Skip when the "after" text is already
   present.

```js
const replace = async (relativePath, before, after) => {
  const source = await readFile(file, 'utf8');
  if (source.includes(after)) return;                       // idempotent
  if (!source.includes(before)) throw new Error(`patch target changed: ${relativePath}`);
  await writeFile(file, source.replace(before, after));
};
```

### Tests the patch mechanism needs

- patching twice changes **no bytes** (checksum before and after)
- **every** installed copy is patched, not just the first
- a wrong version throws, exercised against a fixture package
- a moved target throws, exercised against a fixture
- every module on disk is registered in the runner — a modular split makes it possible to write a
  patch that is never applied because nobody imported it

**Trap:** a before/after checksum cannot tell *"unchanged because correct"* from *"unchanged
because it crashed before writing."* Ours reported idempotent while both runs were failing on a
syntax error. Always also assert the patched content is present.

---

## 2. Upstreaming

### Work in a fork, against source — never against `dist/`

The published package ships compiled output. Patching `dist/` is right locally and wrong upstream:
a maintainer wants the change in the TypeScript. Clone the fork, find the real source, write it
there. This also surfaces things the compiled output hides — in our case a whole emitter had been
removed since an older branch was written.

```
gh repo clone <you>/<lib> fork          # fork already has `upstream` configured
cd fork && git checkout -b <one-branch-per-patch>
```

### Read the project's own rules first

`AGENTS.md`, `CONTRIBUTING.md`, the test commands. Match their conventions: their test framework,
their comment voice, their fixture layout. A PR that looks like it belongs is easier to accept.

### One PR per idea, and make them independent

Five separate PRs beat one 8,000-line PR. Say in each body that it is independent and can land
alone. If two genuinely cannot be separated, put them in one PR, say why, and **offer to split**.

Watch for accidental coupling: two of ours nearly added the same test fixture, which would have
made them conflict on a file neither needed to share. Reuse an existing fixture instead.

### Prove it, in their harness

Add a test in the project's own style. If they have a GPU or integration suite that reads real
output, put it there rather than in unit tests — that is usually where they keep the assertions
that matter.

**Record the before and after.** The strongest thing any of our PRs contained:

```
WITHOUT   ✗ two batches in one frame keep their own attribute data
WITH      ✓ two batches in one frame keep their own attribute data
```

Revert the fix, rebuild, run, capture the failure, restore. That converts "this fixes a bug" into
evidence.

---

## 3. PR body format

What we used, in order. Every section earns its place.

**1. Lead with the current behaviour, quoted from their code.**

````markdown
`createRenderTarget` hard-codes its sampler to nearest:

```ts
const sampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
```
````

**2. Take their existing comment seriously — Chesterton's fence, in public.**

> The second half of that is right and this PR keeps it. The first half no longer matches the code:
> `TARGET_FORMAT` is `rgba16float`, which **is** filterable in core WebGPU…

If a comment explains why the code is as it is, say which part still holds. It shows you read it,
and it is usually half-right.

**3. Say plainly if their code was not wrong.** One of ours looked like an obvious one-line bug and
was not:

> **That line is not wrong on its own**, and it took me a while to see why. The target texture is
> single-sampled, and a pipeline must match its attachment, so `1` was the only valid value.

**4. "Why it matters" in user terms**, not internal terms — what a developer experiences, and why
they would misattribute it.

**5. What changed**, with the default called out: *"defaulting to X so nothing changes for existing
callers."*

**6. Tests**, including the before/after and anything that did not run (ours: WebKit was not
installed locally — say so rather than let them wonder).

**7. Notes for the maintainer** — decisions you deliberately did not take, and why. *"`samples` is
a number rather than a `1 | 4` union because supported counts are a device capability. Validating
against the device would be reasonable; I left it out rather than guess at the API you would want."*

**8. Provenance and scope**, if extracted from something larger: what it carries, what it
**deliberately excludes**, and what needed porting.

**9. Close by handing them control.** On every PR:

```markdown
## Over to you

Genuine questions, not politeness:

- **Is this applicable at all?** If it does not fit where the project is going, say so and close it
  — no offence taken. We carry it as a local patch today, so nothing of ours is blocked.
- **Is there a better approach?** We arrived at this from the outside, without the context you have
  on the design. If you would solve it differently, we would rather write your version than have
  you merge ours.
- **Anything you want changed** — naming, comment style, test placement, scope — tell us.
```

This matters more than it looks. It converts the PR from "merge my code" into "here is a problem
and one solution", which is the honest framing when you are a stranger to the codebase.

---

## 4. Order of operations

1. Reproduce the defect and write the failing test **first**
2. Patch locally against `dist/`, get unblocked, keep shipping
3. Fork, branch, implement against source, add a test in their harness
4. Verify: their typecheck, their unit suite, their integration suite, before/after recorded
5. Open the PR with the format above
6. Add the PR URL to the local patch module's header
7. When it merges: delete the module, drop it from the runner and the allowlist

## 5. Things that bit us

- **npm echoes the command line**, so a script parsing `npm run <cli> -- tool <name> '<json>'`
  reads its own input back. Invoke the CLI binary directly.
- **A version bump can change dependency placement**, breaking anything that assumed hoisting —
  including a test importing the package from a non-package directory. `npm dedupe` restores it.
- **Check whether the defect still exists in the latest version before upstreaming.** We were four
  releases behind; both still did.
- **A test can pass for the wrong reason.** One of ours probed the exact midpoint between two
  texels, where the behaviour is implementation-defined. Move the probe and say why in a comment.
