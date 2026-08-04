import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { CLI_USAGE } from '../src/cli.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  MCP_HTTP_PATH,
  MCP_RESOURCE_URIS,
  MCP_TOOL_NAMES,
} from '../src/mcp-server.ts';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const userDocsRoot = join(repositoryRoot, 'docs', 'user-facing-docs');
const cliGuidePath = join(userDocsRoot, 'cli', 'development.md');
const frameworkGuidePath = join(userDocsRoot, 'framework', 'inspection.md');
const studioGuidePath = join(
  userDocsRoot,
  'studio',
  'development-connection.md',
);
const agentsGuidePath = join(userDocsRoot, 'AGENTS.md');
const claudeGuidePath = join(userDocsRoot, 'CLAUDE.md');

async function verifyLocalLinks(path: string, source: string): Promise<void> {
  const links = Array.from(source.matchAll(/\[[^\]]+]\(([^)]+)\)/g), (match) => match[1]!);
  for (const link of links) {
    if (/^(?:https?:|mailto:|#)/.test(link)) continue;
    const target = link.split('#', 1)[0]!;
    await access(resolve(dirname(path), target));
  }
}

test('user-facing development docs are standalone and match the shipped interfaces', async () => {
  const [cliGuide, frameworkGuide, studioGuide, agentsGuide, claudeGuide] = await Promise.all([
    readFile(cliGuidePath, 'utf8'),
    readFile(frameworkGuidePath, 'utf8'),
    readFile(studioGuidePath, 'utf8'),
    readFile(agentsGuidePath, 'utf8'),
    readFile(claudeGuidePath, 'utf8'),
  ]);

  for (const command of ['dev', 'inspect', 'mcp']) {
    assert.match(CLI_USAGE, new RegExp(`antiky ${command}`));
    assert.match(cliGuide, new RegExp(`antiky ${command}`));
  }
  for (const uri of MCP_RESOURCE_URIS) assert.ok(cliGuide.includes(uri));
  for (const tool of MCP_TOOL_NAMES) assert.ok(cliGuide.includes(tool));

  assert.ok(cliGuide.includes(MCP_HTTP_PATH));
  assert.match(cliGuide, /Streamable HTTP/);
  assert.match(cliGuide, /`antiky dev`[^.]*starts[^.]*MCP/i);

  const documentedConfig = cliGuide.match(/```json\n([\s\S]*?)```/)?.[1];
  assert.ok(documentedConfig, 'CLI guide has no JSON config example');
  const config = JSON.parse(documentedConfig) as {
    schemaVersion: number;
    game: {
      command: string[];
      shaderCommand: string[];
      workingDirectory: string;
      url: string;
      viewport: { width: number; height: number };
    };
    network: { host: string; gamePort: number; inspectionPort: number };
  };
  assert.equal(config.schemaVersion, 1);
  assert.ok(config.game.command.length > 0);
  assert.ok(config.game.shaderCommand.length > 0);
  assert.equal(config.game.workingDirectory, '.');
  assert.ok(config.game.viewport.width > 0);
  assert.ok(config.game.viewport.height > 0);
  assert.equal(config.network.host, '127.0.0.1');
  assert.notEqual(config.network.gamePort, config.network.inspectionPort);
  const gameUrl = new URL(config.game.url);
  assert.equal(gameUrl.hostname, config.network.host);
  assert.equal(Number(gameUrl.port), config.network.gamePort);
  assert.doesNotMatch(config.game.url, /town-study/i);

  const deliveryLanguage = /Slice \d+|N\/A for Studio UI|acceptance evidence|checkpoint|milestone/i;
  for (const guide of [cliGuide, frameworkGuide, studioGuide]) {
    assert.doesNotMatch(guide, deliveryLanguage);
  }

  assert.match(studioGuide, /connectDevelopmentClient/);
  assert.match(agentsGuide, /standalone product documentation/i);
  assert.match(agentsGuide, /developers\s+integrating Antiky into their own\s+games/i);
  assert.match(agentsGuide, /slice[^.]*objective[^.]*checkpoint[^.]*evidence/i);
  assert.match(claudeGuide, /^@AGENTS\.md$/m);
  assert.match(claudeGuide, /^@\.\.\/GOOD_ENGINEERING_H\.md$/m);

  await verifyLocalLinks(cliGuidePath, cliGuide);
  await verifyLocalLinks(frameworkGuidePath, frameworkGuide);
  await verifyLocalLinks(studioGuidePath, studioGuide);
});
