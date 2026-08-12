import {
  step,
  pow,
  abs,
  clamp,
  dot,
  length,
  max,
  mix,
  normalize,
  shader,
  sin,
  smoothstep,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX, tonemapACES } from 'brometal/shader-functions';

function materialPresentationFloorLight(
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
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = specGGX(normal, light, view, roughness) * 0.12;
  return lightColor.scale(lightPower * range * range * (diffuse + specular));
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
    aUv: 'vec2',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uDiffuse: 'sampler2D',
    uSecondGround: 'sampler2D',
    uAo: 'sampler2D',
    uRoughness: 'sampler2D',
    uDetailNormal: 'sampler2D',
    uDiffuseTint: 'vec3',
    uTextureContrast: 'float',
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
    vUv: 'vec2',
  },

  vertex({ aPosition, aUv }, { uViewProj }, v) {
    const world = vec3(aPosition.x, -0.42, -aPosition.y);
    v.vWorld = world;
    v.vUv = aUv.mul(vec2(2.65, 1.9));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uDiffuse,
    uSecondGround,
    uAo,
    uRoughness,
    uDetailNormal,
    uDiffuseTint,
    uTextureContrast,
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
  }, { vWorld, vUv }) {
    // A second ground blended over the first, so the floor stops reading as one texture stretched
    // over eighteen by thirteen units.
    //
    // The mask is two crossed sines at incommensurable rates rather than a noise texture: it costs
    // no sample, and at this scale the eye reads it as patchy ground rather than as a pattern. A
    // world-space mask also means the patches stay put when the plane's UVs are scaled.
    //
    // The second layer is projected at its own rate, so the two do not share a repeat and the
    // combined result has no obvious tile.
    const groundMask = clamp(
      0.5
        + sin(vWorld.x * 0.31 + sin(vWorld.z * 0.17) * 1.4) * 0.35
        + sin(vWorld.z * 0.23 - vWorld.x * 0.11) * 0.3,
      0,
      1,
    );
    // Normalised by its own mean linear luminance (0.2483) so blending it in changes what the ground
    // is made of without changing how bright it is.
    const secondGround = decodeSrgb(texture(uSecondGround, vWorld.xz.scale(0.42)).xyz).scale(4.03);
    const firstGround = decodeSrgb(texture(uDiffuse, vUv).xyz);
    const sourceDiffuse = firstGround.mul(mix(vec3(1, 1, 1), secondGround, groundMask * 0.55));
    const diffuseSample = mix(vec3(0.38, 0.36, 0.31), sourceDiffuse, uTextureContrast);
    const ao = mix(0.64, 1, texture(uAo, vUv).x);
    const roughness = clamp(texture(uRoughness, vUv).x, 0.2, 0.98);
    // The floor's normal was the constant `vec3(0, 1, 0)`, which is the literal reason AC-M1
    // measures this surface's luminance standard deviation below 0.004: every pixel of an
    // eighteen-by-thirteen plane received exactly the same amount of light from every relay.
    //
    // The detail normal is projected in world space rather than read through `vUv`, so the tooth
    // stays a constant size on the ground no matter how the plane's UVs are scaled. Only the Y
    // projection can contribute on a plane whose normal is constant up - weighting three
    // projections here would be two samples spent to multiply by zero, so this writes the one that
    // matters. The model shaders next door do the full three because their normals vary.
    //
    // Sampled in the fragment body, not through a helper: `texture()` inside a DSL helper compiles
    // to `textureSampleLevel(..., 0.0)` and would pin this to the base mip.
    // Worth knowing before anyone tunes this looking for an effect: on its own it did almost
    // nothing here. Measured with it in and out, 20,041 pixels of the frame changed but the floor
    // probes did not move at all — standard deviation 0.0271 either way.
    //
    // The reason was the ambient term below, which used to be a flat colour times an AO scalar and
    // never consulted the normal. Only the three relays saw the normal, and they are weak across
    // most of an eighteen-by-thirteen plane, so a perturbed normal had almost nothing to modulate.
    // The SH-9 ambient that replaced it does consult the normal, which is what gives this term
    // something to bite on.
    const detailRate = 0.32;
    const detailStrength = 0.75;
    const detailTilt = texture(uDetailNormal, vWorld.xz.scale(detailRate)).xyz.scale(2).sub(vec3(1, 1, 1));
    const normal = normalize(vec3(detailTilt.x * detailStrength, 1, detailTilt.y * detailStrength));
    const view = normalize(uCameraPosition.sub(vWorld));
    const amber = materialPresentationFloorLight(vWorld, normal, view, uEmberPosition, uEmberColor, uEmberPower, uEmberRadius, roughness);
    const blue = materialPresentationFloorLight(vWorld, normal, view, uIonPosition, uIonColor, uIonPower, uIonRadius, roughness);
    const plum = materialPresentationFloorLight(vWorld, normal, view, uVioletPosition, uVioletColor, uVioletPower, uVioletRadius, roughness);
    const irradiance = amber.add(blue).add(plum).scale(uRelayLightStrength);
    const dampEarth = diffuseSample.mul(uDiffuseTint);
    // Ambient that knows which way the surface faces.
    //
    // This replaced a single flat colour, which said a floor, a ceiling and the underside of a rock
    // all receive the same light. That is false everywhere, and it was the reason the detail normal
    // above measured as doing nothing here: a perturbed normal that changes nothing about how much
    // light arrives is a perturbed normal nobody can see.
    //
    // The nine coefficients come from a real sky, baked offline by
    // `packages/demos/scripts/bake-sh9-irradiance.mjs`. Nine multiply-adds, no texture fetch.
    //
    // What the bake decides and what it does not: it decides *direction* — which way is brighter,
    // and what colour the sky is against the ground bounce. It does not decide overall level. The
    // coefficients are normalised on the runtime side so their spherical average matches the flat
    // ambient this replaced, because changing the demo's exposure and its ambient direction in one
    // step would leave no way to tell which of the two moved the picture.
    const shIrradiance = uSh0
      .add(uSh1.scale(normal.y))
      .add(uSh2.scale(normal.z))
      .add(uSh3.scale(normal.x))
      .add(uSh4.scale(normal.x * normal.y))
      .add(uSh5.scale(normal.y * normal.z))
      .add(uSh6.scale(3 * normal.z * normal.z - 1))
      .add(uSh7.scale(normal.x * normal.z))
      .add(uSh8.scale(normal.x * normal.x - normal.y * normal.y));
    const ambient = shIrradiance.scale(uAmbientStrength * ao);
    const lit = dampEarth.mul(ambient.add(irradiance));
    const stonePath = smoothstep(0.44, 0.5, max(0.6 - abs(vWorld.x) * 0.12, 0.6 - abs(vWorld.z) * 0.12));
    const pathTint = mix(vec3(1, 1, 1), vec3(0.74, 0.78, 0.72), stonePath * 0.18);
    const materialColor = lit.mul(pathTint).add(irradiance.scale(0.035)).scale(uExposure);
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(
      materialColor,
      uFogColor,
      fog * uFogMaximumMix,
    )), 1);
  },
});
