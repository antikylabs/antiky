import type { TargetRequest, UniformValue } from '@antiky/framework';

import { SHADOW_MAP_SIZE, SUN_COLOR, SUN_DIRECTION, SUN_STRENGTH, createRelaySunShadow } from './sun.ts';

/**
 * The sun's shadow map: one pass that draws the scene from the light, and the uniforms every
 * material needs to read it back.
 *
 * Lifted out of `renderer.ts` rather than added to it. The renderer was at 446 lines before this
 * step and `GOOD_ENGINEERING_H.md` wants a cohesion review at 500, but the better reason is that
 * these six uniforms and this target are one idea: nothing outside this file needs to know that a
 * shadow is a distance written into a colour texture, only that a program can be bound to it.
 */

/**
 * Nothing occludes anything, expressed as a distance.
 *
 * `shadowDepth` writes `distance / range`, so 1 is "as far as this map can see". A caster nearer
 * than that then reads as nearer and shadows what is behind it. Clearing to 0 instead — which is
 * what `drawTo` does by default — would say every texel holds something at the light's own eye, and
 * the whole scene would fall into shadow.
 */
export const NOTHING_OCCLUDING = Object.freeze([1, 1, 1, 1] as const);

/** The shadow map, as a target request the driver fulfils. */
export const SHADOW_TARGET: TargetRequest = Object.freeze({
  key: 'shadow',
  size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE] as const,
  // The map has to record the *nearest* caster to the light. Without a depth test that is whichever
  // triangle was submitted last, which is a shadow map that flickers as the draw order changes.
  depth: true,
  // Deliberately *not* multisampled, unlike the scene target. Averaging distance across a silhouette
  // produces a value belonging to neither the caster nor what is behind it, and that in-between
  // distance reads as a bright halo tracing every shadow edge.
  samples: 1,
});

const sun = createRelaySunShadow();

// Pre-multiplied, because strength and colour are one quantity by the time a shader sees them and
// two uniforms carrying one idea is an invitation to set one and forget the other.
const LIT_COLOR: readonly [number, number, number] = [
  SUN_COLOR[0] * SUN_STRENGTH,
  SUN_COLOR[1] * SUN_STRENGTH,
  SUN_COLOR[2] * SUN_STRENGTH,
];

/** What a material pipeline needs to read the map. Set every frame; none of it varies. */
export const SHADOW_RECEIVER_UNIFORMS: Readonly<Record<string, UniformValue>> = Object.freeze({
  uSunDirection: SUN_DIRECTION,
  uSunColor: LIT_COLOR,
  uShadowMap: { target: 'shadow' },
  uLightViewProj: Array.from(sun.viewProjection),
  uLightPosition: sun.position,
  uShadowRange: sun.range,
});

/**
 * What a depth pipeline needs.
 *
 * Separate from the receiver uniforms because a caster is told where the light is and nothing else —
 * it has no material, no colour and no opinion about the sun.
 */
export const SHADOW_CASTER_UNIFORMS: Readonly<Record<string, UniformValue>> = Object.freeze({
  uLightViewProj: Array.from(sun.viewProjection),
  uLightPosition: sun.position,
  uShadowRange: sun.range,
});
