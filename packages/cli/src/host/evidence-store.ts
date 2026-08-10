import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ObservationRefV1 } from '../development/observation.ts';
import {
  isArtifactId,
  isEvidenceId,
  EVIDENCE_ARTIFACT_KINDS,
  EVIDENCE_MAX_ARTIFACT_BYTES,
  parseEvidenceArtifactRefV1,
  type EvidenceArtifactKind,
  type EvidenceArtifactRefV1,
  type EvidenceMimeType,
} from '../development/evidence.ts';
import { AntikyCliError } from '../errors.ts';

export { parseEvidenceArtifactRefV1 } from '../development/evidence.ts';

export const MAX_EVIDENCE_ARTIFACT_BYTES = EVIDENCE_MAX_ARTIFACT_BYTES;
export const MAX_RETAINED_EVIDENCE = 32;
export const MAX_LISTED_EVIDENCE_ARTIFACTS = 256;

export type EvidencePutInput = Readonly<{
  evidenceId: string;
  kind: EvidenceArtifactKind;
  role: string;
  mimeType: EvidenceMimeType;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
  observation: ObservationRefV1;
}>;

export type EvidenceLookup = Readonly<{
  evidenceId: string;
  artifactId: string;
}>;

export type EvidenceArtifact = Readonly<{
  artifact: EvidenceArtifactRefV1;
  bytes: Buffer;
}>;

export type EvidenceListInput = Readonly<{
  evidenceId?: string;
  kind?: EvidenceArtifactKind;
  limit: number;
}>;

export type EvidenceListResult = Readonly<{
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

export interface EvidenceStore {
  put(input: EvidencePutInput): Promise<EvidenceArtifactRefV1>;
  read(lookup: EvidenceLookup): Promise<EvidenceArtifact>;
  list(input: EvidenceListInput): EvidenceListResult;
  discard(evidenceId: string): Promise<void>;
  stop(): Promise<void>;
}

type StoredArtifact = Readonly<{
  artifact: EvidenceArtifactRefV1;
  path: string;
  creationSequence: number;
}>;

type EvidenceStoreOptions = Readonly<{
  rootDirectory: string;
  developmentSessionId: string;
  now?: () => string;
  maximumRetainedEvidence?: number;
}>;

function notFound(): never {
  throw new AntikyCliError('ANTIKY_EVIDENCE_NOT_FOUND', 'The evidence artifact is unavailable.');
}

function extension(mimeType: EvidenceMimeType): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'video/webm') return 'webm';
  return 'json';
}

export function createEvidenceStore(options: EvidenceStoreOptions): EvidenceStore {
  const sessionKey = createHash('sha256').update(options.developmentSessionId).digest('hex');
  const directory = join(options.rootDirectory, '.antiky', 'evidence', sessionKey);
  const now = options.now ?? (() => new Date().toISOString());
  const maximumRetainedEvidence = options.maximumRetainedEvidence ?? MAX_RETAINED_EVIDENCE;
  if (
    !Number.isSafeInteger(maximumRetainedEvidence)
    || maximumRetainedEvidence < 1
    || maximumRetainedEvidence > MAX_RETAINED_EVIDENCE
  ) throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', 'Evidence retention limit is invalid.');
  const artifacts = new Map<string, StoredArtifact>();
  const evidenceIds = new Set<string>();
  let nextCreationSequence = 0;
  let stopped = false;

  const requireLookup = (lookup: EvidenceLookup): string => {
    if (!isEvidenceId(lookup.evidenceId) || !isArtifactId(lookup.artifactId)) {
      throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', 'Evidence identities are invalid.');
    }
    return `${lookup.evidenceId}/${lookup.artifactId}`;
  };

  return Object.freeze({
    async put(input: EvidencePutInput): Promise<EvidenceArtifactRefV1> {
      if (stopped) throw new AntikyCliError('ANTIKY_EVIDENCE_STORE_FAILED', 'The evidence store stopped.');
      if (!isEvidenceId(input.evidenceId)) {
        throw new AntikyCliError('ANTIKY_EVIDENCE_INVALID', 'Evidence identity is invalid.');
      }
      if (input.observation.developmentSessionId !== options.developmentSessionId) {
        throw new AntikyCliError('ANTIKY_EVIDENCE_INVALID', 'Evidence belongs to another session.');
      }
      if (!evidenceIds.has(input.evidenceId) && evidenceIds.size >= maximumRetainedEvidence) {
        throw new AntikyCliError(
          'CAPTURE_LIMIT_EXCEEDED',
          'Private evidence retention is full; stop the session or discard evidence and retry.',
        );
      }
      if (input.bytes.byteLength < 1 || input.bytes.byteLength > MAX_EVIDENCE_ARTIFACT_BYTES) {
        throw new AntikyCliError('ANTIKY_EVIDENCE_INVALID', 'Evidence bytes exceed limits.');
      }
      const bytes = Buffer.from(input.bytes);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const artifactId = `artifact-${sha256}`;
      const artifact = parseEvidenceArtifactRefV1({
        schemaVersion: 1,
        evidenceId: input.evidenceId,
        artifactId,
        uri: `antiky-evidence://${input.evidenceId}/${artifactId}`,
        kind: input.kind,
        role: input.role,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        byteLength: bytes.byteLength,
        sha256,
        createdAt: now(),
        observation: input.observation,
        reviewState: 'private-unreviewed',
        retention: { scope: 'development-session', state: 'retained' },
        privacy: {
          gameCanvasOnly: true,
          desktopPixelsPossible: false,
          audio: 'none',
          contentScan: 'not-performed',
        },
      });
      const key = `${artifact.evidenceId}/${artifact.artifactId}`;
      const existing = artifacts.get(key);
      if (existing) return existing.artifact;
      const evidenceDirectory = join(directory, artifact.evidenceId);
      const path = join(evidenceDirectory, `${artifact.artifactId}.${extension(artifact.mimeType)}`);
      const temporaryPath = `${path}.${randomUUID()}.tmp`;
      let committed = false;
      try {
        await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
        await chmod(evidenceDirectory, 0o700);
        await writeFile(temporaryPath, bytes, { flag: 'wx', mode: 0o600 });
        await rename(temporaryPath, path);
        await chmod(path, 0o600);
        committed = true;
        nextCreationSequence += 1;
        artifacts.set(key, Object.freeze({ artifact, path, creationSequence: nextCreationSequence }));
        evidenceIds.add(input.evidenceId);
        return artifact;
      } catch {
        throw new AntikyCliError(
          'ANTIKY_EVIDENCE_STORE_FAILED',
          'The evidence artifact could not be stored.',
        );
      } finally {
        await Promise.allSettled([
          rm(temporaryPath, { force: true }),
          ...(committed ? [] : [rm(path, { force: true })]),
        ]);
      }
    },
    async read(lookup: EvidenceLookup): Promise<EvidenceArtifact> {
      if (stopped) notFound();
      const stored = artifacts.get(requireLookup(lookup));
      if (!stored) notFound();
      try {
        const bytes = await readFile(stored.path);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (sha256 !== stored.artifact.sha256 || bytes.byteLength !== stored.artifact.byteLength) {
          notFound();
        }
        return Object.freeze({ artifact: stored.artifact, bytes });
      } catch (cause: unknown) {
        if (cause instanceof AntikyCliError) throw cause;
        notFound();
      }
    },
    list(input: EvidenceListInput): EvidenceListResult {
      if (stopped) notFound();
      if (
        !Number.isSafeInteger(input.limit)
        || input.limit < 1
        || input.limit > MAX_LISTED_EVIDENCE_ARTIFACTS
      ) throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', 'Evidence list limit is invalid.');
      if (input.evidenceId !== undefined && !isEvidenceId(input.evidenceId)) {
        throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', 'Evidence identity is invalid.');
      }
      if (input.kind !== undefined && !EVIDENCE_ARTIFACT_KINDS.includes(input.kind)) {
        throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', 'Evidence kind is invalid.');
      }
      const matches = [...artifacts.values()]
        .filter(({ artifact }) => (
          (input.evidenceId === undefined || artifact.evidenceId === input.evidenceId)
          && (input.kind === undefined || artifact.kind === input.kind)
        ))
        .sort((left, right) => left.creationSequence - right.creationSequence);
      return Object.freeze({
        schemaVersion: 1,
        developmentSessionId: options.developmentSessionId,
        availableCount: matches.length,
        retainedCount: Math.min(matches.length, input.limit),
        complete: matches.length <= input.limit,
        artifacts: Object.freeze(matches.slice(0, input.limit).map((stored) => Object.freeze({
          creationSequence: stored.creationSequence,
          artifact: stored.artifact,
        }))),
      });
    },
    async discard(evidenceId: string): Promise<void> {
      if (!isEvidenceId(evidenceId)) {
        throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', 'Evidence identity is invalid.');
      }
      for (const [key, stored] of artifacts) {
        if (stored.artifact.evidenceId === evidenceId) artifacts.delete(key);
      }
      evidenceIds.delete(evidenceId);
      await rm(join(directory, evidenceId), { recursive: true, force: true });
    },
    async stop(): Promise<void> {
      if (stopped) return;
      stopped = true;
      artifacts.clear();
      evidenceIds.clear();
      await rm(directory, { recursive: true, force: true });
    },
  });
}
