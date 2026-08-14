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
  sqrt,
  smoothstep,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { shadowFactor } from 'brometal/shader-functions';
/**
 * Cook-Torrance GGX specular: the light that leaves this surface toward the viewer.
 *
 * BroMetal's `specGGX` is the distribution term on its own — no Fresnel, no geometry term, and a
 * hard-coded `0.25` sitting where `1 / (4 · N·L · N·V)` belongs. Nothing bounds it, so every call
 * site in this demo used to wrap it in `min(…, 1.5)` or `min(…, 2.4)` and scale the result down by
 * 0.12 to keep highlights off the ceiling. Those numbers were not tuning, they were a workaround.
 *
 * The three terms that make the ceilings unnecessary:
 *
 * - **Distribution** (GGX / Trowbridge-Reitz) — how tightly the microfacets line up with the
 *   halfway vector, which is how wide the highlight is. This is the only part `specGGX` had.
 * - **Visibility** — height-correlated Smith, which is the geometry term already divided by
 *   `4 · N·L · N·V`. This is the real denominator the `0.25` stood in for, and it is what makes a
 *   grazing highlight fall off rather than run away.
 * - **Fresnel** (Schlick) — how reflective the surface is at this angle. `f0` is its reflectance
 *   head-on: 0.04 for dielectrics, the albedo itself for metals. This is the term that makes brass
 *   and stone stop looking like the same material.
 *
 * Energy is conserved by construction, so there is nothing left to clamp. `tests/specular.test.ts`
 * integrates this over the hemisphere and finds it never returns more light than arrives.
 *
 * Declared in every shader that needs it rather than imported, for the same reason `decodeSrgb` is:
 * the BroMetal MVP resolves only module-level helpers declared above their first use, and an
 * imported one fails to compile. `pipeline-invariants.test.mjs` asserts every copy is identical.
 */
function specularGGX(normal: Vec3, light: Vec3, view: Vec3, roughness: number, f0: Vec3): Vec3 {
  const halfway = normalize(light.add(view));
  const nDotL = max(dot(normal, light), 0);
  // Floored rather than clamped to zero. Both of these end up in a denominator, and a surface
  // exactly edge-on to the viewer should be an unlit pixel, not a division by zero.
  const nDotV = max(dot(normal, view), 0.0001);
  const nDotH = max(dot(normal, halfway), 0);
  const vDotH = max(dot(view, halfway), 0);
  const alpha = roughness * roughness;
  const alphaSq = alpha * alpha;
  const distributionDenominator = nDotH * nDotH * (alphaSq - 1) + 1;
  const distribution = alphaSq / (3.14159265 * distributionDenominator * distributionDenominator);
  const occlusionTowardView = nDotL * sqrt(nDotV * nDotV * (1 - alphaSq) + alphaSq);
  const occlusionTowardLight = nDotV * sqrt(nDotL * nDotL * (1 - alphaSq) + alphaSq);
  const visibility = 0.5 / max(occlusionTowardView + occlusionTowardLight, 0.0001);
  // (1 - V·H)^5 as five multiplies rather than a `pow`: cheaper, and exact at both endpoints.
  const grazing = 1 - vDotH;
  const grazingSq = grazing * grazing;
  const fresnelWeight = grazingSq * grazingSq * grazing;
  const fresnel = f0.add(vec3(1, 1, 1).sub(f0).scale(fresnelWeight));
  return fresnel.scale(distribution * visibility * nDotL);
}

function materialPresentationFloorLight(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
  albedo: Vec3,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  // Stone and moss are dielectrics, so 0.04 — the reflectance of a non-metal facing the viewer
  // head-on. Written here rather than as a module constant: the BroMetal MVP does not resolve
  // module-level const values.
  const specular = specularGGX(normal, light, view, roughness, vec3(0.04, 0.04, 0.04));
  // Item 11's falloff: inverse-square with a windowed radius, replacing `power * range²` — a
  // parabola with no bright core, which is why the audit read these as coloured balls rather than
  // lights. The 0.35 floors the divisor so the core clips to near-white instead of to infinity,
  // which is what the HDR target and the bloom pass exist to receive; the window keeps the finite
  // radius the gameplay fields are authored against.
  const arriving = lightColor.scale(lightPower * range * range / (0.35 + distanceSq * 0.55));
  // Albedo tints the diffuse and not the specular. A highlight on wet stone is the colour of the
  // light, not the colour of the stone — that is what `f0` above is for. The two used to be summed
  // and tinted together by the caller, which made every highlight take the surface's colour.
  return arriving.mul(albedo.scale(diffuse).add(specular));
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
    uSunDirection: 'vec3',
    uSunColor: 'vec3',
    uShadowMap: 'sampler2D',
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
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
    uSunDirection,
    uSunColor,
    uShadowMap,
    uLightViewProj,
    uLightPosition,
    uShadowRange,
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
    // The floor's own grey wash is gone for the same reason as the model's: it was compensating for
    // lighting in display space, which the encode has now fixed.
    const diffuseSample = sourceDiffuse;
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
    // §6.1's palette strategy: the ground holds a narrow desaturated blue-green band so every
    // saturated colour in frame belongs to a light. The litter texture is authored in warm autumn
    // tones, so it is pulled most of the way to its own grey before the cool tint — the practicals
    // repaint their own pools through the falloff, which is where the goal says the colour goes.
    const litterGrey = dot(diffuseSample, vec3(0.2126, 0.7152, 0.0722));
    const dampEarth = mix(diffuseSample, vec3(litterGrey, litterGrey, litterGrey), 0.72).mul(uDiffuseTint);
    const amber = materialPresentationFloorLight(vWorld, normal, view, uEmberPosition, uEmberColor, uEmberPower, uEmberRadius, roughness, dampEarth);
    const blue = materialPresentationFloorLight(vWorld, normal, view, uIonPosition, uIonColor, uIonPower, uIonRadius, roughness, dampEarth);
    const plum = materialPresentationFloorLight(vWorld, normal, view, uVioletPosition, uVioletColor, uVioletPower, uVioletRadius, roughness, dampEarth);
    const irradiance = amber.add(blue).add(plum).scale(uRelayLightStrength);
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
    // Item 11's bounce: the ground's ambient warms toward whichever practical is nearest, on a
    // window wider than the direct pool. This is what makes the floor under the amber relay feel
    // warm rather than merely lit — one wide, weak tint per light, added to the hemisphere term.
    const emberBounce = uEmberColor.scale(clamp(1 - dot(vWorld.sub(uEmberPosition), vWorld.sub(uEmberPosition)) / 30, 0, 1) * 0.16 * uEmberPower);
    const ionBounce = uIonColor.scale(clamp(1 - dot(vWorld.sub(uIonPosition), vWorld.sub(uIonPosition)) / 30, 0, 1) * 0.16 * uIonPower);
    const violetBounce = uVioletColor.scale(clamp(1 - dot(vWorld.sub(uVioletPosition), vWorld.sub(uVioletPosition)) / 30, 0, 1) * 0.16 * uVioletPower);
    const ambient = shIrradiance.add(emberBounce).add(ionBounce).add(violetBounce).scale(uAmbientStrength * ao);
    // The sun, and the only shadow in this demo.
    //
    // Softness, bias and the shadow texel are literals rather than uniforms, in the same spirit as
    // the triplanar detail rate: nothing varies them at run time, and a uniform would mean binding
    // plumbing at every call site for a number that never moves. All three are agreed across the
    // three material shaders, and `pipeline-invariants.test.mjs` holds them equal.
    //
    // 2.5 spreads the nine taps over five shadow texels, about 5 cm here — a visible penumbra that
    // still lets a rock meet its own shadow. The bias is in world units and has to clear both the
    // depth quantum (0.016) and one texel's world footprint (0.010); below that a surface shadows
    // itself in stripes, and far above it the shadow walks away from its caster.
    //
    // 0.00048828125 is 1 / 2048, which is `SHADOW_MAP_SIZE` in `src/sun.ts`. `sun.test.ts` asserts
    // the two agree, because a texel size that does not match the map silently resizes the penumbra.
    const shadowSoftness = 2.5;
    const shadowBias = 0.03;
    const sunVisibility = shadowFactor(
      uShadowMap,
      uLightViewProj,
      vWorld,
      normal,
      uLightPosition,
      uShadowRange,
      0.00048828125,
      shadowSoftness,
      shadowBias,
    );
    const sunDiffuse = max(dot(normal, uSunDirection), 0);
    const sunSpecular = specularGGX(normal, uSunDirection, view, roughness, vec3(0.04, 0.04, 0.04));
    // Albedo tints the diffuse, `f0` tints the specular — the same split the relay lights use.
    const sunRadiance = uSunColor
      .scale(sunVisibility)
      .mul(dampEarth.scale(sunDiffuse).add(sunSpecular));
    const lit = dampEarth.mul(ambient).add(irradiance).add(sunRadiance);
    const stonePath = smoothstep(0.44, 0.5, max(0.6 - abs(vWorld.x) * 0.12, 0.6 - abs(vWorld.z) * 0.12));
    const pathTint = mix(vec3(1, 1, 1), vec3(0.74, 0.78, 0.72), stonePath * 0.18);
    const materialColor = lit.mul(pathTint).add(irradiance.scale(0.035));
    const fog = smoothstep(uFogStart, uFogEnd, length(uCameraPosition.sub(vWorld)));
    // Linear HDR. See `post.shader.ts` for where this becomes an image.
    return vec4(mix(
      materialColor,
      uFogColor,
      fog * uFogMaximumMix,
    ), 1);
  },
});
