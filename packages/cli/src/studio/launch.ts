import { execFile } from 'node:child_process';

import { AntikyCliError } from '../errors.ts';

const STUDIO_BUNDLE_ID = 'dev.antiky.studio';

type StudioLaunchExecutor = (
  file: string,
  args: readonly string[],
) => Promise<void>;

export type StudioLaunchOptions = Readonly<{
  platform?: NodeJS.Platform;
  execute?: StudioLaunchExecutor;
}>;

function executeFile(file: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, [...args], { windowsHide: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function launchStudioProject(
  manifestPath: string,
  options: StudioLaunchOptions = {},
): Promise<void> {
  if ((options.platform ?? process.platform) !== 'darwin') {
    throw new AntikyCliError(
      'ANTIKY_STUDIO_UNAVAILABLE',
      'The Antiky Studio CLI launcher is available only on macOS.',
    );
  }

  try {
    await (options.execute ?? executeFile)(
      'open',
      ['-b', STUDIO_BUNDLE_ID, manifestPath],
    );
  } catch {
    throw new AntikyCliError(
      'ANTIKY_STUDIO_UNAVAILABLE',
      'Antiky Studio is not installed or could not be opened.',
    );
  }
}
