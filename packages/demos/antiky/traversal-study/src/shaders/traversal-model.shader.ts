import {
  abs,
  step,
  pow,
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
import { rotate2 } from 'brometal/shader-functions';

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
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uGradeColor: 'vec3',
    uGradeMix: 'float',
    uWrap: 'float',
    uTex: 'sampler2D',
    uRamp: 'sampler3D',
    uDetailNormal: 'sampler2D',
  },
  varyings: { vWorld: 'vec3', vNormal: 'vec3', vUv: 'vec2', vWash: 'float' },

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
    v.vWash = 0.96 + sin(world.x * 1.7 + world.y * 2.3) * 0.04;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    { uCameraPosition, uGradeColor, uGradeMix, uWrap, uTex, uRamp, uDetailNormal },
    { vWorld, vNormal, vUv, vWash },
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
    const diffuse = max((dot(normal, light) + uWrap) / (1 + uWrap), 0);
    // The lighting ramp decides what a surface looks like at this light level, rather than how much
    // grey to scale it by.
    //
    // What this replaced: `0.54 + smoothstep(...) * 0.2 + smoothstep(...) * 0.24` — three bands
    // spanning 0.54 to 0.98. A 1.81:1 range with no hue movement at all, so shadow and light
    // differed only in brightness. The ramp is 14.8:1 and shifts 185 degrees from a cool deep
    // shadow through a chromatic midtone to a warm pale highlight, which is the move a painter
    // makes and the reason stylised games read as lit rather than as tinted.
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
    const view = normalize(uCameraPosition.sub(vWorld));
    const rim = pow(1 - max(dot(normal, view), 0), 2.6);
    const graded = mix(texel, uGradeColor, uGradeMix);
    // Tinted toward the sky rather than the surface colour, so the edge reads as light coming from
    // the world behind the object instead of the object glowing.
    const base = graded.mul(rampLight).scale(vWash).add(vec3(0.55, 0.65, 0.66).scale(rim * 0.3 * vWash));
    const distanceFog = smoothstep(22, 58, length(uCameraPosition.sub(vWorld)));
    return vec4(mix(base, vec3(0.55, 0.65, 0.66), distanceFog * 0.42), 1);
  },
});
