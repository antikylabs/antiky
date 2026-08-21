import {
  createRenderTarget,
  type BroMetalProgram,
  type RenderTarget,
  type Renderer,
} from 'brometal';

import { SHADOW_MAP_SIZE, SUN_DIRECTION, createArenaSunShadow } from './sun.ts';

/**
 * The sun's shadow map: one pass that draws the scene from the light, and the uniforms every
 * material needs to read it back.
 *
 * Copied by hand from `point-light-expo/src/shadow-pass.ts`, which goal 07 names as the reference.
 *
 * Its own file rather than part of `renderer.ts`, because these uniforms and this target are one
 * idea: nothing outside this file needs to know that a shadow is a distance written into a colour
 * texture, only that a program can be bound to it.
 *
 * **This demo has no sun colour or strength of its own.** Its shaders already carry their own key
 * intensity per material, tuned against a scene lit by that key alone, so introducing a second
 * multiplier here would double-count it. What the shadow pass contributes is the *visibility* term;
 * how bright the key is stays where each material already decided it.
 */

/**
 * Nothing occludes anything, expressed as a distance.
 *
 * `shadowDepth` writes `distance / range`, so 1 is "as far as this map can see". A caster nearer
 * than that then reads as nearer and shadows what is behind it. Clearing to 0 instead — which is
 * what `drawTo` does by default — would say every texel holds something at the light's own eye, and
 * the whole scene would fall into shadow.
 */
const NOTHING_OCCLUDING = Object.freeze([1, 1, 1, 1] as const);

/** The uniform names a material shader must declare to be bound by this pass. */
type ShadowReceiver = BroMetalProgram<never, never, never>;

export type ShadowPass = Readonly<{
  /** Point a material shader at the map and tell it where the sun is. Call once at setup. */
  bind(program: ShadowReceiver): void;
  /** Draw the casters from the light. Call before the scene pass, once per frame. */
  render(drawCasters: () => void): void;
  dispose(): void;
}>;

export function createShadowPass(renderer: Renderer): ShadowPass {
  const sun = createArenaSunShadow();
  const target: RenderTarget = createRenderTarget(renderer, {
    width: SHADOW_MAP_SIZE,
    height: SHADOW_MAP_SIZE,
    // The map has to record the *nearest* caster to the light. Without a depth test that is
    // whichever triangle was submitted last, which is a shadow map that flickers as the draw order
    // changes.
    depth: true,
    // The lookup takes nine taps a fraction of a texel apart. On a point sampler those nine reads
    // land on the same texel and the softness parameter does nothing — this is what goal 02's
    // `render-target-filtering` patch exists for.
    filter: 'linear',
    // Deliberately *not* multisampled, unlike the scene target. Averaging distance across a
    // silhouette produces a value belonging to neither the caster nor what is behind it, and that
    // in-between distance reads as a bright halo tracing every shadow edge. The nine-tap lookup is
    // where softness comes from here.
    samples: 1,
  });

  return Object.freeze({
    bind(program: ShadowReceiver): void {
      const uniforms = program.uniforms as unknown as Record<string, { set(value: unknown): void }>;
      uniforms.uSunDirection!.set(SUN_DIRECTION);
      uniforms.uShadowMap!.set(target.texture);
      uniforms.uLightViewProj!.set(sun.viewProjection);
      uniforms.uLightPosition!.set(sun.position);
      uniforms.uShadowRange!.set(sun.range);
    },
    render(drawCasters: () => void): void {
      renderer.drawTo(target, drawCasters, { clear: NOTHING_OCCLUDING });
    },
    dispose(): void {
      target.dispose();
    },
  });
}

/**
 * The uniforms a depth program needs. Separate from `bind` because a caster is told where the light
 * is and nothing else — it has no material, no colour and no opinion about the sun.
 *
 * `bobStrength` is 1 for the batch drawn through `arena-surface`, which wobbles its instances on a
 * clock, and 0 for the two model batches, whose `iParams.x` means something else. A shadow that does
 * not bob with its caster slides out from under it.
 */
export function bindDepthProgram(program: ShadowReceiver, bobStrength: number): void {
  const sun = createArenaSunShadow();
  const uniforms = program.uniforms as unknown as Record<string, { set(value: unknown): void }>;
  uniforms.uLightViewProj!.set(sun.viewProjection);
  uniforms.uLightPosition!.set(sun.position);
  uniforms.uShadowRange!.set(sun.range);
  uniforms.uBobStrength!.set(bobStrength);
}
