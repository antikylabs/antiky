# Motion inspection — telling a motion story to a model that cannot watch video

**Date:** 2026-08-11
**Status:** research. Every repository claim below was read at HEAD and carries a `file:line`.
Nothing here has been implemented. Section 8 ranks what I would build; section 9 says plainly what I
would not, and §9.1 says what I do not know. Section 10 is external prior art, tagged by how well
established each item is; §10.7's optical-flow costs were **measured**, not estimated, and every
remaining unverified claim in it is called out by name at the end of that subsection.
**Audience:** the owner, who is not a graphics specialist. Every technical term is defined in one
plain sentence at first use, and there is a glossary at the end.

---

## The one-paragraph answer

**Do not try to send the model a video. Compute the motion signal from the simulation, in an
ordinary Node test, and use pixels only to prove the renderer did not lie about it.** In
`combat-arena` every visible signal is already a pure function of the simulation snapshot and
`state.time` — the camera comes from `createCombatCameraProjector().project(aspect, state, pointer)`
(`packages/demos/antiky/combat-arena/src/presentation.ts:31`), and every shader's `uTime` is fed
`state.time`, not wall-clock time
(`packages/demos/antiky/combat-arena/src/renderer.ts:130-133`). That means the camera path, the
shake spectrum, the impact envelope and the VFX pulse can all be produced as arrays of numbers in
milliseconds, with no browser, no GPU and no capture. The 1.05-second wobble that makes the arena
feel broken is a property of two constants on two lines; you can prove it with a 600-element array
and forty lines of arithmetic. Reaching for video is reaching straight past the answer.

Pixels remain necessary, but for a narrower job than people assume: they are the only place a
*rendering* bug shows up, and the only place a signal that is computed inside a shader can be
observed at all. The second recommendation follows from that: give captured frames a **per-frame
stamp tying each one to an exact simulation instant**, because without it no pixel measurement can
be correlated with anything the simulation knows, and every pixel-side motion claim is unfalsifiable.

Two independent findings from the literature (section 10) say this is the right bet rather than a
convenient one. First, **no mainstream visual-testing tool asserts on motion — they all suppress
it.** Playwright's screenshot assertion disables animations *by default*; Percy freezes them;
Chromatic pauses them; Unreal ships a "Disable Noisy Rendering Features" checkbox. Second, and more
pointedly: **current multimodal models are close to chance at judging temporal defects in gameplay
video, and denser frame sampling does not fix it** (TempGlitch, 2026; MotionBench, CVPR 2025). If
you built the video pipeline, the model at the end of it still could not do the job. A number and a
threshold can.

---

## 1. The problem, restated in this repository's terms

An agent must judge motion — shake, animation, VFX timing, judder, easing, hit-stop, traversal
feel. It cannot watch video. It can read text and look at still images.

The repository already ships a capture surface. It is good, and it is bounded:

| Fact | Where | Consequence for motion |
|---|---|---|
| Sequence capture is capped at **30 frames per second** | `packages/cli/src/development/capture-sequence.ts:17` | Cannot represent anything faster than **15 Hz**. |
| Sequence capture is capped at **6 seconds** and **180 frames** | `capture-sequence.ts:16,18` | Frequency detail no finer than about **0.17 Hz**; at most ~4.8 cycles of a 0.8 Hz VFX pulse. |
| A sequence declares **`deterministic: false`** | `packages/cli/src/host/capture-sequence-service.ts:372` | "Replay the same input and diff the pixels" is not available. |
| A sequence stamps **only the first and last** observation | `capture-sequence-service.ts:449` | No captured frame can be tied to a simulation instant. |
| The simulation runs at a **fixed 60 Hz** | `packages/framework/src/sessions/engine-session/contract.ts:4` (`FIXED_STEP_SECONDS = 1/60`) | The simulation itself cannot represent anything above 30 Hz. |
| Presentation runs at the display's refresh rate | `packages/cli/src/host/game-server.ts:481-506` | 60–144 Hz, and **nothing measures it per frame**. |
| `get_render_stats` reports a **500 ms rolling average** frame rate | `game-server.ts:490-495` | Averages away exactly the thing judder is. |
| Inspection is published every **250 ms** | `game-server.ts:370` | Any "read the state while it moves" loop samples at 4 Hz. |

Read those together and a single organising rule falls out, which is the intellectual spine of
this document:

> **The frequency budget.** Match the instrument to the speed of the thing you are measuring.
>
> - Below ~1 Hz (VFX breathing, colour drift, slow easing) — **the capture can see it.**
> - 1–15 Hz (screen shake, hit reactions, most animation) — the capture can *barely* see it;
>   the **simulation** sees it exactly and for free.
> - Above 15 Hz (judder, frame holds, per-frame pacing) — **the capture cannot see it at all.**
>   Only the presentation loop can.
>
> Every proposal in section 8 is placed by this rule. Most existing disappointment with visual
> tooling comes from pointing a 30 Hz instrument at a 144 Hz question.

---

## 2. Three places motion lives, and what each can prove

This distinction does most of the work in the rest of the document.

**The simulation** is the authoritative fixed-step state machine. It knows *intent* exactly:
positions, velocities, phases, impact values, event times. It is cheap to query, exactly
reproducible for a given input sequence, and it runs headlessly in Node with no GPU.
It knows **nothing about what was drawn**.

**The renderer / presentation layer** turns state into draw calls: the camera pose, the uniform
values, the instance buffers. It knows things the simulation does not — the camera is computed here
and is *never written back into simulation state*. It is also the layer where a frame is presented,
so it is the only place that knows how long a frame actually took.

**The pixels** are the delivered image. They are the only place a rendering bug appears — a wrong
matrix, a shader that ignores its uniform, a blend mode that eats a colour. They are also noisy,
expensive, lossy about intent, and cannot tell you *why* anything moved. Some defects live **only**
here and **only** in motion — §7.4 works one through, and it is the case that justifies keeping a
pixel path at all.

A good system needs all three, and it needs a **key that joins them**. Today the joins are partial:

| Join | Exists? | Evidence |
|---|---|---|
| Event → simulation time | **Yes.** Facts carry `simulationTimeSeconds` and `simulationRevision`, and `occurredAt` is documented as simulation seconds encoded from the Unix epoch, not wall clock. | `packages/demos/antiky/combat-arena/src/inspection.ts:305-310` |
| Simulation state → captured still | **Yes.** `capture_frame` is fenced on `completedStepCount` and `stateDigest`. | `packages/cli/src/mcp/tools.ts:112-129` |
| Simulation state → captured *sequence frame* | **No.** Start and end observations only. | `capture-sequence-service.ts:449` |
| Camera pose → anything | **No.** The camera is never published. `grep -rn "camera" packages/demos/antiky/*/src/inspection.ts` returns nothing. | verified at HEAD |
| Presented frame → frame time | **No.** Only a 500 ms mean. | `game-server.ts:490-495` |

The missing joins are cheap to add and are the difference between "an agent has evidence" and "an
agent has a picture and a story it made up".

### 2.1 The camera is invisible, and camera shake is a camera-pose problem

This deserves its own line because it is the sharpest example in the repository. Camera shake *is*
the camera pose over time. The camera in `combat-arena` is built inside the render call
(`packages/demos/antiky/combat-arena/src/renderer.ts:125-128`) from a projector that is a pure
function, and its output goes straight into `camera.setPosition` / `camera.lookAt`. It never enters
the world inspection, so `get_world_inspection` cannot see it, and no MCP tool can report it.

The good news is that because the projector is pure and exported, a Node test can call it
directly — and `packages/demos/antiky/combat-arena/tests/presentation.test.ts` already does exactly
that in six of its thirteen tests. What none of them do is call it **repeatedly over time**. Every
existing assertion is about one frame. Motion is the derivative that nobody has taken yet.

---

## 3. The representation problem: candidate encodings, compared

Each candidate below gets: what it is (one plain sentence), what it captures, what it loses, what
it costs to make, what it costs the model to read, and the questions it can and cannot answer.

Cost-to-read matters more than people expect. A 1280×720 image costs roughly 1,200 tokens of a
model's context; 180 of them is not a representation, it is a denial-of-service. A 600-number time
series rendered as text costs a similar amount and is *exact* — and the five summary numbers that
actually settle the question cost almost nothing.

### 3.1 Frame contact sheet (a grid of stills in one image)

**What it is:** the captured frames tiled into a single image, in reading order, like a sheet of
film negatives.

- **Captures:** the arc of an action — where something started, where it went, what appeared and
  disappeared, whether an effect has a beginning/middle/end. Layout, composition, silhouette
  changes, VFX lifetime, whether something is on screen at all.
- **Loses:** everything about timing between the tiles. You cannot see a frame hold, a 5 ms jitter,
  or the difference between linear and eased motion, because the grid throws away the time axis and
  keeps only the order.
- **Cost to make:** low. `sharp` is already a dependency (`scripts/frame-stats.mjs:11`); a 6×5 grid
  of 30 frames downscaled to 320×180 each is one 1920×900 PNG, maybe 80 lines including index
  labels.
- **Cost to read:** **one image, one round trip.** This is its whole argument.
- **Answers:** "did the effect appear and fade?", "does the camera drift off the action?", "is the
  dash trail there at all?", "does the pose arc look like a swing or like a teleport?"
- **Cannot answer:** anything about rate, smoothness, or pacing.
- **Verdict:** build it. It is the single best value-for-effort *image* representation, and it is
  the only one that gets a model to actually see the motion rather than read about it. But be
  honest with yourself that it answers "what happened", never "how did it feel".

**Refinements worth having**, two of which come straight from the one piece of published evidence
that this technique works (IG-VLM, §10.4):

- Burn the frame index and the simulation step into each tile. A grid whose tiles are labelled with
  the tick they came from is a joinable artifact; an unlabelled grid is a mood board.
- **Prefer few frames in a near-square grid.** IG-VLM's result — beating video-trained models on 9
  of 10 benchmarks — used **six frames in a 3×2 grid**, chosen deliberately because a near-square
  composite matches the image shapes vision models were trained on. That is an argument against the
  instinct to tile all 180 frames.
- **Say in the prompt that the tiles are in time order.** IG-VLM found an explicit "grid guidance"
  instruction materially changed results. A contact sheet handed over without that sentence is being
  read as a collage.

### 3.2 Temporal difference and motion-energy images

**What it is:** subtract one frame from the next and keep the magnitude — bright where things moved,
dark where they did not. Accumulate those over a window and you get a "motion energy image", a
single picture of everywhere motion happened.

- **Captures:** *where* in the frame motion is, and how much of it. Very good at answering "is the
  whole frame moving, or just the character?" — which is precisely the camera-swivel question.
- **Loses:** direction, speed, and identity. A thing moving left and the same thing moving right
  produce the same difference image.
- **Cost to make:** trivial. It is a subtract and an absolute value over two decoded buffers;
  `scripts/frame-stats.mjs` already decodes PNGs to raw RGB (`readPixels`, `frame-stats.mjs:71-75`).
- **Cost to read:** one image, or — better — **one number per frame pair**, which is a time series
  and costs almost nothing.
- **Answers:** "did anything move at all between these two frames?" (the frame-hold question, if
  you can sample fast enough), "is the background moving as much as the foreground?" (the swivel
  question), "when did the impact happen?" (a spike in the difference series).
- **Cannot answer:** which direction, or whether the motion was correct.
- **Verdict:** build the **scalar series** version as a first-class output — and build it as **two**
  numbers per frame pair, the mean *and* the standard deviation of the difference. That is not a
  refinement I invented: ITU-T P.910 defines "Temporal Information" as the standard deviation
  precisely because it ignores a uniform brightness change, which the mean does not (§10.7). Ten
  lines of code, and the pair separates "something moved" from "the whole frame got brighter" —
  which matters a great deal in demos that are about to grow bloom. Build the *image* version only
  when a spatial question actually comes up.

A related trick that is cheaper than it sounds: a **temporal variance image**, where each pixel's
value is how much that pixel changed across the whole sequence. It gives you a mask of "what moved"
in one picture. Useful once; not worth automating yet.

### 3.3 Optical flow, and summaries of it

**What it is:** for every pixel, an estimate of where it moved to in the next frame — a field of
little arrows. Summaries reduce that field to a few numbers: dominant direction, a histogram of
speeds, divergence (is stuff spreading out, as when you move forward) and curl (is stuff rotating,
as when you swivel).

- **Captures:** the richest pixel-side description of motion there is. Divergence and curl are
  genuinely diagnostic: a pure camera translation gives near-zero curl, a swivel gives a strong
  uniform curl, a dolly gives strong divergence.
- **Loses:** it is an *estimate*, and it fails exactly where games are hardest — on repeated
  textures, thin geometry, transparent VFX, fast motion beyond its search range, and lighting
  changes that are not motion at all. A bloom pulse reads as flow.
- **Cost to make: the honest answer is "cheap to run, expensive to depend on", and I had that
  backwards on first pass.** Measured on an M4 Pro with OpenCV 5.0 (§10.7): the modern classical
  algorithm, **DIS at its ultrafast preset, costs 8.2 ms per 1080p frame on one core**, and at
  quarter resolution — plenty for a global motion signal — **1.9 ms**, about 18× real time. That is
  not expensive. What *is* expensive is that every route to it is a **native or neural dependency**
  in a repository whose entire measurement library is 173 lines of dependency-free JavaScript. The
  cost is the dependency, not the arithmetic, and it is worth saying that precisely rather than
  hand-waving "flow is slow".
- **Cost to read:** a flow field is useless to a language model as raw data. Only the summary is
  readable, and the summary is a handful of numbers.
- **Answers:** "is this a translation or a rotation?", "which way is the world moving?"
- **Cannot answer:** why. And it will lie on VFX-heavy frames.
- **Verdict:** **I would still not build this**, but on the dependency argument alone. The two
  questions it answers uniquely — translation versus rotation, and dominant direction — are answered
  *exactly and for free* by the simulation and camera math, and answered approximately by two probe
  rectangles at different depths (§5.1). If flow ever does become necessary, two corrections to the
  obvious instinct: **do not reach for Farnebäck** (136 ms per 1080p frame, and it barely threads —
  14 cores buy it 10%), and **do not reach for RAFT** (a GPU, ~100 ms per frame, multi-gigabyte
  correlation volumes at 1080p). Reach for **DIS at quarter scale**, or write the sixty lines of
  coarse block matching (16×16 blocks, ±8 px search, sum of absolute differences) and keep the
  dependency count at zero.

### 3.4 Trajectory extraction from simulation state

**What it is:** the position, velocity and rotation of things over time, taken straight from the
simulation, as a table or a plot.

- **Captures:** exact intent. Where the player was on every one of 600 ticks, to full precision.
- **Loses:** whether any of it was drawn correctly. A trajectory can be perfect while the screen
  shows nothing.
- **Cost to make:** **near zero.** `packages/demos/antiky/combat-arena/src/inspection.ts:95-100`
  already publishes an `antiky.transform` component with a position per entity, and `:195-237`
  publishes a runtime store with `x`/`z` per entity. Driving the simulation directly in a Node test
  is even cheaper and gives every field, not just the published ones.
- **Cost to read:** a 600-row table is too long; a downsampled table (every 10th tick), or a set of
  summary statistics plus a sparkline, is a few hundred tokens.
- **Answers:** almost every gameplay-feel question: acceleration, overshoot, snap, hit-stop
  duration, dash distance, whether the enemy telegraph actually lasts as long as it claims.
- **Cannot answer:** anything about presentation or rendering.
- **Verdict:** **this is the workhorse.** It is exact, free, deterministic, testable in CI, and it
  covers the majority of "does this feel right" questions. Build the analysis library that consumes
  it (§8, P1).

**One caution.** Reading trajectories through `get_world_inspection` samples at the 250 ms
publication interval (`game-server.ts:370`), which is 4 Hz — useless for motion. Trajectories must
be produced by driving the simulation in a test, or by a purpose-built recorder, not by polling the
MCP.

### 3.5 Numeric time series rendered as text

**What it is:** the numbers themselves, plus derived summaries — per-frame deltas, a text sparkline,
autocorrelation (how much a signal looks like a time-shifted copy of itself, which is how you detect
"this repeats"), and a frequency spectrum (which frequencies the signal is made of).

- **Captures:** everything, at full precision, if you send the raw series; the *character* of the
  motion if you send summaries.
- **Loses:** nothing, except through your choice of summary.
- **Cost to make:** low. A discrete Fourier transform over 600 samples is about 20 lines and runs
  in under a millisecond. Autocorrelation is 10 lines.
- **Cost to read:** the summaries are tiny. Five numbers can settle an argument that a video could
  not.
- **Answers:** "is this periodic?" (autocorrelation peak away from lag zero), "is this a pure
  sine?" (one spectral bin holding most of the energy), "how fast does it decay?" (fit the envelope),
  "do these two things move together?" (cross-correlation), "does it ever hold still?" (a run of
  zero deltas).
- **Cannot answer:** anything spatial, and anything you did not think to record.
- **Verdict:** **build this, first.** It is the representation with the best ratio of decisiveness
  to cost in the entire list, and it is what the existing acceptance criteria in
  `06-WORK-PACKETS.md:324-326` already implicitly require and currently have no way to compute.

A note on whether a language model can *read* time series well. The honest answer is: it reads
**summary statistics** reliably and **long raw series** poorly. So the design rule is: compute the
statistic in code, assert on it in a test, and give the model the statistic and the verdict. Do not
paste 600 numbers and ask "does this look periodic?" — that is asking the model to do arithmetic it
is bad at, when a `for` loop is right there.

### 3.6 Event logs with timestamps, and event-to-frame correlation

**What it is:** the list of things that happened, with times, joined to the frames that were on
screen when they happened.

- **Captures:** causality. "The impact spike at 2.31 s follows the `combat.cannon-fired` fact at
  2.29 s" is a sentence about a game, not about a picture.
- **Loses:** magnitude and appearance.
- **Cost to make:** the event side already exists and is good — facts carry
  `simulationTimeSeconds` (`combat-arena/src/inspection.ts:305`). The *correlation* side is missing
  because sequence frames are not stamped.
- **Cost to read:** small. A dozen facts with times is a paragraph.
- **Answers:** "what caused this?", "did the visual respond within N ms of the event?" — which is
  the entire subject of "game feel".
- **Cannot answer:** whether the response looked good.
- **Verdict:** build the join (§8, P2). Note two real limits found at HEAD:
  - `combat-arena` retains only **32 events** (`inspection.ts:21`) with drop-oldest. A cannon shot
    fires every 0.34 s (`simulation.ts:449`), so combat alone can overflow the ring in about ten
    seconds. Any correlation over a six-second capture fits, but only just.
  - Events are published on the 250 ms inspection tick, so the log read after a capture may already
    have dropped facts from the start of that capture.

### 3.7 Camera pose deltas over time

**What it is:** the camera position and look-at target on every frame, and how they change.

- **Captures:** camera shake, drift, lead, framing — literally, because those things *are* the
  camera pose over time.
- **Loses:** nothing about the camera; everything about the rest of the scene.
- **Cost to make:** **zero for `combat-arena`.** The projector is exported and pure
  (`presentation.ts:25-79`); call it 600 times with synthetic states and you have the series.
  Separability varies across the demos and must be checked, not assumed:
  - `traversal-study` exports both a pure frame function and a stateful smoothing rig
    (`packages/demos/antiky/traversal-study/src/presentation.ts:55-84`). The rig is testable as a
    **step response**: feed a sudden change in the desired frame and measure how long the camera
    takes to close the gap. Its easing is `1 − exp(−dt × 8.4)`, which is the frame-rate-*independent*
    form — a time constant of about 0.119 s, roughly 0.27 s to close 90% of a gap. That is a
    correct piece of motion code and a motion test should protect it, not just hunt for defects.
    Its existing test
    (`packages/demos/antiky/traversal-study/tests/presentation.test.ts:26-39`) checks a **single**
    eased frame — that the camera moved toward the target but not all the way. The missing test is
    the one over time: drive the rig for 60 frames after a step change and assert the measured time
    constant. That is the difference between "easing exists" and "easing feels like this".
  - `point-light-expo` has **no camera module at all** — the camera is constructed inline in its
    renderer (`packages/demos/antiky/point-light-expo/src/renderer.ts:174-179`). Applying this
    technique there needs a small extraction first.
- **Cost to read:** tiny.
- **Answers:** the entire camera-shake work packet (W D.6), and it answers it better than any pixel
  representation could.
- **Cannot answer:** whether the renderer actually used that camera.
- **Verdict:** **this is the highest-value single representation for the defect the owner actually
  reported.** Build it as a test, not as a tool.

### 3.8 Frame-time series and judder analysis

**What it is:** how long each presented frame took, in order. Judder is when those durations are
uneven, or when the same image is shown twice.

- **Captures:** smoothness, the thing the owner described as "judders".
- **Loses:** everything about content.
- **Cost to make:** low **in the right place** and impossible in the wrong one. In the host script's
  `present(time)` callback (`game-server.ts:481-506`) the timestamp is already in hand; keeping a
  ring of the last 256 deltas is about fifteen lines. Reconstructing it from a 30 fps capture is not
  possible at all.
- **Cost to read:** a handful of percentiles.
- **Answers:** "is presentation smooth?", "are frames being held?", "did this change make things
  worse?"
- **Cannot answer:** why a frame was slow.
- **Verdict:** build the ring (§8, P5). But see §7.2 for a hard caveat: the frame-hold defect is
  **display-rate dependent**, and headless Chromium's animation rate is not the owner's 144 Hz
  monitor, so the runtime ring corroborates and the headless loop test decides.

### 3.9 Per-frame render statistics as a time series

**What it is:** draw calls, instance counts, uploaded bytes, per frame, over time.

- **Captures:** in principle, when the scene got busier — a burst of particles, a pass that fired.
- **Loses:** everything about appearance.
- **Cost to make:** **currently impossible, and the reason is worth stating plainly.**
  `get_render_stats` returns `measurements.render`, which comes from what a game reports via
  `context.report(...)`. In `combat-arena` that call happens **once, at startup**
  (`packages/demos/antiky/combat-arena/src/game.ts:89-92`), with values from
  `deriveCombatRendererMeasurements()` — a function that sums authored capacity constants and
  contains no runtime measurement whatsoever
  (`packages/demos/antiky/combat-arena/src/renderer.ts:50-72`). Underneath, BroMetal 0.15.0 exposes
  no draw statistics and no GPU timing at all; the only counter in its WebGPU internals is a frame
  index (`node_modules/brometal/dist/runtime/webgpu.d.ts:33-34`).
- **Verdict:** **`get_render_stats` contains essentially zero motion information today, and saying
  otherwise would be inventing evidence.** Its `drawCalls`, `instances` and `uploadBytesPerFrame`
  are constants chosen by a developer. Making them real is a legitimate piece of work, but it is a
  *performance* capability, not a motion one, and it is not on the critical path for anything in
  this document.

### 3.10 Representations I would add to the list

**Probe traces.** `probeStats` in `scripts/frame-stats.mjs:102-123` already computes mean luminance
inside a named rectangle. Run that same probe across every frame of a sequence and you have a **scalar signal per
region of the screen** — the brightness of a specific effect over time. This is the bridge between
pixels and §3.5's analysis, and it is about fifteen lines of new code on top of what exists. It is
how you measure a signal that only exists *after* the shader ran (see the VFX metronome, §7.3).

**Onset shape.** For any scalar trace, three numbers describe its "shape in time": rise time to
peak, peak value, and time to fall to a quarter of peak. That triple is what `03-ART-DIRECTION-AND-VFX.md:792-797`
is asking for in AC-V2, expressed as something a function can return.

**Phase portrait.** Plot a signal against its own rate of change. A pure sine draws a clean ellipse;
noise draws a cloud. It is a beautiful way to *see* "is this a sine", but it needs an image and the
spectral test answers the same question in one number, so it is a nice-to-have.

**Cross-correlation between traces.** One number saying "these two effects are the same signal".
This is the exact instrument for the shared-metronome defect.

**Spatiotemporal slice.** Take one row of pixels from every frame and stack the rows into a single
image where the horizontal axis is space and the vertical axis is time. Smooth motion draws a
straight diagonal line; a frame hold draws a visible staircase; judder draws a ragged one. It is a
genuinely elegant way to put *timing* into a still image, which is the thing contact sheets cannot
do. Cost is about thirty lines. I would build it after everything in section 8, as the one image
that shows pacing.

### 3.11 The comparison, in one table

Ranked roughly by value per unit of effort **for this repository**.

| Representation | Proves | Hides | Effort to build | Tokens to read | Verdict |
|---|---|---|---|---|---|
| Numeric series + summaries (§3.5) | periodicity, spectrum, decay, holds | anything spatial | S | tiny | **Build first** |
| Camera pose series (§3.7) | shake, drift, framing over time | whether it was drawn | XS | tiny | **Build first** |
| Simulation trajectories (§3.4) | intent, exactly | rendering | XS | small | **Build first** |
| Probe traces (§3.10) | post-shader signals, VFX pulse | geometry | S | tiny | **Build** |
| Frame-difference scalar series (§3.2) | when motion happened, how much | direction | XS | tiny | **Build** |
| Per-frame simulation stamps (§3.6) | the join between all of the above | — | S | tiny | **Build** — prerequisite |
| Contact sheet (§3.1) | what happened, visibly | timing | S | one image | **Build** |
| Frame-time ring (§3.8) | smoothness, holds | content | S | tiny | **Build** |
| Event log join (§3.6) | causality | appearance | S | small | **Build** |
| Spatiotemporal slice (§3.10) | pacing, in an image | content | S | one image | Later |
| Motion-energy image (§3.2) | where motion is | direction | S | one image | On demand |
| Block-matching flow summary (§3.3) | dominant direction | accuracy | M | tiny | Only if needed |
| Per-frame render stats (§3.9) | scene load | appearance | L (blocked) | tiny | **No** |
| Dense optical flow (§3.3) | translation vs rotation | reliability on VFX | L | tiny | **No** |
| Perceptual video metrics (§9) | similarity to a reference | everything else | L | tiny | **No** |

---

## 4. What actually translates into motion from GPU and render events

Concretely, for a WebGPU renderer driven by BroMetal in a Chromium page.

### 4.1 What is observable today, with no new code

- **`requestAnimationFrame` timestamps.** Already flowing through
  `game-server.ts:481-506`; `instance.frame(time / 1000)` receives them. This is the single richest
  renderer-side motion signal available and it is currently thrown away after computing a 500 ms
  average.
- **Completed simulation steps per presented frame.** `session.advance(elapsed, input)` returns
  `completedSteps` and it is already read (`combat-arena/src/game.ts:136-137`). A frame where this
  is zero is, given no interpolation, a frame that draws exactly what the previous frame drew.
- **The session clock.** `get_session_status` exposes `accumulatorSeconds`, `completedStepCount`,
  `totalAcceptedElapsedSeconds` and `totalDiscardedSeconds`
  (`packages/framework/src/sessions/engine-session/contract.ts:69-79`). `accumulatorSeconds` divided
  by `fixedStepSeconds` *is* the interpolation factor that render interpolation needs — the
  framework already publishes the missing ingredient.
- **The state digest.** `getStateDigest()` is called per step and surfaced through
  `step_simulation`. Two consecutive presented frames with the same digest and no interpolation
  produce the same image.

### 4.2 What is not observable, and why

- **GPU timing.** WebGPU's `timestamp-query` feature would give per-pass durations, but BroMetal
  0.15.0 neither requests the feature nor exposes any query API
  (`node_modules/brometal/dist/runtime/webgpu.d.ts`). Getting it means patching BroMetal. It answers
  a performance question, not a motion one.
- **Real draw statistics.** See §3.9. They are authored constants.
- **Present/display statistics.** The desktop equivalents (Intel PresentMon, DXGI present
  statistics) have no browser analogue. A web page cannot know when a frame reached the display.
- **The camera.** Not published anywhere (§2.1).

### 4.3 The measurement changes the thing measured

Two honest caveats about the existing sequence capture:

1. **Capturing steals main-thread time.** Each frame is taken by
   `page.evaluate(... canvas.toDataURL('image/png'))` (`managed-capture-runtime.ts:207-217`), which
   runs on the same thread as the game's `requestAnimationFrame` loop, then transfers a
   base64-encoded PNG over the debugging protocol. The game genuinely runs worse while being
   photographed. A "judder" measured this way would be the harness's judder.
2. **The cadence numbers describe the harness, not the game.** `captureOffsetsMilliseconds`
   (`capture-sequence-service.ts:294`) is measured with the CLI's own `performance.now()`. And when
   the harness misses its own schedule, the capture **fails hard** with `CAPTURE_DROPPED_FRAMES`
   rather than reporting the jitter (`capture-sequence-service.ts:335-340`). That is the right
   design for evidence integrity and it means the field is not a timing measurement of the game.

These are not criticisms of the capture design — they are reasons the frequency budget in §1 exists.

---

## 5. Worked example — camera shake in Combat Arena

The defect, verified at HEAD:

```ts
const shakeX = Math.sin(state.time * 47) * actionImpact * 0.11;   // presentation.ts:34
const shakeZ = Math.cos(state.time * 41) * actionImpact * 0.08;   // presentation.ts:35
```

`shakeX`/`shakeZ` are added to `position` at `presentation.ts:70,72` and to `position` again in the
terminal branch at `:61,63`. They are **not** added to `target` at `:73,75`. Impact is set to `0.45`
when a shot connects (`simulation.ts:259`), to `1` when the player takes hull damage
(`simulation.ts:203`), and decays at `4.2` per second (`simulation.ts:378`). The auto-cannon's
cooldown resets to `0.34` s (`simulation.ts:449`).

### 5.1 What representation makes it obvious

**Four separate defects, four separate instruments. This is the important lesson.**

**(a) The waveform is two beating sines.** 47 rad/s is 7.48 Hz; 41 rad/s is 6.53 Hz; they differ by
6 rad/s, so the pair repeats with a period of 2π/6 ≈ 1.047 s.

*Instrument:* generate the offset series analytically — 600 samples of `project()` at 1/60 s
intervals with `impact` pinned at 1 — and take its **frequency spectrum**. Today two bins hold
essentially all the energy. A bounded criterion:

> No single spectral bin above DC holds more than **20%** of the series' total energy, and the
> **autocorrelation** of the series has no peak above **0.3** at any lag other than zero.

The autocorrelation half is already written into `06-WORK-PACKETS.md:324-326`; the spectral half is
stronger, because autocorrelation of a two-frequency beat can be modest at short lags while the
signal is still obviously mechanical. Assert both.

*Cost:* a Node test, no browser, milliseconds.
*What no pixel representation adds:* nothing. This is arithmetic on two constants.

**(b) The camera swivels instead of translating.** Offsetting `position` without `target` rotates
the view. At a camera distance of roughly 14 world units, a 0.11-unit offset rotates the view by
about 0.11/14 ≈ 0.0079 rad ≈ 0.45°. A rotation moves *everything* in frame by the same amount
regardless of depth; a translation moves near things more than far things. That depth-independence
is exactly why it reads as nauseating.

*Instrument, best:* a structural assertion, no signal analysis at all.

> For any state, `project(...).position[i] − projectWithZeroImpact(...).position[i]` must equal
> `project(...).target[i] − projectWithZeroImpact(...).target[i]` for i ∈ {0, 2}.

That is one assertion and it makes the defect unrepresentable. It is strictly better than measuring
the consequence.

*Instrument, second-best (and the one that proves the renderer honoured it):* project a known near
world point and a known far world point through the camera matrix on each frame and compare their
image displacements. Under a pure translation the ratio is the depth ratio; under the current code
it approaches 1.

*Instrument, pixel-side:* two named probe rectangles — one on the near action, one on the far arena
edge — and their per-frame luminance traces; a global swivel moves both, a translation mostly moves
the near one. **This is the weakest of the three and I would only use it as a final confirmation
that the renderer is not ignoring the camera.**

**(c) It is on a metronome.** The most frequent event in the game is nearly the most violent.

*Instrument:* drive the real simulation headlessly for 10 s at a fixed 1/60 s step, recording
`impact` per tick, and compute the **duty cycle** — the fraction of ticks where shake is
perceptible. Today: a connecting shot sets 0.45, decay is 4.2/s, so it takes 0.45/4.2 ≈ 0.107 s to
reach zero, against a 0.34 s cadence — roughly **31% of all ticks are shaking**, forever. A bounded
criterion:

> Over 10 s of sustained combat, the fraction of ticks with a non-zero camera offset is below
> **10%**, and the peak offset produced by cannon events is below **30%** of the peak produced by a
> hull-loss event.

The second clause is already in `06-WORK-PACKETS.md:329-330`; the duty cycle is the missing half and
it is the one that captures "it is the ambient state rather than punctuation".

**(d) It is masked by the missing interpolation.** A 7.5 Hz signal sampled at 60 Hz and frame-held on
a 144 Hz display stair-steps. That is §6's problem, and the two must land together or the
improvement is invisible.

### 5.2 What test asserts it

One new test file section in `packages/demos/antiky/combat-arena/tests/presentation.test.ts`,
consuming a new shared analysis module (§8, P1):

| Assertion | Instrument | Defect it kills |
|---|---|---|
| position offset equals target offset on both horizontal axes | direct comparison | swivel |
| no spectral bin above DC exceeds 20% of energy | DFT over 600 samples | sine pair |
| no autocorrelation peak above 0.3 outside lag 0 | autocorrelation | periodicity |
| shaking-tick fraction below 10% over 10 s of real simulation | headless sim drive | metronome |
| cannon peak offset below 30% of hull-loss peak offset | headless sim drive | mis-scaling |

Every one of these runs in Node in well under a second, with no GPU, no capture, and no evidence
store. **That is the point of the whole document.**

---

## 6. Worked example — missing render interpolation

The defect: the simulation is fixed at 60 Hz (`contract.ts:4`), and the renderer draws
`simulation.view()` — the newest state, unmodified (`combat-arena/src/game.ts:136-138`;
`traversal-study/src/game.ts:103-105`). At 144 Hz presentation, `session.advance` completes
60/144 ≈ 0.42 steps per frame on average, so on roughly 58% of frames it completes **zero** steps and
the renderer draws the identical state again.

Worth noting before anyone treats this as an architecture violation: it is not one.
`docs/adr/framework/0013-explicit-simulation-inputs_H.md:30` explicitly *permits* the renderer to
estimate positions between two simulation states — permissive, not required — and
`10-ADR-0013-SEED-GAP.md:50-53` already records that an earlier draft got this wrong. It is a
quality defect, and the framework already publishes the exact ingredient the fix needs
(`accumulatorSeconds`, §4.1).

### 6.1 How it is detected

**Not from a capture.** Say this plainly: sequence capture is capped at 30 fps
(`capture-sequence.ts:17`) and performs one `requestAnimationFrame` wait per captured frame
(`managed-capture-runtime.ts:250-252`). Sampling a 144 Hz presentation at 30 Hz cannot distinguish a
held frame from a fresh one. **The existing motion-capture path cannot see this defect at all.**

**Detector 1 — the loop test (authoritative).** Drive the game loop headlessly with synthetic
timestamps at a fixed 1/144 s cadence for 100 frames and record the presented camera position and
one entity position per frame. Then:

> The sequence of per-frame position deltas contains **no zero followed by a jump**; equivalently,
> the minimum non-zero delta is at least 25% of the mean delta.

This is `06-WORK-PACKETS.md:312`'s criterion, made precise. The cost is a way to drive the loop
headlessly — the game module's `frame(platformTimeSeconds)` entry point already takes a timestamp
(`packages/framework/src/game/host.ts:169`), so this needs a small harness, not a rewrite.

**Detector 2 — the presentation ring (corroboration).** In `game-server.ts`'s `present(time)`, keep
a bounded ring of `{ timestamp, completedSteps, stateDigest }` and publish it as a new inspection
measurement. Then a frame hold is literally "two consecutive entries with the same digest", and the
frame-time series falls out of the same ring for free. About thirty lines in the host script plus a
schema field.

That an **exact hash** beats a thresholded difference here is not just an intuition: FFmpeg's own
`showinfo` filter exposes a per-plane Adler-32 `plane_checksum` for precisely this purpose (§10.7),
and identical consecutive checksums are a duplicate with no tolerance to tune. The digest ring is
the same idea, one layer earlier and without decoding anything.

**The caveat that must be written down.** The managed capture browser runs headless
(`managed-capture-runtime.ts:162`), and headless Chromium's animation-frame rate is not the owner's
144 Hz display. So the ring will usually observe a 60 Hz page and see no defect. **The loop test
decides; the ring corroborates on real hardware.** Any acceptance criterion phrased as "capture it
at 144 Hz and look" is not satisfiable in this repository and should not be written.

**Detector 3 — the spatiotemporal slice (§3.10), for a human.** One image in which a frame hold
appears as a visible staircase. Worth having eventually because it is the one way to *show* the
owner what was fixed.

---

## 7. Worked example — VFX all breathing on one metronome

The defect: `packages/demos/antiky/combat-arena/src/shaders/arena-glow.shader.ts:51` computes
`vAlpha = iAlpha * (0.82 + sin(uTime * 5 + iPhase * 2.3) * 0.18)`, and
`packages/demos/antiky/traversal-study/src/shaders/traversal-glow.shader.ts:49` does the same at
4.8 rad/s. Per-instance phase varies; the **frequency does not**. Everything on screen inhales and
exhales together at 5 rad/s ≈ **0.796 Hz**.

### 7.1 Why this one genuinely needs pixels

Unlike the camera, this signal does not exist on the CPU. `iPhase` and `iAlpha` are instance
attributes; the pulse itself is computed in the vertex shader. A Node test can assert things about
the *inputs* but cannot observe the *output* without re-implementing the shader — and a test that
re-implements the thing it is testing proves nothing.

There is a static test already proposed —
`03-ART-DIRECTION-AND-VFX.md:799-803` (AC-V3) forbids a `sin(uTime)` on an output alpha without a
per-instance frequency term. It is cheap and I would keep it, but it is a grep: it cannot see a
metronome assembled from two constants, or one driven from a CPU-side uniform.

### 7.2 The measurement that does work — and why the capture is well suited here

0.796 Hz is comfortably inside the frequency budget from §1. A 6-second capture at 30 fps gives
~4.8 full cycles at 180 samples: about 38 samples per cycle, and a frequency resolution of 1/6 s
≈ 0.17 Hz. That is enough to separate 0.796 Hz from, say, 1.1 Hz.

> **Criterion.** Place a named probe rectangle over each of at least three distinct effect types.
> Capture ≥ 5 s at ≥ 20 fps. Compute each probe's mean-luminance trace and its dominant frequency.
> Assert (a) the dominant frequencies of any two effect types differ by at least **30%**, and (b)
> the pairwise Pearson correlation of any two probe traces is below **0.6**.

Today the demos fail both clauses by construction: one frequency, shared.

This is the cleanest illustration of the frequency budget in the whole repository. The **same
capture tool** that is useless for judder (144 Hz) and marginal for shake (7.5 Hz) is
*well matched* to VFX breathing (0.8 Hz). The tool is not weak; it has a band.

### 7.3 The de-synchronisation test that costs nothing

There is also a free CPU-side half worth asserting: whatever per-instance frequency term gets added
must actually vary. Assert that the set of frequencies written into the instance buffer has a
coefficient of variation above some floor. That catches the regression where someone adds the
attribute and then feeds it a constant.

### 7.4 A fourth class the audit already found: defects that exist only in motion, and only in pixels

Everything above could, in principle, have been caught somewhere other than the screen. This one
cannot, and it is worth naming because it is the case that justifies keeping a pixel path at all.

`00-VISUAL-DIAGNOSIS.md:117-118` records that `combat-arena`'s background is a **one-pixel-dot
starfield**, and predicts it "will crawl and shimmer badly in motion, since it can't be filtered".
That is temporal aliasing: detail finer than one pixel cannot be sampled consistently as the camera
moves, so each dot flickers on and off between frames. It is:

- **invisible in a still** — the frame looks correct;
- **invisible to the simulation** — the stars are not simulation state;
- **invisible to the camera series** — the camera is doing exactly what it should;
- **plainly visible in a sequence of pixels.**

*Instrument:* drive a slow, smooth camera pan, capture at a modest rate, and measure **isolated
temporal change**: for each pair of consecutive frames, the fraction of pixels that changed by more
than a threshold while their local neighbourhood mean changed by less than a smaller threshold. Real
motion moves neighbourhoods; crawl moves lone pixels inside stationary neighbourhoods.

*A bounded criterion, once someone wants it:*

> Over a 3 s pan at 24 fps, fewer than **0.2%** of pixels per frame pair change by more than 32/255
> while their 5×5 neighbourhood mean changes by less than 4/255.

I am **not** proposing to build this now. It needs P3 (sequence statistics) and a neighbourhood
filter, and the underlying defect is better fixed than measured — draw the starfield as a soft
sprite rather than a hard dot. It is here because a document arguing "compute it from the
simulation" owes the reader an honest statement of where that argument stops. It stops here.

---

## 8. Proposal for this repository, ranked by value per unit of effort

Design principle throughout: **extend what exists.** `scripts/frame-stats.mjs` and
`scripts/shoot-demos.mjs` established the pattern — a small pure module plus a driver that wraps the
MCP — and it works. Nothing below replaces `capture_gameplay_sequence`; the two items that touch it
add fields and one artifact.

Sizes: **XS** ≤ half a day, **S** ≈ 1 day, **M** ≈ 2–3 days, **L** ≈ a week or more.

| # | What | Size | Unblocks | Packet |
|---|---|---|---|---|
| P1 | `scripts/motion-stats.mjs` — series analysis, no GPU | S | W D.5, W D.6, AC-V2 — every motion criterion already written | W M.1 |
| P2 | Per-frame simulation stamps on `capture_gameplay_sequence` | S | every pixel-side motion claim | W M.5 |
| P3 | Sequence frame statistics and probe traces | XS | the VFX metronome test | W M.4 |
| P4 | Contact-sheet artifact | S | an agent actually seeing motion | W M.6 |
| P5 | Presentation frame ring in the dev host | S | judder and frame-hold, at all | W M.8 |
| P6 | `get_motion_report` MCP tool | M | the agent loop, in one call | W M.9 |
| P7 | Spatiotemporal slice image | XS | showing a pacing fix to a human | — |

**If only one thing gets built, build P1.** It costs a day, needs no browser, and turns three
already-written acceptance criteria from prose into pass/fail.

### P1 — `scripts/motion-stats.mjs`: series analysis, GPU-free — **S, highest value**

A sibling to `frame-stats.mjs`, with the same shape: pure functions, no I/O, unit-tested against
synthetic signals with known answers.

```
deltas(series)                        -> per-step differences
holds(series, epsilon)                -> runs of unchanged values (frame-hold detection)
autocorrelation(series, maxLag)       -> normalised, lag 0..maxLag
spectrum(series, sampleRateHz)        -> { frequencies, magnitudes } via a plain DFT
spectralConcentration(series, rate)   -> largest single-bin share of above-DC energy
dominantFrequency(series, rate)       -> Hz
onsetShape(series)                    -> { peak, peakIndex, riseSamples, quarterDecaySamples }
crossCorrelation(a, b)                -> Pearson at lag 0, plus best lag
dutyCycle(series, threshold)          -> fraction of samples above a threshold
sparkline(series)                     -> a short text rendering, for reports only
```

**Why first:** it makes the acceptance criteria that are *already written* in
`06-WORK-PACKETS.md:324-330` and `03-ART-DIRECTION-AND-VFX.md:792-797` executable. Right now those
criteria are prose with no implementation behind them, which is the same failure mode the audit was
written to end.

**Cost honesty:** a DFT over ≤2,048 samples needs no library and no cleverness; the naive O(n²)
form runs in about 4 ms at n = 600. Do not add an FFT dependency.

### P2 — Per-frame observation stamps on `capture_gameplay_sequence` — **S, prerequisite**

Today the sequence result carries `cadence.captureOffsetsMilliseconds`
(`capture-sequence.ts:73`) and start/end observations only. Extend `cadence` with a parallel array:

```
frames: [{ offsetMilliseconds, completedStepCount, accumulatorSeconds,
           stateDigest, eventSequence } ...]
```

read from `options.readState()` at each capture point — the service already reads that state on
every loop iteration for the step-wait path (`capture-sequence-service.ts:312-322`), so the data is
in hand.

**Why:** without it, no pixel measurement can be tied to a simulation instant, so no correlation
between an event and a frame is possible, and every pixel-side motion claim is unfalsifiable. It is
the join described in §2.

**Cost honesty:** the result schema is strictly validated in both directions
(`capture-sequence.ts:329-372`) and there are tests over it. Adding a field is real work, not a
one-liner — but it is bounded and local, and the field is additive.

### P3 — Sequence frame statistics — **XS**

Extend `scripts/frame-stats.mjs` with `readSequenceStats(pngPaths, { probes })`, returning per-frame
arrays of the statistics it already computes, plus the mean absolute difference between consecutive
frames. Everything it needs already exists in that file — the raw decode is `readPixels`
(`frame-stats.mjs:71-75`) and the probe machinery is `probeStats` (`:102-123`).

**Why:** this is what turns a pile of PNGs into signals that P1 can analyse. It is the smallest
piece of new code in this list and it unlocks §7's VFX test.

**Borrow the standard's statistic, don't invent one.** ITU-T Recommendation **P.910** defines
"Temporal Information" as the **standard deviation** of the per-pixel frame difference, not its mean,
and FFmpeg implements exactly that as `siti`'s `ti` (§10.7). The standard deviation is the better
choice for a specific reason: it is robust to a *uniform* brightness change across the whole frame,
which a mean is not — so a bloom pulse or an exposure shift does not read as motion. Compute
**both**: the mean (equivalent to FFmpeg's `signalstats` `YDIF` and `scdet`'s `mafd`) and the standard
deviation (P.910's `TI`). Two numbers, one pass over the same buffer, and the pair distinguishes "the
whole frame got brighter" from "things moved".

**Cross-reference.** *Which* statistics are worth tracing is a separate argument, and
[`12-VISUAL-METRICS-CRITIQUE.md`](12-VISUAL-METRICS-CRITIQUE.md) is having it — it challenges
`luminanceSpread` as a contrast measure. This proposal is orthogonal: it says "compute the
per-frame series of whatever scalar statistics survive that review". If the statistic changes, the
series machinery does not. Do not build this on top of a statistic that document has retired.

**And a cautionary tale from the same source.** FFmpeg's `scdet` filter publishes a `score` that
looks like the obvious motion number and is not: it is `min(mafd, |Δmafd|)`, built specifically to
*suppress* sustained motion so that scene cuts stand out. Anyone reaching for a published statistic
without reading its definition can measure the opposite of what they meant. That is the argument for
this repository computing its own two numbers, from its own lossless masters, with the definition
written down beside them.

### P4 — A contact-sheet evidence artifact — **S**

Inside the sequence capture, derive one PNG containing a labelled grid of the captured frames
(downscaled), and store it as a new evidence `kind`. Retrieve it through `get_render_evidence` the
same way a still is retrieved — the MCP already returns exactly one PNG as an image block
(`packages/cli/src/mcp/server.ts:247-263`).

**Why:** today, to actually look at motion, an agent must list `sequence-frame` artifacts and pull
them one at a time, each as a full-resolution image block. For 180 frames that is 180 round trips
and an unusable number of image tokens. A contact sheet is one round trip and one image.

**Cost honesty:** `sharp` is already a dependency but currently only in `scripts/`, not in the CLI
package. Either the derivation moves into the shoot script (cheaper, no new CLI dependency, but the
artifact is not part of the evidence record) or `sharp` enters the CLI (a real dependency decision).
**I would put it in the shoot script first** and only promote it into the evidence store once
something needs the artifact to be part of the fenced record.

### P5 — Presentation frame ring in the development host — **S**

In `game-server.ts`'s `present(time)` loop (`:481-506`), keep a bounded ring of the last 256
`{ timestamp, completedSteps, stateDigest }` entries and publish it as a new field on the runtime
measurements. Replace — or rather, supplement — the 500 ms mean at `:490-495` with real percentiles.

**Why:** this is the only way to see judder and frame holds, and it is the only motion signal that
comes from the presentation layer at all. It also finally makes `get_render_stats` carry something
about motion.

**Cost honesty:** it changes `InspectionRuntimeMeasurements`, a validated framework schema
(`packages/framework/src/inspection/snapshot.ts:89-93`), which means schema, parser, tests and the
docs that describe it. Bounded, but it crosses a package boundary. Keep the ring small and the
published projection smaller — percentiles plus a hold count, not 256 raw entries.

### P6 — `get_motion_report`, one deep MCP tool — **M, only after P1–P5**

One call, one answer: given a sequence evidence identity, return per-frame stamps, probe traces,
their spectra and dominant frequencies, the frame-difference series, the correlated events, and one
contact-sheet image block.

This is the deep module the architecture documents keep asking for — a simple interface hiding real
work — and it is the thing an agent would actually use in a loop:

```
capture_gameplay_sequence  -> evidenceId
get_motion_report          -> numbers + one image
   (assert / decide / change code)
dev_reload
capture_gameplay_sequence  -> compare
```

**Build it last on purpose.** Every part of it is a projection over P1–P5; building the tool first
would mean designing the interface before knowing what the answers look like, which is exactly the
premature-abstraction failure the engineering guide warns about.

### P7 — Spatiotemporal slice image — **XS, later**

One row of pixels per frame, stacked. The one image that shows pacing. Build it when someone needs
to *show* a pacing fix rather than assert one.

### 8.1 How an agent actually uses this, in a loop

The loop is deliberately **two loops**, not one, because the fast one needs no browser at all.

**The inner loop — seconds, no GPU, runs in CI.** This is where 90% of motion work happens.

```
edit presentation.ts / simulation.ts
node --test packages/demos/antiky/combat-arena/tests/presentation.test.ts
  -> spectralConcentration 0.71  (budget 0.20)  FAIL
  -> autocorrelation peak 0.83 at lag 63        FAIL
  -> shaking-tick fraction 0.31  (budget 0.10)  FAIL
edit again
```

The agent never captures anything, never launches Chromium, and gets three numbers that name three
distinct defects. This loop is available **today** for everything except the analysis functions,
which is what P1 provides.

**The outer loop — minutes, needs the runtime.** Run it when the inner loop is green, when the
question is about something computed in a shader, or when a change could plausibly break rendering.

```
get_latest_build / get_runtime_status / get_capture_capabilities   (the existing fence)
capture_gameplay_sequence  { source: window, 5000 ms, 24 fps }     -> evidenceId
get_motion_report          { evidenceId }
  -> per-frame stamps: steps 412..712, no gaps
  -> probe "muzzle-glow":  dominant 0.79 Hz, concentration 0.94
  -> probe "relay-ring":   dominant 0.79 Hz, concentration 0.93
  -> pairwise correlation 0.97                                     FAIL (budget 0.60)
  -> events in window: 14 x combat.cannon-fired, 2 x combat.player-damaged
  -> [contact sheet image]
dev_reload  ->  capture again  ->  compare
```

Two rules make this loop honest, and both are consequences of §1 and §4.3:

1. **Never ask the outer loop a question the inner loop can answer.** It is a hundred times slower
   and it perturbs what it measures.
2. **Never ask the outer loop a question above 15 Hz.** It cannot answer, and it will return a
   confident number that is wrong.

### 8.2 What this means for reproducibility, precisely

There is no deterministic seed anywhere (`10-ADR-0013-SEED-GAP.md:24`), and sequence capture declares
`deterministic: false` (`capture-sequence-service.ts:372`). Goal 11 proposes one seeded generator as
an explicit simulation input (`goals/execute-goal-11.md`, outcome 3).

Be precise about what that blocks and what it does not:

- **Not blocked:** all three worked examples. The shake, the interpolation gap and the VFX pulse are
  deterministic functions of `state.time` and contain no randomness. Every criterion in §5, §6 and
  §7 is satisfiable today.
- **Blocked:** comparing *pixel* traces across builds in any scene whose content is random —
  particle bursts (`simulation.ts` `burst(...)`), enemy spawn variation, anything downstream of the
  hand-rolled `fract(sin(...))` generators goal 11 replaces. For those, the honest recipe remains
  the one already established: **pause → step to a fixed N → capture**
  (`07-TESTING-WITH-ANTIKY-MCP.md:150-153`), which is comparable without being reproducible.
- **Also worth stating:** a seed makes captured motion comparable, not identical. Frame timing,
  browser scheduling and GPU driver behaviour remain uncontrolled. Any criterion written as "the
  same inputs produce the same pixels" will still be wrong after goal 11 lands.
- **And the ceiling is lower than it sounds.** Fixed timestep plus a seeded generator plus recorded
  inputs is the standard, twenty-year-old recipe for reproducible motion (§10.2), and its known hard
  limit is floating-point determinism: Fiedler's own writeup notes results diverging between debug
  and release builds of the same program. `10-ADR-0013-SEED-GAP.md:44-46` already records the right
  scope — ADR 0013 does not promise cross-platform bit equality. Keep any determinism claim scoped
  to **same binary, same machine**, which is exactly what a CI regression test needs and no more.

---

## 9. What I would not build, and why

**Dense optical flow.** High cost (a native or neural dependency), unreliable on exactly the content
games have most of (transparent VFX, repeated textures, bloom), and its unique answers —
translation versus rotation, dominant direction — are available exactly and free from the camera
math. If the question ever genuinely arises, build coarse block matching, not RAFT.

**Perceptual video quality metrics (VMAF and relatives).** They measure how similar a distorted
video is to a reference video, for a human viewer, over a compressed transmission. There is no
reference video here; there is no compression question; and "does this camera swivel" is not a
question about perceptual similarity. Reaching for VMAF would be adopting a well-known tool for a
problem it does not have. *One qualification, added after the prior-art sweep:* VMAF's **temporal
feature alone** ships as a single-input, no-reference measure (`vmafmotion`, §10.7) and is a
perfectly reasonable motion-energy signal. What is rejected is the fused human-opinion metric and
its reference video, not that one feature.

**A pipeline built on the WebM.** FFmpeg has genuinely good no-reference per-frame motion filters
(§10.7) and it would be tempting to point them at the sequence video. Don't: the WebM is declared a
`review-derivative` (`capture-sequence-service.ts:404-413`) and measuring it measures the VP9 encoder
alongside the game. The lossless PNG masters are the evidence. Borrow the *statistics* — §8's P3
does — not the pipeline.

**WebGPU timestamp queries / GPU pass timing.** Requires patching BroMetal, is a performance
capability rather than a motion one, and sits behind a more basic problem: the draw statistics
reported today are authored constants (§3.9). If performance ever becomes the question, fix the
constants first.

**Real per-frame render statistics, right now.** Same reasoning. Legitimate work; not motion work;
not on the critical path.

**A general video-to-text pipeline.** Producing a natural-language description of a video, for a
model to read, is the single most tempting and least useful idea in this space: it converts an exact
signal into prose, which is a lossy step in the wrong direction. Every question in §5–§7 is settled
by a number and a threshold. Prose belongs in the report, not in the measurement.

**Any acceptance criterion phrased as "the same inputs produce the same frame".** Unsatisfiable
today (`07-TESTING-WITH-ANTIKY-MCP.md:150-153`) and still unsatisfiable after goal 11 (§8).

### 9.1 What I do not know

Stated plainly, because pretending otherwise is how bad complexity hides.

- **The animation-frame rate inside the managed capture browser.** It is headless Chromium
  (`managed-capture-runtime.ts:162`) and I did not measure its actual `requestAnimationFrame`
  cadence. Every claim in §6 about the capture being unable to see frame holds rests on the 30 fps
  *capture* ceiling, which is certain — but the specific number the page itself runs at is a
  measurement nobody in this repository has taken. It is a ten-line experiment and it should be
  taken before W M.8 is scoped.
- **Whether the four demos' game loops can actually be driven headlessly.** The entry point takes a
  timestamp (`packages/framework/src/game/host.ts:169`), and the presentation modules are already
  imported by Node tests, but the loop also constructs a renderer against a canvas. W M.3 may need a
  small seam that does not exist yet. I have not verified how large that seam is, and it is the one
  item in section 8 whose cost I would not defend to within a factor of two.
- **How well a model reads a labelled contact sheet of *this* content.** The published evidence
  (§10.4) is on natural video, not on a dark, low-contrast game frame downscaled to 320×180. Given
  what `summary-goal-01.md:24-36` measured about these demos' luminance range, tiles may need a
  brightness lift to be legible at all. That is an experiment, not a design decision.
- **Whether the VFX probe test survives contact with real captures.** §7.2's arithmetic says the
  window is sufficient. Arithmetic said a lot of things before the first capture was taken.

---

## 10. Prior art

Sourced from a web sweep run for this document. Each item is tagged **[Established]** (shipping
product or engine documentation, or widely used practice), **[Research]** (published, not standard
practice) or **[Speculative]** (nobody appears to have built it). Where I am unsure, I say so.

### 10.1 The industry does not test motion — it deletes it

This is the strongest single finding, and it is a finding by absence.

| Tool | How it handles animation | Source |
|---|---|---|
| **Playwright** `toHaveScreenshot()` | `animations: "disabled"` **by default** — finite animations are fast-forwarded to completion, infinite ones cancelled to their initial state | https://playwright.dev/docs/api/class-pageassertions (current) |
| **Vitest browser mode** `toMatchScreenshot()` | inherits Playwright's disabled-animations default | https://vitest.dev/guide/browser/visual-regression-testing (2025/26) |
| **Percy** (BrowserStack) | freezes animated GIFs on the first frame, freezes CSS animation styles server-side, and *documents* that JS-driven animation must be manually stopped (it recommends `TweenMax.globalTimeScale(0)`) | https://www.browserstack.com/docs/percy/stabilize-screenshots/animations |
| **Chromatic** (Storybook) | pauses CSS animations (`pauseAnimationAtEnd`), auto-pauses GIFs and videos on the first frame | https://www.chromatic.com/docs/animations/ |
| **Applitools Eyes** | animated regions are declared **Layout** or **Ignore** regions — checked for existence, not content | https://applitools.com/blog/handling-animations-and-loading-artifacts-in-visual-testing/ |
| **Unreal Engine** Automation Screenshot Comparison | per-channel tolerance plus local/global error budgets, a settle **Delay**, and a **"Disable Noisy Rendering Features"** toggle that switches off anti-aliasing, motion blur, screen-space reflections, eye adaptation and contact shadows | https://dev.epicgames.com/documentation/en-us/unreal-engine/screenshot-comparison-tool-in-unreal-engine (UE 5.8) |
| **Unity** Graphics Test Framework | `ImageAssert.AreEqual(referenceImage, camera, settings)` — one camera render, per-pixel plus whole-image thresholds. **No multi-frame concept in the documentation.** | https://docs.unity3d.com/Packages/com.unity.testframework.graphics@8.6/manual/index.html (rev. 2022-02-16) |
| **Godot** | rendering has few automated tests because it needs a GPU; the proposal to add reference-image rendering tests (**godot-proposals #1760**, opened 2020-11-02) is **still open** — and independently arrives at fixed time steps plus screenshots at predefined moments | https://github.com/godotengine/godot-proposals/issues/1760 |

**[Established].** No mainstream visual-regression tool asserts on motion. The standard treatment is
suppression. That is a real, citable gap — and it is why this document does not begin by looking for
an off-the-shelf answer.

**The one counter-example is instructive, and it agrees with §5.** "Automated regression tests for
character animation systems" (Madges, Miles, Anderson — ACM SIGGRAPH/Eurographics **SCA 2017**,
https://dl.acm.org/doi/10.1145/3099564.3106641) tests animation by **diffing generated poses across
revisions**, against a frozen representative dataset — not by diffing pixels. The industry's working
answer to "test motion" is deterministic simulation-state diffing. **[Established, niche.]**

### 10.2 Determinism and interpolation: settled for twenty years

- **"Fix Your Timestep!"** — Glenn Fiedler, 2004-06-10, https://gafferongames.com/post/fix_your_timestep/
  **[Established, canonical.]** The accumulator pattern; and the exact interpolation formula this
  repository is missing: `state = current × alpha + previous × (1 − alpha)` where
  `alpha = accumulator / dt`. The framework already publishes `accumulatorSeconds` (§4.1), so the
  numerator is in hand.
- **"deWiTTERS Game Loop"** — Koen Witters, https://dewitters.com/dewitters-gameloop/
  **[Established.]** An independent derivation of the same interpolation, which is worth knowing
  because it means the pattern is not one author's idiosyncrasy.
- **"Deterministic Lockstep"** — Fiedler, 2014-11-29,
  https://gafferongames.com/post/deterministic_lockstep/ **[Established.]** Send inputs, not state;
  requires a fixed timestep, an identical code path and a seeded generator. **And the caveat that
  bounds goal 11:** results can diverge between debug and release builds of the same program.
  "Floating point determinism is a complicated subject and there's no silver bullet."
- **"Automated Testing and Instant Replays in Retro City Rampage"** — Brian Provinciano, GDC 2015,
  https://www.gdcvault.com/play/1021825/Automated-Testing-and-Instant-Replays **[Established.]** The
  full pattern in production: deterministic engine plus recorded button inputs means every build
  plays itself end to end, replays are kilobytes, and bugs are exactly reproducible. Store the seed
  in the replay and draw random numbers in the same order.
- **Unity determinism guidance** —
  https://support.unity.com/hc/en-us/articles/360015178512-Determinism-with-2D-Physics
  **[Established.]** Deterministic on the same machine, not across machines. Same scoping as
  `10-ADR-0013-SEED-GAP.md:44-46`.
- **Frame pacing as a first-class correctness concern.** Android Frame Pacing / Swappy
  (https://developer.android.com/games/sdk/frame-pacing) states the problem in exactly the language
  §3.8 needs: a 30 FPS game on a 60 Hz panel producing intervals of 49 ms, 16 ms, 33 ms causes
  visible stutter even though the average is fine. It also ships **frame-statistics histograms**.
  Apple's equivalent guidance (WWDC21 session 10147,
  https://developer.apple.com/videos/play/wwdc2021/10147/) says never hard-code the refresh rate and
  — usefully for interpolation — use `targetTimestamp` rather than `timestamp`, because the latter
  produces interpolation error when the rate changes. **[Established.]** Both vendors treat frame
  *timing* as separate from frame *content*; neither of their ecosystems' visual-testing tools checks
  either.

### 10.3 Models are currently bad at judging motion — this is the load-bearing negative result

- **TempGlitch: Evaluating Vision-Language Models for Temporal Glitch Detection in Gameplay Videos**
  — https://arxiv.org/abs/2605.21443, 2026-05-20. **[Research.]** Separates *spatial* glitches
  (visible in one frame) from *temporal* ones (need multiple ordered frames). **Twelve proprietary
  and open-weight models across multiple frame-sampling settings perform near chance**, failing
  either by missing almost everything or by flagging clean video. Critically: *denser frame sampling
  and larger models do not reliably fix it.*
- **MotionBench** — Hong et al., https://arxiv.org/abs/2501.02955, 2025-01-06, CVPR 2025.
  **[Research.]** Existing vision-language models understand fine-grained motion poorly; higher frame
  rates help but leave "substantial room for enhancement".
- **VideoGlitchBench / GLIDE** — https://arxiv.org/abs/2604.07818, 2026-04-09. **[Research.]** 5,238
  annotated gameplay videos with precise temporal spans; frames the task as needing reasoning about
  mechanics, physics, rendering, animation and expected state transitions, and distinguishing true
  glitches from unusual-but-valid events.
- **How models are actually fed video today.** Gemini samples video at **1 frame per second by
  default** (258 tokens/frame at default resolution), with custom rates available roughly 0.0–24.0
  fps and cost scaling linearly. https://ai.google.dev/gemini-api/docs/video-understanding
  **[Established.]** A 1 fps sampler is structurally incapable of judging a 60 Hz animation.

**What this means for the recommendation.** Even if this repository built a perfect video pipeline,
the model at the end of it would be close to chance on exactly the defects §5–§7 describe. A
threshold on a computed number does not have that problem. This is the strongest external support
for the headline.

### 10.4 Contact sheets work — for "what happened", with conditions

- **IG-VLM: "An Image Grid Can Be Worth a Video"** — Kim, Choi, Lee, Rhee,
  https://arxiv.org/abs/2403.18406, 2024-03-27. **[Research, but a strong result.]** Sample **six
  frames uniformly**, tile into a **3×2 grid** as one composite image, add a "grid guidance" prompt
  saying the tiles are temporally ordered, feed to an off-the-shelf vision model with no video
  training. It **beats existing methods on 9 of 10 zero-shot video question-answering benchmarks**.
  The near-square shape was chosen deliberately to match the image proportions models are trained on.
  The authors flag the six-frame limit themselves, and their ablations find frame count, frame
  ranking and grid shape all matter.
- **Independently reinvented for agents.** "Computer-Use Agents as Judges for Generative User
  Interface" — https://arxiv.org/abs/2511.15567, 2025-11-19 — compresses multi-step navigation
  histories into concise visual summaries ("CUA Dashboard") for the judging agent. Same idea, arrived
  at from a different direction. **[Research.]**
- **Reconcile these honestly.** IG-VLM shows contact sheets work for *semantic, event-level*
  questions. TempGlitch and MotionBench show fine-grained *motion quality* judgment is still near
  chance. So: a contact sheet is a strong tool for "did the right thing happen"; it is **not
  demonstrated** for "did it move correctly". §3.1 and W M.6 are scoped accordingly.

### 10.5 Agents that drive and test games

- **SIMA / SIMA 2** (DeepMind) — a generalist agent across 9+ commercial 3D games using **only pixels
  in, keyboard and mouse out**. https://arxiv.org/abs/2404.10179 (2024-04-16);
  https://deepmind.google/blog/sima-2-an-agent-that-plays-reasons-and-learns-with-you-in-virtual-3d-worlds/
  (2025-11). **[Research.]**
- **Voyager** — https://arxiv.org/abs/2305.16291, 2023-05-25. **[Research.]** Lifelong-learning
  Minecraft agent; the transferable idea is the **growing library of executable skills** refined by
  feeding execution errors back into the prompt.
- **Cradle** — https://arxiv.org/abs/2403.03186, 2024-03-05, ICML 2025. **[Research.]** Screenshots
  in, keyboard/mouse out, across Red Dead Redemption 2, Cities: Skylines, Stardew Valley and others.
- **TITAN — "Leveraging LLM Agents for Automated Video Game Testing"** —
  https://arxiv.org/abs/2509.22170, 2025-09-26. **[Research, moving to production.]** The closest
  published prior art for an agentic game-test harness: a perception module abstracting game state
  into expert-chosen features, retrieval over game documentation, coverage maps, monitors for
  unfinishable tasks and slowdowns, automatic bug reports. Reported as deployed in eight real QA
  pipelines.
- **Reinforcement-learning game testing is genuinely established at AAA scale** — EA SEED,
  https://www.ea.com/seed/news/automated-game-testing-deep-reinforcement-learning and
  https://arxiv.org/abs/2103.15819 (2021-03-29), with work on Battlefield V and Dead Space.
- **Vision models detecting visual bugs in HTML5 canvas apps** — Macklon & Bezemer,
  https://arxiv.org/abs/2501.09236, 2025-01-16. **[Research.]** Up to 100% per-application accuracy
  on injected bugs in still screenshots — **but only when the prompt also carried the project README,
  a description of the bug classes, and a bug-free reference screenshot.** That context-dependency is
  a directly usable design constraint for any "look at this frame and tell me what is wrong" prompt
  in this repository.

### 10.6 How robotics and time-series work serialises signals for language models

- **RT-2** — https://arxiv.org/abs/2307.15818, 2023-07-28. **[Established in its field.]** Each
  continuous action dimension is uniformly discretised into **256 bins** and each bin mapped to an
  existing text token, so an action is literally a string like `"1 128 91 241 5 101 127"`. This is
  the canonical citation for serialising continuous control as ordinal text.
- **PaLM-E** — https://arxiv.org/abs/2303.03378, 2023-03-06, ICML 2023. **[Research.]** The
  alternative design: project continuous observations into the language embedding space rather than
  discretising them. Not available through a black-box API, which is what this repository has.
- **LLMTime — "Large Language Models Are Zero-Shot Time Series Forecasters"** —
  https://arxiv.org/abs/2310.07820, 2023-10-11, NeurIPS 2023. **[Research.]** The optimistic side:
  encoding a series as a string of digits works surprisingly well. The practical warning worth
  carrying: **number tokenisation is a real failure mode** — GPT-4 did worse than GPT-3 on this task
  because of how it tokenises numbers.
- **"Are Language Models Actually Useful for Time Series Forecasting?"** — Tan et al.,
  https://arxiv.org/abs/2406.16964, 2024-06-24, NeurIPS 2024 spotlight. **[Research.]** The skeptical
  side, and the paper to read before handing a model raw numeric traces: across three popular
  LLM-based forecasters, **removing the language model, or replacing it with a basic attention layer,
  does not degrade performance and usually improves it.**
- **Rendering series as images rather than as text** — the efficiency argument is clean: text-encoding
  a numeric array costs tokens linearly in its length, while rendering it as one plot costs a constant
  number regardless. See TimeVista (https://arxiv.org/html/2606.16173v1) and Time-VLM
  (https://arxiv.org/pdf/2502.04395, 2025-02). **[Research.]**

**Consequence for this document.** Do not paste 600 numbers and ask a model whether they look
periodic — that is the exact use the NeurIPS 2024 spotlight found unhelpful, and it asks the model to
do arithmetic a `for` loop does better. Compute the statistic in code; hand over the statistic. If a
long series must be shown, a plot is cheaper than the numbers.

### 10.7 The measurement tooling I chose not to adopt, and what it actually is

Recorded so the rejections in §9 are rejections of something specific rather than of a vibe. This
subsection was verified against **FFmpeg master `d9ece3f721` (2026-08-07)** and the generated filter
manual (2026-08-11), with optical-flow costs **measured** on an M4 Pro with OpenCV 5.0 rather than
estimated. Where something is unmeasured, it says so.

**Reference-based video quality metrics — rejected, with one carve-out.**

- **VMAF** (Netflix, https://github.com/Netflix/vmaf) predicts how a *human* would rate a distorted
  video against a pristine reference. Wrong tool here: **no reference video**, no compression stage,
  no human-rating question. SSIM, MS-SSIM, PSNR, XPSNR and LPIPS are reference-based in the same way,
  and their frame-alignment assumption is precisely what judder violates. **[Established.]**
- Two traps if anyone tries anyway: FFmpeg's `libvmaf` filter **emits no per-frame metadata at all**
  (you must parse `log_path`), it takes the **distorted** input first — the opposite of the `psnr`
  and `ssim` convention — and its options changed incompatibly twice: `model_path=` works through
  n6.0 and is **removed at n6.1**. `libvmaf_cuda` additionally needs `--enable-nonfree`, which makes
  the resulting binary non-redistributable.
- **The carve-out: `vmafmotion`.** VMAF's *temporal* component ships as a standalone FFmpeg filter
  that takes **one input and needs no reference**, exporting `lavfi.vmafmotion.score` per frame. It
  is a well-validated motion-energy measure available on a no-reference capture. So the honest
  position is narrower than "reject VMAF": reject the fused human-opinion metric, and note that its
  motion feature alone is a legitimate no-reference signal of the same family as §3.2's
  frame-difference series.
- **Perceptual metrics that genuinely model time** — the FovVideoVDP / ColorVideoVDP line (Mantiuk
  et al.) models the eye's response to flicker and motion over time, which is the right *shape*. Still
  reference-based, still a research artifact rather than a dependency. **[Research.]**

**FFmpeg's no-reference per-frame filters — the right tool if you have a video, which is the catch.**
https://ffmpeg.org/ffmpeg-filters.html. Four independent motion-energy signals come out of one pass
with no custom code:

| Filter | Metadata key | What it is |
|---|---|---|
| `siti` | `lavfi.siti.si`, `lavfi.siti.ti` | **ITU-T P.910** Spatial/Temporal Information. `ti` is the **standard deviation** of the per-pixel frame difference. |
| `vmafmotion` | `lavfi.vmafmotion.score` | VMAF's temporal feature, single-input. |
| `signalstats` | `lavfi.signalstats.YDIF` | **Mean** absolute luma difference against the previous frame. |
| `scdet` | `lavfi.scd.mafd` | Mean absolute frame difference. |

Three traps found by reading the source, all worth carrying because they are the kind of thing that
silently produces a plausible wrong number:

1. **`scdet`'s `score` is not what you want.** It computes `min(mafd, |Δmafd|)` — deliberately
   constructed to *suppress sustained motion*, since a steady pan has high `mafd` but near-zero
   change in it. Use **`mafd`**, never `score`. The same construction sits behind `select`'s
   undocumented `lavfi.scene_score`.
2. **Several filters' metadata keys are undocumented and irregular** — `blockdetect` writes
   `lavfi.block` (not `lavfi.blockdetect.block`), `blurdetect` writes `lavfi.blur`, and `identity`,
   `msad` and `entropy` all **double their own name** in the key.
3. **`signalstats` initialises the previous frame to the current one**, so `YDIF` is 0 on frame 0.
   Do not count that as a held frame.

Also worth knowing: **`vfrdet`** gives one-line variable-frame-rate triage at EOF; **`idet`** detects
field repetition, which is how you distinguish 3:2-pulldown judder from a real pacing bug; and
**`showinfo`'s `plane_checksum`** (Adler-32 per plane) gives **exact** duplicate-frame detection with
no threshold to tune — strictly better than thresholding a difference metric when the question is
"is this frame byte-identical to the last one".

**Why this does not become the plan here.** This repository holds **lossless PNG masters**, and the
WebM is explicitly a `review-derivative` (`capture-sequence-service.ts:404-413`). Measuring the
derivative measures the VP9 encoder as well as the game. But the *statistics* transfer directly, and
one of them improves P3 — see §8's note on ITU-T P.910.

**Compressed-domain motion vectors — a dead end, and more decisively than I first thought.**
The idea is to read the block motion an encoder already computed instead of computing flow. Verified
against FFmpeg master: only `mpegutils.c` and `snowdec.c` ever produce `AV_FRAME_DATA_MOTION_VECTORS`,
and the complete supporting-decoder list is **H.264, MPEG-1/2, MPEG-4 Part 2, H.263, VC-1/WMV3,
RealVideo 1–4, H.261 and Snow**. **HEVC, VP8, VP9 and AV1 export nothing** — zero matches in their
decoders. **This repository's own capture artifact is VP9**
(`packages/cli/src/host/managed-capture-runtime.ts:265-266`), so the technique yields exactly nothing
here without re-encoding. Three further nails: `ffprobe` cannot print the vectors numerically (the
side-data printer has no `MOTION_VECTORS` branch — you get a type and a size and no numbers); the
commonly cited extractor **`mpegflow` no longer builds** against modern FFmpeg (it calls
`av_register_all()`, removed in 4.0, and `avcodec_decode_video2()`, removed in 5.0; last commit
2019-04-04); and for judder specifically, intra blocks and I-frames carry no vectors, so the series
acquires **periodic holes at every GOP boundary — a compression artifact trivially mistaken for a
pacing artifact.** If block motion is ever wanted regardless of codec, FFmpeg's **`mestimate`** filter
computes it in the filtergraph — but its default `method=esa` is exhaustive search, so set
`epzs`/`ds`/`hexbs`, and its runtime is unmeasured.

**Optical flow — measured.** One core, M4 Pro, OpenCV 5.0, synthetic translation pair:

| Method | 720p | 1080p (1 thread) | 1080p (14 threads) |
|---|---|---|---|
| absolute difference + mean | — | **0.8 ms** | — |
| **DIS, ultrafast preset** | **3.5 ms** | **8.2 ms** | **3.0 ms** |
| Lucas–Kanade, 500 points (tracking only) | 2.9 ms | 3.2 ms | — |
| DIS, fast preset | 10.1 ms | 22.8 ms | 13.8 ms |
| **Farnebäck, defaults** | 56.5 ms | **135.9 ms** | **123.4 ms** |

Downscaling first: DIS-fast at quarter resolution (480×270) costs **1.9 ms** end to end, about 18×
real time on one core — ample for a global motion series.

Three things in that table are worth remembering. **Farnebäck barely threads** — fourteen cores buy
it 10% — while DIS threads properly. **DIS-ultrafast is roughly 17× faster than Farnebäck at 1080p**
and, per its own paper (Kroeger et al., ECCV 2016, https://arxiv.org/abs/1603.03590), about an order
of magnitude *more accurate* at matched runtime. And **Lucas–Kanade tracking is nearly
resolution-independent** (2.9 ms at 720p, 3.2 ms at 1080p) because the cost is the corner detector,
not the tracker — seed a fixed grid instead of detecting corners and it is ~3 ms flat.

**RAFT** (https://arxiv.org/abs/2003.12039, ECCV 2020) processes 1088×436 at about 10 frames per
second on a 1080 Ti — roughly 100 ms per frame — and its all-pairs correlation volume needs the
`alternate_corr` path or tiling at 1080p. Wrong shape for this problem: a GPU and 100 ms per frame to
produce sub-pixel accuracy that is immediately collapsed to a scalar. If a learned method is ever
genuinely needed, look at SEA-RAFT (ECCV 2024) or NeuFlow v2 (https://arxiv.org/abs/2408.10161)
rather than RAFT itself.

**Desktop frame-pacing tools.** Intel PresentMon (https://github.com/GameTechDev/PresentMon) and its
relatives measure the interval between presents and between display changes — exactly the signal §3.8
wants and exactly the signal a web page cannot obtain. Borrow their **metric vocabulary** (interval
between presents, 1%-low and 0.1%-low frame rates) for W M.8's published projection even though the
tools do not apply.

**Explicitly unverified in this subsection**, and flagged rather than smoothed over: the FFmpeg filter
*costs* were reasoned from their algorithms, not benchmarked; `mestimate`'s runtime is unmeasured;
whether hardware-accelerated H.264 decode yields empty or *garbage* motion vectors was inferred from a
source guard, not observed; and the RAFT memory figure is derived arithmetic, not a paper number.

### 10.8 What is genuinely mine, not the literature's

**[Speculative.]** The composition proposed in section 8 — deterministic fixed-step simulation as the
*primary* motion instrument, simulation-state assertions in the SCA-2017 style, pixels reserved for
post-shader and rendering-only defects, a frequency budget deciding which instrument answers which
question, and a labelled contact sheet used only for the fuzzy "did the right thing happen" layer —
is not something I found published anywhere. Every ingredient is established. The assembly is a
proposal, and it should be treated as one.

---

## 11. Acceptance criteria

Written in the style of `06-WORK-PACKETS.md`: each packet names the files it owns, and every
criterion is mechanically checkable. "Feels better" never appears.

### W M.1 — `scripts/motion-stats.mjs`, the series analysis library

**Owns:** `scripts/motion-stats.mjs`, `scripts/tests/motion-stats.test.mjs`, root `package.json`,
`scripts/tests/repository-policy.test.mjs` (allowlists).
**Depends on:** nothing. No GPU, no browser, no demo.

> `scripts/tests/repository-policy.test.mjs:24-37` asserts an exact allowlist of tracked files under
> `scripts/`, and `:39-59` asserts an exact allowlist of root script keys. Both must be updated in
> the same commit or `npm test` goes red.

**Acceptance criteria**
- A pure sine of known frequency `f` sampled at 60 Hz reports `dominantFrequency` within **0.2 Hz**
  of `f`, and `spectralConcentration` above **0.9**.
- White noise of the same length reports `spectralConcentration` below **0.15** and no
  autocorrelation value above **0.3** at any lag from 1 to 200.
- The sum of two sines at 7.48 Hz and 6.53 Hz — the exact signal at `presentation.ts:34-35` —
  reports `spectralConcentration` above **0.4** and an autocorrelation peak above **0.6** near lag
  63 (1.047 s at 60 Hz). **This test is the library proving it can detect the defect it exists for.**
- A monotonically increasing ramp with every third value repeated reports exactly the right number
  of holds from `holds(series, 0)`.
- A synthetic exponential decay `e^(−4.2t)` sampled at 60 Hz reports `quarterDecaySamples` within one
  sample of the analytic answer, `ln 4 / 4.2` ≈ 0.330 s. (The game's own impact decay at
  `simulation.ts:378` is *linear*, not exponential — this criterion is exercising the library, not
  describing the simulation.)
- `crossCorrelation` of a signal with itself is 1.0 at lag 0; with its negation, −1.0.
- Every function is pure: no file, network or clock access. Asserted by the module importing nothing
  but `node:assert` in its tests.
- `npm test` green.

### W M.2 — Combat Arena camera-shake motion assertions

**Owns:** `packages/demos/antiky/combat-arena/tests/presentation.test.ts`.
**Depends on:** W M.1. **Fails on purpose until W D.6 lands** — see `06-WORK-PACKETS.md:315-331`.

**Acceptance criteria** — all five, computed from the exported pure projector, no capture:
- **Translation, not swivel.** For a state with `impact = 1`, the horizontal offsets applied to
  `position` equal those applied to `target`, to within **1e-9**, on both axes.
- **No dominant frequency.** Over 600 samples at 1/60 s with `impact` pinned at 1, no spectral bin
  above DC holds more than **20%** of total above-DC energy.
- **No periodicity.** The autocorrelation of the same series has no value above **0.3** at any
  non-zero lag up to 5 s.
- **Not a metronome.** Driving `createCombatSimulation` for 10 s of fixed 1/60 s steps under
  sustained cannon fire, the fraction of ticks producing a non-zero camera offset is below **10%**.
- **Correctly scaled.** In the same run, the peak camera offset attributable to cannon impacts is
  below **30%** of the peak offset produced by a single hull-loss event.
- The thirteen existing tests in that file continue to pass unchanged.

### W M.3 — Render-interpolation loop test

**Owns:** `packages/demos/antiky/*/tests/*` (one small test per demo) and whatever minimal headless
loop harness it needs. **Depends on:** W M.1. **Fails on purpose until W D.5 lands.**

**Acceptance criteria**
- Driving one demo's `frame(platformTimeSeconds)` with synthetic timestamps at a fixed 1/144 s
  cadence for 100 frames, the recorded per-frame camera-position deltas contain **no zero-valued
  delta**, and the minimum delta is at least **25%** of the mean delta.
- The same run at a fixed 1/60 s cadence produces deltas within **5%** of the 144 Hz run's mean
  delta multiplied by 2.4 — that is, interpolation does not change the *speed* of anything, only
  its sampling.
- The test states in a comment that it is the authority for this defect and that a capture cannot
  detect it, with the reason (30 fps ceiling at `capture-sequence.ts:17`).

### W M.4 — Sequence frame statistics

**Owns:** `scripts/frame-stats.mjs`, `scripts/tests/frame-stats.test.mjs`.
**Depends on:** nothing. Parallel-safe with W M.1 — different files, and no GPU.

**Acceptance criteria**
- `readSequenceStats(paths, { probes })` returns, for N input PNGs, arrays of length N for every
  scalar `readFrameStats` already returns, plus two arrays of length N−1 over the per-pixel
  difference between consecutive frames: its **mean** and its **standard deviation**. The standard
  deviation is ITU-T P.910's Temporal Information; the definition is written in a comment beside it
  along with why both are computed (§8, P3).
- Over a synthetic sequence of identical frames, both difference values are exactly **0**.
- Over a synthetic sequence where the *whole frame* brightens by a constant each step, the **mean**
  difference is non-zero and the **standard deviation** is near zero. This is the test that proves
  the pair can tell "the frame got brighter" from "something moved", and it is the reason both
  numbers exist.
- Over a synthetic sequence where one known rectangle brightens linearly, that probe's trace is
  monotonically increasing and every other probe's trace is constant.
- Mismatched frame dimensions produce a clear error naming the first offending index, not a wrong
  number.
- `npm test` green.

### W M.5 — Per-frame observation stamps in `capture_gameplay_sequence`

**Owns:** `packages/cli/src/development/capture-sequence.ts`,
`packages/cli/src/host/capture-sequence-service.ts`, `packages/cli/src/mcp/tools.ts`, and their tests.
**Depends on:** nothing. **Conflicts with any other packet touching those files — serialise.**

**Acceptance criteria**
- The result's `cadence` gains a `frames` array whose length equals `actualFrameCount`, each entry
  carrying `offsetMilliseconds`, `completedStepCount`, `accumulatorSeconds`, `stateDigest` and
  `eventSequence`, with `null` used — never omitted, never invented — where the runtime does not
  publish the value.
- A capture over a session where the simulation is paused reports the **same** `completedStepCount`
  on every frame, and a capture over a running session reports a **non-decreasing** series.
- The existing result parser rejects a `frames` array whose length disagrees with
  `actualFrameCount`, with a path-qualified error, matching the existing style at
  `capture-sequence.ts:349-351`.
- The manifest written to the evidence store carries the same array.
- No existing field changes shape. Every existing test passes unchanged.

### W M.6 — Contact sheet

**Owns:** `scripts/shoot-demos.mjs` (or a sibling script) and its test.
**Depends on:** W M.5 for the labels to mean anything.

**Acceptance criteria**
- Produces exactly one PNG from N captured frames, sampling **uniformly** down to a configurable
  tile count that **defaults to 6 in a 3×2 grid** — the shape with the only published evidence
  behind it (§10.4). A larger sheet is available by option and is not the default.
- Each tile is labelled with its frame index and its `completedStepCount`, and the sheet is at most
  **1920 px** wide and **2 MB**, so it is retrievable as a single image block without overwhelming a
  context window.
- Tile order is row-major and is asserted by a test that decodes the sheet and checks a known marker
  pixel per tile.
- The sheet's accompanying text states that the tiles are in time order and gives the seconds each
  tile represents. A sheet delivered without that sentence is being read as a collage.
- A sequence of one frame produces a 1×1 sheet rather than an error; a sequence shorter than the
  tile count produces a sheet with exactly N tiles rather than padding.

### W M.7 — VFX de-synchronisation measurement

**Owns:** one per-demo test plus a probe configuration file.
**Depends on:** W M.1, W M.4, W M.5. **Fails on purpose until the VFX work lands.**

**Acceptance criteria**
- Over a capture of at least **5 s** at at least **20 fps**, with named probe rectangles over at
  least three distinct effect types, the dominant frequency of any two probe traces differs by at
  least **30%**.
- The pairwise Pearson correlation of any two probe traces is below **0.6**.
- The test records the sampling rate and window length it used, and fails with a clear message if
  the window is shorter than **three full cycles** of the lowest dominant frequency it found —
  a measurement that cannot resolve its own signal must say so rather than return a number.

### W M.8 — Presentation frame ring

**Owns:** `packages/cli/src/host/game-server.ts`, `packages/framework/src/inspection/snapshot.ts`
and their tests. **Depends on:** nothing, but it crosses a package boundary — do not run it in
parallel with any framework schema work.

**Acceptance criteria**
- The host retains the last **256** presented frames as `{ timestamp, completedSteps, stateDigest }`
  and publishes a bounded projection: frame count, the 50th/95th/99th percentile frame interval, and
  the count of consecutive-identical-digest frames in the window.
- A synthetic host driven at a perfectly even 60 Hz reports a 99th-percentile interval within **1 ms**
  of 16.67 ms and **zero** holds.
- The same host driven at 144 Hz against a 60 Hz simulation with no interpolation reports a hold
  count above **50** in a 256-frame window.
- The published projection is fixed-size regardless of ring size — the raw ring never crosses the
  inspection boundary.
- `get_render_stats` continues to return every field it returns today.

### W M.9 — `get_motion_report`

**Owns:** `packages/cli/src/mcp/tools.ts` and a new service module.
**Depends on:** W M.1, W M.4, W M.5, W M.6. Do not start it earlier.

**Acceptance criteria**
- One call taking a sequence `evidenceId` returns: the per-frame stamps, one trace per configured
  probe, each trace's dominant frequency and spectral concentration, the frame-difference series,
  the events whose `simulationTimeSeconds` falls inside the captured window, and one contact-sheet
  image block.
- The JSON payload is under **32 KB** for a 180-frame sequence. Traces are rounded to a stated
  precision; raw pixel data never appears.
- An `evidenceId` from a different development session returns a stable error code, not a partial
  answer.
- The tool declares itself read-only and takes no path.

---

## 12. Glossary

| Term | One plain sentence |
|---|---|
| **Autocorrelation** | How much a signal resembles a time-shifted copy of itself; a high value at some shift means the signal repeats with that period. |
| **Beat** | When two signals of nearly the same frequency are added, they drift in and out of step, producing a slow throb at the difference of the two frequencies. |
| **Contact sheet** | A single image made of many small frames tiled in a grid, like a page of film negatives. |
| **DFT / FFT** | A calculation that reports which frequencies a signal is made of; FFT is just a fast way to compute a DFT. |
| **Duty cycle** | The fraction of the time a thing is "on". |
| **Frame hold** | The display showing the same image twice because nothing new was drawn. |
| **Judder** | Motion that looks uneven because frames arrive at irregular intervals or are held. |
| **Look-at target** | The point in the world the camera is aimed at; moving the camera without moving this point rotates the view. |
| **Motion energy image** | A picture of where motion happened, made by adding up frame-to-frame differences. |
| **Nyquist limit** | You can only faithfully measure a signal up to half your sampling rate; a 30-frames-per-second capture cannot represent anything faster than 15 cycles per second. |
| **Optical flow** | An estimate, for each pixel, of where it moved to in the next frame. |
| **Pearson correlation** | A number from −1 to 1 saying how strongly two series move together. |
| **Probe rectangle** | A named region of the frame whose average brightness is measured, so tests read as intent rather than coordinates. |
| **Spectral concentration** | How much of a signal's energy sits in a single frequency; near 1 means "this is basically one sine wave". |
| **Spatiotemporal slice** | An image built by taking one line of pixels from every frame and stacking them, so one axis is space and the other is time. |
| **Temporal aliasing / crawl** | Detail finer than one pixel flickering on and off as the camera moves, because it cannot be sampled consistently. |
| **Temporal Information (TI)** | ITU-T P.910's motion measure: the standard deviation of the frame-to-frame pixel difference, which ignores a uniform brightness change. |
| **Motion vector** | A block-level "this part of the picture moved by roughly this much" estimate that a video encoder computes as a side effect of compressing. |
| **Step response** | How a system settles after a sudden change in what it is chasing; for a camera, how long it takes to catch up. |
| **Time constant** | For smoothing that eases toward a target, the time to close about 63% of the remaining gap. |
| **Trauma model** | The standard screen-shake design: keep one value that spikes on events and decays, and drive shake by its square so small events stay subtle. |
| **Fixed timestep** | Advancing the simulation in equal-sized quanta regardless of how fast frames are drawn. |
| **Render interpolation** | Drawing a blend of the two most recent simulation states, so a 60 Hz simulation looks smooth on a faster display. |

---

## Verification of the central claim (reviewing agent, 2026-08-11)

The P1 recommendation — compute motion from the simulation rather than from video — was tested
rather than accepted. A 40-line script imported `createCombatCameraProjector` from
`combat-arena/src/presentation.ts`, drove it for 10 simulated seconds at 60 Hz with the documented
cannon cadence (impact 0.45 every 0.34 s, decaying at 4.2/s), and measured the resulting camera
path. **No browser, no GPU, no capture, no dev server.** It runs in well under a second.

Both halves of the owner's reported defect reproduce:

| Measurement | Result | Meaning |
|---|---|---|
| Camera X offset range | 0.0836 world units | The camera does shake |
| **Target X offset range** | **0.0000** | **The look-at point does not.** The frame swivels rather than translating — the defect diagnosed by reading the source, now measured |
| Strongest autocorrelation peak outside lag 0 | **0.759 at 0.667 s** | Strongly periodic |
| W D.6 criterion (`no peak above 0.3`) | **FAILS** | The proposed acceptance criterion is executable today and correctly rejects the current code |

One refinement to the earlier diagnosis. The dominant period is **0.667 s, not the 1.047 s** beat
predicted from `|47 − 41|`. That is 2 × the 0.34 s cannon cadence, which confirms the **metronome
is the stronger periodic signal**, not the sine beat. The retrigger rate is the primary defect and
the beating frequencies are secondary — so cutting the cannon's contribution matters more than
changing the waveform, though both are wrong.

Two supporting claims were also checked and hold:

- **`get_render_stats` carries no motion information.** `instances` and `drawCalls` in
  `combat-arena/src/renderer.ts:55-64` are derived from authored capacity constants, not measured,
  and are reported once through `context.report(...)` at startup (`game.ts:89-92`).
- **BroMetal exposes no draw statistics or GPU timing** in its public surface
  (`node_modules/brometal/dist/index.d.ts`).

**Consequence for planning: W D.6 is no longer blocked on motion capture.** Goal 03 can rebuild the
camera shake and prove it with a plain Node test today. The capture-side work (P2 onward) remains
worth doing to prove the renderer presents what the simulation computed, but it is not a
prerequisite for fixing the defect the owner reported.
