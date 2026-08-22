import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseRoadmap, RoadmapParseError } from '../src/lib/roadmap.ts';

const valid = `title: Roadmap
intro: One loop: with proof
notice: No dates
stages:
  - v0.1: First delivery: still part of the description
    - Framework: Sessions and identity
  - Destination: Ship games
    - Evidence: Repeatable scenarios
`;

test('the production roadmap parses every seeded delivery in source order', async () => {
  const source = await readFile(new URL('../content/roadmap.txt', import.meta.url), 'utf8');
  const roadmap = parseRoadmap(source);
  assert.equal(roadmap.title, 'Antiky Labs roadmap');
  assert.deepEqual(
    roadmap.deliveries.map((delivery) => delivery.title),
    [
      "v0.1. Put the foundation in people's hands",
      'v0.2. Make the game part of the conversation',
      'v0.3. Grow the game-making core',
      'v0.4. Turn Studio into a creator workspace',
      'Beyond. Build a creative library agents can understand',
      'The destination. Ship games that prove the idea',
    ],
  );
  assert.equal(roadmap.deliveries[0]?.subitems[0]?.title, 'Framework and agent tools');
  assert.equal(roadmap.deliveries.at(-1)?.subitems.at(-1)?.title, 'Release evidence');
});

test('field and item descriptions preserve colons after their first delimiter', () => {
  const roadmap = parseRoadmap(valid);
  assert.equal(roadmap.intro, 'One loop: with proof');
  assert.equal(roadmap.deliveries[0]?.description, 'First delivery: still part of the description');
});

function rejects(source: string, code: RoadmapParseError['code'], line: number) {
  assert.throws(
    () => parseRoadmap(source),
    (error) => error instanceof RoadmapParseError
      && error.code === code
      && error.line === line
      && error.message.includes(`at line ${line}`),
  );
}

test('the roadmap accepts exactly delivery and subitem levels', () => {
  rejects(valid.replace('    - Framework', '      - Framework'), 'ROADMAP_DEPTH', 6);
  rejects(valid.replace('  - v0.1', '   - v0.1'), 'ROADMAP_INDENTATION', 5);
  rejects(valid.replace('  - v0.1', '\t- v0.1'), 'ROADMAP_TABS', 5);
  rejects(valid.replace('  - v0.1', '    - v0.1'), 'ROADMAP_SUBITEM_BEFORE_DELIVERY', 5);
});

test('malformed values fail with stable codes and source lines', () => {
  rejects(valid.replace('notice: No dates', 'summary: No dates'), 'ROADMAP_UNKNOWN_FIELD', 3);
  rejects(valid.replace('notice: No dates', 'notice:'), 'ROADMAP_FIELD_VALUE', 3);
  rejects(valid.replace('notice: No dates', 'notice: No dates\nnotice: Again'), 'ROADMAP_DUPLICATE_FIELD', 4);
  rejects(valid.replace('  - v0.1:', '  - :'), 'ROADMAP_ITEM_TITLE', 5);
  rejects(valid.replace('First delivery: still part of the description', ''), 'ROADMAP_ITEM_DESCRIPTION', 5);
  rejects(valid.replace(/  - v0\.1[\s\S]*/, ''), 'ROADMAP_EMPTY_STAGES', 4);
});
