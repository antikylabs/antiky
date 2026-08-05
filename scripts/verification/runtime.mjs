import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { finished } from 'node:stream/promises';

const MAX_CAPTURED_OUTPUT_BYTES = 8 * 1024 * 1024;

function appendBounded(current, chunk) {
  const combined = current + chunk;
  return combined.length <= MAX_CAPTURED_OUTPUT_BYTES
    ? combined
    : combined.slice(combined.length - MAX_CAPTURED_OUTPUT_BYTES);
}

async function createLog(file) {
  await mkdir(path.dirname(file), { recursive: true });
  return createWriteStream(file, { flags: 'wx', mode: 0o600 });
}

function childExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

export async function runLoggedCommand({
  command,
  args,
  cwd,
  env = process.env,
  logFile,
  echo = true,
}) {
  const log = await createLog(logFile);
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout = appendBounded(stdout, text);
    log.write(chunk);
    if (echo) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr = appendBounded(stderr, text);
    log.write(chunk);
    if (echo) process.stderr.write(chunk);
  });
  const exit = await childExit(child);
  log.end();
  await finished(log);
  return { ...exit, stdout, stderr };
}

export async function startLoggedProcess({
  command,
  args,
  cwd,
  env = process.env,
  logFile,
  echo = false,
}) {
  const log = await createLog(logFile);
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  const record = (target) => (chunk) => {
    output = appendBounded(output, chunk.toString());
    log.write(chunk);
    if (echo) target.write(chunk);
  };
  child.stdout.on('data', record(process.stdout));
  child.stderr.on('data', record(process.stderr));
  const exited = childExit(child);
  let logClosed = false;
  async function closeLog() {
    if (logClosed) return;
    logClosed = true;
    log.end();
    await finished(log);
  }
  exited.finally(() => closeLog()).catch(() => undefined);
  return { child, exited, closeLog, output: () => output };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitFor(probe, {
  timeoutMilliseconds,
  intervalMilliseconds = 100,
  label,
}) {
  const started = performance.now();
  let lastError;
  while (performance.now() - started < timeoutMilliseconds) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMilliseconds);
  }
  const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${label} after ${timeoutMilliseconds}ms.${suffix}`);
}

async function waitForExit(record, timeoutMilliseconds) {
  return Promise.race([
    record.exited.then((exit) => ({ exited: true, exit })),
    delay(timeoutMilliseconds).then(() => ({ exited: false })),
  ]);
}

export async function stopOwnedProcess(record) {
  if (!record) return null;
  let result = await waitForExit(record, 0);
  if (!result.exited) {
    record.child.kill('SIGINT');
    result = await waitForExit(record, 10_000);
  }
  if (!result.exited) {
    try {
      process.kill(-record.child.pid, 'SIGTERM');
    } catch {}
    result = await waitForExit(record, 5_000);
  }
  if (!result.exited) {
    try {
      process.kill(-record.child.pid, 'SIGKILL');
    } catch {}
    result = await waitForExit(record, 5_000);
  }
  await record.closeLog();
  if (!result.exited) throw new Error(`Process ${record.child.pid} did not stop.`);
  return result.exit;
}

export async function assertPortsAvailable(host, ports) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', (error) => reject(new Error(`Port ${host}:${port} is unavailable: ${error.message}`)));
      server.listen(port, host, () => server.close(resolve));
    });
  }
}

export class McpStdioClient {
  static async start({ command, args, cwd, transcriptFile, stderrFile }) {
    await mkdir(path.dirname(transcriptFile), { recursive: true });
    const transcript = createWriteStream(transcriptFile, { flags: 'wx', mode: 0o600 });
    const errorLog = createWriteStream(stderrFile, { flags: 'wx', mode: 0o600 });
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stderr.pipe(errorLog);
    const client = new McpStdioClient(child, transcript, errorLog);
    await client.request('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'antiky-verifier', version: '1' },
    });
    client.notify('notifications/initialized');
    return client;
  }

  constructor(child, transcript, errorLog) {
    this.child = child;
    this.transcript = transcript;
    this.errorLog = errorLog;
    this.nextId = 1;
    this.pending = new Map();
    this.exited = childExit(child);
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => {
      this.transcript.write(`< ${line}\n`);
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(`MCP ${message.error.code}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    this.exited.then((exit) => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`MCP process exited (${exit.code ?? exit.signal}).`));
      }
      this.pending.clear();
    }).catch((error) => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }

  request(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const request = { jsonrpc: '2.0', id, method, params };
    this.transcript.write(`> ${JSON.stringify(request)}\n`);
    this.child.stdin.write(`${JSON.stringify(request)}\n`);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}.`));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  notify(method, params = {}) {
    const request = { jsonrpc: '2.0', method, params };
    this.transcript.write(`> ${JSON.stringify(request)}\n`);
    this.child.stdin.write(`${JSON.stringify(request)}\n`);
  }

  async close() {
    this.child.stdin.end();
    let result = await Promise.race([
      this.exited.then((exit) => ({ exited: true, exit })),
      delay(3000).then(() => ({ exited: false })),
    ]);
    if (!result.exited) {
      this.child.kill('SIGTERM');
      result = { exited: true, exit: await this.exited };
    }
    this.transcript.end();
    await finished(this.transcript);
    await finished(this.errorLog);
    return result.exit;
  }
}

export class CdpClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Unable to open the Chrome DevTools socket.')), { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(`CDP ${message.error.code}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Chrome DevTools socket closed.'));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP request timed out: ${method}.`));
      }, 10_000);
      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  close() {
    this.socket.close();
  }
}

export async function waitForChromeTarget(port, expectedUrl) {
  return waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return null;
    const targets = await response.json();
    return targets.find((target) => target.type === 'page' && target.url === expectedUrl) ?? null;
  }, {
    timeoutMilliseconds: 30_000,
    intervalMilliseconds: 200,
    label: 'the Chrome town target',
  });
}

export async function createChromeProfile() {
  return mkdtemp(path.join(os.tmpdir(), 'antiky-s00-chrome-'));
}

export async function removeChromeProfile(profile) {
  const resolved = path.resolve(profile);
  const expectedParent = path.resolve(os.tmpdir());
  if (path.dirname(resolved) !== expectedParent || !path.basename(resolved).startsWith('antiky-s00-chrome-')) {
    throw new Error(`Refusing to remove unexpected Chrome profile: ${profile}`);
  }
  await rm(resolved, { recursive: true, force: true });
}
