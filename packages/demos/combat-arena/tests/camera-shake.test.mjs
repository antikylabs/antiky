import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REACTIVE_CAMERA_STRENGTH,
  createCombatCameraProjector,
  shakeOffset,
} from '../src/presentation.ts';
import {
  dutyCycle,
  onsetShape,
  spectralConcentration,
  strongestRepeat,
} from '../../../../scripts/motion-stats.mjs';

/**
 * The camera shake, measured rather than judged by eye.
 *
 * Named `.test.mjs` rather than `.test.ts` so the demo's own `tests/*.test.ts` glob does not pick
 * it up: `npm test` must stay green as a regression gate. Run it with `npm run demos:verify`.
 *
 * **The shipped camera no longer moves reactively at all.** After three reports ending in motion
 * sickness, `REACTIVE_CAMERA_STRENGTH` is zero: no shake, no velocity lead, no aim swing, no threat
 * lurch, no dash drop. The first test below is that contract.
 *
 * The shake tests that follow drive `shakeOffset` **directly** rather than through the projector.
 * That is deliberate and load-bearing: the projector scales the shake to zero, so a test driving it
 * through the projector would pass no matter how badly the shake were written. Four of these tests
 * did exactly that for one commit, and passing meant nothing. They are kept because the shake is
 * still there behind a constant, and whoever turns it back up deserves to inherit a correct one.
 *
 * No browser, no GPU, no capture: every visible camera value is a pure function of the simulation
 * snapshot and `state.time`, so the whole camera path is computable by driving the projector
 * directly. That is the point of measuring motion from the simulation rather than from video.
 */

const HZ = 60;
const DT = 1 / HZ;
const SECONDS = 10;

/** Cannon cadence and impact values, from `src/simulation.ts`. */
const CANNON_PERIOD_SECONDS = 0.34;
const CANNON_IMPACT = 0.45;
const HULL_LOSS_IMPACT = 1;
const IMPACT_DECAY_PER_SECOND = 4.2;

/**
 * Drive the real projector for a while and record where the camera went.
 *
 * `impactAt` decides what the simulation is doing at a given time, so one helper covers both the
 * sustained-cannon case and a single hull loss.
 */
function track(impactAt) {
  // Drives `shakeOffset` directly, not the projector. The projector multiplies the shake by
  // REACTIVE_CAMERA_STRENGTH, which ships at zero, so every assertion below would hold trivially
  // against a completely broken shake if this went through the camera.
  const out = { positionX: [], positionZ: [], targetX: [], targetZ: [] };

  let impact = 0;
  for (let step = 0; step < SECONDS * HZ; step += 1) {
    const time = step * DT;
    impact = Math.max(0, impact - DT * IMPACT_DECAY_PER_SECOND);
    impact = impactAt(time, impact);
    const [shakeX, shakeZ] = shakeOffset(time, impact);
    // The projector adds the same offset to position and target, so the frame translates rather
    // than swivelling. Mirrored here so the first test still measures that relationship.
    out.positionX.push(shakeX);
    out.positionZ.push(shakeZ);
    out.targetX.push(shakeX);
    out.targetZ.push(shakeZ);
  }
  return out;
}

/** The auto-cannon firing on its cadence, which is the demo's ordinary combat state. */
function sustainedCannon() {
  let sinceShot = Number.POSITIVE_INFINITY;
  return track((time, impact) => {
    sinceShot = time === 0 ? 0 : sinceShot + DT;
    if (sinceShot >= CANNON_PERIOD_SECONDS) {
      sinceShot = 0;
      return Math.max(impact, CANNON_IMPACT);
    }
    return impact;
  });
}

/** Relative to the camera's own resting position, which is what the viewer perceives as shake. */
function offsets(series) {
  const rest = series.reduce((total, value) => total + value, 0) / series.length;
  return series.map((value) => value - rest);
}

test('the frame translates rather than swivelling', async () => {
  // Shake applied to the camera position but not to its look-at target rotates the view instead of
  // moving it. A rotation sweeps the whole frame, including the far arena edges, which is far more
  // nauseating than a translation of the same size. That was the original defect.
  //
  // This is a source assertion, and it has to be. The earlier version compared `positionX` against
  // `targetX` from the `track()` harness — but that harness pushes the same `shakeOffset` value into
  // both arrays, so it asserted `x >= x / 2`, which is true for any x. Driving the real projector
  // instead would be just as empty today, because `REACTIVE_CAMERA_STRENGTH` is zero and both
  // offsets come out as 0.
  //
  // So what is actually worth holding is the structure: whoever turns shake back on must find it
  // wired into both, not one. The `presentation.test.ts` suite covers the zeroed runtime behaviour.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/presentation.ts', import.meta.url), 'utf8');

  for (const [axis, offset] of [[0, 'shakeX'], [2, 'shakeZ']]) {
    assert.match(
      source,
      new RegExp(`position\\[${axis}\\] = [^;]*\\b${offset}\\b`),
      `the shake's ${offset} must be added to position[${axis}]`,
    );
    assert.match(
      source,
      new RegExp(`target\\[${axis}\\] = [^;]*\\b${offset}\\b`),
      `the shake's ${offset} must be added to target[${axis}] as well as the position, or the frame `
      + 'swivels instead of translating',
    );
  }
});

test('the shake is not periodic', () => {
  // Two beating sine waves retriggered on a fixed cannon cadence give the eye something to latch
  // onto, and periodic motion reads as a malfunction rather than as an impact.
  const shaken = offsets(sustainedCannon().positionX);
  const repeat = strongestRepeat(shaken, HZ);

  assert.ok(
    repeat.correlation < 0.3,
    `the camera offset repeats itself every ${repeat.seconds.toFixed(3)}s with correlation `
    + `${repeat.correlation.toFixed(3)}. Drive the shake from noise rather than from summed sines, `
    + 'and stop retriggering it on a fixed cadence.',
  );
});

test('the shake is not a single tone', () => {
  // Currently PASSES: two beating frequencies plus the cannon retrigger spread the energy across
  // several bins, so concentration alone does not catch this defect — the periodicity test above
  // is what does. Kept as a guard against a future shake written as one pure sine.
  const shaken = offsets(sustainedCannon().positionX);
  assert.ok(
    spectralConcentration(shaken, HZ) < 0.5,
    'nearly all the shake energy sits in one frequency bin, which is what a hand-written sine '
    + 'produces. Noise spreads its energy.',
  );
});

test('a routine cannon hit is far weaker than losing hull', () => {
  // The cannon fires every 0.34s for the whole fight. If it shakes anywhere near as hard as taking
  // damage, the most frequent event in the game is also its most violent, and the shake stops
  // meaning anything.
  const cannonPeak = onsetShape(offsets(sustainedCannon().positionX)).peak;
  const hullPeak = onsetShape(
    offsets(track((time, impact) => (time === 0 ? HULL_LOSS_IMPACT : impact)).positionX),
  ).peak;

  assert.ok(
    cannonPeak <= hullPeak * 0.3,
    `a cannon hit peaks at ${cannonPeak.toFixed(4)} against ${hullPeak.toFixed(4)} for a hull loss `
    + `(${((cannonPeak / hullPeak) * 100).toFixed(0)}% of it). Scale shake by trauma squared and cut `
    + 'the cannon\'s contribution, or move its feedback to the hit VFX.',
  );
});

test('the camera is not shaking for most of the fight', () => {
  // Currently PASSES: impact decays to zero in ~0.107s against a 0.34s cadence, so the camera does
  // settle between shots. Kept so a fix that raises the shake cannot quietly make it ambient.
  // Screen shake works because it punctuates. Ambient shake is vibration.
  const shaken = offsets(sustainedCannon().positionX);
  const peak = Math.max(...shaken.map(Math.abs));
  assert.ok(
    dutyCycle(shaken, peak * 0.25) < 0.5,
    'the camera spends most of the fight displaced by more than a quarter of its peak shake. '
    + 'Let it settle between impacts.',
  );
});

/**
 * Reported by the owner after the shake rebuild: "it still shakes uncomfortably on a regular
 * interval (reacting to something in the game)."
 *
 * That is not the trauma shake — measured against the real simulation, the shake fires on 1.4% of
 * frames. It is the camera's *follow*, which had no smoothing at all. Every term was read straight
 * from the current snapshot, including `threatLead`, which tracks the highest-priority enemy and is
 * clamped to +/-0.82. When that enemy dies or another starts telegraphing, the priority flips and
 * the look-at target teleports by up to 1.64 units in a single frame.
 *
 * These tests drive the real simulation rather than a synthetic impact function, because the defect
 * only appears when enemies are actually dying and telegraphing.
 */

async function realCameraPath(seconds = 30) {
  const { createCombatSimulation } = await import('../src/simulation.ts');
  const simulation = createCombatSimulation(() => {});
  const view = simulation.view();
  const projector = createCombatCameraProjector();
  const step = (over = {}) => ({
    movement: { x: 0, z: 0, active: false }, aim: { x: 0, z: 1 }, attack: false, ...over,
  });
  while (view.phase !== 'combat') simulation.update(DT, step());

  const targetX = [];
  const positionX = [];
  for (let frame = 0; frame < seconds * HZ; frame += 1) {
    simulation.update(DT, step({
      attack: true,
      movement: { x: Math.sin(frame / 90), z: Math.cos(frame / 130), active: true },
    }));
    const camera = projector.project(1.78, view, { x: 0.5, y: 0.5 });
    targetX.push(camera.target[0]);
    positionX.push(camera.position[0]);
  }
  return { targetX, positionX };
}

/** A step this large at 60 Hz is 3 units per second of instantaneous travel: a snap, not motion. */
const SNAP_PER_FRAME = 0.05;

test('the camera never teleports when it changes which enemy it is watching', async () => {
  const { targetX } = await realCameraPath();
  const steps = [];
  for (let index = 1; index < targetX.length; index += 1) {
    steps.push(Math.abs(targetX[index] - targetX[index - 1]));
  }
  const worst = Math.max(...steps);
  const snaps = steps.filter((value) => value > SNAP_PER_FRAME).length;

  assert.ok(
    worst <= SNAP_PER_FRAME,
    `the look-at target jumps ${worst.toFixed(4)} in one frame (${(worst * HZ).toFixed(1)} units per `
    + `second), and ${snaps} of ${steps.length} frames jump more than ${SNAP_PER_FRAME}. Ease the `
    + 'camera towards its desired pose instead of assigning it, so a threat switch is a move rather '
    + 'than a cut.',
  );
});

test('easing the camera does not flatten it into a static shot', async () => {
  const { targetX, positionX } = await realCameraPath();
  // The opposite failure: smoothing hard enough to remove the snap can also remove the follow.
  // The camera must still travel with the fight.
  const spread = Math.max(...targetX) - Math.min(...targetX);
  assert.ok(spread > 0.5, `the look-at target only spans ${spread.toFixed(3)}; the camera stopped following`);
  assert.ok(Math.max(...positionX) - Math.min(...positionX) > 0.2, 'the camera position stopped moving');
});

/**
 * The contract the owner asked for, after three reports ending in "that jumping still makes me
 * nauseous, can we just turn that shit off".
 *
 * The camera may follow the player and obey the pointer. Nothing else may move it.
 */

test('the shipped camera does not move on its own', () => {
  assert.equal(
    REACTIVE_CAMERA_STRENGTH,
    0,
    'The owner turned reactive camera motion off because it made them motion sick. Raising this is '
    + 'their call, not a passing test\'s.',
  );
});

test('nothing but the player moves the camera', async () => {
  const { createCombatSimulation } = await import('../src/simulation.ts');
  const simulation = createCombatSimulation(() => {});
  const view = simulation.view();
  const projector = createCombatCameraProjector();
  const idle = { movement: { x: 0, z: 0, active: false }, aim: { x: 0, z: 1 }, attack: false };
  while (view.phase !== 'combat') simulation.update(DT, idle);

  // Holding fire without touching the movement stick. Enemies charge, telegraph, take hits and die
  // all around; the player is carried along the arena by the simulation itself.
  //
  // The camera's only permitted inputs are the player's position and the pointer, so its whole path
  // has to be predictable from `player.x`/`player.z` alone. Anything left over is the camera
  // reacting to the fight, which is what made the owner motion sick.
  const residualX = [];
  const residualZ = [];
  for (let frame = 0; frame < 30 * HZ; frame += 1) {
    simulation.update(DT, { ...idle, attack: true });
    // The terminal pose is a deliberate cut to an overview shot, not reactive motion.
    if (view.phase !== 'combat') break;
    const camera = projector.project(1.78, view, { x: 0.5, y: 0.5 });
    residualX.push(camera.target[0] - view.player.x * 0.12);
    residualZ.push(camera.target[2] - view.player.z * 0.1);
  }
  assert.ok(residualX.length > 5 * HZ, 'the fight ended too early to measure anything');

  const spreadX = Math.max(...residualX) - Math.min(...residualX);
  const spreadZ = Math.max(...residualZ) - Math.min(...residualZ);
  // Not exactly zero: the camera eases towards the player rather than snapping to them, so it lags
  // by a fraction of a unit while they are being pushed around. Nothing else may contribute.
  assert.ok(spreadX < 0.25, `${spreadX.toFixed(3)} of sideways camera motion is not explained by the player`);
  assert.ok(spreadZ < 0.25, `${spreadZ.toFixed(3)} of forward camera motion is not explained by the player`);
});

test('losing hull does not shake the shipped camera', async () => {
  const projector = createCombatCameraProjector();
  const player = { x: 0, z: 0, vx: 0, vz: 0, facingX: 0, facingZ: 1, dash: 0 };
  const enemies = [{ active: true, x: 3, z: 2, mark: 0, state: 'idle' }];
  const calm = projector.project(1.78, { time: 0, impact: 0, phase: 'combat', player, enemies }, { x: 0.5, y: 0.5 });
  const restingX = calm.position[0];

  // The worst impact in the game, at the moment it lands.
  let worst = 0;
  for (let frame = 1; frame < 60; frame += 1) {
    const shaken = projector.project(
      1.78,
      { time: frame * DT, impact: HULL_LOSS_IMPACT, phase: 'combat', player, enemies },
      { x: 0.5, y: 0.5 },
    );
    worst = Math.max(worst, Math.abs(shaken.position[0] - restingX));
  }
  assert.ok(worst < 1e-9, `a hull loss still moved the camera by ${worst.toFixed(6)}`);
});
