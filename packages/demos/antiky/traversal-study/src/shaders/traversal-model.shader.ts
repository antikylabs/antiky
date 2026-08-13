import {
  abs,
  dot,
  length,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { rotate2, shadowFactor } from 'brometal/shader-functions';

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
  attributes: { aPosition: 'vec3', aNormal: 'vec3', aUv: 'vec2' },
  instanceAttributes: { iOffset: 'vec3', iScale: 'vec3', iParams: 'vec3' },
  uniforms: {
    uSunDirection: 'vec3',
    uShadowMap: 'sampler2D',
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uWrap: 'float',
    uTex: 'sampler2D',
    uRamp: 'sampler3D',
    uKitMaterials: 'sampler3D',
    uMaterialDiffuse: 'sampler2D',
    uMaterialRoughness: 'sampler2D',
    uMaterialStrength: 'float',
    uSh0: 'vec3',
    uSh1: 'vec3',
    uSh2: 'vec3',
    uSh3: 'vec3',
    uSh4: 'vec3',
    uSh5: 'vec3',
    uSh6: 'vec3',
    uSh7: 'vec3',
    uSh8: 'vec3',
    uDetailNormal: 'sampler2D',
  },
  varyings: { vWorld: 'vec3', vNormal: 'vec3', vUv: 'vec2' },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iParams }, { uViewProj, uTime }, v) {
    const animatedYaw = iParams.x + sin(uTime * 3.1 + iParams.z) * iParams.y;
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), animatedYaw);
    const rotatedNormal = rotate2(aNormal.xz, animatedYaw);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
    v.vUv = aUv;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    {
    uSunDirection,
    uShadowMap,
    uLightViewProj,
    uLightPosition,
    uShadowRange, uCameraPosition, uWrap, uTex, uRamp, uKitMaterials, uMaterialDiffuse, uMaterialRoughness, uMaterialStrength, uSh0, uSh1, uSh2, uSh3, uSh4, uSh5, uSh6, uSh7, uSh8, uDetailNormal },
    { vWorld, vNormal, vUv },
  ) {
    const texel = decodeSrgb(texture(uTex, vUv).xyz);
    const baseNormal = normalize(vNormal);
    // Triplanar detail normal, written out here rather than called through a helper.
    //
    // A `texture()` call inside a DSL helper compiles to `textureSampleLevel(..., 0.0)`, pinning the
    // sample to the base mip. On a texture tiled this often that reads as crawling static the moment
    // the camera moves. Inlining the sample in the fragment body is what keeps the mip chain.
    //
    // This demo has the least to lose and the most to gain: the Kenney platformer models carry 5-18
    // unique UVs and the Quaternius models were flattened to a palette strip, so there is no
    // authored surface detail here for a projection to overwrite. It is also the demo whose whole
    // subject is material - felt, cardboard, corrugate - which is why the rate is the tightest of
    // the four.
    //
    // Rate and strength are local consts rather than uniforms. Nothing varies them at run time, and
    // a uniform would mean binding plumbing at every call site for a number that never moves.
    const detailRate = 1.1;
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
    const light = normalize(vec3(-0.38, 0.84, 0.48));
    // The sun's shadow, and the only cast shadow on the course.
    //
    // Softness, bias and the shadow texel are literals rather than uniforms, agreed across both
    // material shaders. 0.00048828125 is 1 / 2048, which is `SHADOW_MAP_SIZE` in `src/sun.ts` — a
    // texel size that does not match the map silently resizes the penumbra rather than failing.
    //
    // The bias is larger than the reference's 0.03 because this map covers a moving 28-unit slice
    // rather than a fixed room, so one depth step is 0.028 world units rather than 0.016.
    const shadowSoftness = 2.5;
    const shadowBias = 0.05;
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
    // Wrapped diffuse, for surfaces light passes through rather than bounces off.
    //
    // A cloud lit by `max(dot(n, l), 0)` has a hard terminator and a black underside, because that
    // term says every surface facing away from the sun receives nothing. Light entering a diffuse
    // volume does not stop at the terminator, so wrapping the dot product forward before clamping
    // carries some of it around the back.
    //
    // `uWrap` is set per batch and is 0 for everything solid, so this costs a multiply and an add on
    // the geometry that does not want it. Explicit rather than inferred: the alternative was to key
    // off `uGradeMix`, which happens to be high on clouds today and is really about colour grading,
    // so anything that later graded a rock heavily would start lighting like a cloud.
    // The shadow attenuates the key term and nothing else: the ambient and the rim are what a
    // surface receives from everything that is *not* the key, and dimming those too is what makes a
    // shadowed area read as flat grey instead of dark and shaped.
    const diffuse = max((dot(normal, light) + uWrap) / (1 + uWrap), 0) * sunVisibility;
    // The lighting ramp decides what a surface looks like at this light level, rather than how much
    // grey to scale it by.
    //
    // What this replaced: `0.54 + smoothstep(...) * 0.2 + smoothstep(...) * 0.24` — three bands
    // spanning 0.54 to 0.98. A 1.81:1 range with no hue movement at all, so shadow and light
    // differed only in brightness. The ramp measures **6.69:1** by luminance across its committed
    // stops and shifts 186 degrees, from a cool deep shadow through a chromatic midtone to a warm
    // pale highlight — the move a painter makes, and the reason stylised games read as lit rather
    // than as tinted.
    //
    // This comment said 14.8:1 until goal 07 measured it. That is not what the stops contain, and
    // `tests/lighting-ramp.test.ts` now reads the data rather than describing it. 6.69 still clears
    // the goal-07 bar of 6:1 comfortably.
    //
    // A 3D sampler for a 1D lookup because `createTexture3D` is BroMetal's only raw-buffer upload.
    // Height and depth are 1, so both are sampled at their middle.
    const rampLight = texture(uRamp, vec3(diffuse, 0.5, 0.5)).xyz;
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
    // Roughness from the kit's own palette, addressed by the same UV the albedo uses.
    //
    // The swatch a face lands on is its material identity: V picks the palette row, U picks the
    // swatch. Before this, every face of every model took one roughness, so a grass top and a
    // painted crate side scattered light identically.
    //
    // Sampled `nearest`: this is a table of discrete entries, and blending two swatches would invent
    // a roughness belonging to neither.
    const kitRoughness = texture(uKitMaterials, vec3(vUv.x, vUv.y, 0.5)).x;
    const view = normalize(uCameraPosition.sub(vWorld));
    // The material's own roughness, folded in at the same per-batch strength so a batch with no
    // material keeps the swatch value alone. One projection: roughness is low frequency, and a third
    // of the samples is a third of the cost.
    const materialRough = mix(
      1,
      texture(uMaterialRoughness, vWorld.xz.scale(0.42)).x,
      uMaterialStrength,
    );
    // A rough surface scatters, so its edge light is broader and weaker; a smooth one keeps a
    // tight bright rim. That is the one place roughness is visible in a toon-shaded demo.
    const rim = pow(1 - max(dot(normal, view), 0), 3.4) * (1.25 - kitRoughness * materialRough);
    // What the surface is made of, projected in world space and applied **per batch**.
    //
    // `uMaterialStrength` is the important part. This shader draws every catalog batch — grass,
    // rock, trees, the courier and the clouds — so a material bound to the shader is a material on
    // all of them. A first attempt did exactly that and produced brown clouds. Strength is set per
    // batch beside `gradeColor` and `gradeMix`, which are already per-batch for the same reason, so
    // a cloud takes none and stays palette-only.
    //
    // Multiplied rather than mixed: a tint over a material is a multiply, and mixing would wash the
    // kit's colour toward grey exactly where its identity lives. The 1.9 restores the stop that
    // plywood's dark diffuse costs.
    //
    // Sampled in the fragment body, never through a helper — `texture()` inside a DSL helper
    // compiles to `textureSampleLevel(..., 0.0)` and loses the mip chain.
    const materialRate = 0.42;
    const materialX = texture(uMaterialDiffuse, vec2(vWorld.z, vWorld.y).scale(materialRate)).xyz;
    const materialY = texture(uMaterialDiffuse, vWorld.xz.scale(materialRate)).xyz;
    const materialZ = texture(uMaterialDiffuse, vWorld.xy.scale(materialRate)).xyz;
    const materialAlbedo = decodeSrgb(
      materialX.scale(weightX).add(materialY.scale(weightY)).add(materialZ.scale(weightZ))
        .scale(1 / weightSum),
    // Normalised so the material *modulates* brightness instead of removing it.
    //
    // Plywood's mean linear luminance is 0.1367, so multiplying its albedo straight into a palette
    // colour costs about three stops and turns a green top into dark olive. Dividing by that mean
    // centres it on 1.0: grain lighter than the average brightens, grain darker than it darkens, and
    // the surface keeps the level the palette and the ramp gave it.
    //
    // This is the difference between "the platform is made of plywood" and "the platform is painted
    // with a photograph of plywood", and only the first one is what the art direction wants.
    ).scale(7.32);
    // Pulled toward 1 as well as toward the material, so the grain reads as relief rather than as a
    // second albedo fighting the first.
    const surface = mix(vec3(1, 1, 1), mix(vec3(1, 1, 1), materialAlbedo, 0.55), uMaterialStrength);
    // The Kenney palette is poster paint — fully saturated flat colour, which is what made the
    // course read as plastic blocks rather than as made of anything. Pulling it well toward
    // toward its own luminance keeps the colour language the kit was designed around while letting
    // the material underneath carry the surface.
    // `uGradeColor` / `uGradeMix` deleted here, which goal 07 asks for by name. At their runtime
    // values they replaced about **90% of the cloud texture and 78% of the cliff texture with flat
    // colour** — a grade strong enough that the art underneath it was barely visible, standing in
    // for lighting the demo did not have. The ramp and the SH-9 ambient do that job now.
    const palette = texel;
    const paletteLuminance = palette.x * 0.2126 + palette.y * 0.7152 + palette.z * 0.0722;
    const graded = mix(
      palette,
      vec3(paletteLuminance, paletteLuminance, paletteLuminance),
      0.38,
    ).mul(surface);
    // Tinted toward the sky rather than the surface colour, so the edge reads as light coming from
    // the world behind the object instead of the object glowing.
    // Real sky in the shadows, the authored ramp everywhere else.
    //
    // Added in proportion to how *un*lit a surface is, so a face in full sun sees the ramp alone and
    // a face turned away picks up the sky's actual direction and hue. That is what makes the shadow
    // side of a rock differ from the shadow side of an overhang, which one hand-picked blue cannot.
    //
    // Scaled to the ramp's darkest step in `src/ambient.ts` — the ramp decides level, the sky
    // decides colour. Reversing that would trade the demo's whole visual identity for physical
    // correctness nobody asked for.
    const skyAmbient = uSh0
      .add(uSh1.scale(normal.y))
      .add(uSh2.scale(normal.z))
      .add(uSh3.scale(normal.x))
      .add(uSh4.scale(normal.x * normal.y))
      .add(uSh5.scale(normal.y * normal.z))
      .add(uSh6.scale(3 * normal.z * normal.z - 1))
      .add(uSh7.scale(normal.x * normal.z))
      .add(uSh8.scale(normal.x * normal.x - normal.y * normal.y));
    const base = graded.mul(rampLight.add(skyAmbient.scale(1 - diffuse))).add(vec3(0.62, 0.72, 0.78).scale(rim * 0.55));
    const distanceFog = smoothstep(22, 58, length(uCameraPosition.sub(vWorld)));
    // Linear HDR, and nothing else. Exposure, the tone-map and the encode all happen once in
    // `post.shader.ts`.
    //
    // **One sky.** This demo used to render three in a single frame: this shader faded to
    // (0.55, 0.65, 0.66), `traversal-surface` to (0.52, 0.63, 0.65), and the canvas cleared to
    // (0.38, 0.57, 0.68). A platform receding into a colour the sky behind it is not is the kind of
    // thing nobody sees and everybody feels. The clear colour won because it is what most of the
    // frame actually is.
    //
    // The value is linear because the target is: the post pass exposes, tone-maps and encodes it
    // along with the geometry, so it has to enter in the same space.
    return vec4(mix(base, vec3(0.096296, 0.190755, 0.284863), distanceFog * 0.42), 1);
  },
});
