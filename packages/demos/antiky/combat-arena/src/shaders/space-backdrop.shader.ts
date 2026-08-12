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
    // Earth, close enough that the arena reads as being in orbit around it rather than lost in
    // deep space. It was here before at a fifth of this size and about a tenth of this brightness —
    // a dark blue smudge in a corner that nobody would identify as a planet.
    //
    // Bigger, nearer the frame's edge so it anchors a corner rather than sitting behind the play
    // area, and lit like a real dayside: deep ocean blue, brighter toward the limb where the
    // atmosphere thickens, with cloud bands over the top.
    // Centred well inside the backdrop plane. The plane is 56 across, so it spans -28..28 — a disc
    // centred near the edge is mostly *off* the geometry and renders as a clipped sliver rather than
    // a planet. Radius 12 at (-14, -14) keeps the whole disc on the plane.
    const planetVector = coordinates.sub(vec2(-14, -14));
    const planetDistance = length(planetVector);
    const planetRadius = 12;
    const planetDisc = 1 - smoothstep(planetRadius - 0.5, planetRadius, planetDistance);
    const atmosphere = clamp(1 - smoothstep(planetRadius - 0.1, planetRadius + 4.6, planetDistance) - planetDisc, 0, 1);
    const limb = pow(clamp(1 - planetDistance / planetRadius, 0, 1), 0.34);
    // Two crossed sine fields rather than one, so the cloud belts curve and break instead of
    // reading as stripes on a beach ball.
    const cloudBands = clamp(
      0.5 + sin(planetVector.y * 0.42 + sin(planetVector.x * 0.23) * 2.1) * 0.5
        + sin(planetVector.x * 0.31 - planetVector.y * 0.17) * 0.22
        + sin(planetVector.y * 0.83 + planetVector.x * 0.29) * 0.16,
      0,
      1,
    );
    // Continents: a slow field, thresholded, so land masses read as land rather than as noise.
    const landField = 0.5
      + sin(planetVector.x * 0.19 + 1.7) * sin(planetVector.y * 0.24 - 0.6) * 0.36
      + sin(planetVector.x * 0.47 - 0.9) * sin(planetVector.y * 0.39 + 2.2) * 0.2;
    const land = smoothstep(0.62, 0.78, landField) * planetDisc;
    // The sunlit side. The arena's key light comes from -X +Y, so the planet's terminator agrees
    // with it — a planet lit from the wrong side is the sort of thing nobody names but everyone
    // feels.
    const dayside = clamp(0.46 + (0 - planetVector.x) * 0.038 + planetVector.y * 0.022, 0, 1.2);
    const ocean = mix(vec3(0.035, 0.16, 0.42), vec3(0.12, 0.36, 0.72), limb);
    const continents = mix(vec3(0.16, 0.26, 0.13), vec3(0.42, 0.36, 0.22), landField);
    const planet = mix(ocean, continents, land * 0.85)
      .add(vec3(0.86, 0.9, 0.95).scale(cloudBands * 0.34))
      .scale(dayside);
    const space = vec3(0.0015, 0.004, 0.012)
      .add(vec3(0.008, 0.016, 0.032).scale(nebula * 0.7))
      .add(vec3(0.68, 0.78, 0.94).scale(sparseStars * (1 - planetDisc)));
    const withPlanet = mix(space, planet, planetDisc);
    // The atmospheric limb, which is what actually sells a planet as a sphere with air on it.
    const withAtmosphere = withPlanet
      .add(vec3(0.16, 0.44, 0.86).scale(atmosphere * atmosphere * 1.9 * dayside));
    return vec4(tonemapACES(withAtmosphere), 1);
  },
});
