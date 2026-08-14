import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import type {
  GameHostContext,
  GameInstance,
  GameMeasurements,
  GameModuleEntry,
  GamePointerInput,
} from './contract.ts';

/**
 * The hand-copied contracts, as they exist in the demos today.
 *
 * All five surviving copies are byte-identical. This is the shape a demo
 * currently declares for itself, and a real `GameModuleEntry` has to remain usable wherever one of
 * these is expected — otherwise the demos cannot ever stop copying.
 */
type StudioGameEntry = (context: Readonly<{
  canvas: HTMLCanvasElement;
  pointer: Readonly<{ x: number; y: number }>;
  report(measurements: Readonly<{
    instances?: number;
    drawCalls?: number;
    uploadBytesPerFrame?: number;
    note?: string;
  }>): void;
}>) => Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}> | Promise<Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}>>;

/**
 * The complete contract, as `town-study` declared it before that demo was retired.
 *
 * Kept because it is the shape a copy *should* have: the full seven-field pointer, `movement` and
 * `runtimeInstanceId`. The five surviving copies are all stuck on a two-field pointer, so none of
 * them can see `clicked`, `down`, `active`, `dragX`, `dragY`, `movement` or `mode`. This alias is
 * what they would grow into, and asserting against it keeps that target honest.
 */
type StudioGameEntryWithMode = (context: Readonly<{
  canvas: HTMLCanvasElement;
  runtimeInstanceId: string;
  pointer: Readonly<{
    x: number; y: number; down: boolean; active: boolean;
    dragX: number; dragY: number; clicked: boolean;
  }>;
  movement: Readonly<{ x: number; z: number; active: boolean }>;
  mode: 'ambient' | 'interactive' | 'thumbnail';
  report(measurements: Readonly<{
    instances?: number;
    drawCalls?: number;
    uploadBytesPerFrame?: number;
    note?: string;
  }>): void;
}>) => Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}> | Promise<Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
}>>;

test('a hand-copied game module still satisfies the real contract', () => {
  // The direction that matters, and it is the opposite of the one this work set out to assert.
  //
  // `GameModuleEntry` is *not* assignable to the narrow `StudioGameEntry`, and cannot be: a real
  // `GameHostContext` requires `runtimeInstanceId`, `movement` and `mode`, and the five narrow
  // copies supply none of them. A function demanding more than its target provides is unusable in
  // its place, so asserting that direction would be asserting something false about a contract
  // nobody has broken.
  //
  // What is true, and is what a demo needs, is this: a module written against the copied contract
  // drops straight into the real host, because the host supplies everything the copy asks for and
  // more. That is the property that has to survive the split, and it is what would break if the
  // contract ever *narrowed* — dropping `canvas`, `report`, or a pointer field.
  const studioEntry: StudioGameEntry = () => ({ frame(): void {}, dispose(): void {} });
  const completeEntry: StudioGameEntryWithMode = () => ({ frame(): void {}, dispose(): void {} });

  const asModule: GameModuleEntry = studioEntry;
  const asModuleFromComplete: GameModuleEntry = completeEntry;

  assert.equal(typeof asModule, 'function');
  assert.equal(typeof asModuleFromComplete, 'function');
});

test('the host context still supplies everything a copied contract declared', () => {
  // The copies declare `pointer: { x, y }`. If the real pointer ever loses `x` or `y`, or the
  // measurements lose a field, the assignment above stops meaning anything — so name them here.
  const pointer: Pick<GamePointerInput, 'x' | 'y'> = { x: 0, y: 0 };
  const measurements: GameMeasurements = {};
  assert.deepEqual(pointer, { x: 0, y: 0 });
  assert.deepEqual(measurements, {});
});

test('every pointer field is required, so a game can rely on all seven', () => {
  // A type-level guard the goal asks for from the other direction: this object omits nothing, and
  // adding a required field to `GamePointerInput` makes it fail to compile. The copies see two of
  // these seven, which is why `clicked`, `down`, `active`, `dragX` and `dragY` were invisible.
  const complete: GamePointerInput = {
    x: 0, y: 0, down: false, active: false, dragX: 0, dragY: 0, clicked: false,
  };
  assert.deepEqual(Object.keys(complete).sort(), [
    'active', 'clicked', 'down', 'dragX', 'dragY', 'x', 'y',
  ]);
});

test('a context and an instance can be built from the contract alone', () => {
  const instance: GameInstance = { frame(): void {}, dispose(): void {} };
  const context: Omit<GameHostContext, 'canvas'> = {
    runtimeInstanceId: 'runtime-test-001',
    pointer: { x: 0, y: 0, down: false, active: false, dragX: 0, dragY: 0, clicked: false },
    movement: { x: 0, z: 0, active: false },
    mode: 'interactive',
    report(): void {},
  };
  assert.equal(context.mode, 'interactive');
  assert.equal(typeof instance.frame, 'function');
});

test('the demos that hand-copied the contract still declare the shape this guard models', async () => {
  // If a demo rewrites its copy, the aliases above stop describing reality and this guard quietly
  // stops guarding. Catch that rather than trusting it.
  const demos = new URL('../../../demos/', import.meta.url);
  const found: string[] = [];
  let narrowCopies = 0;
  for (const category of await readdir(demos, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name === 'tests') continue;
    const categoryUrl = new URL(`${category.name}/`, demos);
    for (const demo of await readdir(categoryUrl, { withFileTypes: true })) {
      if (!demo.isDirectory()) continue;
      const source = new URL(`${demo.name}/src/studio-game.ts`, categoryUrl);
      const text = await readFile(source, 'utf8').catch(() => null);
      if (text === null) continue;
      found.push(`${category.name}/${demo.name}`);
      assert.match(text, /frame\(platformTimeSeconds:\s*number\):\s*void/, `${demo.name} frame shape`);
      // Every surviving copy declares the two-field pointer. The complete shape above is what one
      // would grow into; a third shape is neither, and would mean the aliases have stopped
      // describing the demos.
      const narrow = /pointer:\s*Readonly<\{\s*x:\s*number;\s*y:\s*number;?\s*\}>/.test(text);
      const complete = /clicked:\s*boolean/.test(text) && /mode:\s*'ambient'/.test(text);
      assert.ok(narrow || complete, `${demo.name} declares a pointer shape this guard does not model`);
      if (narrow) narrowCopies += 1;
    }
  }
  assert.equal(found.length, 5, `expected five hand-copied contracts, found ${found.join(', ')}`);
  assert.equal(narrowCopies, 5, 'every surviving copy is still stuck on the two-field pointer');
});
