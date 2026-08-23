/**
 * Deterministic randomness for simulations that must replay exactly.
 *
 * Five demos had independently written the same folklore hash — `fract(sin(a·k₁ + b·k₂) · k₃)` —
 * and **no two used the same constants**. That idiom belongs to shaders, where it is cheap and
 * nobody checks it. In a simulation it is wrong twice over:
 *
 * - **It is not specified to be reproducible.** ECMA-262 does not require `Math.sin` to be
 *   correctly rounded, so two engines may disagree in the last bits. These values reach
 *   `getStateDigest()`, which the MCP reports to agents as ground truth, so a digest that depends
 *   on the host's libm is not a digest.
 * - **It is not uniform.** `sin` is smooth, so the low bits are correlated and the distribution is
 *   visibly lumpy. The uniformity test beside this file is one the `sin` hash fails.
 *
 * Integer operations only: `Math.imul`, `^`, `>>>`. Every result is exactly reproducible on every
 * engine.
 *
 * `docs/adr/framework/0013-explicit-simulation-inputs_H.md` requires the authoritative simulation
 * to receive "random seeds or random streams" explicitly. The framework shipped the clock, the
 * inputs and the system order, and no seed existed anywhere; this is the missing input.
 */

/** Golden-ratio constant, the conventional starting state for this family of hashes. */
const SEED_BASIS = 0x9e3779b9 | 0;

/** FNV-1a's 32-bit prime, used to fold each input before the avalanche step. */
const FOLD_PRIME = 0x01000193;

/** 2³², so a `>>> 0` result maps onto `[0, 1)` without ever reaching 1. */
const UNSIGNED_RANGE = 4_294_967_296;

/**
 * MurmurHash3's finaliser: the step that turns a folded value into a well-distributed one.
 *
 * Every bit of the input affects every bit of the output, which is what the `sin` version never
 * achieved and why its low bits stayed correlated.
 */
function avalanche(value: number): number {
  let mixed = value | 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return mixed | 0;
}

/**
 * A 32-bit hash of one or two integers, as an unsigned value.
 *
 * Fixed arity rather than rest parameters: this is called inside per-frame particle loops, and a
 * rest parameter allocates an array on every call.
 */
export function hash32(value: number, salt = 0): number {
  let hashed = Math.imul(SEED_BASIS ^ (value | 0), FOLD_PRIME);
  hashed = avalanche(hashed);
  hashed = Math.imul(hashed ^ (salt | 0), FOLD_PRIME);
  return avalanche(hashed) >>> 0;
}

/** The same hash mapped onto `[0, 1)`. The direct replacement for the demos' `seeded(index, salt)`. */
export function hashUnit(value: number, salt = 0): number {
  return hash32(value, salt) / UNSIGNED_RANGE;
}

export type RandomStream = Readonly<{
  /** The seed this stream was created from. Carry it in a snapshot and the run replays. */
  seed: number;
  /** The next value in `[0, 1)`. Advances the stream. */
  unit(): number;
  /** The next integer in `[0, bound)`. `bound` of zero or less yields zero. */
  below(bound: number): number;
  /**
   * A child stream for an independent concern.
   *
   * Derived from this stream's seed and the label alone — never from how far this stream has been
   * drawn. Two subsystems can therefore be forked in either order, and drawn from in either order,
   * and each still sees the same sequence. Without that property a run stops replaying the moment
   * anything reorders its setup.
   */
  fork(label: number): RandomStream;
}>;

export function createRandomStream(seed: number): RandomStream {
  const streamSeed = seed | 0;
  let counter = 0;

  return Object.freeze({
    seed: streamSeed,
    unit(): number {
      counter += 1;
      return hashUnit(streamSeed, counter);
    },
    below(bound: number): number {
      if (bound <= 0) return 0;
      counter += 1;
      return hash32(streamSeed, counter) % Math.floor(bound);
    },
    fork(label: number): RandomStream {
      return createRandomStream(hash32(streamSeed, (label | 0) ^ SEED_BASIS));
    },
  });
}
