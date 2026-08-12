import {
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
  step,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
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

    // The cloud deck, turning faster than the ground beneath it.
    const cloudLongitude = atan(normal.z, normal.x) + uTime * 0.031;
    const cloudUv = vec2(cloudLongitude * 0.159155 + 0.5, 0.5 - latitude * 0.318310);
    const cloudDensity = clamp(texture(uClouds, cloudUv).x * 1.25, 0, 1);

    // Sunlight. The same key direction every other shader in this demo uses, so the terminator
    // agrees with the light on the arena and the ships.
    const sun = normalize(vec3(-0.44, 0.86, 0.42));
    const lambert = max(dot(normal, sun), 0);
    // A soft terminator rather than a hard one: an atmosphere scatters light past the geometric
    // boundary, and a knife-edge day/night line is the giveaway of a planet without air.
    const dayNight = clamp(lambert * 1.35 + 0.06, 0, 1.25);

    // Night side: city lights would need a second texture, so this is the faint blue of a lit
    // atmosphere over dark ocean, which is what the eye expects at this scale.
    const night = vec3(0.012, 0.018, 0.035);

    // Ocean takes a specular glint, land does not. Blue is the cheapest available proxy for water on
    // this albedo and it costs no extra sample.
    const oceanMask = clamp((surface.z - surface.x) * 3.4, 0, 1);
    const glint = pow(max(dot(normalize(sun.add(view)), normal), 0), 90) * oceanMask * lambert;

    const litSurface = surface.scale(dayNight).add(vec3(0.28, 0.44, 0.75).scale(glint * 0.5));
    const litClouds = vec3(0.95, 0.96, 0.99).scale(dayNight * 0.92);
    const daySide = mix(litSurface, litClouds, cloudDensity * 0.82);
    const withNight = mix(night, daySide, clamp(lambert * 2.4 + 0.08, 0, 1));

    // The atmospheric limb. Fresnel against the view, gated by the sunlit side so it does not glow
    // around the dark edge, and biased blue because that is what Rayleigh scattering does.
    const rim = pow(1 - max(dot(normal, view), 0), 2.6);
    const haze = vec3(0.24, 0.52, 0.95)
      .scale(rim * (0.35 + max(dot(normal, sun), 0) * 1.5));

    return vec4(withNight.add(haze), 1);
  },
});
