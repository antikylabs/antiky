import {
  clamp,
  exp,
  max,
  normalize,
  pow,
  shader,
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
    const height = clamp(direction.y, -0.2, 1);
    // Zenith to horizon: the gradient lives low, the way an afternoon sky does.
    const horizonBand = pow(1 - clamp(height, 0, 1), 3.2);
    const zenith = vec3(0.16, 0.34, 0.58);
    const mid = vec3(0.42, 0.62, 0.78);
    const horizon = vec3(1.05, 0.82, 0.55);
    const base = zenith.add(mid.sub(zenith).scale(clamp(1 - height * 1.5, 0, 1)));
    const sky = base.add(horizon.sub(base).scale(horizonBand));
    // A broad warm glow where the sun hangs behind the course's far end — up-course, low.
    const toSun = normalize(vec3(0.55, 0.18, -0.8));
    const sunness = max(direction.x * toSun.x + direction.y * toSun.y + direction.z * toSun.z, 0);
    const glow = vec3(1.35, 1.0, 0.62).scale(exp((sunness - 1) * 9) * 0.85);
    return vec4(sky.add(glow), 1);
  },
});
