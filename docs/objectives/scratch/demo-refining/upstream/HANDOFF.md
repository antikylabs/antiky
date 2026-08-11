# Goal 02 handoff — BroMetal render-pipeline patches

**Date:** 2026-08-11
**Commits:** `1e5ce13` (patches), `3203a82` (re-capture), `9118e47` (PR drafts)

## Status: complete except one step, which is blocked on the owner

| Completion criterion | State |
|---|---|
| Both patches in `scripts/patch-brometal.mjs` | Done |
| Both idempotent from a clean install | Done — byte-identical checksum on re-run |
| Failing-then-passing tests recorded | Done — all five assertions absent on pristine 0.15.0 unpacked from npm, present after patch |
| Version guard still throws | Done — fixture at 0.16.0 rejected |
| Changed-target guard still throws | Done — fixture with a moved target rejected |
| Demo captures show no aliasing regression | Done — see caveat below |
| `npm test` green | Done |
| **Both upstream pull requests open with URLs** | **BLOCKED — needs owner authorisation** |

## Why the last one is blocked

Opening a pull request on `github.com/ericdrowell/brometal` publishes content publicly, under the
owner's GitHub identity, on a third party's project. It also requires forking that repository into
the owner's account, which creates a public repository in their name.

An agent does not take that action on the strength of a goal file. The goal file is a document in
this repository; it cannot authorise publishing to someone else's. This step needs the owner to say
so explicitly, and the goal stays active until they do.

**This is not a technical blocker.** `gh auth status` reports an authenticated account with `repo`
scope, and the upstream is public with a `main` default branch. The work is ready.

## A substantive gap the owner should know about before authorising

Both drafts state their diffs against the published `dist/`, because that is what a consumer can
patch and what was verified here. **A maintainer will reasonably want the change against the
TypeScript source instead**, which is not present in this repository — only the compiled `dist/`
ships in the npm package.

Doing this properly means forking, cloning the source, locating the equivalent code, writing the
change there, and confirming it compiles to the behaviour verified below. That is real work and it
carries real risk of being wrong in public. The recommended sequence is therefore:

1. Fork and clone `ericdrowell/brometal`.
2. Write both changes against its TypeScript source.
3. Show the owner the source-level diffs.
4. Open the pull requests only after that review.

Opening them today from the `dist/`-level drafts would be faster and worse.

## What was verified, for the pull request bodies

Descriptors WebGPU actually received, headless Chromium with `--enable-unsafe-webgpu --use-angle=metal`,
against the patched build. **No WebGPU validation errors in any case** — the check that matters,
since pass, pipeline and attachments must agree on sample count or the device rejects the pipeline.

| Call | Result |
|---|---|
| `createRenderTarget(r, { width: 8, height: 8 })` | sampler `nearest` / `nearest` |
| `createRenderTarget(r, { …, filter: 'linear' })` | sampler `linear` / `linear` |
| `createRenderTarget(r, { …, depth: true })` | target `rgba16float` @1, depth `depth24plus` @1; pass uses direct view, `storeOp: 'store'` |
| `createRenderTarget(r, { …, depth: true, samples: 4 })` | target `rgba16float` @1, depth @4, colour `rgba16float` @4; pass uses `resolveTarget`, `storeOp: 'discard'` |

## Caveat on the no-regression evidence

The criterion passes, but **trivially**. Local contrast moved 2.97→3.01, 5.47→5.47, 0.00→0.00,
8.61→8.62 across the four antiky demos, and that drift is animation phase rather than the patches.

**No demo renders to an off-screen target yet**, so both patches are inert until Track B consumes
them. The capture proves nothing broke. It does not demonstrate either patch working in a demo —
that happens in goal 06, which is the first consumer.

## Correction to the goal file's framing of W A.2

`execute-goal-02.md:35-37` describes W A.2 as stopping `drawTo` from forcing `passSamples = 1`, "so
an off-screen pass keeps the sample count it was configured with".

That line is not wrong on its own. The target texture **is** single-sampled, and a pipeline must
match its attachment, so 1 was the only valid value. Simply raising it to 4 would fail WebGPU
validation. The missing piece was the multisampled attachment, so the patch adds one and resolves
into the target — mirroring what the on-screen path at `webgpu.js:126-150` already does.

The goal's acceptance criteria were satisfiable as written; only its explanation of the cause needed
correcting.
