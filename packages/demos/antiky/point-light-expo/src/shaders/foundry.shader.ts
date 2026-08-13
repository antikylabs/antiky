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
  sin,
  shader,
  smoothstep,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import {specGGX } from 'brometal/shader-functions';

function materialPresentationPointRadiance(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
  metalness: number,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const attenuation = range * range;
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = min(specGGX(normal, light, view, roughness), 2.4)
    * (0.16 + metalness * 0.84);
  return lightColor.scale(lightPower * attenuation * (diffuse + specular));
}

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iBaseColor: 'vec3',
    iMaterial: 'vec3',
    iYaw: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
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
    uRelayLightStrength: 'float',
    uDetailNormal: 'sampler2D',
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
    vBaseColor: 'vec3',
    vMaterial: 'vec3',
  },

  vertex(
    { aPosition, aNormal, iOffset, iScale, iBaseColor, iMaterial, iYaw },
    { uViewProj },
    v,
  ) {
    const local = aPosition.mul(iScale);
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      local.x * yawCos - local.z * yawSin,
      local.y,
      local.x * yawSin + local.z * yawCos,
    );
    const world = rotated.add(iOffset);
    const inverseScaledNormal = normalize(vec3(
      aNormal.x / max(iScale.x, 0.001),
      aNormal.y / max(iScale.y, 0.001),
      aNormal.z / max(iScale.z, 0.001),
    ));
    const rotatedNormal = vec3(
      inverseScaledNormal.x * yawCos - inverseScaledNormal.z * yawSin,
      inverseScaledNormal.y,
      inverseScaledNormal.x * yawSin + inverseScaledNormal.z * yawCos,
    );
    v.vWorld = world;
    v.vNormal = normalize(rotatedNormal);
    v.vBaseColor = iBaseColor;
    v.vMaterial = iMaterial;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uTime,
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
    uRelayLightStrength,
    uDetailNormal,
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
  }, { vWorld, vNormal, vBaseColor, vMaterial }) {
const baseNormal = normalize(vNormal);
    // Triplanar detail normal, written out here rather than called through a helper.
    //
    // A `texture()` call inside a DSL helper compiles to `textureSampleLevel(..., 0.0)`, pinning the
    // sample to the base mip. On a texture tiled this often that reads as crawling static the moment
    // the camera moves. Inlining the sample in the fragment body is what keeps the mip chain.
    //
    // These are the reliquary's props - forms, creatures, orbs and rings - drawn as untextured
    // instanced primitives tinted per instance. Cones and spheres with no surface variation at all
    // are the clearest case in the demo for projected tooth.
    //
    // Rate and strength are local consts rather than uniforms. Nothing varies them at run time, and
    // a uniform would mean binding plumbing at every call site for a number that never moves.
    const detailRate = 0.55;
    const detailStrength = 0.6;
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
    // Each projection's tangent X/Y is a tilt within that projection's own plane, so it lands in
    // world space by dropping the axis it was projected along. Summing the three by their weights
    // needs no tangent basis - which is why this projects instead of unwrapping, since no source
    // mesh here carries TANGENT and the DSL has no derivatives to rebuild one from.
    const tilt = vec3(0, tiltX.y, tiltX.x).scale(weightX)
      .add(vec3(tiltY.x, 0, tiltY.y).scale(weightY))
      .add(vec3(tiltZ.x, tiltZ.y, 0).scale(weightZ))
      .scale(detailStrength / weightSum);
    const normal = normalize(baseNormal.add(tilt));
    const view = normalize(uCameraPosition.sub(vWorld));
    const roughness = clamp(vMaterial.x, 0.08, 1);
    const metalness = clamp(vMaterial.y, 0, 1);
    const ember = materialPresentationPointRadiance(
      vWorld,
      normal,
      view,
      uEmberPosition,
      uEmberColor,
      uEmberPower,
      uEmberRadius,
      roughness,
      metalness,
    );
    const ion = materialPresentationPointRadiance(
      vWorld,
      normal,
      view,
      uIonPosition,
      uIonColor,
      uIonPower,
      uIonRadius,
      roughness,
      metalness,
    );
    const violet = materialPresentationPointRadiance(
      vWorld,
      normal,
      view,
      uVioletPosition,
      uVioletColor,
      uVioletPower,
      uVioletRadius,
      roughness,
      metalness,
    );
    const radiance = ember.add(ion).add(violet).scale(uRelayLightStrength);
    const hemisphere = 0.78 + normal.y * 0.2;
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
    const lit = vBaseColor.mul(ambient.add(radiance))
      .add(radiance.scale(metalness * 0.2));
    const pulse = 0.92 + sin(uTime * 2.4 + vWorld.x * 0.5) * 0.08;
    const emissive = vBaseColor.scale(vMaterial.z * pulse);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    const color = mix(
      lit.add(emissive),
      uFogColor,
      fog * uFogMaximumMix,
    );
    // Linear HDR. See `post.shader.ts` for where this becomes an image.
    return vec4(color, 1);
  },
});
