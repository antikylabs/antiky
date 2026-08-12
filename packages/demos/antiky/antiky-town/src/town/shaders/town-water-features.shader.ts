import {
  shader,
  abs,
  clamp,
  cos,
  discard,
  dot,
  floor,
  length,
  max,
  min,
  mix,
  mod,
  normalize,
  pow,
  sin,
  smoothstep,
  step,
  targetUv,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX } from 'brometal/shader-functions';

function surfaceNormal(world: Vec3, time: number, amplitude: number): Vec3 {
  const dx = cos(world.x * 2.1 + time * 0.85) * 1.176 +
    cos((world.x + world.z) * 3.2 + time * 1.13) * 0.448;
  const dz = cos(world.z * 1.7 - time * 0.72) * 0.51 +
    cos((world.x + world.z) * 3.2 + time * 1.13) * 0.448;
  return normalize(vec3(-dx * amplitude, 1, -dz * amplitude));
}

function fallingNormal(uvX: number, uvY: number, phase: number, time: number): Vec3 {
  const crossSlope = cos(uvX * 12 + uvY * 7 - time * 5.4 + phase * 6.2831853) * 0.16 +
    cos(uvX * 29 - uvY * 4 - time * 8.1 + phase * 3.7) * 0.09;
  const downSlope = sin(uvX * 12 + uvY * 7 - time * 5.4 + phase * 6.2831853) * 0.055;
  return normalize(vec3(-crossSlope, downSlope, 1));
}

/**
 * Opaque/cutout renderer for the non-voxel town water features.
 *
 * Feature kinds in aFeature.x are authored by town-water-features.ts:
 * 0 horizontal channel/basin/splash, 1 falling ribbon, 2 fountain jet.
 * The shader deliberately does not alpha blend. Remaining fragments write
 * stable hardware depth and linear camera distance in scene alpha, matching
 * the town post-processing payload.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
    aUv: 'vec2',
    aFeature: 'vec4',
  },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uCamPos: 'vec3',
    uLightDir: 'vec3',
    uSunColor: 'vec3',
    uSunIntensity: 'float',
    uSkyColor: 'vec3',
    uDeepColor: 'vec3',
    uShallowColor: 'vec3',
    uFoamColor: 'vec3',
    uRoughness: 'float',
    uTime: 'float',
    uFogColor: 'vec3',
    uFogStart: 'float',
    uFogEnd: 'float',
    uFogStrength: 'float',
    uShadowMap: 'sampler2D',
    uDetailNormal: 'sampler2D',
    uShadowTexel: 'vec2',
    uShadowBias: 'float',
    uShadowStrength: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vUv: 'vec2',
    vFeature: 'vec4',
    vSignal: 'float',
    vDepth: 'float',
  },

  vertex({ aPosition, aNormal, aUv, aFeature }, { uViewProj, uCamPos, uTime }, v) {
    const kind = floor(aFeature.x + 0.5);
    let world = aPosition;
    let normal = aNormal;
    let signal = 0;

    if (kind < 0.5) {
      signal = sin(aPosition.x * 2.1 + uTime * 0.85) * 0.56 +
        sin(aPosition.z * 1.7 - uTime * 0.72) * 0.3 +
        sin((aPosition.x + aPosition.z) * 3.2 + uTime * 1.13) * 0.14;
      world = vec3(aPosition.x, aPosition.y + signal * aFeature.z, aPosition.z);
      normal = surfaceNormal(world, uTime, aFeature.z);
    } else if (kind < 1.5) {
      const sidePin = smoothstep(0, 0.1, aUv.x) * smoothstep(0, 0.1, 1 - aUv.x);
      const topPin = smoothstep(0, 0.065, aUv.y);
      signal = sin(aUv.x * 12 + aUv.y * 7 - uTime * 5.4 + aFeature.y * 6.2831853) *
        0.62 +
        sin(aUv.x * 29 - aUv.y * 4 - uTime * 8.1 + aFeature.y * 3.7) * 0.38;
      const pinnedSignal = signal * sidePin * topPin;
      world = vec3(
        aPosition.x + sin(aUv.y * 18 - uTime * 4.7 + aFeature.y) *
          aFeature.z * 0.16 * sidePin * topPin,
        aPosition.y,
        aPosition.z + pinnedSignal * aFeature.z,
      );
      normal = fallingNormal(aUv.x, aUv.y, aFeature.y, uTime);
    } else {
      const endpointPin = smoothstep(0, 0.1, aUv.y) * smoothstep(0, 0.13, 1 - aUv.y);
      signal = sin(aUv.y * 46 - uTime * 9.2 + aFeature.y * 6.2831853) * 0.7 +
        sin(aUv.y * 19 - uTime * 5.1 + aUv.x * 6.2831853) * 0.3;
      world = aPosition.add(aNormal.scale(signal * aFeature.z * endpointPin));
      normal = normalize(aNormal.add(vec3(
        cos(aUv.y * 19 - uTime * 5.1) * 0.035,
        sin(aUv.y * 31 - uTime * 7.3 + aFeature.y) * 0.025,
        cos(aUv.y * 23 - uTime * 6.4 + aFeature.y) * 0.035,
      )));
    }

    v.vWorld = world;
    v.vNormal = normal;
    v.vUv = aUv;
    v.vFeature = aFeature;
    v.vSignal = signal;
    v.vDepth = length(world.sub(uCamPos));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
      uLightViewProj,
      uCamPos,
      uDetailNormal,
      uLightDir,
      uSunColor,
      uSunIntensity,
      uSkyColor,
      uDeepColor,
      uShallowColor,
      uFoamColor,
      uRoughness,
      uTime,
      uFogColor,
      uFogStart,
      uFogEnd,
      uFogStrength,
      uShadowMap,
      uShadowTexel,
      uShadowBias,
      uShadowStrength,
    },
    { vWorld, vNormal, vUv, vFeature, vSignal, vDepth },
  ) {
    const kind = floor(vFeature.x + 0.5);
    const baseNormal = normalize(vNormal);
    // Triplanar detail normal over the atlas albedo.
    //
    // The hard rule this respects: never project an atlas. Triplanar ignores UVs, so projecting the
    // material atlas across world space would sample across tile boundaries and composite unrelated
    // tiles into every surface. What is projected here is a separate tiling normal map that carries
    // no tile layout at all. The atlas keeps its authored UVs and decides colour; this decides only
    // which way the surface faces.
    //
    // Axis-aligned box faces are the ideal case for it - each face lands almost entirely on one
    // projection, so the three-way blend is nearly a straight lookup with none of the smearing that
    // shows up on curved geometry.
    //
    // Sampled in the fragment body, not through a helper: `texture()` inside a DSL helper compiles
    // to `textureSampleLevel(..., 0.0)`, which would pin this to the base mip and make it crawl.
    //
    // Rate and strength are local consts rather than uniforms. Nothing varies them at run time, and
    // a uniform would mean binding plumbing for a number that never moves.
    const detailRate = 0.55;
    const detailStrength = 0.30;
    const weightX = abs(baseNormal.x);
    const weightY = abs(baseNormal.y);
    const weightZ = abs(baseNormal.z);
    const weightSum = weightX + weightY + weightZ;
    const detailX = texture(uDetailNormal, vec2(vWorld.z, vWorld.y).scale(detailRate)).xyz;
    const detailY = texture(uDetailNormal, vWorld.xz.scale(detailRate)).xyz;
    const detailZ = texture(uDetailNormal, vWorld.xy.scale(detailRate)).xyz;
    const tiltX = detailX.scale(2).sub(vec3(1, 1, 1));
    const tiltY = detailY.scale(2).sub(vec3(1, 1, 1));
    const tiltZ = detailZ.scale(2).sub(vec3(1, 1, 1));
    const tilt = vec3(0, tiltX.y, tiltX.x).scale(weightX)
      .add(vec3(tiltY.x, 0, tiltY.y).scale(weightY))
      .add(vec3(tiltZ.x, tiltZ.y, 0).scale(weightZ))
      .scale(detailStrength / weightSum);
    const normal = normalize(baseNormal.add(tilt));
    const view = normalize(uCamPos.sub(vWorld));
    const light = normalize(uLightDir);
    const ndotl = max(dot(normal, light), 0);

    const lightClip = uLightViewProj.mul(vec4(vWorld, 1));
    const shadowUv = targetUv(lightClip);
    const receiverDepth = clamp(lightClip.z / lightClip.w * 0.5 + 0.5, 0, 1);
    const insideShadow = step(0.001, shadowUv.x) * step(shadowUv.x, 0.999) *
      step(0.001, shadowUv.y) * step(shadowUv.y, 0.999) *
      step(0.001, receiverDepth) * step(receiverDepth, 0.999) *
      step(0.001, lightClip.w);
    const depthBias = uShadowBias * (1 + (1 - ndotl) * 1.8);
    let occluded = 0;
    for (let i = 0; i < 4; i += 1) {
      const x = mod(i, 2) - 0.5;
      const y = floor(i / 2) - 0.5;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + depthBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded * 0.25;

    let color = uDeepColor;
    let foam = 0;
    let reflectionStrength = 0.68;
    let roughness = clamp(uRoughness, 0.08, 1);

    if (kind < 0.5) {
      const centeredUv = vUv.sub(vec2(0.5)).scale(2);
      const radial = length(centeredUv);
      const ring = sin(radial * 31 - uTime * 5.2 + vFeature.y * 6.2831853) * 0.5 + 0.5;
      const crossing = sin((vWorld.x - vWorld.z) * 4.3 + uTime * 1.7) * 0.5 + 0.5;
      const bodyMix = 0.2 + smoothstep(-0.85, 0.9, vSignal) * 0.2;
      color = mix(uDeepColor, uShallowColor, bodyMix);
      const rim = smoothstep(0.82, 1.02, radial) * (0.08 + vFeature.w * 0.22);
      foam = clamp(
        rim + vFeature.w * smoothstep(0.58, 0.92, ring) * (0.45 + crossing * 0.55),
        0,
        1,
      );
      if (vFeature.w > 0.8) {
        const brokenSplash = max(ring, crossing * 0.82);
        if (brokenSplash < 0.42) discard();
      }
    } else if (kind < 1.5) {
      const streakA = sin(vUv.x * 43 + vUv.y * 13 - uTime * 8.6 + vFeature.y * 4.1) *
        0.5 + 0.5;
      const streakB = sin(vUv.x * 17 - vUv.y * 31 - uTime * 12.1 + vFeature.y * 6.7) *
        0.5 + 0.5;
      const braided = streakA * 0.62 + streakB * 0.38;
      const edge = smoothstep(0.68, 0.98, abs(vUv.x * 2 - 1));
      const plunge = smoothstep(0.68, 1, vUv.y);
      foam = clamp(
        edge * (0.42 + braided * 0.38) + plunge * (0.28 + streakB * 0.5) +
          smoothstep(0.7, 0.96, braided) * (0.16 + vFeature.w * 0.5),
        0,
        1,
      );
      if (vFeature.w > 0.2) {
        const veil = max(foam, smoothstep(0.64, 0.94, braided) * (0.62 + vFeature.w * 0.38));
        if (veil < 0.46 + vFeature.w * 0.08) discard();
      }
      color = mix(uDeepColor, uShallowColor, 0.52 + braided * 0.28);
      reflectionStrength = 0.38;
      roughness = clamp(roughness + 0.14, 0.08, 1);
    } else {
      const streamBand = sin(vUv.y * 73 - uTime * 13.4 + vFeature.y * 6.2831853) *
        0.5 + 0.5;
      const around = sin(vUv.x * 12.5663706 + vUv.y * 19 - uTime * 5.8) * 0.5 + 0.5;
      foam = 0.46 + smoothstep(0.52, 0.94, streamBand) * 0.38 + around * 0.1;
      color = mix(uShallowColor, uFoamColor, 0.42 + streamBand * 0.26);
      reflectionStrength = 0.3;
      roughness = clamp(roughness + 0.2, 0.08, 1);
    }

    const ndotv = max(dot(normal, view), 0);
    const fresnel = 0.025 + 0.975 * pow(1 - ndotv, 5);
    color = mix(color, uSkyColor, fresnel * reflectionStrength);
    color = mix(color, uFoamColor, clamp(foam, 0, 1) * 0.82);

    const sunSpecular = min(specGGX(normal, light, view, roughness), 3) *
      uSunIntensity * shadow;
    const directional = (0.14 + ndotl * 0.22) * shadow;
    color = color
      .scale(0.72 + directional)
      .add(uSunColor.scale(sunSpecular + ndotl * shadow * 0.035));

    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(vec3(max(color.x, 0), max(color.y, 0), max(color.z, 0)), vDepth);
  },
});
