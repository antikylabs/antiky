import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const bridgeSource = readFile(
  resolve(packageDirectory, 'src/native/terminal_bridge.m'),
  'utf8',
);

test('terminal teardown frees the Ghostty surface without requesting an interactive close', async () => {
  const source = await bridgeSource;
  const teardown = source.match(
    /void antiky_terminal_close\(void\) \{[\s\S]*?\n\}\n\nantiky_terminal_status_s/,
  )?.[0];

  assert.ok(teardown, 'native terminal teardown must remain explicit and inspectable');
  assert.doesNotMatch(teardown, /ghostty_surface_request_close/);
  assert.equal(teardown.match(/ghostty_surface_free\(surface\);/g)?.length, 1);
});

test('the focused native terminal owns Control-key equivalents', async () => {
  const source = await bridgeSource;
  const view = source.match(
    /@implementation AntikyGhosttyView[\s\S]*?\n@end/,
  )?.[0];
  const keyEquivalent = view?.match(
    /- \(BOOL\)performKeyEquivalent:\(NSEvent \*\)event[\s\S]*?\n\}\n- \(void\)keyDown/,
  )?.[0];

  assert.ok(view, 'native terminal input handling must remain explicit and inspectable');
  assert.ok(keyEquivalent, 'Control-key equivalent handling must stay beside keyDown');
  assert.match(keyEquivalent, /self\.window\.firstResponder != self/);
  assert.match(keyEquivalent, /NSEventModifierFlagControl/);
  assert.match(keyEquivalent, /NSEventModifierFlagCommand/);
  assert.match(keyEquivalent, /send_key\(event, action\)/);
  assert.match(keyEquivalent, /return YES/);
});

test('unhandled Command shortcuts continue through AppKit without re-entering its traversal', async () => {
  const source = await bridgeSource;
  const view = source.match(
    /@implementation AntikyGhosttyView[\s\S]*?\n@end/,
  )?.[0];
  const keyEquivalent = view?.match(
    /- \(BOOL\)performKeyEquivalent:\(NSEvent \*\)event[\s\S]*?\n\}\n- \(void\)keyDown/,
  )?.[0];

  assert.ok(keyEquivalent, 'key-equivalent handling must stay explicit and inspectable');
  assert.doesNotMatch(keyEquivalent, /\[super performKeyEquivalent:event\]/);
  assert.match(
    keyEquivalent,
    /\(flags & NSEventModifierFlagCommand\) != 0\) \{\s*return NO;/,
  );
});

test('modifier-only events never ask AppKit for keyboard text', async () => {
  const source = await bridgeSource;
  const sendKey = source.match(
    /static BOOL send_key\(NSEvent \*event, ghostty_input_action_e action\) \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(sendKey, 'native key translation must remain explicit and inspectable');
  assert.match(
    sendKey,
    /BOOL hasKeyboardText =[\s\S]*NSEventTypeKeyDown \|\| event\.type == NSEventTypeKeyUp/,
  );
  assert.match(
    sendKey,
    /if \(hasKeyboardText\) \{[\s\S]*unmodified_event_text\(event\)/,
  );
  assert.match(sendKey, /NSString \*text = hasKeyboardText/);
});

test('terminal layout hides offscreen geometry and restores visible geometry', async () => {
  const source = await bridgeSource;
  const layout = source.match(
    /int32_t antiky_terminal_layout\([\s\S]*?\n\}/,
  )?.[0];
  const hide = source.match(
    /int32_t antiky_terminal_hide\([\s\S]*?\n\}/,
  )?.[0];

  assert.ok(layout, 'native terminal layout must remain explicit and inspectable');
  assert.ok(hide, 'native terminal hide must remain explicit and inspectable');
  assert.match(layout, /antiky_view\.hidden = NO/);
  assert.match(hide, /antiky_view\.hidden = YES/);
});
