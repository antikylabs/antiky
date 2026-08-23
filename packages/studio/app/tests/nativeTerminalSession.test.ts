import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  createNativeTerminalSession,
  type NativeTerminalStatus,
  type TerminalBounds,
} from '../src/nativeTerminalSession.ts';

const bounds: TerminalBounds = Object.freeze({
  x: 20,
  y: 80,
  width: 640,
  height: 320,
});

function terminalFixture(initial: Partial<NativeTerminalStatus> = {}) {
  const commands: Array<{ command: string; arguments_: unknown }> = [];
  let status: NativeTerminalStatus = {
    isOpen: false,
    processExited: false,
    rendererHealthy: true,
    columns: 80,
    rows: 24,
    widthPx: 640,
    heightPx: 320,
    ...initial,
  };
  const invoke = async <T>(command: string, arguments_?: unknown): Promise<T> => {
    commands.push({ command, arguments_ });
    if (command === 'terminal_status') return { ...status } as T;
    if (command === 'terminal_open') {
      status = {
        ...status,
        isOpen: true,
        processExited: false,
        rendererHealthy: true,
      };
    }
    if (command === 'terminal_close') {
      status = { ...status, isOpen: false, processExited: false };
    }
    return undefined as T;
  };

  return {
    commands,
    invoke,
    markProcessExited() {
      status = { ...status, isOpen: true, processExited: true };
    },
    markRendererUnhealthy() {
      status = { ...status, isOpen: true, rendererHealthy: false };
    },
  };
}

test('terminal synchronization opens a missing native surface and submits current geometry', async () => {
  const fixture = terminalFixture();
  const session = createNativeTerminalSession(fixture.invoke);

  const result = await session.synchronize(() => bounds, undefined);

  assert.deepEqual(fixture.commands, [
    { command: 'terminal_status', arguments_: undefined },
    { command: 'terminal_open', arguments_: { bounds } },
    { command: 'terminal_layout', arguments_: { bounds } },
  ]);
  assert.deepEqual(result, { bounds, ready: true });
});

test('an explicit close cannot leave a mounted terminal believing its surface is open', async () => {
  const fixture = terminalFixture();
  const session = createNativeTerminalSession(fixture.invoke);

  await session.synchronize(() => bounds, undefined);
  await session.close();
  await session.synchronize(() => bounds, bounds);

  assert.deepEqual(fixture.commands.map(({ command }) => command), [
    'terminal_status',
    'terminal_open',
    'terminal_layout',
    'terminal_close',
    'terminal_status',
    'terminal_open',
    'terminal_layout',
  ]);
});

test('an exited shell is closed and replaced before the terminal accepts more input', async () => {
  const fixture = terminalFixture({ isOpen: true });
  const session = createNativeTerminalSession(fixture.invoke);
  fixture.markProcessExited();

  await session.synchronize(() => bounds, bounds);

  assert.deepEqual(fixture.commands.map(({ command }) => command), [
    'terminal_status',
    'terminal_close',
    'terminal_open',
    'terminal_layout',
  ]);
});

test('an unhealthy renderer is replaced instead of leaving a dead native overlay', async () => {
  const fixture = terminalFixture({ isOpen: true });
  const session = createNativeTerminalSession(fixture.invoke);
  fixture.markRendererUnhealthy();

  await session.synchronize(() => bounds, bounds);

  assert.deepEqual(fixture.commands.map(({ command }) => command), [
    'terminal_status',
    'terminal_close',
    'terminal_open',
    'terminal_layout',
  ]);
});

test('hiding a live terminal removes the native overlay without closing its shell', async () => {
  const fixture = terminalFixture({ isOpen: true });
  const session = createNativeTerminalSession(fixture.invoke);

  const result = await session.synchronize(() => null, bounds);

  assert.deepEqual(fixture.commands, [
    { command: 'terminal_status', arguments_: undefined },
    { command: 'terminal_layout', arguments_: { bounds: null } },
  ]);
  assert.deepEqual(result, { bounds: null, ready: true });
});

test('a failed native operation does not poison later terminal commands', async () => {
  const fixture = terminalFixture();
  let failClose = true;
  const session = createNativeTerminalSession(async <T>(command: string, arguments_?: unknown) => {
    if (command === 'terminal_close' && failClose) {
      failClose = false;
      throw new Error('close failed');
    }
    return fixture.invoke<T>(command, arguments_);
  });

  await assert.rejects(session.close(), /close failed/);
  const result = await session.synchronize(() => bounds, undefined);

  assert.equal(result.ready, true);
  assert.deepEqual(fixture.commands.map(({ command }) => command), [
    'terminal_status',
    'terminal_open',
    'terminal_layout',
  ]);
});
