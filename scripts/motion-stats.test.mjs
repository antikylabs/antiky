import assert from 'node:assert/strict';
import test from 'node:test';

import {
  autocorrelation,
  crossCorrelation,
  deltas,
  dominantFrequency,
  dutyCycle,
  holds,
  onsetShape,
  sparkline,
  spectralConcentration,
  strongestRepeat,
} from './motion-stats.mjs';

/**
 * Every case is a synthetic signal whose answer is known analytically. The instrument is verified
 * independently of anything it will later measure. No GPU, no browser, no demo.
 */

const RATE = 60;

function sine(hz, seconds = 10, amplitude = 1) {
  const out = [];
  for (let index = 0; index < seconds * RATE; index += 1) {
    out.push(amplitude * Math.sin((2 * Math.PI * hz * index) / RATE));
  }
  return out;
}

/** Deterministic pseudo-noise, so a failure is reproducible. */
function noise(seconds = 10) {
  let state = 12345;
  const out = [];
  for (let index = 0; index < seconds * RATE; index += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    out.push((state / 0x7fffffff) * 2 - 1);
  }
  return out;
}

test('deltas returns per-step differences', () => {
  assert.deepEqual(deltas([1, 3, 6, 10]), [2, 3, 4]);
  assert.deepEqual(deltas([5]), []);
});

test('a pure tone reports its own frequency', () => {
  for (const hz of [2, 7.5, 12]) {
    const measured = dominantFrequency(sine(hz), RATE);
    assert.ok(Math.abs(measured - hz) < 0.2, `expected ~${hz} Hz, measured ${measured}`);
  }
});

test('a pure tone concentrates its energy, noise does not', () => {
  assert.ok(spectralConcentration(sine(7.5), RATE) > 0.8, 'a sine should be nearly one bin');
  assert.ok(spectralConcentration(noise(), RATE) < 0.1, 'noise should spread across bins');
});

test('autocorrelation finds the period of a repeating signal', () => {
  // A 5 Hz tone repeats every 0.2 s.
  const repeat = strongestRepeat(sine(5), RATE);
  assert.ok(Math.abs(repeat.seconds - 0.2) < 0.02, `period measured as ${repeat.seconds}s`);
  assert.ok(repeat.correlation > 0.9, `correlation was ${repeat.correlation}`);
});

test('noise has no repeat worth reporting', () => {
  // This is the property a good camera shake must have: nothing periodic to latch onto.
  assert.ok(strongestRepeat(noise(), RATE).correlation < 0.3);
});

test('autocorrelation at lag zero is always one', () => {
  assert.equal(autocorrelation(sine(3), 5)[0], 1);
});

test('a constant series has no deltas and one long hold', () => {
  const flat = new Array(120).fill(4);
  assert.deepEqual(deltas(flat).filter((value) => value !== 0), []);
  const runs = holds(flat);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].length, 120);
});

test('holds detect a frame-held series, which is what missing interpolation looks like', () => {
  // A 60 Hz simulation presented at 120 Hz: every value repeats once.
  const held = [];
  for (let index = 0; index < 60; index += 1) {
    held.push(index, index);
  }
  const runs = holds(held);
  assert.equal(runs.length, 60);
  assert.ok(runs.every((run) => run.length === 2));

  // Interpolated motion holds nothing.
  const smooth = [];
  for (let index = 0; index < 120; index += 1) smooth.push(index * 0.5);
  assert.deepEqual(holds(smooth), []);
});

test('onsetShape finds the peak and measures rise and decay', () => {
  // A decaying impulse: silent, then a spike, then an exponential fall.
  const series = new Array(10).fill(0);
  for (let index = 0; index < 50; index += 1) series.push(Math.exp(-index / 5));
  const shape = onsetShape(series);
  assert.equal(shape.peakIndex, 10);
  assert.equal(shape.peak, 1);
  assert.ok(shape.riseSamples <= 1, `rise was ${shape.riseSamples}`);
  // exp(-t/5) falls to 0.25 at t ≈ 6.9 samples.
  assert.ok(Math.abs(shape.quarterDecaySamples - 7) <= 1, `decay was ${shape.quarterDecaySamples}`);
});

test('crossCorrelation separates signals that move together from ones that do not', () => {
  const a = sine(3);
  assert.ok(crossCorrelation(a, a).atZero > 0.99, 'a signal correlates with itself');
  assert.ok(crossCorrelation(a, a.map((value) => -value)).atZero < -0.99, 'inverted anti-correlates');
  assert.ok(Math.abs(crossCorrelation(a, noise()).atZero) < 0.2, 'unrelated signals do not');
});

test('crossCorrelation finds a lag between two copies of the same signal', () => {
  const a = sine(2);
  const delayed = a.slice(9);
  const { best } = crossCorrelation(delayed, a, 20);
  assert.ok(Math.abs(best.lag - 9) <= 1, `lag measured as ${best.lag}`);
});

test('dutyCycle measures how much of the time a signal is active', () => {
  const half = [...new Array(50).fill(0), ...new Array(50).fill(1)];
  assert.equal(dutyCycle(half, 0.5), 0.5);
  assert.equal(dutyCycle(half, 2), 0);
});

test('sparkline renders without throwing and is never asserted on elsewhere', () => {
  assert.equal(typeof sparkline(sine(2)), 'string');
  assert.equal(sparkline([]), '');
  assert.equal(sparkline(new Array(10).fill(3)).length > 0, true);
});
