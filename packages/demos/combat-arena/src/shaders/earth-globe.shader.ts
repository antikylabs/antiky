import {
  type Vec3,
  asin,
  atan,
  clamp,
  cos,
  dot,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  sqrt,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from 'brometal';

/**
 * sRGB to linear, applied when an albedo texture is sampled.
 *
 * BroMetal exposes no sRGB texture format — everything uploads as `rgba8unorm` — so a sampled albedo
 * texel arrives holding display-encoded values. Lighting maths on those is wrong: mid-tones come out
 * too dark, which then gets compensated by over-bright lights, and the error compounds through every
 * term downstream.
 *
 * Declared here rather than imported. The BroMetal MVP resolves only module-level helpers declared
 * above their first use; an imported helper fails to compile. `pipeline-invariants.test.mjs` asserts
 * every copy in the repository is identical.
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

/**
 * Earth, as an actual sphere with real imagery on it.
 *
 * What this replaces: a disc painted onto the backdrop plane out of sines — a flat blob that read as
 * a gas giant at best. A planet needs to be a planet. This is sphere geometry in the world, sampled
 * with NASA's Blue Marble albedo through an equirectangular projection, with the cloud composite
 * turning independently over the top and an atmospheric limb around the edge.
 *
 * **The clouds rotate at their own rate.** Surface and cloud deck are sampled from the same normal
 * at different longitudes, so the weather drifts across the continents instead of being painted on
 * them. That difference is most of what makes a globe read as alive rather than as a textured ball.
 *
 * Lit by the arena's key light so the terminator agrees with everything else in the frame — a planet
 * lit from the wrong side is the sort of thing nobody names but everyone feels.
 */
function channelToScene(channel: number): number {
  const safe = clamp(channel, 0, 0.9999);
  const a = 2.43 * safe - 2.51;
  const b = 0.59 * safe - 0.03;
  const c = 0.14 * safe;
  // The lower root. `max` guards the discriminant against a rounding excursion below zero.
  return (0 - b - sqrt(max(b * b - 4 * a * c, 0))) / (2 * a);
}

/**
 * ACES run backwards, so authored background imagery survives the post chain unchanged.
 *
 * This is the boundary conversion `point-light-expo` established for its clear colour and its fog:
 * a value authored as "what the screen should show" entering a pipeline that will expose, tone-map
 * and encode it has to be converted at the point it enters, or the chain applies a curve to
 * something that was never meant to go through one.
 *
 * The starfield and the planet are exactly that. They are not lit surfaces with a radiance the
 * renderer computes — they are painted, and their values were chosen against a path with no
 * tone-map in it. ACES multiplies a dark value by roughly 0.21, so leaving them unconverted took
 * the whole background about five times darker and moved this packet's invariance measurement from
 * 1.49 to 8.32 in the region they cover.
 *
 * The forward curve is `(2.51x² + 0.03x) / (2.43x² + 0.59x + 0.14)`. Setting that equal to `y` and
 * collecting terms gives a quadratic in `x`, and the lower root is the branch that is monotonic over
 * 0..1. Verified to round-trip to six decimal places across the range.
 *
 * It is a boundary, not a general escape hatch: nothing that the renderer *lights* may use this.
 */
function inverseTonemapACES(color: Vec3): Vec3 {
  return vec3(channelToScene(color.x), channelToScene(color.y), channelToScene(color.z));
}

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uCenter: 'vec3',
    uRadius: 'float',
    uAlbedo: 'sampler2D',
    uClouds: 'sampler2D',
  },
  varyings: {
    vNormal: 'vec3',
    vWorld: 'vec3',
  },

  vertex({ aPosition, aNormal }, { uViewProj, uCenter, uRadius }, v) {
    const world = aPosition.scale(uRadius).add(uCenter);
    v.vNormal = normalize(aNormal);
    v.vWorld = world;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment(
    { uCameraPosition, uTime, uAlbedo, uClouds },
    { vNormal, vWorld },
  ) {
    const normal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));

    // Equirectangular lookup. Longitude from atan of the horizontal components, latitude from the
    // vertical — the standard mapping Blue Marble is authored in, so continents land where they
    // belong rather than smeared toward a pole.
    const latitude = asin(clamp(normal.y, -1, 1));
    const surfaceSpin = uTime * 0.018;
    const surfaceLongitude = atan(normal.z, normal.x) + surfaceSpin;
    // Wrapped into 0..1 by hand. The sampler is set to repeat, so a longitude past the seam simply
    // continues rather than clamping to the edge column.
    const surfaceUv = vec2(surfaceLongitude * 0.159155 + 0.5, 0.5 - latitude * 0.318310);
    const surface = decodeSrgb(texture(uAlbedo, surfaceUv).xyz);

    // Whispy clouds, stylised rather than photographic.
    //
    // The NASA composite on its own is a realistic — and rather flat — grey overcast. Stretching the
    // lookup along longitude and warping it by a slow sine field pulls the same data into drawn-out
    // streaks that read as banded weather, which is what a stylised planet wants. Nothing here is
    // physical; it is the cloud texture used as a source of shape instead of as a photograph.
    const cloudLongitude = atan(normal.z, normal.x) + uTime * 0.031;
    const warp = sin(latitude * 7.4 + uTime * 0.06) * 0.055
      + sin(cloudLongitude * 3.1 - uTime * 0.04) * 0.03;
    // Sampled twice at different stretches and multiplied. Two thin streak fields overlapping give
    // gaps and filaments; one gives a solid sheet.
    const streakUv = vec2(cloudLongitude * 0.159155 * 0.62 + 0.5, 0.5 - latitude * 0.318310 + warp);
    const wispUv = vec2(cloudLongitude * 0.159155 * 1.35 + 0.22, 0.5 - latitude * 0.318310 - warp * 1.7);
    const streaks = texture(uClouds, streakUv).x;
    const wisps = texture(uClouds, wispUv).x;
    // Curved up so thin cloud drops out entirely and the remaining banks read as distinct systems
    // with clear sky between them, rather than as haze over everything.
    const cloudDensity = clamp(pow(clamp(streaks * wisps * 2.1, 0, 1), 1.5) * 1.5, 0, 1);

    // Sunlight. The same key direction every other shader in this demo uses, so the terminator
    // agrees with the light on the arena and the ships.
    // Lowered and moved behind the arena by goal 07's W B.3, and the reason is measured rather than
    // aesthetic. At its previous 59 degrees of elevation the sun dropped each caster's shadow
    // underneath the caster: only **1.63%** of the deck came back darkened by 25% or more, and no
    // 32-pixel probe pair could be placed. Elevation is what decides how much shadow a frame
    // contains. Moving it to -z also turns the shadows to face a camera that sits at +z.
    //
    // One value, agreed by every shader here and by `src/sun.ts`, which is what
    // `pipeline-invariants.test.mjs` asserts when it says a demo has one key direction.
    const sun = normalize(vec3(-0.52, 0.58, -0.63));
    const lambert = max(dot(normal, sun), 0);
    // A soft terminator rather than a hard one: an atmosphere scatters light past the geometric
    // boundary, and a knife-edge day/night line is the giveaway of a planet without air.
    // Earth is the brightest thing in an orbital frame after the sun itself, and the Blue Marble
    // albedo is dark on average (0.06 linear) because most of the planet is ocean. Lifting the
    // response is what makes it read as a lit sphere rather than as a dim ball.
    const dayNight = clamp(lambert * 3.4 + 0.18, 0, 3.4);

    // Night side: city lights would need a second texture, so this is the faint blue of a lit
    // atmosphere over dark ocean, which is what the eye expects at this scale.
    const night = vec3(0.02, 0.03, 0.06);

    // Ocean takes a specular glint, land does not. Blue is the cheapest available proxy for water on
    // this albedo and it costs no extra sample.
    const oceanMask = clamp((surface.z - surface.x) * 3.4, 0, 1);
    const glint = pow(max(dot(normalize(sun.add(view)), normal), 0), 90) * oceanMask * lambert;

    const litSurface = surface.scale(dayNight).add(vec3(0.28, 0.44, 0.75).scale(glint * 0.5));
    const litClouds = vec3(1.05, 1.07, 1.12).scale(dayNight * 0.95);
    const daySide = mix(litSurface, litClouds, cloudDensity * 0.82);
    const withNight = mix(night, daySide, clamp(lambert * 2.4 + 0.08, 0, 1));

    // The atmospheric limb. Fresnel against the view, gated by the sunlit side so it does not glow
    // around the dark edge, and biased blue because that is what Rayleigh scattering does.
    const rim = pow(1 - max(dot(normal, view), 0), 2.6);
    const haze = vec3(0.24, 0.52, 0.95)
      .scale(rim * (0.45 + max(dot(normal, sun), 0) * 2.4));

    // Linear HDR, and nothing else. Exposure, the tone-map and the encode all happen once in
    // `post.shader.ts`.
    return vec4(inverseTonemapACES(withNight.add(haze)), 1);
  },
});
