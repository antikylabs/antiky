import {
  pow,
  shader,
  abs,
  clamp,
  cross,
  discard,
  dot,
  floor,
  length,
  max,
  mix,
  mod,
  normalize,
  smoothstep,
  step,
  targetUv,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
  type Vec4,
} from 'brometal';

function keyedAlpha(texelSample: Vec4, colorKey: Vec3, useColorKey: number): number {
  const keyed = (1 - smoothstep(0.015, 0.075, length(texelSample.xyz.sub(colorKey)))) *
    clamp(useColorKey, 0, 1);
  return texelSample.w * (1 - keyed);
}

function practicalRadiance(
  world: Vec3,
  normal: Vec3,
  posInvRangeSq: Vec4,
  colorPower: Vec4,
  lobe: number,
): Vec3 {
  const toLight = posInvRangeSq.xyz.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq * posInvRangeSq.w, 0, 1);
  const attenuation = range * range;
  const wrappedDiffuse = 0.2 + 0.8 * max(dot(normal, normalize(toLight)), 0);
  return colorPower.xyz.scale(colorPower.w * attenuation * wrappedDiffuse * lobe);
}

/**
 * Lit cardboard-standee shader.
 *
 * The illustrated face of a die-cut cardboard standee. Physical side walls are
 * emitted from the atlas alpha contour by sprite-batch.ts and rendered through
 * the town surface shader. There is intentionally no dilation, halo, keyline,
 * or front-facing white outline in this shader.
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
  attributes: { aPosition: 'vec3', aUv: 'vec2', aShell: 'float' },
  instanceAttributes: {
    iCenter: 'vec3',
    iSize: 'vec2',
    iUvRect: 'vec4',
    iTint: 'vec4',
    iFacing: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uLightViewProj: 'mat4',
    uRight: 'vec3',
    uUp: 'vec3',
    uCamPos: 'vec3',
    uLightDir: 'vec3',
    uAtlas: 'sampler2D',
    uCutoff: 'float',
    uColorKey: 'vec3',
    uUseColorKey: 'float',
    uStandeeThickness: 'float',
    uAmbientLight: 'vec3',
    uFrontLight: 'vec3',
    uBackLight: 'vec3',
    uSideLight: 'vec3',
    uPracticalCount: 'float',
    uPracticalStrength: 'float',
    uPracticalPosInvRangeSq0: 'vec4',
    uPracticalColorPower0: 'vec4',
    uPracticalPosInvRangeSq1: 'vec4',
    uPracticalColorPower1: 'vec4',
    uPracticalPosInvRangeSq2: 'vec4',
    uPracticalColorPower2: 'vec4',
    uPracticalPosInvRangeSq3: 'vec4',
    uPracticalColorPower3: 'vec4',
    uPracticalPosInvRangeSq4: 'vec4',
    uPracticalColorPower4: 'vec4',
    uPracticalPosInvRangeSq5: 'vec4',
    uPracticalColorPower5: 'vec4',
    uPracticalPosInvRangeSq6: 'vec4',
    uPracticalColorPower6: 'vec4',
    uPracticalPosInvRangeSq7: 'vec4',
    uPracticalColorPower7: 'vec4',
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
    vTint: 'vec4',
    vFacing: 'vec3',
    vWorld: 'vec3',
    vBillboardNormal: 'vec3',
    vDepth: 'float',
  },

  vertex(
    { aPosition, aUv, aShell, iCenter, iSize, iUvRect, iTint, iFacing },
    { uViewProj, uRight, uUp, uCamPos, uStandeeThickness },
    v,
  ) {
    const billboardNormal = normalize(cross(uRight, uUp));
    const world = iCenter
      .add(uRight.scale(aPosition.x * iSize.x))
      .add(uUp.scale(aPosition.y * iSize.y))
      .add(billboardNormal.scale(aShell * uStandeeThickness * 0.5));
    v.vUv = iUvRect.xy.add(aUv.mul(vec2(iUvRect.z, iUvRect.w)));
    v.vTint = iTint;
    v.vFacing = iFacing;
    v.vWorld = world;
    v.vBillboardNormal = billboardNormal;
    v.vDepth = length(world.sub(uCamPos));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
      uLightViewProj,
      uLightDir,
      uAtlas,
      uCutoff,
      uColorKey,
      uUseColorKey,
      uAmbientLight,
      uFrontLight,
      uBackLight,
      uSideLight,
      uPracticalCount,
      uPracticalStrength,
      uPracticalPosInvRangeSq0,
      uPracticalColorPower0,
      uPracticalPosInvRangeSq1,
      uPracticalColorPower1,
      uPracticalPosInvRangeSq2,
      uPracticalColorPower2,
      uPracticalPosInvRangeSq3,
      uPracticalColorPower3,
      uPracticalPosInvRangeSq4,
      uPracticalColorPower4,
      uPracticalPosInvRangeSq5,
      uPracticalColorPower5,
      uPracticalPosInvRangeSq6,
      uPracticalColorPower6,
      uPracticalPosInvRangeSq7,
      uPracticalColorPower7,
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
    { vUv, vTint, vFacing, vWorld, vBillboardNormal, vDepth },
  ) {
    const encoded = texture(uAtlas, vUv);
    const texel = vec4(decodeSrgb(encoded.xyz), encoded.w);
    const alpha = keyedAlpha(texel, uColorKey, uUseColorKey) * vTint.w;
    if (alpha < uCutoff) discard();

    const facingLength = max(length(vec2(vFacing.x, vFacing.z)), 0.001);
    const facing = vec3(vFacing.x / facingLength, 0, vFacing.z / facingLength);
    const lightLength = max(length(vec2(uLightDir.x, uLightDir.z)), 0.001);
    const horizontalLight = vec3(uLightDir.x / lightLength, 0, uLightDir.z / lightLength);
    const facingLight = dot(facing, horizontalLight);
    const elevation = clamp(uLightDir.y, 0, 1);
    const frontWeight = max(facingLight, 0) * (0.55 + elevation * 0.45);
    const backWeight = max(-facingLight, 0) * (0.55 + elevation * 0.45);
    const sideWeight = 1 - abs(facingLight);

    const lightClip = uLightViewProj.mul(vec4(vWorld, 1));
    const shadowUv = targetUv(lightClip);
    const receiverDepth = clamp(lightClip.z / lightClip.w * 0.5 + 0.5, 0, 1);
    const insideShadow = step(0.001, shadowUv.x) * step(shadowUv.x, 0.999) *
      step(0.001, shadowUv.y) * step(shadowUv.y, 0.999) *
      step(0.001, receiverDepth) * step(receiverDepth, 0.999) *
      step(0.001, lightClip.w);
    const billboardNdotL = max(dot(normalize(vBillboardNormal), normalize(uLightDir)), 0);
    const slope = 1 - billboardNdotL;
    const depthBias = uShadowBias + uShadowSlopeBias * slope * slope;
    let occluded = 0;
    for (let i = 0; i < 9; i += 1) {
      const x = mod(i, 3) - 1;
      const y = floor(i / 3) - 1;
      const stored = texture(uShadowMap, shadowUv.add(uShadowTexel.mul(vec2(x, y))));
      const nearestDepth = stored.x + stored.y / 255;
      occluded = occluded + step(nearestDepth + depthBias, receiverDepth);
    }
    const shadow = 1 - insideShadow * clamp(uShadowStrength, 0, 1) * occluded / 9;

    const directional = uFrontLight.scale(frontWeight)
      .add(uBackLight.scale(backWeight))
      .add(uSideLight.scale(sideWeight))
      .scale(shadow);
    const cardNormal = normalize(vBillboardNormal);
    let practical = vec3(0, 0, 0);
    if (uPracticalCount > 0.5) practical = practical.add(practicalRadiance(
      vWorld, cardNormal, uPracticalPosInvRangeSq0, uPracticalColorPower0, 1,
    ));
    if (uPracticalCount > 1.5) practical = practical.add(practicalRadiance(
      vWorld, cardNormal, uPracticalPosInvRangeSq1, uPracticalColorPower1, 1,
    ));
    if (uPracticalCount > 2.5) practical = practical.add(practicalRadiance(
      vWorld, cardNormal, uPracticalPosInvRangeSq2, uPracticalColorPower2, 1,
    ));
    if (uPracticalCount > 3.5) practical = practical.add(practicalRadiance(
      vWorld, cardNormal, uPracticalPosInvRangeSq3, uPracticalColorPower3, 1,
    ));
    if (uPracticalCount > 4.5) practical = practical.add(practicalRadiance(
      vWorld, cardNormal, uPracticalPosInvRangeSq4, uPracticalColorPower4, 1,
    ));
    if (uPracticalCount > 5.5) practical = practical.add(practicalRadiance(
      vWorld, cardNormal, uPracticalPosInvRangeSq5, uPracticalColorPower5, 1,
    ));
    if (uPracticalCount > 6.5) {
      const windowLobe = smoothstep(
        -0.1,
        0.55,
        normalize(vWorld.sub(uPracticalPosInvRangeSq6.xyz)).z,
      );
      practical = practical.add(practicalRadiance(
        vWorld, cardNormal, uPracticalPosInvRangeSq6, uPracticalColorPower6, windowLobe,
      ));
    }
    if (uPracticalCount > 7.5) {
      const windowLobe = smoothstep(
        -0.1,
        0.55,
        normalize(vWorld.sub(uPracticalPosInvRangeSq7.xyz)).z,
      );
      practical = practical.add(practicalRadiance(
        vWorld, cardNormal, uPracticalPosInvRangeSq7, uPracticalColorPower7, windowLobe,
      ));
    }
    let color = texel.xyz.mul(vTint.xyz).mul(
      uAmbientLight.add(directional).add(practical.scale(uPracticalStrength)),
    );
    const fog = smoothstep(uFogStart, uFogEnd, vDepth) * clamp(uFogStrength, 0, 1);
    color = mix(color, uFogColor, fog);
    return vec4(vec3(max(color.x, 0), max(color.y, 0), max(color.z, 0)), vDepth);
  },
});
