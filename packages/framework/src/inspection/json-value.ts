export const MAX_INSPECTION_JSON_BYTES = 8 * 1024;
export const MAX_INSPECTION_JSON_DEPTH = 8;
export const MAX_INSPECTION_JSON_ITEMS = 128;
export const MAX_INSPECTION_JSON_STRING_LENGTH = 4_096;
export const MAX_INSPECTION_JSON_KEY_LENGTH = 128;

export type InspectionJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly InspectionJsonValue[]
  | Readonly<{ [key: string]: InspectionJsonValue }>;

export class InspectionJsonValueError extends Error {
  constructor(
    readonly reason: string,
    readonly path: string,
  ) {
    super(`${reason} at ${path}`);
    this.name = 'InspectionJsonValueError';
  }
}

function fail(reason: string, path: string): never {
  throw new InspectionJsonValueError(reason, path);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

function cloneValue(
  value: unknown,
  path: string,
  depth: number,
  ancestors: WeakSet<object>,
): InspectionJsonValue {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('Expected a finite JSON number', path);
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_INSPECTION_JSON_STRING_LENGTH) {
      fail(
        `Expected at most ${MAX_INSPECTION_JSON_STRING_LENGTH} string characters`,
        path,
      );
    }
    return value;
  }
  if (typeof value !== 'object') fail('Expected a JSON value', path);
  if (depth >= MAX_INSPECTION_JSON_DEPTH) {
    fail(`Expected at most ${MAX_INSPECTION_JSON_DEPTH} nested levels`, path);
  }
  if (ancestors.has(value)) fail('Expected an acyclic JSON value', path);
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_INSPECTION_JSON_ITEMS) {
        fail(`Expected at most ${MAX_INSPECTION_JSON_ITEMS} array items`, path);
      }
      return Object.freeze(value.map((item, index) => (
        cloneValue(item, `${path}[${index}]`, depth + 1, ancestors)
      )));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail('Expected a plain JSON object', path);
    }
    const keys = Object.keys(value);
    if (Reflect.ownKeys(value).length !== keys.length) {
      fail('Expected only enumerable string fields', path);
    }
    if (keys.length > MAX_INSPECTION_JSON_ITEMS) {
      fail(`Expected at most ${MAX_INSPECTION_JSON_ITEMS} object fields`, path);
    }

    const clone: Record<string, InspectionJsonValue> = {};
    for (const key of keys.sort((left, right) => left.localeCompare(right))) {
      if (key.length === 0 || key.length > MAX_INSPECTION_JSON_KEY_LENGTH) {
        fail(
          `Expected field names from 1 through ${MAX_INSPECTION_JSON_KEY_LENGTH} characters`,
          `${path}.${key}`,
        );
      }
      clone[key] = cloneValue(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
        depth + 1,
        ancestors,
      );
    }
    return Object.freeze(clone);
  } finally {
    ancestors.delete(value);
  }
}

export function cloneInspectionJson(
  value: unknown,
  path: string,
  maximumBytes = MAX_INSPECTION_JSON_BYTES,
): InspectionJsonValue {
  const clone = cloneValue(value, path, 0, new WeakSet());
  const encoded = JSON.stringify(clone);
  if (utf8ByteLength(encoded) > maximumBytes) {
    fail(`Expected encoded JSON no larger than ${maximumBytes} bytes`, path);
  }
  return clone;
}
