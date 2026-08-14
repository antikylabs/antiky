import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

/**
 * `antiky-town` and `town-study` share source by copying it, and nothing checked they stayed equal.
 *
 * `character-motor.ts` is the reason this exists: 1,286 lines, the highest-quality code in the
 * repository, maintained in two packages with no test that the two copies agree. A bug fixed in one
 * would sit unfixed in the other, and the input-buffer promotion in this same goal is the proof that
 * this actually happens — a rising-edge fix landed in one demo and never reached the two beside it.
 *
 * This guard does not decide where the shared code should live. `town-study` is framework-free by
 * the fence at `dev-host.test.mjs:72,95`, so a shared home cannot be `@antiky/framework` unless the
 * owner moves that fence. Until that decision, this stops the copies drifting apart silently.
 *
 * It is deliberately a *set equality* check rather than a per-file assertion. If a file drifts it
 * leaves the set and the test fails; if a new file is copied it joins the set and the test fails.
 * Either way the manifest below has to be updated by hand, which is the point — both outcomes are
 * decisions somebody should make on purpose.
 */

const demosDirectory = new URL('../', import.meta.url);
const ANTIKY_TOWN = new URL('antiky/antiky-town/src/', demosDirectory);
const TOWN_STUDY = new URL('brometal/town-study/src/', demosDirectory);

/**
 * Every file the two packages currently hold byte-for-byte in common, relative to each `src/`.
 *
 * 4,889 lines. Adding to this list means accepting another copy; removing from it means the two
 * have deliberately diverged. Neither should happen by accident, which is why the list is written
 * out rather than discovered.
 */
const SHARED_SOURCES = Object.freeze([
  'town/art/sprite-batch.ts',
  'town/art/town-dynamic-props.ts',
  'town/art/town-foliage.ts',
  'town/art/town-validation.ts',
  'town/art/town-water-features.ts',
  'town/art/voxel-surface-mesh.ts',
  'town/physics/character-motor.test.ts',
  'town/physics/character-motor.ts',
  'town/physics/index.ts',
  'town/practical-light-input.test.ts',
  'town/practical-light-input.ts',
  'town/shaders/town-awning-shadow.shader.ts',
  'town/shaders/town-foliage-shadow.shader.ts',
  'town/shaders/town-prop-shadow.shader.ts',
  'town/shaders/town-shadow.shader.ts',
  'town/shaders/town-sprite-shadow.shader.ts',
]);

/** The file this guard was written for. Named so a careless manifest edit cannot quietly drop it. */
const LOAD_BEARING = 'town/physics/character-motor.ts';

async function relativeSources(root) {
  const found = [];
  const walk = async (directory, prefix) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const next = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) await walk(next, `${prefix}${entry.name}/`);
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.gen.ts')) {
        found.push(`${prefix}${entry.name}`);
      }
    }
  };
  await walk(root, '');
  return found;
}

async function digest(root, relative) {
  return createHash('md5').update(await readFile(new URL(relative, root))).digest('hex');
}

async function identicalPairs() {
  const townFiles = new Set(await relativeSources(TOWN_STUDY));
  const pairs = [];
  for (const relative of await relativeSources(ANTIKY_TOWN)) {
    if (!townFiles.has(relative)) continue;
    const [left, right] = await Promise.all([
      digest(ANTIKY_TOWN, relative),
      digest(TOWN_STUDY, relative),
    ]);
    if (left === right) pairs.push(relative);
  }
  return pairs.sort();
}

test('character-motor.ts is byte-identical in both town packages', async () => {
  assert.ok(
    SHARED_SOURCES.includes(LOAD_BEARING),
    `${LOAD_BEARING} was removed from SHARED_SOURCES. This guard exists for that file.`,
  );
  const [antiky, study] = await Promise.all([
    digest(ANTIKY_TOWN, LOAD_BEARING),
    digest(TOWN_STUDY, LOAD_BEARING),
  ]);
  assert.equal(
    antiky,
    study,
    `${LOAD_BEARING} has drifted between antiky-town (${antiky}) and town-study (${study}).\n`
    + 'It is one file maintained in two packages. Apply the change to both copies, or decide '
    + 'deliberately that they have diverged and update SHARED_SOURCES in this test.',
  );
});

test('the two town packages share exactly the sources the manifest claims', async () => {
  const actual = await identicalPairs();
  const expected = [...SHARED_SOURCES].sort();

  const drifted = expected.filter((relative) => !actual.includes(relative));
  const copied = actual.filter((relative) => !expected.includes(relative));

  assert.deepEqual(
    actual,
    expected,
    [
      drifted.length === 0 ? '' : (
        `These files were identical and no longer are:\n  ${drifted.join('\n  ')}\n`
        + 'A fix applied to one copy and not the other is the failure this guard exists to catch. '
        + 'Apply it to both, or drop the file from SHARED_SOURCES to record the divergence.'
      ),
      copied.length === 0 ? '' : (
        `These files became byte-identical and are not in the manifest:\n  ${copied.join('\n  ')}\n`
        + 'Another copy is another place a fix has to be remembered. Add it to SHARED_SOURCES if '
        + 'that is intended.'
      ),
    ].filter(Boolean).join('\n'),
  );
});
