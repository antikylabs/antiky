import { execFile } from 'node:child_process';

import { AntikyCliError } from './errors.ts';

type GameLaunchExecutor = (file: string, args: readonly string[]) => Promise<void>;

export type GameLaunchOptions = Readonly<{
  platform?: NodeJS.Platform;
  execute?: GameLaunchExecutor;
}>;

function executeFile(file: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, [...args], { windowsHide: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function exactLoopbackGameUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AntikyCliError(
      'ANTIKY_GAME_LAUNCH_FAILED',
      'The Antiky game URL is invalid.',
    );
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port.length === 0
    || url.username.length > 0
    || url.password.length > 0
  ) {
    throw new AntikyCliError(
      'ANTIKY_GAME_LAUNCH_FAILED',
      'Antiky can open only the current loopback game URL.',
    );
  }
  return url.toString();
}

export async function launchGamePage(
  value: string,
  options: GameLaunchOptions = {},
): Promise<void> {
  const url = exactLoopbackGameUrl(value);
  const platform = options.platform ?? process.platform;
  const command = platform === 'darwin'
    ? { file: 'open', args: [url] }
    : platform === 'win32'
      ? { file: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '', url] }
      : platform === 'linux'
        ? { file: 'xdg-open', args: [url] }
        : null;
  if (!command) {
    throw new AntikyCliError(
      'ANTIKY_GAME_LAUNCH_FAILED',
      'Opening the game is unavailable on this platform.',
    );
  }
  try {
    await (options.execute ?? executeFile)(command.file, command.args);
  } catch (cause) {
    if (cause instanceof AntikyCliError) throw cause;
    throw new AntikyCliError(
      'ANTIKY_GAME_LAUNCH_FAILED',
      `The game could not be opened. Open ${url} manually.`,
    );
  }
}
