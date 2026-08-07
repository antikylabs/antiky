import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GHOSTTY_DEPENDENCY,
  cacheMatchesDependency,
} from '../scripts/ghostty-dependency.mjs';

test('Ghostty preparation is pinned, hash-verified, and cache-safe', () => {
  assert.deepEqual(GHOSTTY_DEPENDENCY, {
    ghosttyRevision: 'f948d4207655f31ae9b95fa039e73524df43cd13',
    ghosttyArchiveSha256: 'd7051e56f4edbca4a316c9785265e06ce0776f74004026a2395bb881c009fa99',
    zigVersion: '0.16.0',
    zigArchiveSha256: 'b23d70deaa879b5c2d486ed3316f7eaa53e84acf6fc9cc747de152450d401489',
    target: 'macos-arm64',
  });
  assert.equal(cacheMatchesDependency(GHOSTTY_DEPENDENCY), true);
  assert.equal(cacheMatchesDependency({ ...GHOSTTY_DEPENDENCY, ghosttyRevision: 'latest' }), false);
  assert.equal(cacheMatchesDependency({ ...GHOSTTY_DEPENDENCY, target: '../escape' }), false);
});
