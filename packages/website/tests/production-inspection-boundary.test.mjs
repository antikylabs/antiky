import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoots = [
  new URL('../.next/server/', import.meta.url),
  new URL('../.next/static/', import.meta.url),
];
const forbiddenMarkers = [
  'NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN',
  '/v1/browser/bootstrap',
  '/v1/runtime/snapshot',
  '/v1/runtime/action',
  'Antiky inspection bootstrap',
];

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) files.push(...await filesBelow(new URL(`${entry.name}/`, directory)));
    else if (entry.isFile()) files.push(url);
  }
  return files;
}

test('production website output excludes the local inspection bridge and credential bootstrap', async () => {
  const files = (await Promise.all(outputRoots.map(filesBelow))).flat();
  assert.ok(files.length > 0, 'production output is missing');
  for (const file of files) {
    const source = await readFile(file);
    if (source.includes(0)) continue;
    const text = source.toString('utf8');
    for (const marker of forbiddenMarkers) {
      assert.doesNotMatch(text, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file.pathname} contains ${marker}`);
    }
  }
});
