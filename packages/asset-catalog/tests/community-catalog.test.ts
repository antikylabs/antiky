import assert from 'node:assert/strict';
import test from 'node:test';

import { CATALOG_ASSETS } from '../src/catalog-data.ts';
import { GENERATED_COMMUNITY_REPORT } from '../src/generated-community-catalog.ts';
import { GENERATED_HANDPICKED_REPORT } from '../src/generated-handpicked-catalog.ts';
import {
  parseKayKitIndex,
  parseKayKitPage,
  parseOpenDuelystTree,
  parseScreamingBrainIndex,
} from '../src/providers/community-client.ts';
import { HANDPICKED_ITCH_SOURCES, parseHandpickedItchPage } from '../src/providers/handpicked-client.ts';

test('publishes every handpicked itch source once at its reviewed quality tier', () => {
  assert.equal(HANDPICKED_ITCH_SOURCES.length, 19);
  assert.equal(new Set(HANDPICKED_ITCH_SOURCES.map((source) => source.url)).size, 19);
  assert.equal(new Set(HANDPICKED_ITCH_SOURCES.map((source) => source.catalogId)).size, 19);
  assert.deepEqual(
    Array.from({ length: 6 }, (_, quality) => HANDPICKED_ITCH_SOURCES.filter((source) => source.quality === quality).length),
    [7, 4, 5, 1, 2, 0],
  );
  assert.equal(GENERATED_HANDPICKED_REPORT.sourceCount, 19);
  assert.equal(GENERATED_HANDPICKED_REPORT.assetCount, 13);
  assert.equal(GENERATED_HANDPICKED_REPORT.aliasCount, 6);
  for (const source of HANDPICKED_ITCH_SOURCES) {
    const asset = CATALOG_ASSETS.find((candidate) => candidate.id === source.catalogId);
    assert.ok(asset, `${source.catalogId} is missing`);
    assert.equal(asset.quality, source.quality, `${source.catalogId} has the wrong quality`);
  }
});

test('parses source-verified itch metadata without downloading archives', () => {
  const source = HANDPICKED_ITCH_SOURCES.find((candidate) => candidate.catalogId === 'datagoblin:monogram')!;
  const asset = parseHandpickedItchPage(`
    <meta content="elegant monospace pixel font" property="og:description">
    <meta content="https://img.itch.zone/monogram.png" property="og:image">
    <h1 class="game_title">monogram</h1>
    <div class="formatted_description">Monogram is a monospace bitmap font, free and CC0!</div>
    <div class="game_info_panel_widget"><table><tr><td>Tags</td><td>
      <a>8-Bit</a>, <a>Fonts</a>, <a>Pixel Art</a>
    </td></tr></table></div>
    <div class="uploads"><strong class="name">monogram.ttf</strong></div>
  `, source, '2026-08-12T00:00:00.000Z');
  assert.equal(asset.id, 'datagoblin:monogram');
  assert.equal(asset.kind, 'font');
  assert.equal(asset.quality, 2);
  assert.equal(asset.description, 'elegant monospace pixel font');
  assert.ok(asset.tags.includes('pixel art'));
  assert.deepEqual(asset.formats, ['ttf', 'png', 'json', 'p8']);
  assert.equal(asset.preview.sourceUrl, 'https://img.itch.zone/monogram.png');
  assert.equal(asset.verification, 'source-verified');
  assert.deepEqual(asset.downloads, []);
});

test('rejects a handpicked itch page when its CC0 evidence disappears', () => {
  const source = HANDPICKED_ITCH_SOURCES.find((candidate) => candidate.catalogId === 'datagoblin:monogram')!;
  assert.throws(() => parseHandpickedItchPage(`
    <meta content="elegant monospace pixel font" property="og:description">
    <meta content="https://img.itch.zone/monogram.png" property="og:image">
    <h1 class="game_title">monogram</h1>
    <div class="formatted_description">All rights reserved.</div>
  `, source, '2026-08-12T00:00:00.000Z'), /CC0 evidence/);
});

test('accepts CC0 evidence scoped to a named itch upload', () => {
  const source = HANDPICKED_ITCH_SOURCES.find((candidate) => candidate.catalogId === 'pixel-frog:tiny-swords')!;
  const asset = parseHandpickedItchPage(`
    <meta content="Colorful strategy sprites" property="og:description">
    <meta content="https://img.itch.zone/tiny-swords.png" property="og:image">
    <h1 class="game_title">Tiny Swords</h1>
    <div class="formatted_description">Commercial use and modification are allowed.</div>
    <div class="uploads"><strong class="name">TS_old version_CC0 Licensed</strong></div>
  `, source, '2026-08-12T00:00:00.000Z');
  assert.equal(asset.id, 'pixel-frog:tiny-swords');
  assert.equal(asset.verification, 'source-verified');
});

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
  const promotedKayKit = new Set(['kaykit:medieval-hexagon', 'kaykit:dungeon-remastered', 'kaykit:forest-nature-pack']);
  assert.ok(kaykit.every((asset) => asset.quality === (promotedKayKit.has(asset.id) ? 0 : 1)));
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
