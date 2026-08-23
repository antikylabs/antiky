import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  commitTownSlotZeroPower,
  readTownSlotZeroPower,
  type TownSlotZeroPowerSource,
} from '../../src/town/practical-light-input.ts';

test('a valid slot-zero replacement commits only after its frame succeeds', () => {
  const calls: string[] = [];
  const source: TownSlotZeroPowerSource = {
    readPendingBasePower() {
      calls.push('read');
      return 2;
    },
    commitPendingBasePower(power) {
      calls.push(`commit:${power}`);
    },
  };

  const sample = readTownSlotZeroPower(source, 1.05);

  assert.deepEqual(sample, { basePower: 2, hasReplacement: true });
  assert.deepEqual(calls, ['read']);
  assert.equal(commitTownSlotZeroPower(source, sample), 2);
  assert.deepEqual(calls, ['read', 'commit:2']);
});

test('missing, invalid, and throwing replacements preserve the last valid power', () => {
  let commits = 0;
  assert.deepEqual(
    readTownSlotZeroPower(undefined, 1.05),
    { basePower: 1.05, hasReplacement: false },
  );
  const invalidSources: TownSlotZeroPowerSource[] = [
    {
      readPendingBasePower: () => undefined,
      commitPendingBasePower: () => { commits += 1; },
    },
    {
      readPendingBasePower: () => Number.NaN,
      commitPendingBasePower: () => { commits += 1; },
    },
    {
      readPendingBasePower: () => 4.01,
      commitPendingBasePower: () => { commits += 1; },
    },
    {
      readPendingBasePower() {
        throw new Error('adapter unavailable');
      },
      commitPendingBasePower: () => { commits += 1; },
    },
  ];

  for (const source of invalidSources) {
    const sample = readTownSlotZeroPower(source, 1.05);
    assert.deepEqual(sample, { basePower: 1.05, hasReplacement: false });
    assert.equal(commitTownSlotZeroPower(source, sample), 1.05);
  }
  assert.equal(commits, 0);
});

test('a commit failure keeps the rendered replacement as the next fallback', () => {
  const source: TownSlotZeroPowerSource = {
    readPendingBasePower: () => 2,
    commitPendingBasePower() {
      throw new Error('acknowledgement raced');
    },
  };
  const sample = readTownSlotZeroPower(source, 1.05);

  assert.equal(commitTownSlotZeroPower(source, sample), 2);
});
