import assert from 'node:assert/strict';
import test from 'node:test';

import { createCombatCameraProjector } from '../src/presentation.ts';
import {
  dutyCycle,
  onsetShape,
  spectralConcentration,
  strongestRepeat,
} from '../../../../../scripts/motion-stats.mjs';

/**
 * The camera shake, measured rather than judged by eye.
 *
 * Named `.test.mjs` rather than `.test.ts` so the demo's own `tests/*.test.ts` glob does not pick
 * it up: `npm test` must stay green as a regression gate. Run it with `npm run demos:verify`.
 *
 * **These tests fail against the current camera, on purpose.** They encode the three defects the
 * owner reported as "shakes and judders a lot, it's too much", and goal 03 is what turns them
 * green. A test that passed today would be measuring nothing.
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
  const projector = createCombatCameraProjector();
  const player = { x: 0, z: 0, vx: 0, vz: 0, facingX: 0, facingZ: 1, dash: 0 };
  const enemies = [{ active: true, x: 3, z: 2, mark: 0, state: 'idle' }];
  const out = { positionX: [], positionZ: [], targetX: [], targetZ: [] };

  let impact = 0;
  for (let step = 0; step < SECONDS * HZ; step += 1) {
    const time = step * DT;
    impact = Math.max(0, impact - DT * IMPACT_DECAY_PER_SECOND);
    impact = impactAt(time, impact);
    const frame = projector.project(
      1.78,
      { time, impact, phase: 'combat', player, enemies },
      { x: 0.5, y: 0.5 },
    );
    out.positionX.push(frame.position[0]);
    out.positionZ.push(frame.position[2]);
    out.targetX.push(frame.target[0]);
    out.targetZ.push(frame.target[2]);
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

test('the frame translates rather than swivelling', () => {
  // Shake is added to the camera position but not to its look-at target, so the view rotates
  // instead of moving. A rotation sweeps the whole frame, including the far arena edges, which is
  // far more nauseating than a translation of the same size.
  const shaken = sustainedCannon();
  const positionRange = Math.max(...shaken.positionX) - Math.min(...shaken.positionX);
  const targetRange = Math.max(...shaken.targetX) - Math.min(...shaken.targetX);

  assert.ok(positionRange > 0, 'the camera should shake at all');
  assert.ok(
    targetRange >= positionRange * 0.5,
    `camera position moves ${positionRange.toFixed(4)} but the look-at target moves `
    + `${targetRange.toFixed(4)}. Offset both together so the frame translates, or apply a `
    + 'rotational shake — do not move one without the other.',
  );
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
