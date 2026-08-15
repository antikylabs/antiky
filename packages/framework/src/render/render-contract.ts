/**
 * What a game hands a render driver, and nothing about how any driver satisfies it.
 *
 * This module imports nothing. That is enforced by
 * `packages/framework/tests/import-boundary.test.mjs`, and it is the property that makes a second
 * driver possible: a driver is an implementation of this data, not a backend behind an interface.
 *
 * The line between what crosses here and what does not is drawn by
 * `docs/adr/framework/0021-brometal-render-driver-ownership_H.md` — the data uses "Antiky
 * identifiers, pipeline keys, assets, and typed updates" and "will not contain BroMetal objects".
 * So a pipeline **key** crosses; the compiled pipeline it names does not. A driver is handed its own
 * backend's pipelines when it is constructed, which is driver-specific setup rather than frame data.
 *
 * Extracted from the two demos that had already built this, rather than designed from zero — they
 * are named in `docs/objectives/scratch/demo-refining/14-DRIVER-HOME.md`, because a test keeps demo
 * names out of framework source and that is the right rule. Both had independently arrived at the
 * same frame shape: cast shadows into a depth target, draw the scene into a floating-point target,
 * reduce that target through a bloom chain, then resolve everything to the canvas in one pass that
 * owns exposure and tone mapping. The vocabulary below is that shape, named.
 */

/** A colour in linear light, not display encoding. Alpha is included so a clear can be transparent. */
export type ClearColor = readonly [number, number, number, number];

/**
 * Names one pipeline the driver was constructed with.
 *
 * Opaque on purpose: the framework never learns what a driver builds for a given key.
 */
export type PipelineKey = string;

/** Names one render target the driver owns, or the canvas when absent. */
export type TargetKey = string;

/**
 * A uniform value a game sets for a draw.
 *
 * Numbers and number lists only. A texture is referenced by the key of the target that produced it,
 * which is how a bloom chain reads its own previous step without either side naming a GPU object.
 */
export type UniformValue =
  | number
  | readonly number[]
  | Readonly<{ target: TargetKey }>;

export type DrawCall = Readonly<{
  pipeline: PipelineKey;
  /** Uniforms set immediately before this draw, by name. */
  uniforms?: Readonly<Record<string, UniformValue>>;
  /**
   * How many instances to draw.
   *
   * Omitted means "whatever the pipeline's instance buffers already hold". Zero means skip the draw
   * entirely, which is how a game turns off an effect without restructuring its frame.
   */
  instances?: number;
}>;

/**
 * How a target is sized when the driver creates it.
 *
 * `scale` is a fraction of the canvas, so a bloom chain asks for quarter resolution without ever
 * learning the canvas size. `depth` and `samples` are the two properties both demos needed and
 * neither could express without touching BroMetal directly.
 */
export type TargetRequest = Readonly<{
  key: TargetKey;
  scale: number;
  depth?: boolean;
  samples?: number;
}>;

export type RenderPass = Readonly<{
  /** Where this pass draws. Absent means the canvas, which is the last pass of a frame. */
  target?: TargetKey;
  /**
   * What to clear the target to before drawing.
   *
   * Absent means "do not clear". Both demos lost a frame to this: a scene target left at a driver's
   * default of transparent black turned every pixel outside the ground plane pure black, because
   * the authored void colour was never written.
   */
  clear?: ClearColor;
  draws: readonly DrawCall[];
}>;

/** One frame, as an ordered list of passes. The last pass targeting the canvas is what is seen. */
export type RenderFrame = Readonly<{
  passes: readonly RenderPass[];
}>;

/**
 * What every driver implements.
 *
 * Deliberately three methods. A driver that needed a wider interface would be pushing its own
 * complexity back onto the game, which is the thing this record exists to stop.
 */
export type RenderDriver = Readonly<{
  /** Create or resize the targets a frame will reference. Safe to call every frame. */
  configureTargets(requests: readonly TargetRequest[]): void;
  /** Draw one frame. */
  submit(frame: RenderFrame): void;
  /** Release every resource the driver owns. */
  dispose(): void;
}>;

/**
 * Whether a value could have come from this contract rather than from a backend.
 *
 * Used by the driver tests to prove the input carries no GPU objects. A `submit` payload that
 * fails this check has leaked something the second-driver property depends on not leaking.
 */
export function isContractValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const kind = typeof value;
  if (kind === 'number' || kind === 'string' || kind === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isContractValue);
  if (ArrayBuffer.isView(value)) return true;
  if (kind !== 'object') return false;
  // A plain object, and only a plain object. A class instance is how a backend handle would arrive.
  const prototype = Object.getPrototypeOf(value as object);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isContractValue);
}
