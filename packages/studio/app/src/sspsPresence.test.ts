import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  applySspsPresencePreference,
  readSspsPresenceEnabled,
  SSPS_PRESENCE_STORAGE_KEY,
  SSPS_SCRIPT_URL,
  SSPS_SITE_ID,
  SSPS_VISITOR_STORAGE_KEY,
  startSspsPresence,
  writeSspsPresenceEnabled,
} from './sspsPresence.ts';

type TestStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> & {
  values: Map<string, string>;
};

function testStorage(entries: readonly (readonly [string, string])[] = []): TestStorage {
  const values = new Map(entries);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

function testDocument(existing = false): {
  appended: HTMLScriptElement[];
  document: Document;
  script: HTMLScriptElement;
} {
  const appended: HTMLScriptElement[] = [];
  const script = { async: false, dataset: {}, src: '' } as unknown as HTMLScriptElement;
  const document = {
    createElement: (name: string) => {
      assert.equal(name, 'script');
      return script;
    },
    head: { append: (element: HTMLScriptElement) => { appended.push(element); } },
    querySelector: () => existing ? script : null,
  } as unknown as Document;
  return { appended, document, script };
}

test('SSPS presence defaults on and persists an explicit local opt-out', () => {
  const storage = testStorage([[SSPS_VISITOR_STORAGE_KEY, 'visitor-123']]);

  assert.equal(readSspsPresenceEnabled(storage), true);
  assert.equal(writeSspsPresenceEnabled(storage, false), true);
  assert.equal(storage.values.get(SSPS_PRESENCE_STORAGE_KEY), 'disabled');
  assert.equal(storage.values.has(SSPS_VISITOR_STORAGE_KEY), false);
  assert.equal(readSspsPresenceEnabled(storage), false);

  assert.equal(writeSspsPresenceEnabled(storage, true), true);
  assert.equal(storage.values.get(SSPS_PRESENCE_STORAGE_KEY), 'enabled');
  assert.equal(readSspsPresenceEnabled(storage), true);
});

test('SSPS presence stays disabled when preference storage is unavailable', () => {
  const unavailable = {
    getItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
  };

  assert.equal(readSspsPresenceEnabled(unavailable), false);
  assert.equal(writeSspsPresenceEnabled(unavailable, false), false);
});

test('SSPS preference changes wait for native terminal teardown before reloading Studio', async () => {
  const storage = testStorage();
  const events: string[] = [];
  let finishTerminalTeardown = () => undefined;
  const terminalTeardown = new Promise<void>((resolve) => {
    finishTerminalTeardown = () => {
      events.push('terminal closed');
      resolve();
    };
  });

  const change = applySspsPresencePreference(
    storage,
    false,
    () => {
      events.push('close requested');
      return terminalTeardown;
    },
    () => { events.push('reloaded'); },
  );

  assert.equal(storage.values.get(SSPS_PRESENCE_STORAGE_KEY), 'disabled');
  assert.deepEqual(events, ['close requested']);
  finishTerminalTeardown();
  assert.equal(await change, true);
  assert.deepEqual(events, ['close requested', 'terminal closed', 'reloaded']);
});

test('SSPS preference changes do not close or reload when saving fails', async () => {
  const unavailable = {
    getItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
  };
  let terminalCloseCount = 0;
  let reloadCount = 0;

  assert.equal(await applySspsPresencePreference(
    unavailable,
    false,
    async () => { terminalCloseCount += 1; },
    () => { reloadCount += 1; },
  ), false);
  assert.equal(terminalCloseCount, 0);
  assert.equal(reloadCount, 0);
});

test('SSPS loads one exact site script only for an enabled native Studio', () => {
  const disabled = testDocument();
  assert.equal(startSspsPresence(disabled.document, 'native', false), false);
  assert.equal(disabled.appended.length, 0);

  const browser = testDocument();
  assert.equal(startSspsPresence(browser.document, 'browser', true), false);
  assert.equal(browser.appended.length, 0);

  const native = testDocument();
  assert.equal(startSspsPresence(native.document, 'native', true), true);
  assert.equal(native.appended.length, 1);
  assert.equal(native.script.async, true);
  assert.equal(native.script.src, SSPS_SCRIPT_URL);
  assert.equal(native.script.dataset.siteId, SSPS_SITE_ID);

  const existing = testDocument(true);
  assert.equal(startSspsPresence(existing.document, 'native', true), true);
  assert.equal(existing.appended.length, 0);
});
