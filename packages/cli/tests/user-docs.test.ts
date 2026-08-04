import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { CLI_USAGE } from '../src/cli.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { MCP_RESOURCE_URIS } from '../src/mcp-server.ts';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const cliGuidePath = join(repositoryRoot, 'docs', 'user-facing-docs', 'cli', 'development.md');
const studioGuidePath = join(
  repositoryRoot,
  'docs',
  'user-facing-docs',
  'studio',
  'development-connection.md',
);

async function verifyLocalLinks(path: string, source: string): Promise<void> {
  const links = Array.from(source.matchAll(/\[[^\]]+]\(([^)]+)\)/g), (match) => match[1]!);
  for (const link of links) {
    if (/^(?:https?:|mailto:|#)/.test(link)) continue;
    const target = link.split('#', 1)[0]!;
    await access(resolve(dirname(path), target));
  }
}

test('user-facing development docs match shipped commands, config, MCP names, and links', async () => {
  const [cliGuide, studioGuide, configSource] = await Promise.all([
    readFile(cliGuidePath, 'utf8'),
    readFile(studioGuidePath, 'utf8'),
    readFile(join(repositoryRoot, 'antiky.config.json'), 'utf8'),
  ]);
  for (const command of ['dev', 'inspect', 'mcp']) {
    assert.match(CLI_USAGE, new RegExp(`antiky ${command}`));
    assert.match(cliGuide, new RegExp(`antiky ${command}`));
  }
  for (const uri of MCP_RESOURCE_URIS) assert.ok(cliGuide.includes(uri));
  for (const tool of ['dev_reload', 'capture_frame']) assert.ok(cliGuide.includes(tool));

  const documentedConfig = cliGuide.match(/```json\n([\s\S]*?)```/)?.[1];
  assert.ok(documentedConfig, 'CLI guide has no JSON config example');
  assert.deepEqual(JSON.parse(documentedConfig), JSON.parse(configSource));
  assert.match(studioGuide, /N\/A for Studio UI/);
  assert.match(studioGuide, /connectDevelopmentClient/);
  await verifyLocalLinks(cliGuidePath, cliGuide);
  await verifyLocalLinks(studioGuidePath, studioGuide);
});
