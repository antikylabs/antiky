import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAssetLlmsText } from '../src/lib/llms.ts';

test('publishes a compact agent guide to the complete asset API', () => {
  const source = buildAssetLlmsText();
  assert.match(source, /^# Antiky Assets/m);
  assert.match(source, /1,292 CC0 asset records/);
  assert.match(source, /212 Kenney packs/);
  assert.match(source, /82 Quaternius packs/);
  assert.match(source, /GET https:\/\/antikylabs\.com\/api\/assets\?q=forest&type=model&limit=100&offset=0/);
  assert.match(source, /cataloged.*source-verified.*install-verified/s);
  assert.match(source, /Do not claim that cataloged metadata is install-verified/);
  assert.ok(source.length < 8_000, 'llms.txt should point to the API instead of embedding the full catalog');
});
