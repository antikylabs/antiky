import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const defaultPublicationPath = path.join(repositoryRoot, 'packages/website/media-publication.json');
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const SOURCE_EXTENSION = /\.(?:css|js|jsx|mjs|ts|tsx)$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{40}$/;

export class MediaPublicationError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'MediaPublicationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new MediaPublicationError(code, message);
}

function record(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('MEDIA_SCHEMA_INVALID', `${label} must be an object`);
  }
  return value;
}

function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('MEDIA_SCHEMA_INVALID', `${label} must be a non-empty string`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail('MEDIA_SCHEMA_INVALID', `${label} must be a positive integer`);
  }
  return value;
}

function safeRepositoryPath(value, label) {
  const repositoryPath = nonEmpty(value, label);
  if (path.isAbsolute(repositoryPath) || repositoryPath.split('/').includes('..')) {
    fail('MEDIA_PATH_INVALID', `${label} must stay inside the repository`);
  }
  return repositoryPath;
}

function imageRecord(value, label) {
  const image = record(value, label);
  safeRepositoryPath(image.path, `${label}.path`);
  if (!SHA256.test(image.sha256 ?? '')) fail('MEDIA_SCHEMA_INVALID', `${label}.sha256 must be SHA-256`);
  positiveInteger(image.width, `${label}.width`);
  positiveInteger(image.height, `${label}.height`);
  return image;
}

/** Validate fields that do not require filesystem access. */
export function validateMediaPublication(publication) {
  record(publication, 'publication');
  if (publication.schemaVersion !== 1) fail('MEDIA_SCHEMA_INVALID', 'schemaVersion must be 1');
  nonEmpty(publication.reviewedAt, 'reviewedAt');
  if (!REVISION.test(publication.implementationRevision ?? '')) {
    fail('MEDIA_SCHEMA_INVALID', 'implementationRevision must be a full Git revision');
  }
  if (!Array.isArray(publication.entries) || publication.entries.length === 0) {
    fail('MEDIA_SCHEMA_INVALID', 'entries must be a non-empty array');
  }

  const ids = new Set();
  const deliveryPaths = new Map();
  const publicUrls = new Set();
  for (const [index, rawEntry] of publication.entries.entries()) {
    const entry = record(rawEntry, `entries[${index}]`);
    const id = nonEmpty(entry.id, `entries[${index}].id`);
    if (ids.has(id)) fail('MEDIA_ID_REUSED', `duplicate entry id ${id}`);
    ids.add(id);

    if (!['capture', 'generated'].includes(entry.sourceKind)) {
      fail('MEDIA_SOURCE_KIND_INVALID', `${id} has unsupported sourceKind ${entry.sourceKind}`);
    }
    if (!['Evidence', 'Illustrative'].includes(entry.publicRole)) {
      fail('MEDIA_PUBLIC_ROLE_INVALID', `${id} has unsupported publicRole ${entry.publicRole}`);
    }

    imageRecord(entry.master, `${id}.master`);
    const delivery = imageRecord(entry.delivery, `${id}.delivery`);
    const expectedPublicUrl = `/${path.posix.relative('packages/website/public', delivery.path)}`;
    if (delivery.publicUrl !== expectedPublicUrl || !delivery.publicUrl.startsWith('/media/')) {
      fail('MEDIA_PUBLIC_URL_INVALID', `${id} delivery URL must match its public path`);
    }
    positiveInteger(delivery.bytes, `${id}.delivery.bytes`);
    positiveInteger(delivery.maxBytes, `${id}.delivery.maxBytes`);
    if (delivery.bytes > delivery.maxBytes) {
      fail('MEDIA_DELIVERY_OVERSIZED', `${id} is ${delivery.bytes} bytes; limit is ${delivery.maxBytes}`);
    }

    const prior = deliveryPaths.get(delivery.path);
    if (prior !== undefined) {
      const code = entry.publicRole === 'Evidence' || prior.role === 'Evidence'
        ? 'MEDIA_EVIDENCE_REUSED'
        : 'MEDIA_DELIVERY_REUSED';
      fail(code, `${id} and ${prior.id} declare the same delivery file`);
    }
    deliveryPaths.set(delivery.path, { id, role: entry.publicRole });
    if (publicUrls.has(delivery.publicUrl)) fail('MEDIA_DELIVERY_REUSED', `${id} reuses ${delivery.publicUrl}`);
    publicUrls.add(delivery.publicUrl);

    if (!Array.isArray(entry.usedBy) || entry.usedBy.length === 0) {
      fail('MEDIA_UNREFERENCED', `${id} must name at least one route or launch placement`);
    }
    for (const owner of entry.usedBy) {
      if (typeof owner !== 'string' || (!owner.startsWith('/') && !owner.startsWith('launch-kit:'))) {
        fail('MEDIA_SCHEMA_INVALID', `${id}.usedBy contains invalid owner ${String(owner)}`);
      }
    }

    if (entry.sourceKind === 'capture') {
      if (entry.publicRole !== 'Evidence') {
        fail('MEDIA_CAPTURE_ROLE_INVALID', `${id} captures must be Evidence`);
      }
      const capture = record(entry.capture, `${id}.capture`);
      if (!REVISION.test(capture.sourceRevision ?? '')) {
        fail('MEDIA_CAPTURE_PROVENANCE_MISSING', `${id} needs a full source revision`);
      }
      nonEmpty(capture.capturedAt, `${id}.capture.capturedAt`);
      nonEmpty(capture.fixture, `${id}.capture.fixture`);
      if (capture.kind === 'managed-demo') {
        safeRepositoryPath(capture.sourceDirectory, `${id}.capture.sourceDirectory`);
        safeRepositoryPath(capture.metricsSidecar, `${id}.capture.metricsSidecar`);
        if (!/^[a-f0-9]{16}$/.test(capture.sourceDigest ?? '')) {
          fail('MEDIA_CAPTURE_PROVENANCE_MISSING', `${id} needs a managed source digest`);
        }
        positiveInteger(capture.sourceFileCount, `${id}.capture.sourceFileCount`);
        positiveInteger(capture.acceptedBuildRevision, `${id}.capture.acceptedBuildRevision`);
        positiveInteger(capture.selectedRun, `${id}.capture.selectedRun`);
        if (!SHA256.test(capture.inputSha256 ?? '')) {
          fail('MEDIA_CAPTURE_PROVENANCE_MISSING', `${id} needs its selected input digest`);
        }
        positiveInteger(capture.inputWidth, `${id}.capture.inputWidth`);
        positiveInteger(capture.inputHeight, `${id}.capture.inputHeight`);
      } else {
        nonEmpty(capture.state, `${id}.capture.state`);
      }
    } else {
      if (entry.publicRole !== 'Illustrative') {
        fail('MEDIA_GENERATED_ROLE_INVALID', `${id} generated media must be Illustrative`);
      }
      const generation = record(entry.generation, `${id}.generation`);
      if (
        typeof generation.method !== 'string' || generation.method.trim() === ''
        || typeof generation.generatedAt !== 'string' || generation.generatedAt.trim() === ''
        || typeof generation.promptSidecar !== 'string' || generation.promptSidecar.trim() === ''
      ) fail('MEDIA_GENERATED_PROVENANCE_MISSING', `${id} needs method, date, and prompt sidecar`);
      safeRepositoryPath(generation.promptSidecar, `${id}.generation.promptSidecar`);
      if (!Array.isArray(generation.references) || generation.references.length === 0) {
        fail('MEDIA_GENERATED_PROVENANCE_MISSING', `${id} needs its input-reference roles`);
      }
      for (const [referenceIndex, rawReference] of generation.references.entries()) {
        const reference = record(rawReference, `${id}.generation.references[${referenceIndex}]`);
        safeRepositoryPath(reference.path, `${id}.generation.references[${referenceIndex}].path`);
        if (!SHA256.test(reference.sha256 ?? '')) {
          fail('MEDIA_GENERATED_PROVENANCE_MISSING', `${id} needs the digest of each input reference`);
        }
        if (reference.archivePath !== undefined) {
          safeRepositoryPath(reference.archivePath, `${id}.generation.references[${referenceIndex}].archivePath`);
        }
        nonEmpty(reference.role, `${id}.generation.references[${referenceIndex}].role`);
      }
      if (typeof generation.approval !== 'object' || generation.approval === null) {
        fail('MEDIA_GENERATED_APPROVAL_MISSING', `${id} needs owner approval`);
      }
      const approval = record(generation.approval, `${id}.generation.approval`);
      if (approval.status !== 'approved') {
        fail('MEDIA_GENERATED_APPROVAL_MISSING', `${id} is not approved`);
      }
      nonEmpty(approval.approvedBy, `${id}.generation.approval.approvedBy`);
      nonEmpty(approval.approvedAt, `${id}.generation.approval.approvedAt`);
      nonEmpty(approval.basis, `${id}.generation.approval.basis`);
    }
  }

  return publication;
}

async function walkFiles(directory, predicate) {
  const files = [];
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && predicate(full)) files.push(full);
    }
  };
  await walk(directory);
  return files.sort();
}

async function bytesAt(root, repositoryPath, id) {
  try {
    return await readFile(path.join(root, repositoryPath));
  } catch (cause) {
    if (cause && typeof cause === 'object' && cause.code === 'ENOENT') {
      fail('MEDIA_FILE_MISSING', `${id} is missing ${repositoryPath}`);
    }
    throw cause;
  }
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function verifyImage(root, image, id, { delivery = false } = {}) {
  const bytes = await bytesAt(root, image.path, id);
  if (digest(bytes) !== image.sha256) fail('MEDIA_DIGEST_MISMATCH', `${id} changed: ${image.path}`);
  const metadata = await sharp(bytes).metadata();
  const extension = path.extname(image.path).slice(1).toLowerCase();
  const expectedFormat = extension === 'jpg' ? 'jpeg' : extension;
  if (metadata.format !== expectedFormat) {
    fail('MEDIA_FORMAT_MISMATCH', `${id} is ${metadata.format ?? 'unknown'}, not ${expectedFormat}`);
  }
  if (metadata.width !== image.width || metadata.height !== image.height) {
    fail('MEDIA_DIMENSIONS_MISMATCH', `${id} dimensions changed: ${image.path}`);
  }
  if (delivery) {
    if (bytes.length !== image.bytes) fail('MEDIA_BYTES_MISMATCH', `${id} byte count changed`);
    if (bytes.length > image.maxBytes) {
      fail('MEDIA_DELIVERY_OVERSIZED', `${id} is ${bytes.length} bytes; limit is ${image.maxBytes}`);
    }
  }
}

async function productionMediaReferences(root) {
  const sourceRoot = path.join(root, 'packages/website/src');
  const files = await walkFiles(sourceRoot, (file) => SOURCE_EXTENSION.test(file));
  const references = new Set();
  const pattern = /\/media\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|gif|jpe?g|png|svg|webp)/gi;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(pattern)) references.add(match[0]);
  }
  return references;
}

/** Validate files, current source freshness, and production ownership. */
export async function validateMediaPublicationFiles(publication, { root = repositoryRoot } = {}) {
  validateMediaPublication(publication);
  const declaredDeliveries = new Set(publication.entries.map((entry) => entry.delivery.path));
  const declaredMasters = new Set(publication.entries.map((entry) => entry.master.path));
  const declaredReferenceMasters = new Set(publication.entries.flatMap((entry) =>
    entry.generation?.references?.flatMap((reference) => [
      reference.path,
      ...(reference.archivePath === undefined ? [] : [reference.archivePath]),
    ]) ?? [],
  ));
  const declaredUrls = new Set(publication.entries.map((entry) => entry.delivery.publicUrl));

  for (const entry of publication.entries) {
    await verifyImage(root, entry.master, `${entry.id}.master`);
    await verifyImage(root, entry.delivery, `${entry.id}.delivery`, { delivery: true });

    if (entry.sourceKind === 'capture' && entry.capture.kind === 'managed-demo') {
      const { sourceDigest } = await import(path.join(root, 'scripts/shoot-demos.mjs'));
      const current = await sourceDigest(path.join(root, entry.capture.sourceDirectory));
      if (current.digest !== entry.capture.sourceDigest || current.fileCount !== entry.capture.sourceFileCount) {
        fail('MEDIA_SOURCE_STALE', `${entry.id} was captured from ${entry.capture.sourceDigest}; current source is ${current.digest}`);
      }
      const sidecar = JSON.parse(await bytesAt(root, entry.capture.metricsSidecar, entry.id));
      if (
        sidecar.source?.digest !== entry.capture.sourceDigest
        || sidecar.source?.fileCount !== entry.capture.sourceFileCount
        || sidecar.inspection?.fixture?.fixtureName !== entry.capture.fixture
        || sidecar.inspection?.observation?.acceptedBuildRevision !== entry.capture.acceptedBuildRevision
      ) fail('MEDIA_CAPTURE_SIDECAR_MISMATCH', `${entry.id} does not match its metrics sidecar`);
    }

    if (entry.sourceKind === 'generated') {
      const sidecar = (await bytesAt(root, entry.generation.promptSidecar, entry.id)).toString('utf8');
      if (!sidecar.includes(entry.generation.method) && !sidecar.includes('built-in ImageGen')) {
        fail('MEDIA_GENERATED_PROVENANCE_MISMATCH', `${entry.id} prompt record omits its method`);
      }
      for (const reference of entry.generation.references) {
        const referencePath = reference.archivePath ?? reference.path;
        const referenceBytes = await bytesAt(root, referencePath, entry.id);
        if (digest(referenceBytes) !== reference.sha256) {
          fail('MEDIA_GENERATED_PROVENANCE_MISMATCH', `${entry.id} input reference changed: ${referencePath}`);
        }
        if (!sidecar.includes(reference.path)) {
          fail('MEDIA_GENERATED_PROVENANCE_MISMATCH', `${entry.id} prompt record omits ${reference.path}`);
        }
      }
    }
  }

  const publicMediaRoot = path.join(root, 'packages/website/public/media');
  for (const file of await walkFiles(publicMediaRoot, (candidate) => IMAGE_EXTENSION.test(candidate))) {
    const repositoryPath = path.relative(root, file).split(path.sep).join('/');
    if (!declaredDeliveries.has(repositoryPath)) {
      fail('MEDIA_FILE_UNDECLARED', `${repositoryPath} has no publication entry`);
    }
  }
  const masterRoot = path.join(root, 'packages/website/media-masters');
  for (const file of await walkFiles(masterRoot, (candidate) => IMAGE_EXTENSION.test(candidate))) {
    const repositoryPath = path.relative(root, file).split(path.sep).join('/');
    if (!declaredMasters.has(repositoryPath) && !declaredReferenceMasters.has(repositoryPath)) {
      fail('MEDIA_FILE_UNDECLARED', `${repositoryPath} has no publication entry`);
    }
  }

  for (const reference of await productionMediaReferences(root)) {
    if (!declaredUrls.has(reference)) fail('MEDIA_REFERENCE_UNDECLARED', `${reference} is used by production source`);
  }

  const demoPublication = JSON.parse(await readFile(path.join(root, 'packages/website/demo-publication.json'), 'utf8'));
  for (const demo of demoPublication.demos) {
    if (!declaredUrls.has(`/media/demos/${demo.slug}.webp`)) {
      fail('MEDIA_REFERENCE_UNDECLARED', `demo catalog has no poster for ${demo.slug}`);
    }
  }
  return publication;
}

export async function readAndValidateMediaPublication({
  root = repositoryRoot,
  publicationPath = defaultPublicationPath,
} = {}) {
  const publication = JSON.parse(await readFile(publicationPath, 'utf8'));
  return validateMediaPublicationFiles(publication, { root });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const publication = await readAndValidateMediaPublication();
  process.stdout.write(`Validated ${publication.entries.length} media publication entries.\n`);
}
