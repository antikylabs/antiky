import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const bridgeSource = readFile(
  resolve(packageDirectory, 'src/native/terminal_bridge.m'),
  'utf8',
);
const bridgeHeader = readFile(
  resolve(packageDirectory, 'src/native/terminal_bridge.h'),
  'utf8',
);
const shellProfile = readFile(
  resolve(packageDirectory, 'resources/terminal/antiky-studio.zshrc'),
  'utf8',
);

test('the bridge validates and loads the Studio profile after user configuration', async () => {
  const [source, header] = await Promise.all([bridgeSource, bridgeHeader]);
  const open = source.match(
    /int32_t antiky_terminal_open\([\s\S]*?\n\}\n\nint32_t antiky_terminal_layout/,
  )?.[0];
  const validation = source.match(
    /int32_t antiky_terminal_validate_profile\([\s\S]*?\n\}/,
  )?.[0];

  assert.ok(open, 'native terminal open must remain explicit and inspectable');
  assert.ok(validation, 'the product profile must use an isolated Ghostty configuration');
  assert.match(header, /const char \*terminal_profile/);
  assert.match(validation, /ghostty_config_new\(\)/);
  assert.match(validation, /ghostty_config_load_file\(profile_config, terminal_profile\)/);
  assert.match(validation, /ghostty_config_finalize\(profile_config\)/);
  assert.match(validation, /ghostty_config_diagnostics_count\(profile_config\)/);
  assert.match(validation, /ghostty_config_free\(profile_config\)/);

  const userDefaults = open.indexOf('ghostty_config_load_default_files(antiky_config)');
  const userRecursive = open.indexOf('ghostty_config_load_recursive_files(antiky_config)');
  const studioProfile = open.indexOf('ghostty_config_load_file(antiky_config, terminal_profile)');
  const finalize = open.indexOf('ghostty_config_finalize(antiky_config)');
  assert.ok(userDefaults > 0);
  assert.ok(userRecursive > userDefaults);
  assert.ok(studioProfile > userRecursive);
  assert.ok(finalize > studioProfile);
});

test('the Studio terminal isolates startup output and uses one non-identifying prompt', async () => {
  const [source, profile] = await Promise.all([bridgeSource, shellProfile]);
  const open = source.match(
    /int32_t antiky_terminal_open\([\s\S]*?\n\}\n\nint32_t antiky_terminal_layout/,
  )?.[0];

  assert.ok(open, 'native terminal open must remain explicit and inspectable');
  assert.match(open, /surface_config\.command = "\/bin\/zsh -d -i"/);
  assert.doesNotMatch(open, /surface_config\.command = "\/bin\/zsh";/);
  assert.match(open, /\.key = "ZDOTDIR", \.value = shell_config_directory/);
  assert.doesNotMatch(open, /ANTIKY_STUDIO_USER_ZDOTDIR/);
  assert.match(open, /surface_config\.env_vars = shell_environment/);
  assert.match(open, /surface_config\.env_var_count = 1/);
  assert.doesNotMatch(profile, /source\s+"?\$ZDOTDIR\/\.zshrc/);
  assert.match(
    profile,
    /^printf '\\033\[3J\\033\[2J\\033\[H'/,
    'Studio startup must erase the macOS login banner and its scrollback before drawing a prompt',
  );
  assert.match(profile, /PROMPT='%% '/);
  assert.match(profile, /RPROMPT=''/);

  const fixture = await mkdtemp(join(tmpdir(), 'antiky-terminal-prompt-'));
  const studioConfig = join(fixture, 'studio');
  const userConfig = join(fixture, 'generic-user');
  await mkdir(studioConfig);
  await mkdir(userConfig);
  await writeFile(join(studioConfig, '.zshrc'), profile);
  await writeFile(
    join(userConfig, '.zshrc'),
    "print -r -- 'private-user@private-machine'\nexport GENERIC_SHELL_FIXTURE=leaked\nPROMPT='private-user@private-machine '\n",
  );

  try {
    const child = spawn('/bin/zsh', ['-d', '-i'], {
      env: {
        ...process.env,
        ZDOTDIR: studioConfig,
        ANTIKY_STUDIO_USER_ZDOTDIR: userConfig,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.stdin.end('print -r -- "${GENERIC_SHELL_FIXTURE:-isolated}"\nexit\n');
    const exit = await new Promise((resolveExit) => {
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    });

    assert.deepEqual(exit, { code: 0, signal: null }, stderr);
    assert.match(stdout, /^\x1B\[3J\x1B\[2J\x1B\[H/);
    const visibleOutput = stdout.replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, '');
    assert.match(visibleOutput, /^isolated$/m);
    assert.doesNotMatch(visibleOutput, /private-user|private-machine/);
    const visiblePrompt = stderr
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, '')
      .replaceAll('\r', '\n');
    assert.match(visiblePrompt, /(?:^|\n)% /);
    assert.doesNotMatch(visiblePrompt, /private-user|private-machine/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('terminal teardown frees the Ghostty surface without requesting an interactive close', async () => {
  const source = await bridgeSource;
  const teardown = source.match(
    /void antiky_terminal_close\(void\) \{[\s\S]*?\n\}\n\nantiky_terminal_status_s/,
  )?.[0];

  assert.ok(teardown, 'native terminal teardown must remain explicit and inspectable');
  assert.doesNotMatch(teardown, /ghostty_surface_request_close/);
  assert.equal(teardown.match(/ghostty_surface_free\(surface\);/g)?.length, 1);
});

test('terminal teardown keeps the originating native view alive until Ghostty is finished with it', async () => {
  const source = await bridgeSource;
  const teardown = source.match(
    /void antiky_terminal_close\(void\) \{[\s\S]*?\n\}\n\nantiky_terminal_status_s/,
  )?.[0];

  assert.ok(teardown, 'native terminal teardown must remain explicit and inspectable');
  assert.match(
    teardown,
    /__attribute__\(\(objc_precise_lifetime\)\) AntikyGhosttyView \*view = antiky_view;/,
  );
  assert.match(teardown, /ghostty_surface_t surface = view\.surface;/);
  assert.match(teardown, /view\.surface = NULL;/);
});

test('deferred Ghostty callbacks can mutate only the surface that emitted them', async () => {
  const source = await bridgeSource;
  const action = source.match(
    /static bool runtime_action\([\s\S]*?\n\}/,
  )?.[0];
  const clipboard = source.match(
    /static bool runtime_read_clipboard\([\s\S]*?\n\}/,
  )?.[0];
  const closeSurface = source.match(
    /static void runtime_close_surface\([\s\S]*?\n\}/,
  )?.[0];

  assert.ok(action, 'Ghostty action routing must remain inspectable');
  assert.ok(clipboard, 'clipboard routing must remain inspectable');
  assert.ok(closeSurface, 'surface-close routing must remain inspectable');
  assert.equal(
    action.match(/antiky_view\.surface == surface/g)?.length,
    3,
    'render, child-exit, and renderer-health actions must verify their source surface',
  );
  assert.match(clipboard, /AntikyGhosttyView \*view = terminal_view\(userdata\);/);
  assert.doesNotMatch(clipboard, /antiky_view\.surface/);
  assert.match(closeSurface, /AntikyGhosttyView \*view = terminal_view\(userdata\);/);
  assert.match(closeSurface, /antiky_view == view && view\.surface != NULL/);
});

test('opening a terminal replaces an exited shell instead of laying out its dead surface', async () => {
  const source = await bridgeSource;
  const open = source.match(
    /int32_t antiky_terminal_open\([\s\S]*?\n\}\n\nint32_t antiky_terminal_layout/,
  )?.[0];

  assert.ok(open, 'native terminal open must remain explicit and inspectable');
  assert.match(open, /ghostty_surface_process_exited\(antiky_view\.surface\)/);
  assert.match(open, /antiky_terminal_close\(\);/);
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

test('Command copy and paste remain terminal clipboard shortcuts', async () => {
  const source = await bridgeSource;
  const view = source.match(
    /@implementation AntikyGhosttyView[\s\S]*?\n@end/,
  )?.[0];
  const keyEquivalent = view?.match(
    /- \(BOOL\)performKeyEquivalent:\(NSEvent \*\)event[\s\S]*?\n\}\n- \(void\)keyDown/,
  )?.[0];

  assert.ok(keyEquivalent, 'terminal key-equivalent handling must remain inspectable');
  assert.match(keyEquivalent, /event\.keyCode == 0x08 \|\| event\.keyCode == 0x09/);
  assert.match(
    keyEquivalent,
    /if \(terminalClipboardShortcut\) \{[\s\S]*return send_key\(event, action\);/,
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

test('the native view paints the Studio media background before Ghostty draws', async () => {
  const source = await bridgeSource;
  const open = source.match(
    /int32_t antiky_terminal_open\([\s\S]*?\n\}\n\nint32_t antiky_terminal_layout/,
  )?.[0];

  assert.ok(open, 'native terminal open must remain explicit and inspectable');
  const background = open.indexOf('antiky_view.layer.backgroundColor');
  const attach = open.indexOf('[parent addSubview:antiky_view');
  assert.ok(background > 0, 'the AppKit surface must own an explicit first-frame background');
  assert.ok(attach > background, 'the background must be set before the native view is attached');
  assert.match(open, /Red:\(8\.0 \/ 255\.0\)/);
  assert.match(open, /green:\(9\.0 \/ 255\.0\)/);
  assert.match(open, /blue:\(11\.0 \/ 255\.0\)/);
});
