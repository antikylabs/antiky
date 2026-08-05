import assert from 'node:assert/strict';
import test from 'node:test';

import { ID_KINDS, isUuidV7 } from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { runCli } from '../src/cli.ts';

function output() {
  const stdout: string[] = [];
  return {
    stdout,
    io: { stdout: (text: string) => stdout.push(text), stderr: () => {} },
  };
}

test('antiky generate id uses the framework generator for every supported kind', async () => {
  for (const kind of ID_KINDS) {
    const plain = output();
    assert.equal(await runCli(['generate', 'id', kind], plain.io), 0);
    assert.equal(plain.stdout.length, 1);
    assert.equal(isUuidV7(plain.stdout[0]?.trim()), true);

    const json = output();
    assert.equal(await runCli(['generate', 'id', kind, '--json'], json.io), 0);
    const value = JSON.parse(json.stdout[0]!) as { kind: string; id: string };
    assert.deepEqual(Object.keys(value), ['kind', 'id']);
    assert.equal(value.kind, kind);
    assert.equal(isUuidV7(value.id), true);
  }
});

test('antiky generate id rejects unknown kinds and options with usage', async () => {
  for (const args of [
    ['generate', 'id', 'player'],
    ['generate', 'id', 'world', '--yaml'],
    ['generate', 'world'],
  ]) {
    await assert.rejects(
      () => runCli(args),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_ARGUMENT_INVALID'
        && /antiky generate id/.test(error.message)
      ),
    );
  }
});

test('an unexpected CLI failure emits a safe diagnostic and a bounded public error', async () => {
  const diagnostics: unknown[] = [];

  await assert.rejects(
    () => runCli(['generate', 'id', 'world'], {
      stdout: () => { throw new Error('credential=must-not-leak'); },
      stderr: () => {},
    }, {
      diagnosticSink: (event: unknown) => diagnostics.push(event),
    }),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_INTERNAL_ERROR'
      && error.message === 'The Antiky CLI failed unexpectedly.'
      && !error.message.includes('must-not-leak')
    ),
  );
  assert.deepEqual(diagnostics, [{
    schemaVersion: 1,
    level: 'error',
    code: 'ANTIKY_CLI_FAILED',
    component: 'cli',
  }]);
});
