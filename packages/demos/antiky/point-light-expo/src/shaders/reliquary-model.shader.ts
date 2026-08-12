import {
  step,
  pow,
  abs,
  clamp,
  cos,
  dot,
  length,
  max,
  min,
  mix,
  normalize,
  sign,
  sin,
  shader,
  smoothstep,
  texture,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX, tonemapACES } from 'brometal/shader-functions';

function rotateModel(value: Vec3, rotation: Vec3): Vec3 {
  const cosZ = cos(rotation.z);
  const sinZ = sin(rotation.z);
  const aroundZ = vec3(
    value.x * cosZ - value.y * sinZ,
    value.x * sinZ + value.y * cosZ,
    value.z,
  );
  const cosX = cos(rotation.x);
  const sinX = sin(rotation.x);
  const aroundX = vec3(
    aroundZ.x,
    aroundZ.y * cosX - aroundZ.z * sinX,
    aroundZ.y * sinX + aroundZ.z * cosX,
  );
  const cosY = cos(rotation.y);
  const sinY = sin(rotation.y);
  return vec3(
    aroundX.x * cosY - aroundX.z * sinY,
    aroundX.y,
    aroundX.x * sinY + aroundX.z * cosY,
  );
}

function pointRadiance(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const attenuation = range * range;
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = min(specGGX(normal, light, view, roughness), 1.5) * 0.12;
  return lightColor.scale(lightPower * attenuation * (diffuse + specular));
}

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
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
    aUv: 'vec2',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'float',
    iRotation: 'vec3',
    iTint: 'vec3',
    iMaterial: 'vec2',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uDiffuse: 'sampler2D',
    uArm: 'sampler2D',
    uNormalMap: 'sampler2D',
    uNormalStrength: 'float',
    uMaterialLayout: 'float',
    uDiffuseLift: 'float',
    uTextureContrast: 'float',
    uSaturation: 'float',
    uSh0: 'vec3',
    uSh1: 'vec3',
    uSh2: 'vec3',
    uSh3: 'vec3',
    uSh4: 'vec3',
    uSh5: 'vec3',
    uSh6: 'vec3',
    uSh7: 'vec3',
    uSh8: 'vec3',
    uAmbientStrength: 'float',
    uExposure: 'float',
    uRelayLightStrength: 'float',
    uFogColor: 'vec3',
    uFogStart: 'float',
    uFogEnd: 'float',
    uFogMaximumMix: 'float',
    uEmberPosition: 'vec3',
    uEmberColor: 'vec3',
    uEmberPower: 'float',
    uEmberRadius: 'float',
    uIonPosition: 'vec3',
    uIonColor: 'vec3',
    uIonPower: 'float',
    uIonRadius: 'float',
    uVioletPosition: 'vec3',
    uVioletColor: 'vec3',
    uVioletPower: 'float',
    uVioletRadius: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    // Object space, so the triplanar projection does not swim when a prop is rotated per instance.
    vObject: 'vec3',
    vObjectNormal: 'vec3',
    vRotation: 'vec3',
    vUv: 'vec2',
    vTint: 'vec3',
    vMaterial: 'vec2',
  },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iRotation, iTint, iMaterial }, {
    uViewProj,
  }, v) {
    const world = rotateModel(aPosition.scale(iScale), iRotation).add(iOffset);
    v.vWorld = world;
    v.vNormal = normalize(rotateModel(aNormal, iRotation));
    v.vObject = aPosition.scale(iScale);
    v.vObjectNormal = normalize(aNormal);
    v.vRotation = iRotation;
    v.vUv = aUv;
    v.vTint = iTint;
    v.vMaterial = iMaterial;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uTime,
    uDiffuse,
    uArm,
    uMaterialLayout,
    uNormalMap,
    uNormalStrength,
    uDiffuseLift,
    uTextureContrast,
    uSaturation,
    uSh0,
    uSh1,
    uSh2,
    uSh3,
    uSh4,
    uSh5,
    uSh6,
    uSh7,
    uSh8,
    uAmbientStrength,
    uExposure,
    uRelayLightStrength,
    uFogColor,
    uFogStart,
    uFogEnd,
    uFogMaximumMix,
    uEmberPosition,
    uEmberColor,
    uEmberPower,
    uEmberRadius,
    uIonPosition,
    uIonColor,
    uIonPower,
    uIonRadius,
    uVioletPosition,
    uVioletColor,
    uVioletPower,
    uVioletRadius,
  }, { vWorld, vNormal, vObject, vObjectNormal, vRotation, vUv, vTint, vMaterial }) {
    const geometricNormal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));
    // Triplanar normal mapping. These meshes ship no TANGENT and BroMetal's DSL has no dpdx/dpdy or
    // fwidth, so a tangent basis is not available by either route. Triplanar needs none: it derives
    // its coordinates from position and normal.
    //
    // Projected in OBJECT space and rotated into world afterwards. World-space projection would make
    // the texture swim across a prop whenever that prop is placed at a different yaw, because the
    // geometry would slide through a fixed projection.
    //
    // Every texture() call is inlined here rather than wrapped in a helper: a texture() inside a DSL
    // helper compiles to textureSampleLevel(..., 0.0) and silently loses mips.
    // Measured, not guessed: 0.55, 1.6, 4.0 and 9.0 were captured and compared against the same
    // frame with normal mapping off. Local luminance standard deviation on the lit rock rose 1.46x,
    // 1.40x, 1.39x and 1.37x respectively, so the response is nearly flat in scale and 0.55 is the
    // best of them. The frame-to-frame noise floor is 0.000, so all of that is signal.
    const triplanarScale = 0.55;
    const projection = vObject.scale(triplanarScale);
    // `abs` here is scalar-only, so the blend weights are taken per component.
    const axisX = abs(vObjectNormal.x);
    const axisY = abs(vObjectNormal.y);
    const axisZ = abs(vObjectNormal.z);
    const weightSum = max(axisX + axisY + axisZ, 0.0001);
    const weightX = axisX / weightSum;
    const weightY = axisY / weightSum;
    const weightZ = axisZ / weightSum;

    const tangentX = texture(uNormalMap, projection.yz).xyz.scale(2).sub(vec3(1, 1, 1));
    const tangentY = texture(uNormalMap, projection.xz).xyz.scale(2).sub(vec3(1, 1, 1));
    const tangentZ = texture(uNormalMap, projection.xy).xyz.scale(2).sub(vec3(1, 1, 1));

    // Each plane's tangent normal is reoriented so its z lies along that plane's axis. Vec3 exposes
    // only .xy/.xz/.yz, so the reoriented vectors are built with explicit constructors.
    const planeX = vec3(tangentX.z * sign(vObjectNormal.x), tangentX.x, tangentX.y);
    const planeY = vec3(tangentY.x, tangentY.z * sign(vObjectNormal.y), tangentY.y);
    const planeZ = vec3(tangentZ.x, tangentZ.y, tangentZ.z * sign(vObjectNormal.z));

    const objectPerturbed = normalize(
      planeX.scale(weightX).add(planeY.scale(weightY)).add(planeZ.scale(weightZ)),
    );
    const worldPerturbed = normalize(rotateModel(objectPerturbed, vRotation));
    const normal = normalize(mix(geometricNormal, worldPerturbed, clamp(uNormalStrength, 0, 1)));

    const materialMap = texture(uArm, vUv).xyz;
    const roughness = clamp(mix(materialMap.y, materialMap.x, uMaterialLayout) + vMaterial.x, 0.18, 1);
    const occlusion = mix(0.58 + materialMap.x * 0.42, 1, uMaterialLayout);
    const sourceBase = decodeSrgb(texture(uDiffuse, vUv).xyz);
    const sourceLuminance = dot(sourceBase, vec3(0.2126, 0.7152, 0.0722));
    const saturated = mix(vec3(sourceLuminance, sourceLuminance, sourceLuminance), sourceBase, uSaturation);
    const lifted = mix(vec3(0.48, 0.48, 0.48), saturated, uTextureContrast)
      .add(vec3(uDiffuseLift, uDiffuseLift, uDiffuseLift));
    const base = clamp(lifted, 0, 1).mul(vTint);
    const relay = pointRadiance(
      vWorld, normal, view, uEmberPosition, uEmberColor, uEmberPower, uEmberRadius, roughness,
    ).add(pointRadiance(
      vWorld, normal, view, uIonPosition, uIonColor, uIonPower, uIonRadius, roughness,
    )).add(pointRadiance(
      vWorld, normal, view, uVioletPosition, uVioletColor, uVioletPower, uVioletRadius, roughness,
    )).scale(uRelayLightStrength);
    // Ambient that knows which way the surface faces.
    //
    // This replaced a flat colour with a crude up-facing fudge bolted on. The nine coefficients come
    // from a real sky, baked offline by `packages/demos/scripts/bake-sh9-irradiance.mjs`: nine
    // multiply-adds, no texture fetch, and a genuine sky-to-ground hue shift rather than a scalar
    // lean toward brighter-if-upward.
    //
    // The bake decides direction; the demo's existing exposure still decides level. See
    // `src/ambient.ts` for why those two are deliberately kept apart.
    const shIrradiance = uSh0
      .add(uSh1.scale(normal.y))
      .add(uSh2.scale(normal.z))
      .add(uSh3.scale(normal.x))
      .add(uSh4.scale(normal.x * normal.y))
      .add(uSh5.scale(normal.y * normal.z))
      .add(uSh6.scale(3 * normal.z * normal.z - 1))
      .add(uSh7.scale(normal.x * normal.z))
      .add(uSh8.scale(normal.x * normal.x - normal.y * normal.y));
    const ambient = shIrradiance.scale(uAmbientStrength);
    // Always-on rim.
    //
    // A surface turning away from the camera catches light from everything behind it, and without
    // that term every object in the frame ends at a hard edge against whatever is behind it. It is
    // the cheapest thing that separates a subject from its background, which is what AC-L6 measures
    // when it asks for a silhouette band brighter than the interior.
    //
    // Hand-rolled rather than calling BroMetal's `fresnel()`. The helper takes its power as a
    // parameter and compiles the sample-free maths inline anyway, so the only difference is that
    // this spelling matches the twelve other places in this repository that already do it.
    const rim = pow(1 - max(dot(normal, view), 0), 2.4);
    const lit = base.mul(ambient.add(relay)).scale(occlusion)
      // Band 0 is the sky's average over the whole sphere, which is exactly what a surface
      // turning away from the camera is catching.
      .add(uSh0.scale(rim * 0.22 * occlusion));
    const pulse = 0.94 + sin(uTime * 2.1 + vWorld.y) * 0.06;
    const emissive = base.scale(vMaterial.y * pulse);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(
      lit.add(emissive).scale(uExposure),
      uFogColor,
      fog * uFogMaximumMix,
    )), 1);
  },
});
