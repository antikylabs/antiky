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
 * are recorded as the extraction basis in the archived demo-refining summary, while a test keeps
 * demo names out of framework source. Both had independently arrived at the
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
  | Readonly<{ target: TargetKey }>
  | Readonly<{ texture: TextureKey }>;

/** Names one texture the driver was given. Loading is the host's job; owning it is the driver's. */
export type TextureKey = string;

export type DrawCall = Readonly<{
  pipeline: PipelineKey;
  /** Uniforms set immediately before this draw, by name. */
  uniforms?: Readonly<Record<string, UniformValue>>;
  /**
   * Per-instance attribute data uploaded immediately before this draw, by attribute name.
   *
   * This is what ADR 0021 means by "typed updates": a game writes rows into its own typed arrays and
   * hands them over, and the driver decides what a buffer is. Every instanced batch in both demos
   * this was extracted from does exactly this and nothing more exotic.
   */
  instanceData?: Readonly<Record<string, Float32Array>>;
  /**
   * Vertex attribute data uploaded immediately before this draw, by attribute name.
   *
   * The per-vertex twin of `instanceData`, and needed for the same reason: geometry that is rebuilt
   * on the CPU every frame rather than uploaded once. A mesh whose vertex *count* changes between
   * frames cannot be expressed as instance rows, because there is no fixed per-instance shape to
   * write rows into.
   */
  vertexData?: Readonly<Record<string, Float32Array>>;
  /**
   * Indices uploaded immediately before this draw.
   *
   * Belongs with `vertexData` and is only meaningful beside it: rebuilt geometry changes its
   * triangle list along with its vertices, and uploading one without the other draws the new
   * vertices in the old order.
   */
  indices?: Uint16Array | Uint32Array;
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
  /**
   * A fraction of the canvas, so a bloom chain asks for quarter resolution without learning the
   * canvas size. Ignored when `size` is given.
   */
  scale?: number;
  /**
   * A fixed size in pixels, for a target whose resolution is a quality setting rather than a
   * function of the canvas. A shadow map is the case that forced this: it is authored at a fixed
   * resolution and must not change when the canvas is resized.
   */
  size?: readonly [number, number];
  depth?: boolean;
  samples?: number;
  /**
   * How the target is sampled when a later pass reads it. Defaults to `linear`.
   *
   * `nearest` is not a quality setting — it is a correctness one for any target holding numbers
   * rather than an image. A shadow map that packs a depth into two channels as a whole part and a
   * fraction is the case that forced this: interpolating the fraction across a step in the whole
   * part yields a depth belonging to neither texel, and every shadow edge fills with acne.
   */
  filter?: 'nearest' | 'linear';
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
