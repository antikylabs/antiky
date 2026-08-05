import { createEvidenceContract } from '../../../../../scripts/verification/evidence.mjs';

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validateSlice01Domain(receipt, errors) {
  const commandRoles = new Map(
    Array.isArray(receipt.commands)
      ? receipt.commands.map((command) => [command.role, command])
      : [],
  );
  for (const role of ['change', 'correction']) {
    const command = commandRoles.get(role);
    if (!command) errors.push(`The ${role} command link is missing.`);
    else if (!uuidV7Pattern.test(command.commandId ?? '') || command.code !== 'ACCEPTED') {
      errors.push(`The ${role} command link is invalid.`);
    }
  }

  for (const projection of ['authoring', 'runtime', 'render']) {
    if (receipt.projections?.[projection] !== 'PASS') errors.push(`${projection} projection must pass.`);
  }
  if (
    typeof receipt.runtimes?.initial !== 'string'
    || typeof receipt.runtimes?.reloaded !== 'string'
    || receipt.runtimes.initial === receipt.runtimes.reloaded
  ) {
    errors.push('Initial and reloaded runtime links must be present and different.');
  }

  const captureRoles = new Set(
    Array.isArray(receipt.captures) ? receipt.captures.map((capture) => capture.role) : [],
  );
  for (const role of ['before', 'changed', 'corrected']) {
    if (!captureRoles.has(role)) errors.push(`The ${role} capture link is missing.`);
  }
}

const contract = createEvidenceContract({
  label: 'Slice 01',
  sliceId: 'slice-01',
  runIdPattern: /^s01-\d{8}T\d{6}Z$/,
  requiredArtifactPaths: [
    'baseline.json',
    'baseline.md',
    'captures/before.png',
    'captures/changed.png',
    'captures/corrected.png',
    'confirmation-checks.md',
    'facts.json',
    'measurements.json',
    'receipt.json',
  ],
  checkpointIds: ['CP-00', 'CP-01', 'CP-02', 'CP-03', 'CP-04', 'CP-05'],
  statusCollections: ['tests', 'acceptance', 'completionChecks'],
  validateDomain: validateSlice01Domain,
});

export const {
  artifactFor,
  sealReceipt,
  validateArtifactDigests,
  validateReceipt,
  writeJsonAtomic,
  writeReceiptAtomic,
  writeTextAtomic,
} = contract;
