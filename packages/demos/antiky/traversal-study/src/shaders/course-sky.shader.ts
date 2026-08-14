import {
  clamp,
  exp,
  max,
  normalize,
  pow,
  shader,
  smoothstep,
  vec3,
  vec4,
} from 'brometal';

/**
 * The course's sky — goal 08. The old sky was literally `clearColor: [0.38, 0.57, 0.68]`: one flat
 * blue over sixty percent of the frame, which is most of why the §7.1 hue budget measured 84% of
 * the chromatic pixels in a single cluster. A dome at infinity carries a real gradient instead:
 * a deeper afternoon zenith, a warm cream band low on the horizon where LittleBigPlanet keeps its
 * stage light, and a soft sun glow behind the course's far end. Aerial perspective comes from the
 * existing fog, which fades the far course into the same horizon band this dome paints.
 *
 * Linear HDR out, like every material here: the post pass tone-maps and encodes once.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition }, { uViewProj, uCameraPosition }, v) {
    v.vWorld = aPosition;
    return uViewProj.mul(vec4(aPosition.add(uCameraPosition), 1));
  },

  fragment(_, { vWorld }) {
    const direction = normalize(vWorld);
    const height = clamp(direction.y, -0.35, 1);
    // The camera sees roughly -0.15..0.3 of elevation, so the whole gradient must happen inside
    // that band — the first authoring spread it over the hemisphere and the frame saw only the
    // horizon colour. The warm band is a thin seam now, blue arrives fast above it, and below the
    // horizon a cool sea-haze deepens instead of staying cream.
    const above = clamp(height, 0, 1);
    const horizonBand = pow(1 - above, 9) * smoothstep(-0.1, 0.005, height);
    const zenith = vec3(0.1, 0.24, 0.46);
    const mid = vec3(0.24, 0.42, 0.6);
    const horizon = vec3(0.66, 0.52, 0.34);
    const base = zenith.add(mid.sub(zenith).scale(clamp(1 - above * 3.2, 0, 1)));
    const below = clamp(0 - height, 0, 1);
    const sea = vec3(0.16, 0.24, 0.3);
    const skyAbove = base.add(horizon.sub(base).scale(horizonBand));
    const sky = skyAbove.scale(1 - smoothstep(0, 0.18, below))
      .add(sea.scale(smoothstep(0, 0.18, below)));
    // A broad warm glow where the sun hangs behind the course's far end — up-course, low.
    const toSun = normalize(vec3(0.55, 0.16, -0.8));
    const sunness = max(direction.x * toSun.x + direction.y * toSun.y + direction.z * toSun.z, 0);
    const glow = vec3(0.9, 0.62, 0.34).scale(exp((sunness - 1) * 11) * 0.6);
    return vec4(sky.add(glow), 1);
  },
});
