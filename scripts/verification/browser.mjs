import assert from 'node:assert/strict';
import { chmod, constants, copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

export function parseWorkingTreePaths(status) {
  return status.split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1));
}

export async function capturePageAtViewport(cdp, width, height) {
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  return screenshot.data;
}

export function createChromeArguments({
  profile,
  gameUrl,
  debugPort = 9322,
  viewport = { width: 756, height: 469 },
}) {
  return [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-quic',
    '--disable-gpu-sandbox',
    '--enable-unsafe-webgpu',
    '--use-angle=metal',
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=127.0.0.1',
    '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    `--window-size=${viewport.width},${viewport.height}`,
    gameUrl,
  ];
}

export function assertChromeNetworkIsolation(log) {
  assert.doesNotMatch(
    log,
    /Registration response/i,
    'Chrome received an external endpoint response during isolated verification',
  );
}

export async function copyTreeExclusive(source, destination) {
  for (const entry of await readdir(source, { withFileTypes: true }).catch(() => [])) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true, mode: 0o700 });
      await copyTreeExclusive(from, to);
    } else if (entry.isFile()) {
      await copyFile(from, to, constants.COPYFILE_EXCL);
      await chmod(to, 0o600);
    }
  }
}

export async function assertCaptureHasContent(file) {
  const metadata = await sharp(file).metadata();
  const statistics = await sharp(file).stats();
  const channelStandardDeviation = Math.max(
    ...statistics.channels.slice(0, 3).map((channel) => channel.stdev),
  );
  assert.ok(metadata.width > 0 && metadata.height > 0, 'capture dimensions must be positive');
  assert.ok(
    channelStandardDeviation >= 8,
    `capture is visually blank (${channelStandardDeviation.toFixed(3)} channel deviation)`,
  );
  return { width: metadata.width, height: metadata.height, channelStandardDeviation };
}

export async function comparePageCaptures(referenceFile, resultFile) {
  const pixels = async (file) => sharp(file)
    .removeAlpha()
    .resize(96, 60, { fit: 'fill' })
    .raw()
    .toBuffer();
  const [reference, result] = await Promise.all([pixels(referenceFile), pixels(resultFile)]);
  assert.equal(result.length, reference.length, 'page capture sample sizes differ');
  let difference = 0;
  for (let index = 0; index < reference.length; index += 1) {
    difference += Math.abs(reference[index] - result[index]);
  }
  return { similarity: Number((1 - difference / (reference.length * 255)).toFixed(6)) };
}
