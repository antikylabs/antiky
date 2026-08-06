import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const gracefulStopMilliseconds = 1_200;
const forcedStopMilliseconds = 600;
const pollMilliseconds = 75;

function usage() {
  return `Expected one TCP port from 1 to 65535.

Usage:
  npm run portRelease -- <port>`;
}

function requestedPort() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  if (args.length !== 1 || !/^\d+$/.test(args[0])) throw new Error(usage());

  const port = Number(args[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(usage());
  return port;
}

async function listeningPids(port) {
  try {
    const { stdout } = await execFileAsync('lsof', [
      '-nP',
      '-t',
      `-iTCP:${port}`,
      '-sTCP:LISTEN',
    ]);
    const pids = stdout.split(/\s+/).filter((value) => /^\d+$/.test(value)).map(Number);
    return [...new Set(pids)];
  } catch (error) {
    if (error.code === 1) return [];
    if (error.code === 'ENOENT') {
      throw new Error(
        '[PORT_RELEASE_DEPENDENCY_MISSING] This command requires lsof. macOS includes it; on Linux install your distribution\'s lsof package.',
      );
    }

    const detail = error.stderr?.trim() || error.message;
    throw new Error(`[PORT_RELEASE_LOOKUP_FAILED] Unable to inspect port ${port}: ${detail}`);
  }
}

function describePids(pids) {
  return `${pids.length === 1 ? 'PID' : 'PIDs'} ${pids.join(', ')}`;
}

function processPronoun(pids) {
  return pids.length === 1 ? 'it' : 'them';
}

function signalPids(pids, signal) {
  const failures = [];
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') failures.push(`${pid}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`[PORT_RELEASE_FAILED] Unable to stop ${failures.join('; ')}`);
  }
}

async function waitForAvailablePort(port, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  let pids = await listeningPids(port);
  while (pids.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMilliseconds));
    pids = await listeningPids(port);
  }
  return pids;
}

async function releasePort(port) {
  const originalPids = await listeningPids(port);
  if (originalPids.length === 0) {
    console.log(`Port ${port} is already available.`);
    return;
  }

  console.log(
    `Port ${port} is in use by ${describePids(originalPids)}. Stopping ${processPronoun(originalPids)}...`,
  );
  signalPids(originalPids, 'SIGTERM');

  let remainingPids = await waitForAvailablePort(port, gracefulStopMilliseconds);
  if (remainingPids.length > 0) {
    const originalPidSet = new Set(originalPids);
    const stubbornPids = remainingPids.filter((pid) => originalPidSet.has(pid));
    if (stubbornPids.length > 0) {
      console.log(
        `${describePids(stubbornPids)} did not stop. Force stopping ${processPronoun(stubbornPids)}...`,
      );
      signalPids(stubbornPids, 'SIGKILL');
      remainingPids = await waitForAvailablePort(port, forcedStopMilliseconds);
    }
  }

  if (remainingPids.length > 0) {
    throw new Error(
      `[PORT_RELEASE_FAILED] Port ${port} is still in use by ${describePids(remainingPids)}. A process supervisor may have restarted it.`,
    );
  }

  console.log(`Released port ${port}.`);
}

try {
  await releasePort(requestedPort());
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
