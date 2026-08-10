import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ObservationRefV1 } from '../development/observation.ts';
import {
  isArtifactId,
  isEvidenceId,
  EVIDENCE_MAX_ARTIFACT_BYTES,
  parseEvidenceArtifactRefV1,
  type EvidenceArtifactKind,
  type EvidenceArtifactRefV1,
  type EvidenceMimeType,
} from '../development/evidence.ts';
import { AntikyCliError } from '../errors.ts';

export { parseEvidenceArtifactRefV1 } from '../development/evidence.ts';

export const MAX_EVIDENCE_ARTIFACT_BYTES = EVIDENCE_MAX_ARTIFACT_BYTES;

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

export interface EvidenceStore {
  put(input: EvidencePutInput): Promise<EvidenceArtifactRefV1>;
  read(lookup: EvidenceLookup): Promise<EvidenceArtifact>;
  stop(): Promise<void>;
}

type StoredArtifact = Readonly<{
  artifact: EvidenceArtifactRefV1;
  path: string;
}>;

type EvidenceStoreOptions = Readonly<{
  rootDirectory: string;
  developmentSessionId: string;
  now?: () => string;
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
  const artifacts = new Map<string, StoredArtifact>();
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
        artifacts.set(key, Object.freeze({ artifact, path }));
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
    async stop(): Promise<void> {
      if (stopped) return;
      stopped = true;
      artifacts.clear();
      await rm(directory, { recursive: true, force: true });
    },
  });
}
