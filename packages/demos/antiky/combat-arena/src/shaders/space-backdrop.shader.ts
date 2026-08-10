import {
  clamp,
  dot,
  fract,
  length,
  max,
  mix,
  pow,
  shader,
  sin,
  smoothstep,
  vec2,
  vec3,
  vec4,
} from 'brometal';
import { tonemapACES } from 'brometal/shader-functions';

export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition }, { uViewProj }, v) {
    const world = vec3(aPosition.x, -1.45, aPosition.z);
    v.vWorld = world;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uTime }, { vWorld }) {
    const coordinates = vWorld.xz;
    const starSeed = fract(sin(dot(coordinates, vec2(12.9898, 78.233))) * 43_758.5453);
    const sparseStars = pow(max(starSeed, 0), 72) * (0.66 + sin(uTime * 0.45 + starSeed * 16) * 0.12);
    const nebula = clamp(
      sin(coordinates.x * 0.105 + coordinates.y * 0.062)
        * sin(coordinates.y * 0.086 - coordinates.x * 0.034) * 0.5 + 0.5,
      0,
      1,
    );
    const planetVector = coordinates.sub(vec2(-16.5, -12.5));
    const planetDistance = length(planetVector);
    const planetDisc = 1 - smoothstep(7.35, 7.85, planetDistance);
    const atmosphere = clamp(1 - smoothstep(7.8, 10.25, planetDistance) - planetDisc, 0, 1);
    const limb = pow(clamp(1 - planetDistance / 7.85, 0, 1), 0.34);
    const cloudBands = 0.5 + sin(planetVector.y * 1.28 + sin(planetVector.x * 0.42) * 1.6) * 0.5;
    const planet = mix(vec3(0.018, 0.045, 0.09), vec3(0.075, 0.18, 0.27), limb)
      .add(vec3(0.08, 0.12, 0.14).scale(cloudBands * 0.18));
    const space = vec3(0.0015, 0.004, 0.012)
      .add(vec3(0.008, 0.016, 0.032).scale(nebula * 0.7))
      .add(vec3(0.68, 0.78, 0.94).scale(sparseStars * (1 - planetDisc)));
    const withPlanet = mix(space, planet, planetDisc);
    const withAtmosphere = withPlanet.add(vec3(0.04, 0.22, 0.34).scale(atmosphere * atmosphere * 1.25));
    return vec4(tonemapACES(withAtmosphere), 1);
  },
});
