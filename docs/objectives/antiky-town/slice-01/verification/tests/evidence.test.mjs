import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
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
    sliceId: 'slice-01',
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
    permissions: [{ operation: 'repository writes', scope: 'Slice 01 files' }],
    commands: [
      { role: 'change', commandId: '018f0f3a-7b2c-7a1d-8e2f-123456789ad0', code: 'ACCEPTED' },
      { role: 'correction', commandId: '018f0f3a-7b2c-7a1d-8e2f-123456789ad1', code: 'ACCEPTED' },
    ],
    projections: { authoring: 'PASS', runtime: 'PASS', render: 'PASS' },
    runtimes: { initial: 'runtime-a', reloaded: 'runtime-b' },
    captures: [
      { role: 'before', path: 'captures/before.png' },
      { role: 'changed', path: 'captures/changed.png' },
      { role: 'corrected', path: 'captures/corrected.png' },
    ],
    tests: [{ command: 'npm run check', status: 'PASS' }],
    acceptance: [{ id: 'AC-01', status: 'PASS', evidence: 'fixture' }],
    rubric: [{ dimension: 'Correctness', score: 3, evidence: 'fixture' }],
    completionChecks: [{ id: 'COMPLETE-01', status: 'PASS', evidence: 'fixture' }],
    goalAudit: { status: 'PASS', outcome: 'fixture' },
    afterCompletion: {
      owner: 'Framework and demo maintainers',
      health: 'npm run verify:slice-01',
      feedback: 'formal objective inboxes',
      rollback: 'tested corrective or revert commit',
      retirement: 'replace only through a tested versioned contract',
    },
    artifacts,
  };
}

test('a sealed Slice 01 receipt validates its own digest and required artifacts', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'antiky-s01-evidence-'));
  const required = {
    'baseline.json': '{}\n',
    'baseline.md': '# baseline\n',
    'captures/before.png': 'before',
    'captures/changed.png': 'changed',
    'captures/corrected.png': 'corrected',
    'facts.json': '{}\n',
    'measurements.json': '{}\n',
    'confirmation-checks.md': '# PASS\n',
  };
  for (const [file, content] of Object.entries(required)) {
    await mkdir(path.dirname(path.join(outputDirectory, file)), { recursive: true });
    await writeFile(path.join(outputDirectory, file), content);
  }
  const artifacts = [
    { path: 'receipt.json', sha256: null, digestScope: 'canonical-json-with-null-self-digest' },
    ...await Promise.all(Object.keys(required).map((file) => artifactFor(outputDirectory, file))),
  ];
  const receipt = sealReceipt(passingReceipt('s01-20260805T014602Z', artifacts));

  assert.deepEqual(validateReceipt(receipt), []);
  await writeReceiptAtomic(path.join(outputDirectory, 'receipt.json'), receipt);
  assert.deepEqual(await validateArtifactDigests(receipt, outputDirectory), []);
  assert.equal((await stat(path.join(outputDirectory, 'receipt.json'))).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(path.join(outputDirectory, 'receipt.json'))).result, 'PASS');
});

test('receipt validation rejects missing command/capture links and secret-bearing fields', () => {
  const receipt = sealReceipt(passingReceipt('s01-20260805T014602Z', [{
    path: 'receipt.json',
    sha256: null,
    digestScope: 'canonical-json-with-null-self-digest',
  }]));
  receipt.commands.pop();
  receipt.captures.pop();
  receipt.sessionToken = 'must-not-appear';

  const errors = validateReceipt(receipt);
  assert.ok(errors.some((error) => error.includes('correction')));
  assert.ok(errors.some((error) => error.includes('corrected')));
  assert.ok(errors.some((error) => error.includes('secret-bearing key')));
});
