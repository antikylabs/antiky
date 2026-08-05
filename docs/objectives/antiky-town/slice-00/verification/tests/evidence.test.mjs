import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  artifactFor,
  sealReceipt,
  validateArtifactDigests,
  validateReceipt,
  writeReceiptAtomic,
} from '../evidence.mjs';

const revision = 'a'.repeat(40);

function passingReceipt(runId, artifacts) {
  return {
    schemaVersion: 1,
    sliceId: 'slice-00',
    runId,
    runState: 'CLOSED',
    result: 'PASS',
    sourceRevision: revision,
    finalRevision: revision,
    checkpoints: Array.from({ length: 6 }, (_, index) => ({
      id: `CP-0${index}`,
      commit: revision,
      status: 'PASS',
    })),
    runSetup: { worktree: '/tmp/antiky', ports: [3010, 3011, 9322] },
    attempts: [{ id: 'attempt-001', result: 'PASS', failureClass: null }],
    permissions: [{ operation: 'repository writes', scope: 'Slice 00 files' }],
    acceptance: [{ id: 'AC-01', status: 'PASS', evidence: 'fixture' }],
    rubric: [{ dimension: 'Outcome and scope', score: 3, evidence: 'fixture' }],
    completionChecks: [{ id: 'COMPLETE-01', status: 'PASS', evidence: 'fixture' }],
    goalAudit: { status: 'PASS', outcome: 'fixture' },
    afterCompletion: {
      owner: '@antiky/cli and @antiky/framework maintainers',
      health: 'npm run verify:slice-00',
      feedback: 'formal objective inboxes',
      rollback: 'tested corrective or revert commit',
      retirement: 'replace only through a tested versioned contract',
    },
    artifacts,
  };
}

test('a sealed Slice 00 receipt validates its own canonical digest and every artifact', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'antiky-evidence-'));
  await writeFile(path.join(outputDirectory, 'facts.json'), '{"ready":true}\n');
  await writeFile(path.join(outputDirectory, 'measurements.json'), '{"launchMilliseconds":5}\n');
  await writeFile(path.join(outputDirectory, 'confirmation-checks.md'), '# PASS\n');

  const artifacts = [
    {
      path: 'receipt.json',
      sha256: null,
      digestScope: 'canonical-json-with-null-self-digest',
    },
    await artifactFor(outputDirectory, 'facts.json'),
    await artifactFor(outputDirectory, 'measurements.json'),
    await artifactFor(outputDirectory, 'confirmation-checks.md'),
  ];
  const receipt = sealReceipt(passingReceipt('s00-20260804T185103Z', artifacts));

  assert.deepEqual(validateReceipt(receipt), []);
  await writeReceiptAtomic(path.join(outputDirectory, 'receipt.json'), receipt);
  assert.deepEqual(await validateArtifactDigests(receipt, outputDirectory), []);
  assert.equal((await stat(path.join(outputDirectory, 'receipt.json'))).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(path.join(outputDirectory, 'receipt.json'))).result, 'PASS');
});

test('receipt validation rejects incomplete gates, unresolved failures, and secret fields', () => {
  const receipt = sealReceipt(passingReceipt('s00-20260804T185103Z', [{
    path: 'receipt.json',
    sha256: null,
    digestScope: 'canonical-json-with-null-self-digest',
  }]));
  receipt.checkpoints.pop();
  receipt.attempts.push({ id: 'attempt-002', result: 'FAIL', failureClass: null });
  receipt.sessionCredential = 'must-not-appear';

  const errors = validateReceipt(receipt);
  assert.ok(errors.some((error) => error.includes('CP-05')));
  assert.ok(errors.some((error) => error.includes('failure class')));
  assert.ok(errors.some((error) => error.includes('secret-bearing key')));
});

test('artifact validation detects a file changed after the receipt was sealed', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'antiky-evidence-'));
  await writeFile(path.join(outputDirectory, 'facts.json'), '{"ready":true}\n');
  await writeFile(path.join(outputDirectory, 'measurements.json'), '{}\n');
  await writeFile(path.join(outputDirectory, 'confirmation-checks.md'), '# PASS\n');
  const receipt = sealReceipt(passingReceipt('s00-20260804T185103Z', [
    {
      path: 'receipt.json',
      sha256: null,
      digestScope: 'canonical-json-with-null-self-digest',
    },
    await artifactFor(outputDirectory, 'facts.json'),
    await artifactFor(outputDirectory, 'measurements.json'),
    await artifactFor(outputDirectory, 'confirmation-checks.md'),
  ]));
  await writeReceiptAtomic(path.join(outputDirectory, 'receipt.json'), receipt);
  await writeFile(path.join(outputDirectory, 'facts.json'), '{"ready":false}\n');

  const errors = await validateArtifactDigests(receipt, outputDirectory);
  assert.ok(errors.some((error) => error.includes('facts.json')));
});
