import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);

test('production pages load the configured Fathom analytics script once', async () => {
  for (const page of ['index.html', 'framework.html', 'studio.html']) {
    const output = await readFile(new URL(page, outputRoot), 'utf8');
    const scripts = output.match(/<script[^>]+src="https:\/\/cdn\.usefathom\.com\/script\.js"[^>]*>/g) ?? [];

    assert.equal(scripts.length, 1, `${page} must load Fathom once`);
    assert.match(scripts[0], /data-site="HELZNBFB"/);
    assert.match(scripts[0], /(?:^|\s)defer(?:="")?(?:\s|>)/);
  }
});
