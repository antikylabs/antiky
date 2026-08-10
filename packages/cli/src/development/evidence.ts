import {
  parseObservationRefV1,
  type ObservationRefV1,
} from './observation.ts';
import { AntikyCliError } from '../errors.ts';

export const EVIDENCE_REVIEW_STATE = 'private-unreviewed' as const;
export const EVIDENCE_MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
export const EVIDENCE_MIME_TYPES = Object.freeze([
  'image/png',
  'application/json',
  'video/webm',
] as const);

export type EvidenceMimeType = typeof EVIDENCE_MIME_TYPES[number];
export type EvidenceArtifactKind =
  | 'still'
  | 'sequence-frame'
  | 'poster'
  | 'manifest'
  | 'video'
  | 'presentation-trace';

export const EVIDENCE_ARTIFACT_KINDS = Object.freeze([
  'still', 'sequence-frame', 'poster', 'manifest', 'video', 'presentation-trace',
] as const satisfies readonly EvidenceArtifactKind[]);

export type RenderEvidenceQueryV1 = Readonly<{
  schemaVersion: 1;
  evidenceId?: string;
  artifactId?: string;
  kind?: EvidenceArtifactKind;
  limit: number;
}>;

export type RenderEvidenceResultV1 = Readonly<{
  schemaVersion: 1;
  developmentSessionId: string;
  availableCount: number;
  retainedCount: number;
  complete: boolean;
  artifacts: readonly Readonly<{
    creationSequence: number;
    artifact: EvidenceArtifactRefV1;
  }>[];
}>;

export type EvidenceArtifactRefV1 = Readonly<{
  schemaVersion: 1;
  evidenceId: string;
  artifactId: string;
  uri: string;
  kind: EvidenceArtifactKind;
  role: string;
  mimeType: EvidenceMimeType;
  width: number | null;
  height: number | null;
  byteLength: number;
  sha256: string;
  createdAt: string;
  observation: ObservationRefV1;
  reviewState: typeof EVIDENCE_REVIEW_STATE;
  retention: Readonly<{
    scope: 'development-session';
    state: 'retained';
  }>;
  privacy: Readonly<{
    gameCanvasOnly: true;
    desktopPixelsPossible: false;
    audio: 'none';
    contentScan: 'not-performed';
  }>;
}>;

type UnknownRecord = Record<string, unknown>;
const EVIDENCE_ID_PATTERN = /^evidence-[a-z0-9][a-z0-9-]{7,126}$/u;
const ARTIFACT_ID_PATTERN = /^artifact-[0-9a-f]{64}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const ROLE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

function invalid(message: string, path = '$'): never {
  throw new AntikyCliError('ANTIKY_EVIDENCE_INVALID', message, path);
}

function object(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Expected an evidence object.', path);
  }
  return value as UnknownRecord;
}

function keys(record: UnknownRecord, expectedKeys: readonly string[], path: string): void {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) invalid('Unknown evidence field.', `${path}.${key}`);
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(record, key)) invalid('Missing evidence field.', `${path}.${key}`);
  }
}

function count(value: unknown, path: string, positive = false): number {
  if (!Number.isSafeInteger(value) || (value as number) < (positive ? 1 : 0)) {
    invalid('Expected a bounded evidence count.', path);
  }
  return value as number;
}

function exactString(value: unknown, pattern: RegExp, path: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    invalid('Expected a canonical evidence string.', path);
  }
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length > 32) invalid('Invalid evidence time.', '$.createdAt');
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== value) {
    invalid('Invalid evidence time.', '$.createdAt');
  }
  return value;
}

export function parseEvidenceArtifactRefV1(value: unknown): EvidenceArtifactRefV1 {
  const record = object(value, '$');
  keys(record, [
    'schemaVersion', 'evidenceId', 'artifactId', 'uri', 'kind', 'role', 'mimeType',
    'width', 'height', 'byteLength', 'sha256', 'createdAt', 'observation',
    'reviewState', 'retention', 'privacy',
  ], '$');
  if (record.schemaVersion !== 1) invalid('Unsupported evidence version.', '$.schemaVersion');
  const evidenceId = exactString(record.evidenceId, EVIDENCE_ID_PATTERN, '$.evidenceId');
  const artifactId = exactString(record.artifactId, ARTIFACT_ID_PATTERN, '$.artifactId');
  const sha256 = exactString(record.sha256, HASH_PATTERN, '$.sha256');
  if (artifactId !== `artifact-${sha256}`) invalid('Artifact identity does not match its hash.', '$.artifactId');
  const expectedUri = `antiky-evidence://${evidenceId}/${artifactId}`;
  if (record.uri !== expectedUri) invalid('Evidence URI does not match its identities.', '$.uri');
  if (!EVIDENCE_ARTIFACT_KINDS.includes(record.kind as EvidenceArtifactKind)) {
    invalid('Unknown artifact kind.', '$.kind');
  }
  if (!EVIDENCE_MIME_TYPES.includes(record.mimeType as EvidenceMimeType)) {
    invalid('Unsupported evidence media type.', '$.mimeType');
  }
  const width = record.width === null ? null : count(record.width, '$.width', true);
  const height = record.height === null ? null : count(record.height, '$.height', true);
  if ((width === null) !== (height === null)) invalid('Evidence dimensions must be paired.', '$.width');
  if (width !== null && (width > 2560 || height! > 1440)) invalid('Evidence dimensions exceed limits.', '$.width');
  if (record.mimeType === 'image/png' && width === null) invalid('PNG evidence needs dimensions.', '$.width');
  const retention = object(record.retention, '$.retention');
  keys(retention, ['scope', 'state'], '$.retention');
  if (retention.scope !== 'development-session' || retention.state !== 'retained') {
    invalid('Invalid evidence retention.', '$.retention');
  }
  const privacy = object(record.privacy, '$.privacy');
  keys(privacy, [
    'gameCanvasOnly', 'desktopPixelsPossible', 'audio', 'contentScan',
  ], '$.privacy');
  if (
    privacy.gameCanvasOnly !== true
    || privacy.desktopPixelsPossible !== false
    || privacy.audio !== 'none'
    || privacy.contentScan !== 'not-performed'
  ) invalid('Invalid evidence privacy attestation.', '$.privacy');
  if (record.reviewState !== EVIDENCE_REVIEW_STATE) invalid('Invalid review state.', '$.reviewState');
  return Object.freeze({
    schemaVersion: 1,
    evidenceId,
    artifactId,
    uri: expectedUri,
    kind: record.kind as EvidenceArtifactKind,
    role: exactString(record.role, ROLE_PATTERN, '$.role'),
    mimeType: record.mimeType as EvidenceMimeType,
    width,
    height,
    byteLength: (() => {
      const byteLength = count(record.byteLength, '$.byteLength', true);
      if (byteLength > EVIDENCE_MAX_ARTIFACT_BYTES) {
        invalid('Evidence bytes exceed limits.', '$.byteLength');
      }
      return byteLength;
    })(),
    sha256,
    createdAt: timestamp(record.createdAt),
    observation: parseObservationRefV1(record.observation),
    reviewState: EVIDENCE_REVIEW_STATE,
    retention: Object.freeze({ scope: 'development-session', state: 'retained' }),
    privacy: Object.freeze({
      gameCanvasOnly: true,
      desktopPixelsPossible: false,
      audio: 'none',
      contentScan: 'not-performed',
    }),
  });
}

export function isEvidenceId(value: unknown): value is string {
  return typeof value === 'string' && EVIDENCE_ID_PATTERN.test(value);
}

export function isArtifactId(value: unknown): value is string {
  return typeof value === 'string' && ARTIFACT_ID_PATTERN.test(value);
}

export function parseRenderEvidenceQueryV1(value: unknown): RenderEvidenceQueryV1 {
  const record = object(value, '$');
  const allowed = new Set(['schemaVersion', 'evidenceId', 'artifactId', 'kind', 'limit']);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) invalid('Unknown render-evidence field.', `$.${key}`);
  }
  if (record.schemaVersion !== 1) invalid('Unsupported render-evidence query.', '$.schemaVersion');
  if (!Number.isSafeInteger(record.limit) || (record.limit as number) < 1 || (record.limit as number) > 256) {
    invalid('Render-evidence limit is invalid.', '$.limit');
  }
  if (record.evidenceId !== undefined && !isEvidenceId(record.evidenceId)) {
    invalid('Evidence identity is invalid.', '$.evidenceId');
  }
  if (record.artifactId !== undefined) {
    if (!isArtifactId(record.artifactId)) invalid('Artifact identity is invalid.', '$.artifactId');
    if (record.evidenceId === undefined) invalid('Exact artifact lookup needs evidence identity.', '$.evidenceId');
  }
  if (
    record.kind !== undefined
    && !EVIDENCE_ARTIFACT_KINDS.includes(record.kind as EvidenceArtifactKind)
  ) invalid('Evidence kind is invalid.', '$.kind');
  return Object.freeze({
    schemaVersion: 1,
    ...(record.evidenceId === undefined ? {} : { evidenceId: record.evidenceId as string }),
    ...(record.artifactId === undefined ? {} : { artifactId: record.artifactId as string }),
    ...(record.kind === undefined ? {} : { kind: record.kind as EvidenceArtifactKind }),
    limit: record.limit as number,
  });
}

export function parseRenderEvidenceResultV1(
  value: unknown,
  expectedDevelopmentSessionId?: string,
): RenderEvidenceResultV1 {
  const record = object(value, '$');
  keys(record, [
    'schemaVersion', 'developmentSessionId', 'availableCount', 'retainedCount',
    'complete', 'artifacts',
  ], '$');
  if (record.schemaVersion !== 1) invalid('Unsupported render-evidence result.', '$.schemaVersion');
  const developmentSessionId = exactString(
    record.developmentSessionId,
    /^[a-z0-9][a-z0-9-]{0,127}$/u,
    '$.developmentSessionId',
  );
  if (
    expectedDevelopmentSessionId !== undefined
    && developmentSessionId !== expectedDevelopmentSessionId
  ) invalid('Render evidence belongs to another session.', '$.developmentSessionId');
  const availableCount = count(record.availableCount, '$.availableCount');
  const retainedCount = count(record.retainedCount, '$.retainedCount');
  if (retainedCount > availableCount || typeof record.complete !== 'boolean') {
    invalid('Render-evidence counts are invalid.', '$.retainedCount');
  }
  if (!Array.isArray(record.artifacts) || record.artifacts.length !== retainedCount) {
    invalid('Render-evidence artifacts are invalid.', '$.artifacts');
  }
  let previousSequence = 0;
  const artifacts = Object.freeze(record.artifacts.map((value, index) => {
    const entry = object(value, `$.artifacts[${index}]`);
    keys(entry, ['creationSequence', 'artifact'], `$.artifacts[${index}]`);
    const creationSequence = count(
      entry.creationSequence,
      `$.artifacts[${index}].creationSequence`,
      true,
    );
    if (creationSequence <= previousSequence) {
      invalid('Render-evidence ordering is invalid.', `$.artifacts[${index}].creationSequence`);
    }
    previousSequence = creationSequence;
    const artifact = parseEvidenceArtifactRefV1(entry.artifact);
    if (artifact.observation.developmentSessionId !== developmentSessionId) {
      invalid('Evidence artifact belongs to another session.', `$.artifacts[${index}].artifact`);
    }
    return Object.freeze({ creationSequence, artifact });
  }));
  if (record.complete !== (availableCount === retainedCount)) {
    invalid('Render-evidence completeness is invalid.', '$.complete');
  }
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId,
    availableCount,
    retainedCount,
    complete: record.complete,
    artifacts,
  });
}
