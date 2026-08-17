/**
 * Capture every demo and record what it looks like, as numbers.
 *
 * This wraps the capture and inspection MCP the repository already ships. It does not drive a
 * browser itself. The MCP owns the managed Chromium, the WebGPU flags, the canvas-only framing,
 * and the private evidence store, and duplicating any of that here would create a second, weaker
 * capture path that nobody maintains.
 *
 * The captured PNG is deliberately not committed. `.antiky/` is gitignored and evidence retention
 * is scoped to a development session. The durable artifact is `visual-metrics.json` beside each
 * demo, which is what the per-demo visual budget tests assert against.
 *
 * Demos are captured strictly one at a time. Every manifest binds 127.0.0.1:3010 for the game and
 * :3011 for inspection, so two demos cannot run at once.
 *
 * Usage:
 *   node scripts/shoot-demos.mjs [--demo <slug>] [--runs <n>] [--warm-up <n>]
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isUniformFrame, readFrameStats } from './frame-stats.mjs';
import {
  CAPTURE_FIXTURES,
  CAPTURE_PAIRS,
  DEMOS,
} from './demo-capture-config.mjs';
import {
  evaluateControlPair,
  measureControlPair,
  measurePixelDrift,
} from './demo-visual-evidence.mjs';

export {
  evaluateControlPair,
  measureControlPair,
  measurePixelDrift,
} from './demo-visual-evidence.mjs';
export {
  CAPTURE_FIXTURES,
  CAPTURE_PAIRS,
  DEMOS,
} from './demo-capture-config.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

/**
 * Named rectangles a demo wants measured on top of the whole-frame numbers.
 *
 * A whole-frame statistic cannot answer "is this particular thing still in the picture", and a demo
 * can lose an entire element while every frame-wide number stays inside its budget. That happened:
 * point-light-expo's onboarding panel stopped drawing and the capture still measured p95 0.256,
 * local contrast 6.66 and saturation 0.422 — all normal.
 *
 * Most demos need none of this, so the map is sparse and lives beside `DEMOS` rather than inside
 * it. A probe that falls outside the frame is an error, not a clamp, so these are real coordinates
 * against a real capture size.
 */
export const DEMO_PROBES = Object.freeze({
  'point-light-expo': Object.freeze({
    /**
     * The onboarding panel, bottom-left of a 1280x720 capture.
     *
     * Judged by standard deviation rather than brightness. The panel is a near-black plate carrying
     * bright text, so it spreads much wider than the lit floor it covers: 0.143 with the panel
     * present against 0.081 without. Mean luminance separates too, but in the direction that makes
     * "darker" look like "passing", and this demo is already dark on purpose.
     */
    onboarding: Object.freeze({ x: 16, y: 648, width: 608, height: 60 }),
    /**
     * Floor in the shadow of a rock, and floor in full sun 205 px away on the same material.
     *
     * The pair is what makes the measurement mean something. One probe on its own only says how
     * bright a patch of ground is, which depends on the litter under it as much as on the light.
     * With shadows disabled these two swap places — the shadowed probe measures 34% *brighter*
     * than its reference — so the darkness is the shadow and not a difference between two patches.
     */
    sunShadow: Object.freeze({ x: 1082, y: 438, width: 32, height: 32 }),
    // Moved by goal 08: the old box (898, 348) now has the plum relay's field ring crossing it,
    // which read as stripes to the acne bound. Plain litter, no rings, still fully lit.
    sunLit: Object.freeze({ x: 700, y: 560, width: 32, height: 32 }),
    /**
     * Ground 20 px beyond the blue relay's edge, and the same ground 100 px out.
     *
     * A pair again, for the same reason as the shadow probes: the near patch is brighter than the
     * far one with or without bloom, because it is closer to a light. What bloom changes is *how
     * much* brighter — 1.64 without it against 2.01 with — and a ratio is the thing that separates
     * "there is a glow" from "there is a lamp over there".
     */
    bloomNear: Object.freeze({ x: 700, y: 118, width: 24, height: 24 }),
    bloomFar: Object.freeze({ x: 772, y: 196, width: 24, height: 24 }),
  }),
  'combat-arena': Object.freeze({
    /**
     * Arena deck in the sun's shadow, and deck in full key light 204 px away on the same panel
     * band. Re-derived by goal 08 after the camera commit moved every screen coordinate; the old
     * pair (822,138 / 1006,110) measured wall and sky in the new frame.
     *
     * Verified against a control capture with the shadow term forced off: the shadow box darkens
     * 31% when the term is on while the lit box moves under 2%, so the gap below is the shadow
     * arriving rather than two different patches of floor.
     */
    sunShadow: Object.freeze({ x: 656, y: 378, width: 32, height: 32 }),
    sunLit: Object.freeze({ x: 860, y: 378, width: 32, height: 32 }),
  }),
});

/** Capture errors that mean "reality moved, read it again" rather than "this failed". */
const RETRYABLE_CAPTURE_CODES = new Set([
  'CAPTURE_BUILD_STALE',
  'CAPTURE_RUNTIME_STALE',
  'CAPTURE_DIMENSIONS_MISMATCH',
]);

const MAX_FENCE_ATTEMPTS = 4;

export function resolveDemo(slug) {
  const manifest = DEMOS[slug];
  if (manifest === undefined) {
    throw new Error(`Unknown demo "${slug}". Known demos: ${Object.keys(DEMOS).sort().join(', ')}`);
  }
  return { slug, manifest, directory: path.dirname(manifest) };
}

/**
 * Build the fenced `capture_frame` input.
 *
 * The target must equal the manifest viewport reported by `get_capture_capabilities`, and the
 * device scale factor must be 1. Asking for the configured size at a scale factor of 2 is rejected
 * with CAPTURE_DIMENSIONS_MISMATCH even though the result is inside the stated maximums.
 */
export function buildCaptureInput({
  build,
  runtime,
  capabilities,
  warmUpFrames,
  idempotencyKey,
  sessionStatus,
  fixture: captureFixture,
}) {
  const session = sessionStatus?.session;
  return {
    schemaVersion: 3,
    expected: {
      developmentSessionId: build.developmentSessionId,
      acceptedBuildRevision: build.acceptedBuildRevision,
      currentRuntimeInstanceId: runtime.observation?.runtimeInstanceId ?? null,
      ...(session === undefined ? {} : {
        sessionId: session.sessionId,
        completedStepCount: session.clock.completedStepCount,
        stateDigest: session.lastCompletedStep?.stateDigest ?? null,
      }),
    },
    runtimePolicy: 'managed-only',
    target: {
      width: capabilities.target.configuredWidth,
      height: capabilities.target.configuredHeight,
      deviceScaleFactor: 1,
    },
    warmUpFrames,
    idempotencyKey,
    ...(captureFixture === undefined ? {} : { fixture: captureFixture }),
  };
}

/** Pause one live game and advance it to one exact fixed-step identity. */
export async function pauseAndAdvanceToStep({
  manifest,
  targetCompletedStepCount,
  advanceSteps = 1,
  callTool = runAntikyTool,
}) {
  const paused = await callTool('pause_simulation', undefined, manifest);
  if (paused.error !== undefined) {
    throw new Error(`pause_simulation failed: ${paused.error.code} — ${paused.error.message}`);
  }
  if (paused.result?.code !== 'PAUSED' && paused.result?.code !== 'NO_OP') {
    throw new Error(`pause_simulation did not pause the session (${paused.result?.code ?? 'missing'}).`);
  }
  let status = await callTool('get_session_status', undefined, manifest);
  if (status.error !== undefined) {
    throw new Error(`get_session_status failed: ${status.error.code} — ${status.error.message}`);
  }
  const initialCount = status.session.clock.completedStepCount;
  const target = targetCompletedStepCount ?? initialCount + advanceSteps;
  if (!Number.isSafeInteger(target) || target < initialCount) {
    throw new Error(`Requested completed step ${target} is behind current step ${initialCount}.`);
  }
  while (status.session.clock.completedStepCount < target) {
    const expectedCompletedStepCount = status.session.clock.completedStepCount;
    const stepped = await callTool(
      'step_simulation',
      { expectedCompletedStepCount },
      manifest,
    );
    if (stepped.error !== undefined) {
      throw new Error(`step_simulation failed: ${stepped.error.code} — ${stepped.error.message}`);
    }
    if (
      stepped.result?.code !== 'STEPPED'
      || stepped.session?.clock?.completedStepCount !== expectedCompletedStepCount + 1
    ) throw new Error('step_simulation did not advance exactly one fixed step.');
    status = await callTool('get_session_status', undefined, manifest);
  }
  if (status.session.mode !== 'paused' || status.session.clock.completedStepCount !== target) {
    throw new Error('The exact paused capture identity did not settle.');
  }
  return status;
}

/** Stable simulation/build identity shared by captures; publication timestamps may legitimately move. */
export function comparableCaptureIdentity(observation) {
  return Object.freeze({
    developmentSessionId: observation.developmentSessionId,
    acceptedBuildRevision: observation.acceptedBuildRevision,
    runtimeInstanceId: observation.runtimeInstanceId,
    sessionId: observation.session?.sessionId ?? null,
    completedStepCount: observation.session?.completedStepCount ?? null,
    stateDigest: observation.session?.stateDigest ?? null,
  });
}

/**
 * Where the evidence store writes a captured artifact.
 *
 * Every component comes from identities the capture response already returned, so this reads the
 * documented layout rather than guessing at a filename.
 */
export function evidencePngPath({ demoDirectory, developmentSessionId, evidenceId, artifactId }) {
  const sessionKey = createHash('sha256').update(developmentSessionId).digest('hex');
  return path.join(demoDirectory, '.antiky', 'evidence', sessionKey, evidenceId, `${artifactId}.png`);
}

/**
 * A digest of everything that decides what a demo renders.
 *
 * Without this a `visual-metrics.json` is a number with a timestamp nobody reads, so one good
 * capture keeps a budget green forever no matter what the demo does afterwards.
 *
 * **It covers art, not just code.** The first version walked `src` and accepted only `.ts`, `.mjs`
 * and `.json`, which left every texture atlas, GLB and sprite sheet outside it — repainting an atlas
 * left the digest unchanged. For a repository whose recent work is *about* texture decoding and
 * atlas bleeding, that was the wrong boundary. It now covers `src`, `assets` and the `.antiky`
 * manifest, and hashes by content rather than by extension.
 */
export async function sourceDigest(rawDirectory) {
  // Resolved first, so every path collected below is absolute. Mixing an absolute repository path
  // with a relative demo path made `files.sort()` order them differently depending on how the caller
  // spelled its argument, and the same demo hashed two ways — the shoot script recorded one and the
  // budget tests computed the other, so every budget declared itself stale.
  const directory = path.resolve(rawDirectory);
  const hash = createHash('sha256');
  const files = [];
  const walk = async (current) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      // `.antiky` holds capture evidence, which is an output of measuring, not an input to it.
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.antiky') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name !== 'visual-metrics.json') files.push(full);
    }
  };
  await walk(path.join(directory, 'src'));
  await walk(path.join(directory, 'assets'));
  // The shared code every demo renders through. Changing `FIXED_STEP_SECONDS` in the framework
  // alters what every capture would show, and left the digest untouched — a boundary drawn at the
  // demo folder misses the thing they all depend on.
  // Resolved from this file's own location, not by counting `..` from the caller's argument. The
  // argument arrives relative from the shoot script and absolute from the budget tests, and walking
  // up from each gave two different roots — so the same demo hashed to two different digests and
  // every budget reported itself stale.
  const repositoryRoot = path.resolve(import.meta.dirname, '..');
  await walk(path.join(repositoryRoot, 'packages', 'framework', 'src'));
  await walk(path.join(repositoryRoot, 'packages', 'demos', 'scripts'));
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.antiky') || entry.name === 'vite.config.ts' || entry.name === 'package.json') {
      files.push(path.join(directory, entry.name));
    }
  }

  for (const file of files.sort()) {
    hash.update(path.relative(directory, file));
    hash.update(await readFile(file));
  }
  return { digest: hash.digest('hex').slice(0, 16), fileCount: files.length };
}

/** The committed record of what a demo looked like on a given run. */
export function buildMetricsSidecar({ slug, stats, capturedAt, warmUpFrames, source, inspection }) {
  const sidecar = {
    // 4 added `encodedLuma` and `hue` for the §7.1 frame-level value targets, which are written
    // against the delivered bytes rather than linear light.
    schemaVersion: 5,
    demo: slug,
    capturedAt,
    warmUpFrames,
    // What was measured. A budget read against a different digest is stale, not passing.
    source,
    frame: { width: stats.width, height: stats.height },
    luminance: {
      mean: Number(stats.meanLuminance.toFixed(6)),
      p05: Number(stats.luminanceP05.toFixed(6)),
      p50: Number(stats.luminanceP50.toFixed(6)),
      p95: Number(stats.luminanceP95.toFixed(6)),
      // Descriptive only. Across real captures this tracks p95 at r = 0.99, so asserting on it
      // is very nearly asserting "be brighter". Judge form with localContrast.
      spread: Number(stats.luminanceSpread.toFixed(6)),
    },
    localContrast: {
      median: Number(stats.localContrastMedian.toFixed(4)),
      p10: Number(stats.localContrastP10.toFixed(4)),
    },
    clipping: {
      high: Number(stats.clippedHigh.toFixed(6)),
      low: Number(stats.clippedLow.toFixed(6)),
    },
    saturation: { mean: Number(stats.meanSaturation.toFixed(6)) },
    /**
     * The §7.1 measurements, in the space that table is written in: Rec. 709 luma of the
     * delivered sRGB bytes, and hue clustering over the chromatic pixels.
     */
    encodedLuma: {
      p05: Number(stats.encodedLumaP05.toFixed(6)),
      p50: Number(stats.encodedLumaP50.toFixed(6)),
      p95: Number(stats.encodedLumaP95.toFixed(6)),
      spread: Number(stats.encodedLumaSpread.toFixed(6)),
      clipped: Number(stats.encodedLumaClipped.toFixed(6)),
    },
    hue: {
      clusters: stats.hueClusterCount,
      dominantShare: Number(stats.hueDominantShare.toFixed(6)),
      chromaticFraction: Number(stats.chromaticFraction.toFixed(6)),
    },
    /**
     * Anti-aliasing. `hard` is the fraction of pixels on an unsampled edge; it rises when a scene
     * stops being multisampled, which is a change nothing else here notices.
     */
    edges: { hard: Number(stats.hardEdgeFraction.toFixed(6)) },
    // Only the demos in `DEMO_PROBES` have any, so this is usually `{}`.
    probes: Object.fromEntries(Object.entries(stats.probes).map(([name, probe]) => [name, {
      meanLuminance: Number(probe.meanLuminance.toFixed(6)),
      standardDeviation: Number(probe.luminanceStandardDeviation.toFixed(6)),
      pixels: probe.pixels,
    }])),
    ...(inspection === undefined ? {} : { inspection }),
  };
  // Sealed against editing. The budgets are read from this file, so without a seal the way to pass
  // one is to open it and type a bigger number — which was demonstrated, and passed.
  //
  // This is not security, and it is not trying to be: anyone can recompute the seal. It is there so
  // that changing a measurement is a deliberate act rather than a two-second edit that looks like a
  // result.
  return { ...sidecar, seal: sealMetrics(sidecar) };
}

/**
 * A digest of the measured values, so a hand-edited number stops matching.
 *
 * This is deliberately not a secret. Anyone can call it and re-seal an edited file, which an audit
 * duly did — so on its own it stops a careless edit, not a determined one.
 *
 * **What it is and is not.** It is a tripwire against carelessness: opening the file and typing a
 * bigger number to pass a budget no longer works, and that was a two-second edit that looked like a
 * result. It is not a control against intent — calling this function again re-seals whatever you
 * wrote.
 *
 * It cannot be made into one here, and the reason is worth stating rather than papering over.
 * Closing it would mean committing the captured frame so a budget could recompute its own numbers,
 * and `scripts/tests/repository-policy.test.mjs` asserts that capture evidence is never tracked. So the
 * honest boundary is: the seal plus `source.digest` catch an edited measurement and a stale one.
 * Neither catches someone who captures legitimately, edits the number, and re-seals. If that
 * matters, the fix is a trusted capture step, not a longer hash.
 */
export function sealMetrics(sidecar) {
  const { seal, capturedAt, ...measured } = sidecar;
  return createHash('sha256').update(JSON.stringify(measured)).digest('hex').slice(0, 16);
}

/**
 * Invoke the CLI directly rather than through `npm run antiky`.
 *
 * npm echoes the resolved command line before running it, and a tool call carries its input as a
 * JSON argument. That echo lands on stdout ahead of the response and contains braces, so a reader
 * that scans for the first `{` parses the *input* it just sent. Skipping the npm wrapper removes
 * the ambiguity rather than trying to out-parse it.
 */
function runAntikyTool(name, input, manifest) {
  return new Promise((resolve, reject) => {
    const args = [
      '--experimental-strip-types',
      '--experimental-transform-types',
      'packages/cli/src/bin.ts',
      'tool',
      name,
    ];
    if (input !== undefined) args.push(JSON.stringify(input));
    args.push('--project', manifest);
    const child = spawn(process.execPath, args, { cwd: repositoryRoot });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', () => {
      const start = stdout.indexOf('{');
      if (start < 0) {
        reject(new Error(`${name} produced no JSON. stderr: ${stderr.trim().slice(0, 400)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.slice(start)));
      } catch (cause) {
        reject(new Error(`${name} produced unparsable JSON: ${cause.message}`));
      }
    });
  });
}

async function waitForGameServer(url, timeoutMilliseconds = 120_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The dev server is not listening yet.
    }
    await delay(500);
  }
  throw new Error(`The dev server at ${url} did not start within ${timeoutMilliseconds}ms.`);
}

async function captureWithFence({
  manifest,
  warmUpFrames,
  idempotencyKey,
  sessionStatus,
  fixture: captureFixture,
}) {
  for (let attempt = 1; attempt <= MAX_FENCE_ATTEMPTS; attempt += 1) {
    const build = await runAntikyTool('get_latest_build', undefined, manifest);
    const runtime = await runAntikyTool('get_runtime_status', undefined, manifest);
    const capabilities = await runAntikyTool('get_capture_capabilities', undefined, manifest);
    if (capabilities.error !== undefined) {
      throw new Error(
        `get_capture_capabilities failed: ${capabilities.error.code} — ${capabilities.error.message}`,
      );
    }
    // The status is one of 'unknown-until-launch', 'available' or 'unavailable'. Before a managed
    // browser has ever started in this session it is 'unknown-until-launch', which is the normal
    // state for a first capture and must not be treated as a failure. Only a decided 'unavailable'
    // is worth stopping for, because the capture cannot succeed.
    if (capabilities.webGpu?.status === 'unavailable') {
      throw new Error(
        `WebGPU is unavailable for capture: ${capabilities.webGpu.unavailableReason ?? 'no reason given'}`,
      );
    }
    if (capabilities.managedRuntime?.available === false) {
      throw new Error(
        `The managed capture runtime is unavailable: ${capabilities.managedRuntime.unavailableReason ?? 'no reason given'}`,
      );
    }
    const input = buildCaptureInput({
      build,
      runtime,
      capabilities,
      warmUpFrames,
      idempotencyKey: `${idempotencyKey}-${attempt}`,
      sessionStatus,
      fixture: captureFixture,
    });
    const result = await runAntikyTool('capture_frame', input, manifest);
    if (result.error === undefined) return { result, build };
    if (!RETRYABLE_CAPTURE_CODES.has(result.error.code) || attempt === MAX_FENCE_ATTEMPTS) {
      throw new Error(`capture_frame failed: ${result.error.code} — ${result.error.message}`);
    }
    // The managed browser attaching is itself what advances the build revision, so a first
    // call built from a cold read reliably loses this race once.
  }
  throw new Error('capture_frame did not settle within the retry budget.');
}

async function shootDemo(slug, { warmUpFrames, runs, keep, evidence }) {
  const { manifest, directory } = resolveDemo(slug);
  const demoDirectory = path.join(repositoryRoot, directory);
  const server = spawn(process.execPath, [
    '--experimental-strip-types',
    '--experimental-transform-types',
    'packages/cli/src/bin.ts',
    'dev',
    '--project',
    manifest,
  ], {
    cwd: repositoryRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: process.platform !== 'win32',
  });
  let serverStderr = '';
  server.stderr.on('data', (chunk) => { serverStderr += chunk; });

  try {
    await waitForGameServer('http://127.0.0.1:3010/');
    await delay(2_000);

    // The first capture establishes the managed runtime. Only after it exists can the shared
    // pause/step authority produce a session identity for deterministic evidence.
    await captureWithFence({
      manifest,
      warmUpFrames: 0,
      idempotencyKey: `shoot-${slug}-bootstrap`,
      fixture: CAPTURE_FIXTURES[slug].baseline,
    });
    const sessionStatus = await pauseAndAdvanceToStep({ manifest });

    let sidecar;
    const observations = [];
    const capturePaths = [];
    for (let run = 1; run <= runs; run += 1) {
      const { result, build } = await captureWithFence({
        manifest,
        warmUpFrames,
        idempotencyKey: `shoot-${slug}-run-${run}`,
        sessionStatus,
        fixture: CAPTURE_FIXTURES[slug].baseline,
      });
      const pngPath = evidencePngPath({
        demoDirectory,
        developmentSessionId: build.developmentSessionId,
        evidenceId: result.artifact.evidenceId,
        artifactId: result.artifact.artifactId,
      });
      if (!existsSync(pngPath)) {
        throw new Error(`The capture reported success but no artifact exists at ${pngPath}.`);
      }
      if (await isUniformFrame(pngPath)) {
        throw new Error('The captured frame is a single flat colour, which means nothing rendered.');
      }
      observations.push(result.observation);
      capturePaths.push(pngPath);
      // Evidence is session-scoped and the store clears it on teardown, so a frame nobody copies
      // out cannot be looked at afterwards. `--keep` writes it somewhere durable, which is what
      // makes "the frames were actually looked at" a thing a person can do rather than a claim.
      // Deliberately opt-in and deliberately outside the repository by convention: `.antiky/` is
      // gitignored and `*.png` is LFS here, so captures are not committed.
      if (keep !== undefined) {
        await mkdir(keep, { recursive: true });
        await copyFile(pngPath, path.join(keep, `${slug}-run-${run}.png`));
      }
      const stats = await readFrameStats(pngPath, { probes: DEMO_PROBES[slug] ?? {} });
      sidecar = buildMetricsSidecar({
        slug,
        stats,
        capturedAt: result.artifact.createdAt,
        warmUpFrames,
        source: await sourceDigest(directory),
        inspection: {
          observation: result.observation,
          fixture: result.fixture,
        },
      });
      process.stdout.write(
        `  run ${run}/${runs}: p95 ${sidecar.luminance.p95.toFixed(3)}`
        + ` localContrast ${sidecar.localContrast.median.toFixed(2)}`
        + ` sat ${sidecar.saturation.mean.toFixed(3)}\n`,
      );
    }

    if (observations.length > 1) {
      const identity = comparableCaptureIdentity(observations[0]);
      const canonical = JSON.stringify(identity);
      if (observations.some((entry) => JSON.stringify(comparableCaptureIdentity(entry)) !== canonical)) {
        throw new Error('Repeated captures did not preserve one build, runtime, session, step, and digest.');
      }
      sidecar = {
        ...sidecar,
        inspection: {
          ...sidecar.inspection,
          comparableIdentity: identity,
          repeatability: await measurePixelDrift(capturePaths[0], capturePaths[1]),
        },
      };
      sidecar = { ...sidecar, seal: sealMetrics(sidecar) };
    }

    if (evidence) {
      const identity = comparableCaptureIdentity(observations[0]);
      const criteria = {};
      for (const declaration of CAPTURE_PAIRS[slug]) {
        const take = async (role, captureFixture) => {
          const { result, build } = await captureWithFence({
            manifest,
            warmUpFrames: 2,
            idempotencyKey: `shoot-${slug}-${declaration.name}-${role}`,
            sessionStatus,
            fixture: captureFixture,
          });
          if (
            JSON.stringify(comparableCaptureIdentity(result.observation))
            !== JSON.stringify(identity)
          ) throw new Error(`${declaration.name} moved the authoritative capture identity.`);
          const pngPath = evidencePngPath({
            demoDirectory,
            developmentSessionId: build.developmentSessionId,
            evidenceId: result.artifact.evidenceId,
            artifactId: result.artifact.artifactId,
          });
          if (!existsSync(pngPath) || await isUniformFrame(pngPath)) {
            throw new Error(`${declaration.name} ${role} did not produce a rendered frame.`);
          }
          if (keep !== undefined) {
            await mkdir(keep, { recursive: true });
            await copyFile(pngPath, path.join(keep, `${slug}-${declaration.name}-${role}.png`));
          }
          return { result, pngPath };
        };
        const control = await take('control', CAPTURE_FIXTURES[slug].baseline);
        const treatment = await take('treatment', declaration.treatment);
        const measurement = await measureControlPair(
          control.pngPath,
          treatment.pngPath,
          declaration,
        );
        criteria[declaration.name] = {
          kind: declaration.kind,
          region: declaration.roi,
          outcome: evaluateControlPair(declaration.kind, measurement),
          measurement,
          artifacts: {
            control: {
              artifactId: control.result.artifact.artifactId,
              sha256: control.result.artifact.sha256,
            },
            treatment: {
              artifactId: treatment.result.artifact.artifactId,
              sha256: treatment.result.artifact.sha256,
            },
          },
          fixtures: {
            control: control.result.fixture,
            treatment: treatment.result.fixture,
          },
        };
        process.stdout.write(`  ${declaration.name}: measured ${declaration.roi.width}x${declaration.roi.height}\n`);
      }
      const renderStats = await runAntikyTool('get_render_stats', undefined, manifest);
      const framesPerSecond = renderStats.runtime?.framesPerSecond ?? null;
      sidecar = {
        ...sidecar,
        inspection: {
          ...sidecar.inspection,
          criteria,
          frameTime: framesPerSecond === null || framesPerSecond <= 0 ? {
            supported: false,
            limitation: 'The Framework runtime did not publish a positive frame-rate sample.',
          } : {
            supported: 'upper-bound-only',
            framesPerSecond,
            frameTimeUpperBoundMilliseconds: Number((1000 / framesPerSecond).toFixed(6)),
            limitation: 'The runtime sample is capped by display refresh and cannot resolve GPU cost below one refresh interval.',
          },
        },
      };
      sidecar = { ...sidecar, seal: sealMetrics(sidecar) };
    }

    const sidecarPath = path.join(demoDirectory, 'visual-metrics.json');
    await mkdir(path.dirname(sidecarPath), { recursive: true });
    await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
    return { slug, ok: true, sidecarPath };
  } catch (cause) {
    const diagnostic = serverStderr.trim().slice(-600);
    return {
      slug,
      ok: false,
      reason: `${cause.message}${diagnostic === '' ? '' : ` Server: ${diagnostic}`}`,
    };
  } finally {
    try {
      if (server.pid && process.platform !== 'win32') process.kill(-server.pid, 'SIGINT');
      else server.kill('SIGINT');
    } catch (cause) {
      if (cause.code !== 'ESRCH') throw cause;
    }
    // The dev server owns 3010 and 3011. The next demo cannot bind them until it exits.
    await delay(3_000);
  }
}

function parseArguments(argv) {
  const options = { demo: undefined, runs: 2, warmUpFrames: 60, keep: undefined, evidence: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--demo') options.demo = argv[index += 1];
    else if (argument === '--runs') options.runs = Number(argv[index += 1]);
    else if (argument === '--warm-up') options.warmUpFrames = Number(argv[index += 1]);
    else if (argument === '--keep') options.keep = argv[index += 1];
    else if (argument === '--evidence') options.evidence = true;
    else throw new Error(`Unknown argument "${argument}".`);
  }
  if (!Number.isSafeInteger(options.runs) || options.runs < 1) {
    throw new Error('--runs must be a positive integer.');
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const slugs = options.demo === undefined ? Object.keys(DEMOS) : [resolveDemo(options.demo).slug];
  const results = [];

  for (const slug of slugs) {
    process.stdout.write(`${slug}\n`);
    const result = await shootDemo(slug, options);
    results.push(result);
    if (!result.ok) process.stdout.write(`  FAILED: ${result.reason}\n`);
  }

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length} demo(s) failed to capture:\n`);
    for (const failure of failures) process.stderr.write(`  ${failure.slug}: ${failure.reason}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\nCaptured ${results.length} demo(s).\n`);
}

if (process.argv[1] === import.meta.filename) await main();
