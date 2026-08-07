import {
  shader,
  clamp,
  cos,
  discard,
  floor,
  fract,
  length,
  max,
  mix,
  normalize,
  sin,
  texture,
  vec2,
  vec3,
  vec4,
} from 'brometal';

/**
 * Cutout directional-shadow caster for town-foliage.shader.ts.
 * Wind math intentionally matches the visible vertex stage term-for-term.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormalWind: 'vec4',
    aUv: 'vec2',
  },
  instanceAttributes: {
    iCenter: 'vec3',
    iShape: 'vec4',
    iUvRect: 'vec4',
    iTint: 'vec3',
    iWindKind: 'vec3',
  },
  uniforms: {
    uLightViewProj: 'mat4',
    uAtlas: 'sampler2D',
    uCutoff: 'float',
    uTime: 'float',
    uWindDirection: 'vec2',
    uWindStrength: 'float',
    uWindSpeed: 'float',
  },
  varyings: {
    vUv: 'vec2',
    vKind: 'float',
    vWorld: 'vec3',
  },

  vertex(
    { aPosition, aNormalWind, aUv, iCenter, iShape, iUvRect, iTint, iWindKind },
    { uLightViewProj, uTime, uWindDirection, uWindStrength, uWindSpeed },
    v,
  ) {
    const aWindWeight = aNormalWind.w;
    const iWind = iWindKind.xy;
    const iKind = iWindKind.z;
    const width = max(iShape.x, 0.001);
    const height = max(iShape.y, 0.001);
    const cosine = cos(iShape.z);
    const sine = sin(iShape.z);
    const local = vec3(aPosition.x * width, aPosition.y * height, aPosition.z * width);
    const rotated = vec3(
      local.x * cosine - local.z * sine,
      local.y,
      local.x * sine + local.z * cosine,
    );

    const windLength = max(length(uWindDirection), 0.001);
    const windDirection = uWindDirection.scale(1 / windLength);
    const anchorWeight = mix(
      1 - clamp(aWindWeight, 0, 1),
      clamp(aWindWeight, 0, 1),
      clamp(iWind.y, 0, 1),
    );
    const phase = iShape.w * 6.2831853 + iCenter.x * 0.19 + iCenter.z * 0.27;
    const primary = sin(uTime * uWindSpeed + phase + aWindWeight * 0.8);
    const flutter = sin(uTime * uWindSpeed * 2.73 + phase * 1.71) * 0.34;
    const sway = (primary + flutter) * iWind.x * uWindStrength * anchorWeight * anchorWeight;
    const world = iCenter.add(rotated).add(vec3(
      windDirection.x * sway,
      0,
      windDirection.y * sway,
    ));

    // Keep otherwise-unused attributes in this program's interface so the
    // visible and caster programs bind identical geometry/instance streams.
    const interfaceNoop = aNormalWind.x * 0 + iTint.x * 0;
    v.vUv = iUvRect.xy.add(aUv.mul(vec2(iUvRect.z, iUvRect.w)))
      .add(vec3(interfaceNoop, interfaceNoop, 0).xy);
    v.vKind = iKind;
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment(
    { uLightViewProj, uAtlas, uCutoff },
    { vUv, vKind, vWorld },
  ) {
    // Keep the implicit-derivative sample outside the per-instance kind branch
    // so every invocation samples in uniform control flow.
    const atlasSample = texture(uAtlas, vUv);
    if (vKind < 0.5) {
      if (atlasSample.w < uCutoff) discard();
    }
    const clip = uLightViewProj.mul(vec4(vWorld, 1));
    const depth = clamp(clip.z / clip.w * 0.5 + 0.5, 0, 1);
    const scaled = depth * 255;
    const high = floor(scaled) / 255;
    const low = fract(scaled);
    return vec4(high, low, depth, 1);
  },
});
