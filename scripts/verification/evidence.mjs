import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

const revisionPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const failureClasses = new Set([
  'AUTHORITY_BLOCK',
  'DEFECT',
  'EVIDENCE_FAILURE',
  'EXPECTED_REJECTION',
  'STALE_RUN',
  'TRANSIENT',
]);
const forbiddenKeyPattern = /(?:authorization|credential|password|private.?key|secret|token)/i;

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeRelativePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !path.isAbsolute(value)
    && value === value.replaceAll('\\', '/')
    && !value.split('/').includes('..')
    && path.normalize(value) === value;
}

function findSecretBearingFields(value, location = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSecretBearingFields(item, `${location}[${index}]`, found));
    return found;
  }
  if (!isRecord(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (forbiddenKeyPattern.test(key)) found.push(childLocation);
    if (typeof child === 'string' && /^Bearer\s/i.test(child)) found.push(childLocation);
    findSecretBearingFields(child, childLocation, found);
  }
  return found;
}

function receiptWithEmptySelfDigest(receipt) {
  const copy = structuredClone(receipt);
  const self = copy.artifacts?.find((artifact) => artifact.path === 'receipt.json');
  if (self) self.sha256 = null;
  return copy;
}

function validateStatuses(entries, label, errors) {
  if (!Array.isArray(entries) || entries.length === 0) {
    errors.push(`${label} must contain at least one result.`);
    return;
  }
  for (const entry of entries) {
    if (!isRecord(entry) || !['PASS', 'N/A'].includes(entry.status)) {
      errors.push(`${label} contains a result that is not PASS or N/A.`);
    } else if (entry.status === 'N/A' && !(typeof entry.reason === 'string' && entry.reason)) {
      errors.push(`${label} contains N/A without a reason.`);
    }
  }
}

async function writeAtomic(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await access(file).then(
    () => { throw new Error(`Refusing to overwrite existing evidence: ${file}`); },
    () => undefined,
  );
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function artifactFor(outputDirectory, relativePath) {
  if (!safeRelativePath(relativePath)) throw new Error(`Unsafe artifact path: ${relativePath}`);
  const absolutePath = path.join(outputDirectory, relativePath);
  const [content, metadata] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  if (!metadata.isFile()) throw new Error(`Artifact is not a file: ${relativePath}`);
  return { path: relativePath, sha256: sha256(content), bytes: metadata.size };
}

export function sealReceipt(receipt) {
  const sealed = structuredClone(receipt);
  const self = sealed.artifacts?.find((artifact) => artifact.path === 'receipt.json');
  if (!self) throw new Error('Receipt artifact entry is required before sealing.');
  self.sha256 = sha256(canonicalJson(receiptWithEmptySelfDigest(sealed)));
  return sealed;
}

export async function writeJsonAtomic(file, value) {
  await writeAtomic(file, canonicalJson(value));
}

export async function writeTextAtomic(file, value) {
  await writeAtomic(file, value);
}

export function createEvidenceContract({
  label,
  sliceId,
  runIdPattern,
  requiredArtifactPaths,
  checkpointIds,
  statusCollections = ['acceptance', 'completionChecks'],
  validateDomain = () => undefined,
}) {
  const requiredArtifacts = new Set(requiredArtifactPaths);
  const requiredCheckpoints = [...checkpointIds];

  function validateReceipt(receipt) {
    const errors = [];
    if (!isRecord(receipt)) return ['Receipt must be an object.'];
    if (receipt.schemaVersion !== 1) errors.push('Receipt schemaVersion must be 1.');
    if (receipt.sliceId !== sliceId) errors.push(`Receipt sliceId must be ${sliceId}.`);
    if (!runIdPattern.test(receipt.runId ?? '')) errors.push('Receipt runId is invalid.');
    if (receipt.runState !== 'CLOSED') errors.push('Receipt runState must be CLOSED.');
    if (receipt.result !== 'PASS') errors.push('Receipt result must be PASS.');
    if (!revisionPattern.test(receipt.sourceRevision ?? '')) errors.push('sourceRevision is invalid.');
    if (!revisionPattern.test(receipt.finalRevision ?? '')) errors.push('finalRevision is invalid.');
    if (!isRecord(receipt.runSetup)) errors.push('runSetup is required.');
    if (!Array.isArray(receipt.permissions) || receipt.permissions.length === 0) {
      errors.push('permissions must contain at least one operation.');
    }

    const checkpointMap = new Map(
      Array.isArray(receipt.checkpoints)
        ? receipt.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint])
        : [],
    );
    for (const id of requiredCheckpoints) {
      const checkpoint = checkpointMap.get(id);
      if (!checkpoint) errors.push(`${id} is missing from checkpoints.`);
      else if (checkpoint.status !== 'PASS' || !revisionPattern.test(checkpoint.commit ?? '')) {
        errors.push(`${id} must have PASS status and a full commit revision.`);
      }
    }

    if (!Array.isArray(receipt.attempts) || receipt.attempts.length === 0) {
      errors.push('attempts must contain at least one attempt.');
    } else {
      const identifiers = new Set();
      for (const attempt of receipt.attempts) {
        if (!isRecord(attempt) || typeof attempt.id !== 'string' || identifiers.has(attempt.id)) {
          errors.push('attempt IDs must be present and unique.');
          continue;
        }
        identifiers.add(attempt.id);
        if (attempt.result === 'FAIL' && !failureClasses.has(attempt.failureClass)) {
          errors.push(`${attempt.id} failed without a valid failure class.`);
        }
        if (!['PASS', 'FAIL'].includes(attempt.result)) {
          errors.push(`${attempt.id} has an invalid result.`);
        }
      }
    }

    for (const collection of statusCollections) {
      validateStatuses(receipt[collection], collection, errors);
    }
    if (!Array.isArray(receipt.rubric) || receipt.rubric.length === 0) {
      errors.push('rubric must contain at least one score.');
    } else {
      for (const row of receipt.rubric) {
        if (row?.score !== 3 && row?.status !== 'N/A') {
          errors.push('Every applicable rubric score must be 3.');
        }
        if (row?.status === 'N/A' && !(typeof row.reason === 'string' && row.reason)) {
          errors.push('Every N/A rubric score needs a reason.');
        }
      }
    }
    if (receipt.goalAudit?.status !== 'PASS') errors.push('goalAudit must have PASS status.');

    const afterCompletionKeys = ['owner', 'health', 'feedback', 'rollback', 'retirement'];
    if (!isRecord(receipt.afterCompletion)) errors.push('afterCompletion is required.');
    else for (const key of afterCompletionKeys) {
      if (!(typeof receipt.afterCompletion[key] === 'string' && receipt.afterCompletion[key])) {
        errors.push(`afterCompletion.${key} is required.`);
      }
    }

    validateDomain(receipt, errors, { isRecord, safeRelativePath });

    const artifacts = Array.isArray(receipt.artifacts) ? receipt.artifacts : [];
    const artifactPaths = new Set();
    for (const artifact of artifacts) {
      if (!isRecord(artifact) || !safeRelativePath(artifact.path)) {
        errors.push('Every artifact needs a safe relative path.');
        continue;
      }
      if (artifactPaths.has(artifact.path)) errors.push(`Duplicate artifact path: ${artifact.path}.`);
      artifactPaths.add(artifact.path);
      if (!digestPattern.test(artifact.sha256 ?? '')) {
        errors.push(`Artifact ${artifact.path} has an invalid SHA-256 digest.`);
      }
    }
    for (const requiredPath of requiredArtifacts) {
      if (!artifactPaths.has(requiredPath)) errors.push(`Required artifact is missing: ${requiredPath}.`);
    }

    const self = artifacts.find((artifact) => artifact.path === 'receipt.json');
    if (self && digestPattern.test(self.sha256 ?? '')) {
      const expected = sha256(canonicalJson(receiptWithEmptySelfDigest(receipt)));
      if (self.sha256 !== expected) errors.push('Receipt canonical self digest does not match.');
      if (self.digestScope !== 'canonical-json-with-null-self-digest') {
        errors.push('Receipt digest scope is invalid.');
      }
    }
    for (const location of findSecretBearingFields(receipt)) {
      errors.push(`Receipt contains a secret-bearing key or value at ${location}.`);
    }
    return errors;
  }

  async function writeReceiptAtomic(file, receipt) {
    const errors = validateReceipt(receipt);
    if (errors.length > 0) throw new Error(`Invalid ${label} receipt:\n${errors.join('\n')}`);
    await writeAtomic(file, canonicalJson(receipt));
  }

  async function validateArtifactDigests(receipt, outputDirectory) {
    const errors = [...validateReceipt(receipt)];
    for (const artifact of receipt.artifacts ?? []) {
      if (artifact.path === 'receipt.json' || !safeRelativePath(artifact.path)) continue;
      try {
        const actual = await artifactFor(outputDirectory, artifact.path);
        if (actual.sha256 !== artifact.sha256 || actual.bytes !== artifact.bytes) {
          errors.push(`Artifact digest or size changed: ${artifact.path}.`);
        }
      } catch (error) {
        errors.push(`Artifact cannot be read: ${artifact.path}: ${error.message}`);
      }
    }
    try {
      const stored = JSON.parse(await readFile(path.join(outputDirectory, 'receipt.json'), 'utf8'));
      if (canonicalJson(stored) !== canonicalJson(receipt)) errors.push('Stored receipt content changed.');
    } catch (error) {
      errors.push(`Stored receipt cannot be read: ${error.message}`);
    }
    return errors;
  }

  return Object.freeze({
    artifactFor,
    sealReceipt,
    validateArtifactDigests,
    validateReceipt,
    writeJsonAtomic,
    writeReceiptAtomic,
    writeTextAtomic,
  });
}
