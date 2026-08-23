import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  validateMediaPublication,
  validateMediaPublicationFiles,
} from '../scripts/media/validate-media-publication.mjs';

const repositoryRoot = new URL('../../../', import.meta.url).pathname;
const publication = JSON.parse(await readFile(new URL('../media-publication.json', import.meta.url), 'utf8'));

function copyPublication() {
  return structuredClone(publication);
}

function hasCode(code) {
  return (error) => error?.code === code;
}

test('current media publication passes provenance, freshness, ownership, and delivery checks', async () => {
  await validateMediaPublicationFiles(copyPublication(), { root: repositoryRoot });
  assert.ok(
    publication.entries.every((entry) => entry.delivery.publicUrl !== '/media/demos/combat-arena.webp'),
    'withheld demos must not retain a public delivery',
  );
  assert.ok(
    publication.entries.some((entry) => entry.generation?.references?.some(
      (reference) => reference.path === 'packages/website/media-masters/demos/combat-arena.png',
    )),
    'the exact historical ImageGen input must remain in generation provenance',
  );
});

test('media publication rejects a stale managed-capture source digest', async () => {
  const changed = copyPublication();
  changed.entries.find((entry) => entry.capture?.kind === 'managed-demo').capture.sourceDigest = '0000000000000000';
  await assert.rejects(
    validateMediaPublicationFiles(changed, { root: repositoryRoot }),
    hasCode('MEDIA_SOURCE_STALE'),
  );
});

test('media publication rejects a missing declared file', async () => {
  const changed = copyPublication();
  const entry = changed.entries.find((candidate) => candidate.id === 'studio-launcher');
  entry.delivery.path = 'packages/website/public/media/studio/missing.webp';
  entry.delivery.publicUrl = '/media/studio/missing.webp';
  await assert.rejects(
    validateMediaPublicationFiles(changed, { root: repositoryRoot }),
    hasCode('MEDIA_FILE_MISSING'),
  );
});

test('media publication rejects one Evidence delivery reused as a second entry', () => {
  const changed = copyPublication();
  changed.entries[1].delivery = structuredClone(changed.entries[0].delivery);
  assert.throws(
    () => validateMediaPublication(changed),
    hasCode('MEDIA_EVIDENCE_REUSED'),
  );
});

test('media publication rejects missing generated provenance and approval', () => {
  const withoutPrompt = copyPublication();
  const generatedWithoutPrompt = withoutPrompt.entries.find((entry) => entry.sourceKind === 'generated');
  delete generatedWithoutPrompt.generation.promptSidecar;
  assert.throws(
    () => validateMediaPublication(withoutPrompt),
    hasCode('MEDIA_GENERATED_PROVENANCE_MISSING'),
  );

  const withoutApproval = copyPublication();
  const generatedWithoutApproval = withoutApproval.entries.find((entry) => entry.sourceKind === 'generated');
  delete generatedWithoutApproval.generation.approval;
  assert.throws(
    () => validateMediaPublication(withoutApproval),
    hasCode('MEDIA_GENERATED_APPROVAL_MISSING'),
  );
});

test('media publication rejects an oversized derivative', () => {
  const changed = copyPublication();
  changed.entries[0].delivery.maxBytes = changed.entries[0].delivery.bytes - 1;
  assert.throws(
    () => validateMediaPublication(changed),
    hasCode('MEDIA_DELIVERY_OVERSIZED'),
  );
});
