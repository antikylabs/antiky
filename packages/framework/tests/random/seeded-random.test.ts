import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createRandomStream, hash32, hashUnit } from '../../src/random/seeded-random.ts';

const golden = JSON.parse(
  readFileSync(new URL('../../src/random/seeded-random.golden.json', import.meta.url), 'utf8'),
) as { seed: number; draws: number[] };

test('the hash uses integer operations only', () => {
  // The point of this promotion. Five demos hashed with `fract(sin(a·k + b·k) · k)`, which is not
  // specified to be reproducible across engines and whose low bits are correlated. Reading the
  // source is the only way to assert the absence of a technique.
  const source = readFileSync(new URL('../../src/random/seeded-random.ts', import.meta.url), 'utf8');
  const code = source.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /Math\.sin|Math\.cos|Math\.tan/, 'no trigonometric hashing');
  assert.doesNotMatch(code, /Math\.random/, 'a seeded stream must not reach for the ambient generator');
  // `x - Math.floor(x)` is the fract idiom itself. Plain `Math.floor` is fine — `below()` uses it
  // to truncate a bound, which is integer arithmetic, not hashing.
  assert.doesNotMatch(code, /(\w+)\s*-\s*Math\.floor\(\s*\1\s*\)/, 'no fract-style float hashing');
  assert.match(code, /Math\.imul/, 'the hash is built from integer multiplication');
});

test('a fixed seed reproduces its committed sequence exactly', () => {
  const stream = createRandomStream(golden.seed);
  for (let index = 0; index < golden.draws.length; index += 1) {
    assert.equal(
      stream.unit(),
      golden.draws[index]! / 4_294_967_296,
      `draw ${index + 1} of ${golden.draws.length} diverged from the committed sequence`,
    );
  }
});

test('a fork depends on its label alone, not on when it was made or drawn from', () => {
  const reference = createRandomStream(7).fork(1);
  const expected = [reference.unit(), reference.unit(), reference.unit()];

  // The same fork, taken after a sibling was created *and* drawn from. If forking consumed parent
  // state, this sequence would shift and the run would stop replaying whenever setup was reordered.
  const parent = createRandomStream(7);
  const sibling = parent.fork(2);
  sibling.unit();
  sibling.unit();
  const later = parent.fork(1);

  assert.deepEqual([later.unit(), later.unit(), later.unit()], expected);
});

test('sibling forks do not share a sequence', () => {
  const parent = createRandomStream(7);
  const first = parent.fork(1);
  const second = parent.fork(2);
  assert.notEqual(first.unit(), second.unit());
});

test('100,000 draws land within one percent of uniform across ten buckets', () => {
  // The test the `sin` hash fails. Correlated low bits show up here as a lumpy histogram, and
  // nothing else in the repository would have caught it.
  const buckets = new Array<number>(10).fill(0);
  const stream = createRandomStream(20_260_814);
  const draws = 100_000;
  for (let index = 0; index < draws; index += 1) {
    const value = stream.unit();
    assert.ok(value >= 0 && value < 1, `draw ${index} left [0, 1)`);
    buckets[Math.min(9, Math.floor(value * 10))]! += 1;
  }

  const expected = draws / buckets.length;
  for (let index = 0; index < buckets.length; index += 1) {
    const deviation = Math.abs(buckets[index]! - expected) / expected;
    assert.ok(
      deviation <= 0.01,
      `bucket ${index} held ${buckets[index]}, ${(deviation * 100).toFixed(2)}% from ${expected}`,
    );
  }
});

test('the hash is stable, order-free in neither argument, and spread across its inputs', () => {
  assert.equal(hash32(1, 2), hash32(1, 2));
  assert.notEqual(hash32(1, 2), hash32(2, 1), 'the two arguments must not be interchangeable');
  assert.notEqual(hashUnit(0), hashUnit(1));
  // Adjacent inputs must not produce adjacent outputs — the specific failure of a smooth hash.
  assert.ok(Math.abs(hashUnit(1_000) - hashUnit(1_001)) > 0.01);
});

test('a bounded draw stays inside its bound and tolerates a meaningless one', () => {
  const stream = createRandomStream(11);
  for (let index = 0; index < 500; index += 1) {
    const value = stream.below(6);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 6, `below(6) produced ${value}`);
  }
  assert.equal(stream.below(0), 0);
  assert.equal(stream.below(-3), 0);
});
