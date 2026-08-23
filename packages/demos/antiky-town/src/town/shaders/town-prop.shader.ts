import {
  abs,
  pow,
  shader,
  sqrt,
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

/**
 * Alpha-tested, genuinely curved 2.5D town props. Front and back surfaces have
 * independent normals and physical separation; the back is warm dark board,
 * never a mirrored copy of the illustration.
 */
/**
 * sRGB to linear, applied when an albedo texture is sampled.
 *
 * BroMetal exposes no sRGB texture format — everything uploads as `rgba8unorm` — so a sampled albedo
 * texel arrives holding display-encoded values. Lighting maths on those is wrong: mid-tones come out
 * too dark, which then gets compensated by over-bright lights, and the error compounds through every
 * term downstream. This is the sample-side half of colour management; encoding once on output is the
 * other half and belongs to the post pass.
 *
 * Only albedo goes through here. Normal maps, ARM and roughness maps, shadow maps and scene targets
 * already hold linear data, and decoding those would corrupt them.
 *
 * The piecewise curve rather than the 2.2 approximation: they differ most below 0.04045, which is
 * exactly where these dark scenes spend their time.
 *
 * Declared in every shader that needs it rather than imported. The BroMetal MVP resolves only
 * "module-level helper functions declared above their first use" — an imported helper fails to
 * compile. `pipeline-invariants.test.mjs` asserts every copy is identical.
 */
function channelToLinear(channel: number): number {
  const low = channel / 12.92;
  const high = pow((channel + 0.055) / 1.055, 2.4);
  // `pow` and `step` are scalar-only here, so the curve is applied one component at a time.
  return mix(low, high, step(0.04045, channel));
}

function decodeSrgb(color: Vec3): Vec3 {
  return vec3(channelToLinear(color.x), channelToLinear(color.y), channelToLinear(color.z));
}

export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  instanceAttributes: {
    iCenter: 'vec3',
    iSize: 'vec2',
    iUvRect: 'vec4',
    iYaw: 'float',
    iCurvature: 'float',
    iTile: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uCamPos: 'vec3',
    uAtlas: 'sampler2D',
    uDetailNormal: 'sampler2D',
    uCutoff: 'float',
    uLightDir: 'vec3',
    uSunColor: 'vec3',
    uSunIntensity: 'float',
    uSkyColor: 'vec3',
    uSkyIntensity: 'float',
    uGroundColor: 'vec3',
    uGroundIntensity: 'float',
    uFogColor: 'vec3',
    uFogStart: 'float',
    uFogEnd: 'float',
    uFogStrength: 'float',
    uShadowMap: 'sampler2D',
    uShadowTexel: 'vec2',
    uShadowBias: 'float',
    uShadowSlopeBias: 'float',
    uShadowStrength: 'float',
  },
  varyings: {
    vUv: 'vec2',
    vWorld: 'vec3',
    vNormal: 'vec3',
    vSide: 'float',
    vTile: 'float',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aUv, iCenter, iSize, iUvRect, iYaw, iCurvature, iTile },
    { uViewProj, uCamPos },
    v,
  ) {
    const bend = max(iCurvature * 2.4, 0.001);
    const angle = aPosition.x * bend;
    const lean = 0.12;
    const localX = sin(angle) / bend * iSize.x;
    const localY = aPosition.y * iSize.y;
    const localZ = (cos(angle) - 1) / bend * iSize.x - aPosition.y * iSize.y * lean;
    const frontNormal = normalize(vec3(sin(angle), cos(angle) * lean, cos(angle)));
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      yawCos * localX + yawSin * localZ,
      localY,
      -yawSin * localX + yawCos * localZ,
    );
    const rotatedFrontNormal = normalize(vec3(
      yawCos * frontNormal.x + yawSin * frontNormal.z,
      frontNormal.y,
      -yawSin * frontNormal.x + yawCos * frontNormal.z,
    ));
    const side = aPosition.z;
    const surfaceNormal = rotatedFrontNormal.scale(side);
    const thickness = 0.012 + iSize.x * 0.012;
    const world = iCenter.add(rotated).add(surfaceNormal.scale(thickness));
    v.vUv = iUvRect.xy.add(aUv.mul(vec2(iUvRect.z, iUvRect.w)));
    v.vWorld = world;
    v.vNormal = surfaceNormal;
    v.vSide = side;
    v.vTile = iTile;
    v.vDepth = length(world.sub(uCamPos));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
      uLightViewProj,
      uCamPos,
      uAtlas,
      uDetailNormal,
      uCutoff,
      uLightDir,
      uSunColor,
      uSunIntensity,
      uSkyColor,
      uSkyIntensity,
      uGroundColor,
      uGroundIntensity,
      uFogColor,
      uFogStart,
      uFogEnd,
      uFogStrength,
      uShadowMap,
      uShadowTexel,
      uShadowBias,
      uShadowSlopeBias,
      uShadowStrength,
    },
    { vUv, vWorld, vNormal, vSide, vTile, vDepth },
  ) {
    const encoded = texture(uAtlas, vUv);
    const texel = vec4(decodeSrgb(encoded.xyz), encoded.w);
    if (texel.w < uCutoff) discard();

    const front = step(0, vSide);
    const artLuma = dot(texel.xyz, vec3(0.299, 0.587, 0.114));
    const back = mix(vec3(0.12, 0.06, 0.032), vec3(0.31, 0.17, 0.075), artLuma);
    const albedo = mix(back, texel.xyz, front);
    const chest = step(0.5, vTile) * (1 - step(2.5, vTile));
    const paper = step(2.5, vTile) * (1 - step(5.5, vTile));
    let roughness = mix(0.74, 0.58, chest);
    roughness = mix(roughness, 0.9, paper);
    roughness = mix(0.94, roughness, front);
    let specularLevel = mix(0.075, 0.18, chest);
    specularLevel = mix(specularLevel, 0.035, paper);
    specularLevel = mix(0.025, specularLevel, front);

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
    const detailStrength = 0.42;
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
    const light = normalize(uLightDir);
    const view = normalize(uCamPos.sub(vWorld));
    // Always-on rim, tinted by the sky the town already lights itself with.
    //
    // A surface turning away from the camera catches light from everything behind it. Without it
    // every prop ends at a hard edge against the plaza, which is the difference between a thing
    // standing in a scene and a decal pasted onto it.
    const rimFacing = pow(1 - max(dot(normal, view), 0), 2.5);
    const ndotl = max(dot(normal, light), 0);
    const lightClip = uLightViewProj.mul(vec4(vWorld, 1));
    const shadowUv = targetUv(lightClip);
    const receiverDepth = clamp(lightClip.z / lightClip.w * 0.5 + 0.5, 0, 1);
    const insideShadow = step(0.001, shadowUv.x) * step(shadowUv.x, 0.999) *
      step(0.001, shadowUv.y) * step(shadowUv.y, 0.999) *
      step(0.001, receiverDepth) * step(receiverDepth, 0.999) *
      step(0.001, lightClip.w);
    const slope = 1 - ndotl;
    const depthBias = uShadowBias + uShadowSlopeBias * slope * slope;
    let occluded = 0;
    for (let i = 0; i < 4; i += 1) {
      // Goal 08 widened the penumbra to match the voxel surface's: four vogel taps over ±2.6
      // texels instead of the half-texel grid. Bias is untouched, so no acne returns.
      const angle = i * 2.399963 + 0.7;
      const ringRadius = sqrt((i + 0.5) / 4) * 2.6;
      const x = cos(angle) * ringRadius;
      const y = sin(angle) * ringRadius;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + depthBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded * 0.25;

    const up = normal.y * 0.5 + 0.5;
    const indirect = uSkyColor.scale(uSkyIntensity * (0.3 + up * 0.7))
      .add(uGroundColor.scale(uGroundIntensity * (0.26 + (1 - up) * 0.74)))
      .add(vec3(0.042, 0.054, 0.08));
    const warmKey = mix(vec3(1, 0.94, 0.84), uSunColor, 0.46);
    const direct = warmKey.scale(uSunIntensity * 0.52 * ndotl * shadow * shadow);
    let color = albedo.mul(indirect.add(direct))
      .add(uSkyColor.scale(rimFacing * uSkyIntensity * 0.32));
    const specular = min(specGGX(normal, light, view, roughness), 1.4) *
      specularLevel * uSunIntensity * 0.5 * shadow * shadow;
    color = color.add(warmKey.scale(specular));
    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(vec3(max(color.x, 0), max(color.y, 0), max(color.z, 0)), vDepth);
  },
});
