/**
 * Every demo, with the manifest that owns its ports and viewport.
 * `scripts/dev.mjs` carries the same set for its own purposes, and a test asserts the two agree
 * with the manifests actually on disk.
 */
export const DEMOS = Object.freeze({
  'antiky-town': 'packages/demos/antiky-town/antiky-town.antiky',
  'combat-arena': 'packages/demos/combat-arena/combat-arena.antiky',
  'point-light-expo': 'packages/demos/point-light-expo/point-light-expo.antiky',
  'traversal-study': 'packages/demos/traversal-study/traversal-study.antiky',
});

const fixture = (controls) => Object.freeze({
  schemaVersion: 1,
  fixtureName: 'goal-19-evidence',
  controls: Object.freeze(controls),
});

/** The declared game-owned controls used by the deterministic capture protocol. */
export const CAPTURE_FIXTURES = Object.freeze({
  'combat-arena': Object.freeze({
    baseline: fixture([
      { kind: 'scene-visibility', group: 'scene-geometry', visible: true },
      { kind: 'camera-translation', delta: { x: 0, y: 0, z: 0 } },
      { kind: 'variant', name: 'bloom', enabled: true },
      { kind: 'variant', name: 'shadows', enabled: true },
      { kind: 'variant', name: 'vignette', enabled: true },
    ]),
  }),
  'traversal-study': Object.freeze({
    baseline: fixture([
      { kind: 'scene-visibility', group: 'scene-geometry', visible: true },
      { kind: 'camera-translation', delta: { x: 0, y: 0, z: 0 } },
      { kind: 'variant', name: 'bloom', enabled: true },
      { kind: 'variant', name: 'shadows', enabled: true },
      { kind: 'variant', name: 'vignette', enabled: true },
    ]),
  }),
  'point-light-expo': Object.freeze({
    baseline: fixture([
      { kind: 'scene-visibility', group: 'scene-geometry', visible: true },
      { kind: 'camera-translation', delta: { x: 0, y: 0, z: 0 } },
    ]),
  }),
  'antiky-town': Object.freeze({
    baseline: fixture([
      { kind: 'variant', name: 'bloom', enabled: true },
      { kind: 'variant', name: 'shadows', enabled: true },
      { kind: 'variant', name: 'tree-translucency', enabled: true },
      { kind: 'variant', name: 'vignette', enabled: true },
    ]),
  }),
});

function replaceControl(base, replacement) {
  const identity = (control) => (
    control.kind === 'scene-visibility' ? `${control.kind}:${control.group}`
      : control.kind === 'variant' ? `${control.kind}:${control.name}` : control.kind
  );
  const replaced = base.controls.map((control) => (
    identity(control) === identity(replacement) ? replacement : control
  ));
  return fixture(replaced);
}

/** Executable visual-control pairs required by Goal 19 and the carried Goal 08 criteria. */
export const CAPTURE_PAIRS = Object.freeze({
  'combat-arena': Object.freeze([
    { name: 'ac-v1-vfx-only', kind: 'vfx-boundary', roi: { x: 0, y: 0, width: 1280, height: 720 }, treatment: replaceControl(CAPTURE_FIXTURES['combat-arena'].baseline, { kind: 'scene-visibility', group: 'scene-geometry', visible: false }) },
    { name: 'ac-l7-camera-translation', kind: 'camera-registration', roi: { x: 340, y: 270, width: 600, height: 340 }, treatment: replaceControl(CAPTURE_FIXTURES['combat-arena'].baseline, { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } }) },
    { name: 'm13-bloom-halo', kind: 'bloom', roi: { x: 0, y: 270, width: 160, height: 270 }, treatment: replaceControl(CAPTURE_FIXTURES['combat-arena'].baseline, { kind: 'variant', name: 'bloom', enabled: false }) },
    { name: 'm13-vignette-corner', kind: 'vignette', roi: { x: 0, y: 0, width: 160, height: 90 }, treatment: replaceControl(CAPTURE_FIXTURES['combat-arena'].baseline, { kind: 'variant', name: 'vignette', enabled: false }) },
    { name: 'm13-shadow', kind: 'shadow', roi: { x: 656, y: 378, width: 32, height: 32 }, treatment: replaceControl(CAPTURE_FIXTURES['combat-arena'].baseline, { kind: 'variant', name: 'shadows', enabled: false }) },
  ]),
  'traversal-study': Object.freeze([
    { name: 'ac-v1-vfx-only', kind: 'vfx-boundary', roi: { x: 0, y: 0, width: 1280, height: 720 }, treatment: replaceControl(CAPTURE_FIXTURES['traversal-study'].baseline, { kind: 'scene-visibility', group: 'scene-geometry', visible: false }) },
    { name: 'ac-l7-camera-translation', kind: 'camera-registration', roi: { x: 100, y: 220, width: 1080, height: 400 }, treatment: replaceControl(CAPTURE_FIXTURES['traversal-study'].baseline, { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } }) },
    { name: 'm13-bloom-halo', kind: 'bloom', roi: { x: 480, y: 260, width: 320, height: 260 }, treatment: replaceControl(CAPTURE_FIXTURES['traversal-study'].baseline, { kind: 'variant', name: 'bloom', enabled: false }) },
    { name: 'm13-vignette-corner', kind: 'vignette', roi: { x: 0, y: 0, width: 160, height: 90 }, treatment: replaceControl(CAPTURE_FIXTURES['traversal-study'].baseline, { kind: 'variant', name: 'vignette', enabled: false }) },
    { name: 'm13-shadow', kind: 'shadow', roi: { x: 500, y: 430, width: 96, height: 64 }, treatment: replaceControl(CAPTURE_FIXTURES['traversal-study'].baseline, { kind: 'variant', name: 'shadows', enabled: false }) },
  ]),
  'point-light-expo': Object.freeze([
    { name: 'ac-v1-vfx-only', kind: 'vfx-boundary', roi: { x: 0, y: 0, width: 1280, height: 720 }, treatment: replaceControl(CAPTURE_FIXTURES['point-light-expo'].baseline, { kind: 'scene-visibility', group: 'scene-geometry', visible: false }) },
    { name: 'ac-l7-camera-translation', kind: 'camera-registration', roi: { x: 180, y: 100, width: 920, height: 500 }, treatment: replaceControl(CAPTURE_FIXTURES['point-light-expo'].baseline, { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } }) },
  ]),
  'antiky-town': Object.freeze([
    { name: 'tree-translucency', kind: 'translucency', roi: { x: 1008, y: 70, width: 90, height: 120 }, treatment: replaceControl(CAPTURE_FIXTURES['antiky-town'].baseline, { kind: 'variant', name: 'tree-translucency', enabled: false }) },
    { name: 'm13-bloom-halo', kind: 'bloom', roi: { x: 1020, y: 115, width: 32, height: 32 }, treatment: replaceControl(CAPTURE_FIXTURES['antiky-town'].baseline, { kind: 'variant', name: 'bloom', enabled: false }) },
    { name: 'm13-vignette-corner', kind: 'vignette', roi: { x: 0, y: 0, width: 160, height: 90 }, treatment: replaceControl(CAPTURE_FIXTURES['antiky-town'].baseline, { kind: 'variant', name: 'vignette', enabled: false }) },
    { name: 'm13-shadow', kind: 'shadow', roi: { x: 410, y: 330, width: 120, height: 90 }, treatment: replaceControl(CAPTURE_FIXTURES['antiky-town'].baseline, { kind: 'variant', name: 'shadows', enabled: false }) },
  ]),
});
