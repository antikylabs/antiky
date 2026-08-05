const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_UUID_TIMESTAMP = (2 ** 48) - 1;
const RANDOM_BYTE_COUNT = 10;

declare const worldIdBrand: unique symbol;
declare const entityIdBrand: unique symbol;
declare const commandIdBrand: unique symbol;

export type WorldId = string & { readonly [worldIdBrand]: 'WorldId' };
export type EntityId = string & { readonly [entityIdBrand]: 'EntityId' };
export type CommandId = string & { readonly [commandIdBrand]: 'CommandId' };

export type UuidV7CreationSource = Readonly<{
  timestampMilliseconds: number;
  randomBytes: readonly number[];
}>;

export class IdValidationError extends Error {
  readonly code = 'ANTIKY_INVALID_UUID_V7';

  constructor(message: string) {
    super(message);
    this.name = 'IdValidationError';
  }
}

function systemSource(): UuidV7CreationSource {
  return {
    timestampMilliseconds: Date.now(),
    randomBytes: Array.from(
      { length: RANDOM_BYTE_COUNT },
      () => Math.floor(Math.random() * 256),
    ),
  };
}

function byteHex(value: number): string {
  return value.toString(16).padStart(2, '0');
}

function createUuidV7(source: UuidV7CreationSource = systemSource()): string {
  const { timestampMilliseconds, randomBytes } = source;
  if (
    !Number.isSafeInteger(timestampMilliseconds)
    || timestampMilliseconds < 0
    || timestampMilliseconds > MAX_UUID_TIMESTAMP
  ) {
    throw new IdValidationError('UUIDv7 timestamp must be a non-negative 48-bit integer.');
  }
  if (!Array.isArray(randomBytes) || randomBytes.length !== RANDOM_BYTE_COUNT) {
    throw new IdValidationError(`UUIDv7 creation needs exactly ${RANDOM_BYTE_COUNT} random bytes.`);
  }
  for (const byte of randomBytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new IdValidationError('Each UUIDv7 random byte must be an integer from 0 through 255.');
    }
  }

  const timestamp = timestampMilliseconds.toString(16).padStart(12, '0');
  const versionAndRandom = 0x70 | (randomBytes[0]! & 0x0f);
  const variantAndRandom = 0x80 | (randomBytes[2]! & 0x3f);
  return [
    timestamp.slice(0, 8),
    timestamp.slice(8),
    `${byteHex(versionAndRandom)}${byteHex(randomBytes[1]!)}`,
    `${byteHex(variantAndRandom)}${byteHex(randomBytes[3]!)}`,
    randomBytes.slice(4).map(byteHex).join(''),
  ].join('-');
}

function parseUuidV7(value: unknown, type: string): string {
  if (typeof value !== 'string' || !UUID_V7_PATTERN.test(value)) {
    throw new IdValidationError(`${type} must be a canonical lowercase UUIDv7 value.`);
  }
  return value;
}

export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_PATTERN.test(value);
}

export function createWorldId(source?: UuidV7CreationSource): WorldId {
  return createUuidV7(source) as WorldId;
}

export function createEntityId(source?: UuidV7CreationSource): EntityId {
  return createUuidV7(source) as EntityId;
}

export function createCommandId(source?: UuidV7CreationSource): CommandId {
  return createUuidV7(source) as CommandId;
}

export function parseWorldId(value: unknown): WorldId {
  return parseUuidV7(value, 'WorldId') as WorldId;
}

export function parseEntityId(value: unknown): EntityId {
  return parseUuidV7(value, 'EntityId') as EntityId;
}

export function parseCommandId(value: unknown): CommandId {
  return parseUuidV7(value, 'CommandId') as CommandId;
}
