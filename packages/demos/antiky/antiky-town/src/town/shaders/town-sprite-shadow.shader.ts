import {
  shader,
  clamp,
  cross,
  discard,
  floor,
  fract,
  length,
  normalize,
  smoothstep,
  texture,
  vec2,
  vec4,
} from 'brometal';

/**
 * Alpha-tested sprite caster for town-sprite's five-shell standees.
 * Uses the same ordinary and instance buffers as the visible sprite program.
 * The caller must pass the *camera billboard* uRight/uUp, not a light-facing
 * basis: the standee is a physical thin card in the world, and the light sees
 * that card obliquely. Color-key rejection is optional and matches the receiver.
 */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2', aShell: 'float' },
  instanceAttributes: {
    iCenter: 'vec3',
    iSize: 'vec2',
    iUvRect: 'vec4',
    iTint: 'vec4',
    iFacing: 'vec3',
  },
  uniforms: {
    uLightViewProj: 'mat4',
    uRight: 'vec3',
    uUp: 'vec3',
    uAtlas: 'sampler2D',
    uCutoff: 'float',
    uColorKey: 'vec3',
    uUseColorKey: 'float',
    uStandeeThickness: 'float',
  },
  varyings: { vUv: 'vec2', vTintAlpha: 'float', vWorld: 'vec3' },

  vertex(
    { aPosition, aUv, aShell, iCenter, iSize, iUvRect, iTint, iFacing },
    { uLightViewProj, uRight, uUp, uStandeeThickness },
    v,
  ) {
    const billboardNormal = normalize(cross(uRight, uUp));
    // iFacing participates in the interface intentionally so the visible and
    // caster programs can share one upload path without attribute repacking.
    const facingNoop = iFacing.x * 0;
    const world = iCenter
      .add(uRight.scale(aPosition.x * iSize.x + facingNoop))
      .add(uUp.scale(aPosition.y * iSize.y))
      .add(billboardNormal.scale(aShell * uStandeeThickness * 0.5));
    v.vUv = iUvRect.xy.add(aUv.mul(vec2(iUvRect.z, iUvRect.w)));
    v.vTintAlpha = iTint.w;
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment(
    { uLightViewProj, uAtlas, uCutoff, uColorKey, uUseColorKey },
    { vUv, vTintAlpha, vWorld },
  ) {
    const texel = texture(uAtlas, vUv);
    const keyed = (1 - smoothstep(0.015, 0.075, length(texel.xyz.sub(uColorKey)))) *
      clamp(uUseColorKey, 0, 1);
    const alpha = texel.w * (1 - keyed) * vTintAlpha;
    if (alpha < uCutoff) discard();

    const clip = uLightViewProj.mul(vec4(vWorld, 1));
    const depth = clamp(clip.z / clip.w * 0.5 + 0.5, 0, 1);
    const scaled = depth * 255;
    const high = floor(scaled) / 255;
    const low = fract(scaled);
    return vec4(high, low, depth, 1);
  },
});
