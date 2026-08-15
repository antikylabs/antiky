/**
 * The one Antiky component that speaks BroMetal.
 *
 * `docs/adr/framework/0021-brometal-render-driver-ownership_H.md` gives this driver the BroMetal
 * programs, textures, render targets, buffers, GPU state and their disposal. Framework code hands it
 * Antiky render data and never a BroMetal object; see
 * `packages/framework/src/render/render-contract.ts`, which imports nothing.
 *
 * This is the single file `import-boundary.test.mjs` permits to import BroMetal, and a test asserts
 * it stays single. It is reachable only as `@antiky/framework/render-driver` and deliberately not
 * from the package barrel, so a server importing the framework does not pull a WebGPU library in
 * behind it. The reasoning is in `docs/objectives/scratch/demo-refining/14-DRIVER-HOME.md`.
 *
 * The frame shape here was extracted from two working implementations that had independently
 * converged on it — both cast shadows into a depth target, draw the scene into a floating-point
 * target, reduce it through a bloom chain and resolve everything in one final pass. Neither was
 * designed from this; this was read off both. They are named in the design note cited above, because
 * a test keeps demo names out of framework source.
 */
import {
  createProgram,
  createRenderTarget,
  createTexture,
  loadTexture,
  type BroMetalProgram,
  type BroMetalTexture,
  type CompiledShader,
  type RenderTarget,
  type Renderer,
  type TextureOptions,
} from 'brometal';

import { createDisposalScope } from '../resources/disposal-scope.ts';
import type {
  RenderDriver,
  RenderFrame,
  TargetKey,
  TargetRequest,
  UniformValue,
} from './render-contract.ts';

/**
 * One pipeline the driver can draw, supplied at construction.
 *
 * This is where a BroMetal artifact legitimately crosses into the driver: a compiled shader is
 * BroMetal's own output, and 0021 draws the line at the *frame data*, which names pipelines by key.
 * A second driver takes its own backend's equivalent here and consumes the identical frames.
 */
export type PipelineDefinition = Readonly<{
  shader: CompiledShader<never, never, never>;
  /**
   * Passed through to `createProgram`, for the blend mode a pass needs.
   *
   * The three BroMetal accepts. Spelled `additive`, not `add`: the first draft guessed and would
   * have rejected every additive pipeline in the repository, which is most of the glow and effect
   * work in all four demos.
   */
  options?: Readonly<{ blend?: 'none' | 'alpha' | 'additive' }>;
  /** Called once after the program exists, for geometry and other one-time attribute uploads. */
  setup?(program: BroMetalProgram): void;
}>;

export type BroMetalRenderDriverOptions = Readonly<{
  renderer: Renderer;
  pipelines: Readonly<Record<string, PipelineDefinition>>;
  /**
   * Textures the frames may sample, keyed, described rather than built.
   *
   * A caller says "this URL" or "this canvas" and the driver creates, owns and releases the GPU
   * texture. ADR 0021 gives textures to the driver, so a game that called `loadTexture` itself
   * would be taking the exception path rather than the default one.
   */
  textures?: Readonly<Record<string, TextureSource>>;
  /**
   * The two BroMetal factories the driver calls, injectable.
   *
   * The same seam every resource-owning module in this repository already exposes, and for the same
   * reason: it is how a test proves the driver releases what it acquired without needing a GPU.
   * Production callers omit both.
   */
  createProgram?: typeof createProgram;
  createRenderTarget?: typeof createRenderTarget;
  createTexture?: typeof createTexture;
  loadTexture?: typeof loadTexture;
}>;

/**
 * The driver, plus the one operation that is BroMetal's rather than the contract's.
 *
 * `registerPipeline` exists because three of every Antiky demo's batches are built from GLB models
 * fetched at runtime, so those pipelines cannot exist before the driver does. Construction-only
 * registration would have forced every demo to await all its assets before it could draw anything.
 */
/** Where a texture comes from. The driver turns either into a GPU texture it owns. */
export type TextureSource = Readonly<{
  url?: string;
  /** Anything `createTexture` accepts — a canvas, an image, a bitmap. */
  source?: TexImageSource;
  options?: TextureOptions;
}>;

export type BroMetalRenderDriver = RenderDriver & Readonly<{
  registerPipeline(key: string, definition: PipelineDefinition): void;
  /** Register a texture built from an already-decoded source. */
  registerTexture(key: string, source: TextureSource): void;
  /** Fetch and register every URL-backed texture. Call once, before the first frame that samples one. */
  loadTextures(): Promise<void>;
}>;

export function createBroMetalRenderDriver(options: BroMetalRenderDriverOptions): BroMetalRenderDriver {
  const buildProgram = options.createProgram ?? createProgram;
  const buildTarget = options.createRenderTarget ?? createRenderTarget;
  const owned = createDisposalScope();
  const programs = new Map<string, BroMetalProgram>();
  const textures = new Map<string, BroMetalTexture>();
  const targets = new Map<TargetKey, RenderTarget>();
  const requests = new Map<TargetKey, TargetRequest>();

  const registerPipeline = (key: string, definition: PipelineDefinition): void => {
    if (programs.has(key)) {
      throw new Error(`Pipeline "${key}" is already registered. Pick a distinct key rather than replacing one mid-run.`);
    }
    const program = owned.adopt(buildProgram(
      options.renderer,
      definition.shader as never,
      definition.options as never,
    ));
    definition.setup?.(program);
    programs.set(key, program);
  };

  for (const [key, definition] of Object.entries(options.pipelines)) registerPipeline(key, definition);

  const buildTexture = options.createTexture ?? createTexture;
  const fetchTexture = options.loadTexture ?? loadTexture;

  const registerTexture = (key: string, source: TextureSource): void => {
    if (source.source === undefined) {
      throw new Error(`Texture "${key}" has no decoded source. Use loadTextures() for a URL.`);
    }
    textures.set(key, owned.adopt(buildTexture(options.renderer, source.source, source.options)));
  };

  const loadTextures = async (): Promise<void> => {
    const pending = Object.entries(options.textures ?? {});
    for (const [key, source] of pending) {
      if (textures.has(key)) continue;
      if (source.url !== undefined) {
        textures.set(key, owned.adopt(await fetchTexture(options.renderer, source.url, source.options)));
      } else if (source.source !== undefined) {
        registerTexture(key, source);
      }
    }
  };

  /**
   * Resolve a uniform value to something BroMetal accepts.
   *
   * The one interesting case is `{ target }`: a game says "sample what that pass produced" and the
   * driver turns it into the target's texture. That indirection is what lets a bloom chain read its
   * own previous step without either side naming a GPU object.
   */
  const resolve = (value: UniformValue): unknown => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const reference = value as { target?: TargetKey; texture?: string };
      if (reference.texture !== undefined) {
        const texture = textures.get(reference.texture);
        if (texture === undefined) {
          throw new Error(`Render frame sampled texture "${reference.texture}", which the driver was not given.`);
        }
        return texture;
      }
      const targetKey = reference.target!;
      const target = targets.get(targetKey);
      if (target === undefined) {
        throw new Error(`Render frame sampled target "${targetKey}", which was never configured.`);
      }
      return target.texture;
    }
    return value;
  };

  const configureTargets = (nextRequests: readonly TargetRequest[]): void => {
    const width = Math.max(1, options.renderer.canvas.width);
    const height = Math.max(1, options.renderer.canvas.height);
    for (const request of nextRequests) {
      const previous = requests.get(request.key);
      const existing = targets.get(request.key);
      const wantedWidth = Math.max(1, Math.round(width * request.scale));
      const wantedHeight = Math.max(1, Math.round(height * request.scale));
      // Recreated only when the size or the shape actually changed. A canvas resize is the common
      // case and a frame is the wrong place to reallocate a target that already fits.
      if (
        existing !== undefined
        && existing.width === wantedWidth
        && existing.height === wantedHeight
        && previous?.depth === request.depth
        && previous?.samples === request.samples
      ) continue;
      existing?.dispose();
      targets.set(request.key, buildTarget(options.renderer, {
        width: wantedWidth,
        height: wantedHeight,
        depth: request.depth === true,
        ...(request.samples === undefined ? {} : { samples: request.samples }),
        filter: 'linear',
      }));
      requests.set(request.key, request);
    }
  };

  const runPassDraws = (frame: RenderFrame, passIndex: number): void => {
    for (const draw of frame.passes[passIndex]!.draws) {
      if (draw.instances === 0) continue;
      const program = programs.get(draw.pipeline);
      if (program === undefined) {
        throw new Error(`Render frame drew pipeline "${draw.pipeline}", which the driver was not given.`);
      }
      if (draw.instanceData !== undefined) {
        for (const [name, rows] of Object.entries(draw.instanceData)) {
          program.instanceAttributes[name]?.set(rows);
        }
      }
      if (draw.uniforms !== undefined) {
        for (const [name, value] of Object.entries(draw.uniforms)) {
          program.uniforms[name]?.set(resolve(value) as never);
        }
      }
      program.draw();
    }
  };

  return Object.freeze({
    registerPipeline,
    registerTexture,
    loadTextures,
    configureTargets,
    submit(frame: RenderFrame): void {
      for (let index = 0; index < frame.passes.length; index += 1) {
        const pass = frame.passes[index]!;
        if (pass.target === undefined) {
          runPassDraws(frame, index);
          continue;
        }
        const target = targets.get(pass.target);
        if (target === undefined) {
          throw new Error(`Render frame drew into target "${pass.target}", which was never configured.`);
        }
        options.renderer.drawTo(
          target,
          () => { runPassDraws(frame, index); },
          pass.clear === undefined ? undefined : { clear: pass.clear as never },
        );
      }
    },
    dispose(): void {
      for (const target of targets.values()) target.dispose();
      targets.clear();
      requests.clear();
      programs.clear();
      textures.clear();
      owned.dispose();
    },
  });
}
