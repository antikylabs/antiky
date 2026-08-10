import assert from 'node:assert/strict';
import test from 'node:test';

import { CATALOG_ASSETS } from './catalog-data.ts';
import { GENERATED_COMMUNITY_REPORT } from './generated-community-catalog.ts';
import {
  parseKayKitIndex,
  parseKayKitPage,
  parseOpenDuelystTree,
  parseScreamingBrainIndex,
} from './providers/community-client.ts';

test('publishes exact community-source coverage and requested quality tiers', () => {
  const kaykit = CATALOG_ASSETS.filter((asset) => asset.provider.id === 'kaykit');
  const openDuelyst = CATALOG_ASSETS.filter((asset) => asset.provider.id === 'open-duelyst');
  const screamingBrain = CATALOG_ASSETS.filter((asset) => asset.provider.id === 'screaming-brain-studios');
  assert.equal(kaykit.length, GENERATED_COMMUNITY_REPORT.kaykit.count);
  assert.equal(openDuelyst.length, GENERATED_COMMUNITY_REPORT.openDuelyst.groupCount);
  assert.equal(screamingBrain.length, GENERATED_COMMUNITY_REPORT.screamingBrainStudios.count);
  assert.equal(kaykit.length, 17);
  assert.equal(screamingBrain.length, 62);
  assert.equal(openDuelyst.reduce((sum, asset) => sum + (asset.fileCount ?? 0), 0), GENERATED_COMMUNITY_REPORT.openDuelyst.coveredFileCount);
  assert.ok(kaykit.every((asset) => asset.quality === 1));
  assert.ok(openDuelyst.every((asset) => asset.quality === 2));
  assert.ok(screamingBrain.every((asset) => asset.quality === 3));
});

test('discovers individual KayKit packs and excludes the duplicate complete bundle', () => {
  const packs = parseKayKitIndex(`
    <a href='https://kaylousberg.com/game-assets/complete-kaykit-collection' class='project Bundle'>
      <div style='background-image:url("https://example.com/all.png")'><div class='overlay'>Complete collection</div>
    </a>
    <a href='https://kaylousberg.com/game-assets/platformer' class='project Platformer Environment'>
      <div style='background-image:url("https://example.com/platformer.png")'><div class='overlay'>Platformer Pack</div>
    </a>
  `);
  assert.equal(packs.length, 1);
  assert.deepEqual(packs[0]?.categories, ['platformer', 'environment']);
});

test('requires CC0 evidence on each KayKit detail page', () => {
  const asset = parseKayKitPage(`
    <title>Kay Lousberg &middot; Platformer Pack</title>
    <meta property="og:description" content="There's 120 unique (370 total models including recolours) stylised platformer assets.">
    <meta property='og:image' content='https://example.com/platformer.png'>
    <li>Free for personal and commercial use, no attribution required. (CC0 Licensed)</li>
  `, {
    url: 'https://kaylousberg.com/game-assets/platformer', title: 'Platformer Pack',
    previewUrl: 'https://example.com/platformer.png', categories: ['Platformer', 'Environment'],
  }, '2026-08-09T00:00:00.000Z');
  assert.equal(asset.fileCount, 370);
  assert.match(asset.description, /There's 120 unique/);
  assert.equal(asset.quality, 1);
  assert.equal(asset.provider.id, 'kaykit');
});

test('reads KayKit marketed model counts when no archive manifest is requested', () => {
  const asset = parseKayKitPage(`
    <meta property="og:description" content="Download here. Features: 64+ Low poly optimized 3D models.">
    <p>Free for personal and commercial use. (CC0 Licensed)</p>
  `, {
    url: 'https://kaylousberg.com/game-assets/prototype-bits', title: 'Prototype Bits',
    previewUrl: 'https://example.com/prototype.png', categories: ['prototype'],
  }, '2026-08-09T00:00:00.000Z');
  assert.equal(asset.fileCount, 64);
});

test('discovers Screaming Brain assets while excluding software tools', () => {
  const assets = parseScreamingBrainIndex(`
    <p>All assets have been released under the Public Domain (CC0) license.</p>
    <div class="game_cell"><a href="https://screamingbrainstudios.itch.io/texture-manipulator"><img data-lazy_src="https://example.com/tool.png"></a><a class="title game_link">Texture Manipulator</a><div class="game_text">A utility.</div></div>
    <div class="game_cell"><a href="https://screamingbrainstudios.itch.io/planetpack"><img data-lazy_src="https://example.com/planet.png"></a><a class="title game_link">2D Planet Pack</a><div class="game_text">FREE 303 planet sprites!</div></div>
  `, '2026-08-09T00:00:00.000Z');
  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.fileCount, 303);
  assert.equal(assets[0]?.quality, 3);
});

test('groups and completely accounts for both OpenDuelyst resource trees', () => {
  const report = parseOpenDuelystTree({ sha: 'tree-sha', truncated: false, tree: [
    { path: 'app/resources/units/a.png', type: 'blob', size: 10 },
    { path: 'app/resources/units/a.json', type: 'blob', size: 20 },
    { path: 'app/original_resources/ui/button.psd', type: 'blob', size: 30 },
    { path: 'README.md', type: 'blob', size: 40 },
  ] }, '2026-08-09T00:00:00.000Z');
  assert.equal(report.assets.length, 2);
  assert.equal(report.coveredFileCount, 3);
  assert.equal(report.assets.reduce((sum, asset) => sum + (asset.fileCount ?? 0), 0), report.coveredFileCount);
  assert.ok(report.assets.every((asset) => asset.quality === 2));
});
