import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

function runPortRelease(port) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawnSync(npmCommand, ['run', 'portRelease', '--', port], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    encoding: 'utf8',
  });
}

async function startListeningChild({ ignoreTermination = false } = {}) {
  const terminationHandler = ignoreTermination ? "process.on('SIGTERM', () => {});" : '';
  const source = `
    const net = require('node:net');
    const server = net.createServer();
    ${terminationHandler}
    server.listen(0, '127.0.0.1', () => console.log(server.address().port));
  `;
  const child = spawn(process.execPath, ['-e', source], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const [output] = await once(child.stdout, 'data');
  return { child, port: Number(output.toString().trim()) };
}

test('rejects a value that is not a TCP port', () => {
  const result = runPortRelease('not-a-port');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Expected one TCP port from 1 to 65535/);
  assert.match(result.stderr, /npm run portRelease -- <port>/);
});

test('stops the process listening on the requested port', async (context) => {
  const { child, port } = await startListeningChild();
  context.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });

  const result = runPortRelease(String(port));
  if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Port ${port} is in use by PID ${child.pid}`));
  assert.match(result.stdout, new RegExp(`Released port ${port}`));

  const repeatedResult = runPortRelease(String(port));
  assert.equal(repeatedResult.status, 0, repeatedResult.stderr);
  assert.match(repeatedResult.stdout, new RegExp(`Port ${port} is already available`));
});

test('force stops the same listener when it ignores graceful termination', async (context) => {
  const { child, port } = await startListeningChild({ ignoreTermination: true });
  context.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });

  const result = runPortRelease(String(port));
  if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`PID ${child.pid} did not stop`));
  assert.match(result.stdout, /Force stopping it/);
  assert.match(result.stdout, new RegExp(`Released port ${port}`));
  assert.equal(child.signalCode, 'SIGKILL');
});
