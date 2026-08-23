const MAX_INPUT_DEPTH = 32;
const MAX_INPUT_VALUES = 4_096;

export const INVALID_CAPTURED_INPUT = Symbol('INVALID_CAPTURED_INPUT');

export function canonicalizeCapturedInput<Input>(
  value: Readonly<Input>,
): Readonly<Input> | typeof INVALID_CAPTURED_INPUT {
  const seen = new Set<object>();
  let valueCount = 0;

  const visit = (current: unknown, depth: number): unknown => {
    valueCount += 1;
    if (valueCount > MAX_INPUT_VALUES || depth > MAX_INPUT_DEPTH) {
      return INVALID_CAPTURED_INPUT;
    }
    if (typeof current === 'function') return INVALID_CAPTURED_INPUT;
    if (current === null || typeof current !== 'object') return current;
    if (seen.has(current) || !Object.isFrozen(current)) return INVALID_CAPTURED_INPUT;
    seen.add(current);

    const isArray = Array.isArray(current);
    const expectedPrototype = isArray ? Array.prototype : Object.prototype;
    if (Object.getPrototypeOf(current) !== expectedPrototype) return INVALID_CAPTURED_INPUT;

    const copy: object = isArray ? [] : {};
    let arrayLength: number | null = null;
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
        return INVALID_CAPTURED_INPUT;
      }
      const copiedValue = visit(descriptor.value, depth + 1);
      if (copiedValue === INVALID_CAPTURED_INPUT) return INVALID_CAPTURED_INPUT;
      if (isArray && key === 'length') {
        if (
          typeof copiedValue !== 'number'
          || !Number.isSafeInteger(copiedValue)
          || copiedValue < 0
        ) {
          return INVALID_CAPTURED_INPUT;
        }
        arrayLength = copiedValue;
        continue;
      }
      Object.defineProperty(copy, key, {
        configurable: false,
        enumerable: descriptor.enumerable,
        value: copiedValue,
        writable: false,
      });
    }
    if (isArray) {
      if (arrayLength === null) return INVALID_CAPTURED_INPUT;
      Object.defineProperty(copy, 'length', {
        configurable: false,
        enumerable: false,
        value: arrayLength,
        writable: false,
      });
    }
    return Object.freeze(copy);
  };

  const canonicalInput = visit(value, 0);
  if (canonicalInput === INVALID_CAPTURED_INPUT) return INVALID_CAPTURED_INPUT;
  // The copy has the validated own data-property graph and the same plain object or array shape.
  return canonicalInput as Readonly<Input>;
}
