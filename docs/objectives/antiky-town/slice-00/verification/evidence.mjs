import { createEvidenceContract } from '../../../../../scripts/verification/evidence.mjs';

const contract = createEvidenceContract({
  label: 'Slice 00',
  sliceId: 'slice-00',
  runIdPattern: /^s00-\d{8}T\d{6}Z$/,
  requiredArtifactPaths: [
    'confirmation-checks.md',
    'facts.json',
    'measurements.json',
    'receipt.json',
  ],
  checkpointIds: ['CP-00', 'CP-01', 'CP-02', 'CP-03', 'CP-04', 'CP-05'],
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
