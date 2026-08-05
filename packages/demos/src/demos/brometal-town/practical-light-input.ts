export const MIN_TOWN_SLOT_ZERO_POWER = 0;
export const MAX_TOWN_SLOT_ZERO_POWER = 4;

export type TownSlotZeroPowerSource = Readonly<{
  readPendingBasePower(): number | undefined;
  commitPendingBasePower(power: number): void;
}>;

export type TownDemoOptions = Readonly<{
  slotZeroPower?: TownSlotZeroPowerSource;
}>;

export type TownSlotZeroPowerSample = Readonly<{
  basePower: number;
  hasReplacement: boolean;
}>;

function isValidBasePower(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_TOWN_SLOT_ZERO_POWER
    && value <= MAX_TOWN_SLOT_ZERO_POWER
  );
}

/** Reads the optional framework replacement without allowing a bad adapter to
 * replace the last frame's valid renderer value. */
export function readTownSlotZeroPower(
  source: TownSlotZeroPowerSource | undefined,
  lastValidBasePower: number,
): TownSlotZeroPowerSample {
  if (!source) {
    return Object.freeze({ basePower: lastValidBasePower, hasReplacement: false });
  }
  try {
    const replacement = source.readPendingBasePower();
    if (isValidBasePower(replacement)) {
      return Object.freeze({ basePower: replacement, hasReplacement: true });
    }
  } catch {
    // A renderer frame remains usable with its last applied value.
  }
  return Object.freeze({ basePower: lastValidBasePower, hasReplacement: false });
}

/** Called only after the renderer completes the frame that used the sample. */
export function commitTownSlotZeroPower(
  source: TownSlotZeroPowerSource | undefined,
  sample: TownSlotZeroPowerSample,
): number {
  if (source && sample.hasReplacement) {
    try {
      source.commitPendingBasePower(sample.basePower);
    } catch {
      // The rendered value stays valid. A pending framework change can retry.
    }
  }
  return sample.basePower;
}
