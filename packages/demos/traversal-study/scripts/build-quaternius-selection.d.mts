export type SelectionEntry = Readonly<{ name: string; bytes: Uint8Array }>;

export const QUATERNIUS_SELECTION_FILES: readonly string[];

export function createDeterministicSelectionZip(entries: readonly SelectionEntry[]): Buffer;

export function buildQuaterniusSelectionArchive(
  sourceDirectory: string,
  outputPath: string,
): Promise<Readonly<{
  outputPath: string;
  bytes: number;
  sha256: string;
  entries: readonly string[];
}>>;
