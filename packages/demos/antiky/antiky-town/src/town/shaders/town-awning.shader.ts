import {
  shader,
  sqrt,
  abs,
  clamp,
  cos,
  dot,
  floor,
  length,
  max,
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

/**
 * Instanced, physically bent market cloth. The normalized source sheet is
 * subdivided on the CPU; pitch, sag and two-frequency wind happen here so the
 * silhouette, lighting normal and shadow caster all move together.
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
    iYaw: 'float',
    iSlope: 'float',
    iStyle: 'float',
    iPhase: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uCamPos: 'vec3',
    uTime: 'float',
    uMaterialAtlas: 'sampler2D',
    uDetailNormal: 'sampler2D',
    /** The market-cloth tile's inner rectangle as (u, v, width, height), from the atlas JSON. */
    uClothRect: 'vec4',
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
    vStyle: 'float',
    vSide: 'float',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aUv, iCenter, iSize, iYaw, iSlope, iStyle, iPhase },
    { uViewProj, uCamPos, uTime },
    v,
  ) {
    const phaseA = uTime * 1.35 + iPhase * 6.28318 + aUv.x * 5.4 + aUv.y * 2.1;
    const phaseB = uTime * 0.83 + iPhase * 10.6814 - aUv.x * 3.2 + aUv.y * 4.6;
    const waveA = sin(phaseA);
    const waveB = sin(phaseB);
    const freeEdge = 0.35 + smoothstep(0.12, 1, aUv.y) * 0.65;
    const wind = (waveA * 0.7 + waveB * 0.3) * 0.026 * freeEdge;
    const sagAmplitude = 0.03 + iSize.y * 0.012;
    const sagX = sin(aUv.x * 3.14159);
    const sagZ = sin(aUv.y * 3.14159);
    const localX = aPosition.x * iSize.x;
    const localZ = aPosition.z * iSize.y;
    const localY = -aPosition.z * iSlope * iSize.y - sagX * sagZ * sagAmplitude + wind;

    const safeWidth = max(iSize.x, 0.01);
    const safeDepth = max(iSize.y, 0.01);
    const dyDx = -cos(aUv.x * 3.14159) * 3.14159 / safeWidth * sagZ * sagAmplitude +
      (cos(phaseA) * 5.4 * 0.7 - cos(phaseB) * 3.2 * 0.3) / safeWidth *
      0.026 * freeEdge;
    const dyDz = -iSlope - sagX * cos(aUv.y * 3.14159) * 3.14159 /
      safeDepth * sagAmplitude +
      (cos(phaseA) * 2.1 * 0.7 + cos(phaseB) * 4.6 * 0.3) / safeDepth *
      0.026 * freeEdge;
    const localNormal = normalize(vec3(-dyDx, 1, -dyDz));
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      yawCos * localX + yawSin * localZ,
      localY,
      -yawSin * localX + yawCos * localZ,
    );
    const upperNormal = normalize(vec3(
      yawCos * localNormal.x + yawSin * localNormal.z,
      localNormal.y,
      -yawSin * localNormal.x + yawCos * localNormal.z,
    ));
    const side = aPosition.y;
    const surfaceNormal = upperNormal.scale(side);
    const world = iCenter.add(rotated).add(surfaceNormal.scale(0.008));
    v.vUv = aUv;
    v.vWorld = world;
    v.vNormal = surfaceNormal;
    v.vStyle = iStyle;
    v.vSide = side;
    v.vDepth = length(world.sub(uCamPos));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
      uLightViewProj,
      uCamPos,
      uMaterialAtlas,
      uDetailNormal,
      uClothRect,
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
    { vUv, vWorld, vNormal, vStyle, vSide, vDepth },
  ) {
    // The market cloth's own rectangle, handed in from the atlas layout rather than worked out from
    // a grid written down here. The one-texel inset this replaces existed to keep the sample off the
    // tile boundary; the packed atlas surrounds every tile with 64 pixels of its own extruded edge,
    // so the rectangle can be addressed edge to edge.
    const atlasUv = vec2(
      uClothRect.x + vUv.x * uClothRect.z,
      uClothRect.y + vUv.y * uClothRect.w,
    );
    const clothSample = decodeSrgb(texture(uMaterialAtlas, atlasUv).xyz);
    const sampleLuma = max(dot(clothSample, vec3(0.299, 0.587, 0.114)), 0.04);
    const stripe = smoothstep(0.045, 0.19, clothSample.x - max(clothSample.y, clothSample.z));
    let stripeColor = vec3(0.58, 0.15, 0.09);
    stripeColor = mix(stripeColor, vec3(0.12, 0.27, 0.5), step(0.5, vStyle));
    stripeColor = mix(stripeColor, vec3(0.6, 0.37, 0.09), step(1.5, vStyle));
    const cream = vec3(0.74, 0.65, 0.49);
    const expectedLuma = mix(0.66, 0.32, stripe);
    const weaveValue = clamp(sampleLuma / expectedLuma, 0.7, 1.32);
    let albedo = mix(cream, stripeColor, stripe).scale(weaveValue);
    const front = step(0, vSide);
    albedo = mix(albedo.mul(vec3(0.5, 0.43, 0.36)), albedo, front);

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
    const indirect = uSkyColor.scale(uSkyIntensity * (0.34 + up * 0.66))
      .add(uGroundColor.scale(uGroundIntensity * (0.28 + (1 - up) * 0.72)))
      .add(vec3(0.04, 0.052, 0.078));
    const warmKey = mix(vec3(1, 0.94, 0.84), uSunColor, 0.46);
    const direct = warmKey.scale(uSunIntensity * 0.5 * ndotl * shadow * shadow);
    const transmission = pow(max(0 - dot(normal, light), 0), 2) * shadow * 0.07;
    let color = albedo.mul(indirect.add(direct)).add(uSkyColor.scale(rimFacing * uSkyIntensity * 0.28))
      .add(albedo.mul(warmKey).scale(transmission));
    const clothEdge = pow(1 - abs(dot(normal, view)), 3) * 0.025;
    color = color.add(uSkyColor.scale(clothEdge));
    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(vec3(max(color.x, 0), max(color.y, 0), max(color.z, 0)), vDepth);
  },
});
