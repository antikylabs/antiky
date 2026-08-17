export const CAPTURE_FIXTURE_SCHEMA_VERSION = 1 as const;
export const CAPTURE_FIXTURE_MAX_CONTROLS = 8;
export const CAPTURE_FIXTURE_MAX_TRANSLATION = 100;

export type CaptureFixtureSceneVisibilityControl = Readonly<{
  kind: 'scene-visibility';
  group: string;
  visible: boolean;
}>;

export type CaptureFixtureCameraTranslationControl = Readonly<{
  kind: 'camera-translation';
  delta: Readonly<{ x: number; y: number; z: number }>;
}>;

export type CaptureFixtureVariantControl = Readonly<{
  kind: 'variant';
  name: string;
  enabled: boolean;
}>;

export type CaptureFixtureControl =
  | CaptureFixtureSceneVisibilityControl
  | CaptureFixtureCameraTranslationControl
  | CaptureFixtureVariantControl;

export type CaptureFixtureRequest = Readonly<{
  schemaVersion: typeof CAPTURE_FIXTURE_SCHEMA_VERSION;
  fixtureName: string;
  controls: readonly CaptureFixtureControl[];
}>;

export type CaptureFixtureResult = Readonly<{
  schemaVersion: typeof CAPTURE_FIXTURE_SCHEMA_VERSION;
  fixtureName: string;
  appliedControls: readonly CaptureFixtureControl[];
}>;

export type CaptureFixtureState = Readonly<{
  sceneVisibility: Readonly<Record<string, boolean>>;
  variants: Readonly<Record<string, boolean>>;
  cameraTranslation: Readonly<{ x: number; y: number; z: number }>;
}>;

export type CaptureFixtureDeclaration = Readonly<{
  fixtureName: string;
  sceneGroups?: Readonly<Record<string, boolean>>;
  variants?: Readonly<Record<string, boolean>>;
  maximumCameraTranslation?: number;
}>;

export type CaptureFixtureController = Readonly<{
  apply(request: CaptureFixtureRequest): CaptureFixtureResult;
  read(): CaptureFixtureState;
}>;

type UnknownRecord = Record<string, unknown>;

export class CaptureFixtureValidationError extends Error {
  readonly code = 'INVALID_CAPTURE_FIXTURE';

  constructor(message: string, readonly path: string) {
    super(`${message} at ${path}`);
    this.name = 'CaptureFixtureValidationError';
  }
}

function fail(message: string, path: string): never {
  throw new CaptureFixtureValidationError(message, path);
}

function object(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected an object', path);
  }
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, keys: readonly string[], path: string): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) fail('Unexpected fixture fields', path);
}

function name(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(value)) {
    fail('Expected a lower-case semantic name', path);
  }
  return value;
}

function finite(value: unknown, path: string): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || Math.abs(value) > CAPTURE_FIXTURE_MAX_TRANSLATION
  ) fail('Expected a bounded finite translation', path);
  return Object.is(value, -0) ? 0 : value;
}

function control(value: unknown, path: string): CaptureFixtureControl {
  const record = object(value, path);
  if (record.kind === 'scene-visibility') {
    exactKeys(record, ['kind', 'group', 'visible'], path);
    if (typeof record.visible !== 'boolean') fail('Expected a visibility boolean', `${path}.visible`);
    return Object.freeze({
      kind: 'scene-visibility',
      group: name(record.group, `${path}.group`),
      visible: record.visible,
    });
  }
  if (record.kind === 'camera-translation') {
    exactKeys(record, ['kind', 'delta'], path);
    const delta = object(record.delta, `${path}.delta`);
    exactKeys(delta, ['x', 'y', 'z'], `${path}.delta`);
    return Object.freeze({
      kind: 'camera-translation',
      delta: Object.freeze({
        x: finite(delta.x, `${path}.delta.x`),
        y: finite(delta.y, `${path}.delta.y`),
        z: finite(delta.z, `${path}.delta.z`),
      }),
    });
  }
  if (record.kind === 'variant') {
    exactKeys(record, ['kind', 'name', 'enabled'], path);
    if (typeof record.enabled !== 'boolean') fail('Expected a variant boolean', `${path}.enabled`);
    return Object.freeze({
      kind: 'variant',
      name: name(record.name, `${path}.name`),
      enabled: record.enabled,
    });
  }
  fail('Unknown capture fixture control', `${path}.kind`);
}

function controls(value: unknown, path: string): readonly CaptureFixtureControl[] {
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > CAPTURE_FIXTURE_MAX_CONTROLS
  ) fail(`Expected 1 through ${CAPTURE_FIXTURE_MAX_CONTROLS} fixture controls`, path);
  const parsed = value.map((entry, index) => control(entry, `${path}[${index}]`));
  const identities = parsed.map((entry) => (
    entry.kind === 'scene-visibility' ? `${entry.kind}:${entry.group}`
      : entry.kind === 'variant' ? `${entry.kind}:${entry.name}` : entry.kind
  ));
  if (new Set(identities).size !== identities.length) fail('Duplicate fixture control', path);
  return Object.freeze(parsed);
}

export function parseCaptureFixtureRequest(value: unknown): CaptureFixtureRequest {
  const record = object(value, '$');
  exactKeys(record, ['schemaVersion', 'fixtureName', 'controls'], '$');
  if (record.schemaVersion !== CAPTURE_FIXTURE_SCHEMA_VERSION) {
    fail('Unsupported capture fixture version', '$.schemaVersion');
  }
  return Object.freeze({
    schemaVersion: CAPTURE_FIXTURE_SCHEMA_VERSION,
    fixtureName: name(record.fixtureName, '$.fixtureName'),
    controls: controls(record.controls, '$.controls'),
  });
}

export function parseCaptureFixtureResult(
  value: unknown,
  expected?: CaptureFixtureRequest,
): CaptureFixtureResult {
  const record = object(value, '$');
  exactKeys(record, ['schemaVersion', 'fixtureName', 'appliedControls'], '$');
  const parsed = parseCaptureFixtureRequest({
    schemaVersion: record.schemaVersion,
    fixtureName: record.fixtureName,
    controls: record.appliedControls,
  });
  const result = Object.freeze({
    schemaVersion: CAPTURE_FIXTURE_SCHEMA_VERSION,
    fixtureName: parsed.fixtureName,
    appliedControls: parsed.controls,
  });
  if (expected && JSON.stringify(result.appliedControls) !== JSON.stringify(expected.controls)) {
    fail('Applied controls do not match the request', '$.appliedControls');
  }
  if (expected && result.fixtureName !== expected.fixtureName) {
    fail('Fixture name does not match the request', '$.fixtureName');
  }
  return result;
}

/** Build a game-local fixture surface from game-owned semantic names and bounds. */
export function createCaptureFixtureController(
  declaration: CaptureFixtureDeclaration,
): CaptureFixtureController {
  const fixtureName = name(declaration.fixtureName, '$.fixtureName');
  const sceneVisibility = { ...(declaration.sceneGroups ?? {}) };
  const variants = { ...(declaration.variants ?? {}) };
  for (const group of Object.keys(sceneVisibility)) name(group, '$.sceneGroups');
  for (const variant of Object.keys(variants)) name(variant, '$.variants');
  const maximumCameraTranslation = declaration.maximumCameraTranslation ?? 0;
  if (
    typeof maximumCameraTranslation !== 'number'
    || !Number.isFinite(maximumCameraTranslation)
    || maximumCameraTranslation < 0
    || maximumCameraTranslation > CAPTURE_FIXTURE_MAX_TRANSLATION
  ) fail('Invalid game camera-translation bound', '$.maximumCameraTranslation');
  let cameraTranslation: CaptureFixtureState['cameraTranslation'] = Object.freeze({
    x: 0,
    y: 0,
    z: 0,
  });

  const read = (): CaptureFixtureState => Object.freeze({
    sceneVisibility: Object.freeze({ ...sceneVisibility }),
    variants: Object.freeze({ ...variants }),
    cameraTranslation,
  });

  return Object.freeze({
    apply(requestInput: CaptureFixtureRequest): CaptureFixtureResult {
      const request = parseCaptureFixtureRequest(requestInput);
      if (request.fixtureName !== fixtureName) fail('Unknown game fixture', '$.fixtureName');
      for (const entry of request.controls) {
        if (entry.kind === 'scene-visibility') {
          if (!Object.hasOwn(sceneVisibility, entry.group)) {
            fail('Unknown game scene group', '$.controls');
          }
        } else if (entry.kind === 'variant') {
          if (!Object.hasOwn(variants, entry.name)) fail('Unknown game variant', '$.controls');
        } else if (
          Math.abs(entry.delta.x) > maximumCameraTranslation
          || Math.abs(entry.delta.y) > maximumCameraTranslation
          || Math.abs(entry.delta.z) > maximumCameraTranslation
        ) fail('Camera translation exceeds the game bound', '$.controls');
      }
      for (const entry of request.controls) {
        if (entry.kind === 'scene-visibility') sceneVisibility[entry.group] = entry.visible;
        else if (entry.kind === 'variant') variants[entry.name] = entry.enabled;
        else cameraTranslation = entry.delta;
      }
      return parseCaptureFixtureResult({
        schemaVersion: CAPTURE_FIXTURE_SCHEMA_VERSION,
        fixtureName,
        appliedControls: request.controls,
      }, request);
    },
    read,
  });
}
