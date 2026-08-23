import type { AssetVerification } from '@antiky/asset-catalog';

export const VERIFICATION_COPY: Record<AssetVerification, Readonly<{
  label: string;
  description: string;
}>> = {
  cataloged: {
    label: 'Cataloged metadata',
    description: 'Source, license, preview, and descriptive metadata are cataloged. Download files are not verified.',
  },
  'source-verified': {
    label: 'Source metadata verified',
    description: 'Metadata came from an authoritative provider API. Download files are not verified for installation.',
  },
  'install-verified': {
    label: 'Install verified',
    description: 'Selected download files include sizes and hashes that Antiky checks during installation.',
  },
};

export function fileCountLabel(fileCount: number | null, includeSource = false): string {
  if (fileCount === null) return 'File count not published';
  return `${fileCount} ${includeSource ? 'source ' : ''}${fileCount === 1 ? 'file' : 'files'}`;
}
