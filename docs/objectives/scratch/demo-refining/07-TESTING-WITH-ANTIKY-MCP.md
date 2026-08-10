# Testing and Inspecting Demos with the Antiky MCP

**Date:** 2026-08-10
**Status:** every command and error code below was **actually executed** against a live dev server
at HEAD, not transcribed from source. Where I state that something fails, I ran it and it failed.

These are working notes for anyone (human or agent) doing render work on the demos. The companion
reusable skill spec lives at `../skill-research/skill-specs.md` (S1 `verify-antiky-frame`).

---

## Why this document exists

The single root cause behind every finding in this audit is that **the previous work was done
blind** — no shader shows evidence of having been looked at after it was written. The repository
ships a purpose-built capture and inspection MCP for exactly this, and it went unused.

I nearly repeated the mistake. My first pass captured the demos with a hand-rolled Playwright
script, and my first draft of `06-WORK-PACKETS.md` proposed *building a new capture harness* when
the repo already had one. That was wrong, and this document is the correction.

---

## The surface

`npm run antiky -- tool <name> [json] --project <path/to/x.antiky>`

Reads (safe, no side effects): `get_dev_status`, `get_latest_build`, `get_runtime_status`,
`get_render_stats`, `get_diagnostics`, `get_capture_capabilities`, `get_render_evidence`,
`get_session_status`, `get_world_inspection`, `get_event_log`, `list_point_lights`,
`get_point_light`.

Actions: `capture_frame`, `capture_gameplay_sequence`, `dev_reload`, `pause_simulation`,
`resume_simulation`, `step_simulation`, `set_point_light_power`, `correct_point_light_power`.

The same tools are available over stdio MCP via `antiky mcp --project <path>`, which is the right
integration for an agent session. The `antiky tool` CLI form is what you want in a script.

## The capture protocol, as actually observed

`capture_frame` is **fenced**: you pass the identities you believe are current, and it refuses if
reality has moved. This is good design — it makes "I captured a stale build" unrepresentable —
but it means a single call is never enough. The working sequence is:

```
get_latest_build          -> developmentSessionId, acceptedBuildRevision
get_runtime_status        -> observation.runtimeInstanceId (null when nothing is attached)
get_capture_capabilities  -> target.configuredWidth / configuredHeight
capture_frame             -> retry on a stale fence
```

A verified-working reference client is in this session's scratchpad as `mcp-shoot.mjs`; the shape
that matters is the retry:

```js
const retryable = new Set([
  'CAPTURE_BUILD_STALE',        // the build advanced under you — re-read and retry
  'CAPTURE_RUNTIME_STALE',      // the runtime was replaced
  'CAPTURE_DIMENSIONS_MISMATCH' // canvas size moved, or you asked for the wrong target
]);
```

Both of the first two fired during a normal run. They are expected traffic, not failures — the
managed browser attaching *is itself* what advances the build revision from 0 to 1, so a first
call built from a cold `get_latest_build` will usually lose the race exactly once.

### Rule: `target` must equal the manifest viewport

`get_capture_capabilities` reports `target.configuredWidth/Height` (1280×720 for these demos,
from the `.antiky` manifest's `development.viewport`). Passing anything else returns
`CAPTURE_DIMENSIONS_MISMATCH`.

**`deviceScaleFactor` is where this bites.** `1280×720 @ dsf 2` is rejected, even though
`maximumDeviceScaleFactor` is 2 and 2560×1440 is inside `maximumWidth/Height`. Use
`deviceScaleFactor: 1` and change the manifest viewport if you want more pixels. I lost a cycle
to this; the limits block reads as though it permits the combination and it does not.

## The blocker nobody had hit: a 10-second timeout around a cold browser start

**`capture_frame` does not currently work on the asset-heavy antiky demos.** Verified:

| Demo | Assets loaded | Result |
|---|---|---|
| `luminous-reef` (BroMetal, 420 LOC, procedural) | none | **Captured first try**, valid PNG artifact |
| `point-light-expo` | ~10 MB (3.7 + 2.7 + 1.7 MB GLB, ~2.8 MB JPEG) | `ANTIKY_ACTION_TIMEOUT` at `warmUpFrames: 90` **and** at `12` |

The cause is `packages/cli/src/host/actions.ts:48`:

```js
const DEFAULT_ACTION_TIMEOUT_MILLISECONDS = 10_000;
```

That single 10-second budget wraps the *entire* managed capture: launching Chromium, loading the
page, downloading ~10 MB of assets, initialising WebGPU, warming up N frames, and encoding the
PNG. An asset-free demo fits comfortably. The three demos this audit is about do not, and lowering
`warmUpFrames` does not help because warm-up is not what is slow.

**This is very likely the real reason the tooling went unused.** The ceremony is a nuisance; a
tool that reliably times out on the demos you actually need to photograph is a dead end. Anyone
who tried it once on `point-light-expo` and got `ANTIKY_ACTION_TIMEOUT` would reasonably conclude
it was broken and go back to guessing.

### Fix, in priority order

1. **Separate the launch budget from the action budget.** A managed cold start already has its own
   `DEFAULT_LAUNCH_TIMEOUT_MILLISECONDS` (`managed-capture-runtime.ts:385`); the capture action
   should not also have to fit inside 10 s. Give `capture_frame` its own timeout, sized for a cold
   start plus asset load, or make it configurable per call.
2. **Keep the managed runtime warm across captures.** Paying browser launch + asset load once per
   demo instead of once per capture removes the problem for iterative work, which is the whole
   point of a see-your-own-output loop.
3. Until either lands, `runtimePolicy: 'current-or-managed'` against an already-attached browser
   avoids the cold start — but that requires a live runtime, which the CLI path does not give you.

This is a prerequisite for the verification loop, and it should be treated as **Track 0's first
packet**, ahead of any script that consumes it.

## Two more things that will bite you

- **`npm test` is red on `main` right now.** `skills/` was deleted in `1062bd4` ("sync") while
  `scripts/repository-policy.test.mjs:64-66` still does `readdir(repositoryRoot/skills)`. It fails
  `ENOENT`. Verified by running it: 4 pass, 1 fail. Fix this before adding any test, or you will
  not be able to tell your own failure from the pre-existing one.
- **Every demo manifest binds `127.0.0.1:3010`** (game) and `:3011` (inspection). Captures are
  therefore **strictly serial** — one demo at a time, `Ctrl-C` between. Any "shoot all demos"
  script must sequence, not parallelise. Also, `combat-arena` and `traversal-study` are missing
  from `scripts/dev.mjs`'s `demoProjects` map, so `npm run dev:demos -- combat-arena` fails.

## Beyond screenshots: what makes this better than a Playwright script

A hand-rolled script gets pixels. The MCP gets pixels *plus the state that produced them*, which
is what turns "looks wrong" into a diagnosis:

- **`get_render_stats`** — frame, canvas, draw-call, instance and upload measurements. This is how
  the frame-time acceptance criteria in `06-WORK-PACKETS.md` are checked (e.g. W B.3's "frame time
  increases by no more than 40%"). It explicitly does *not* prove appearance; pair it with a capture.
- **`pause_simulation` / `step_simulation` / `resume_simulation`** — step to an exact
  `completedStepCount`, then capture. This is how you get a *comparable* frame across a change.
  Note `step_simulation` requires `expectedCompletedStepCount`, so it is fenced too.
- **`get_world_inspection` / `get_event_log`** — the simulation state behind the frame. Answers
  "is the shadow wrong, or is the object somewhere I didn't expect?"
- **`list_point_lights` / `set_point_light_power`** — live light manipulation, which is exactly the
  A/B tool for `point-light-expo`'s lighting work: change one light's power and re-capture.
- **`capture_gameplay_sequence`** — bounded motion with a scripted keyboard/pointer trace.
  Necessary for anything about *feel* (the camera-shake work in W D.6 cannot be judged from a
  still). It declares itself **non-deterministic**, so do not build exact-replay assertions on it.

### There is no seed

No deterministic seed exists in the demos, and sequence capture declares `deterministic: false`.
So the comparable-frame recipe is **pause → step to a fixed N → capture**, never "replay the same
input and diff". Any acceptance criterion written as "the same inputs produce the same frame" is
unsatisfiable today. (A seeded RNG is proposed in `05-FRAMEWORK-EASY-WINS.md` — six demos
currently hand-roll one with six different magic-constant sets.)

### Evidence is not a file path

Captures return opaque `antiky-evidence://` URIs and are retrieved through `get_render_evidence`.
Retention is scoped to the development session and `.antiky/` is gitignored, so **the capture
itself is not a committable artifact.** Commit a metrics sidecar (the luminance statistics from
Track 0) and treat the PNG as transient. Note also that `*.png` is tracked by LFS here.

---

## Correction to `06-WORK-PACKETS.md` Track 0

Track 0 as originally written proposed building a Playwright harness from scratch. Revised:

- **W0.1 is now:** raise/split the capture action timeout so `capture_frame` succeeds on the
  asset-heavy demos. Acceptance: `capture_frame` returns a valid artifact for all three antiky
  demos at `warmUpFrames: 60`, three runs in a row, no `ANTIKY_ACTION_TIMEOUT`.
- **W0.1b:** fix `npm test` on `main` (the `skills/` ENOENT). Acceptance: `npm test` green before
  any new test is added.
- **W0.2 (`demos:shoot`) wraps the MCP**, it does not replace it: fence, retry, capture, then run
  the frame statistics. It must sequence demos because they share port 3010, and it must update
  both `repository-policy.test.mjs` allowlists in the same commit — that test asserts exact
  allowlists for `scripts/` contents and root `package.json` script keys, so adding a script
  without updating them turns the suite red.
- Frame statistics (W0.2/W0.3) are unchanged and still needed — the MCP gives pixels and render
  measurements, but nothing computes luminance percentiles today.

The reference client I verified this with is in the session scratchpad as `mcp-shoot.mjs`; it is
throwaway, and `demos:shoot` should be written properly against the same protocol.
