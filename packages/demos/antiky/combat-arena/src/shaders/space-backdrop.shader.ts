import {
  asin,
  dot,
  floor,
  fract,
  length,
  sin,
  smoothstep,
  step,
  atan,
  clamp,
  normalize,
  shader,
  texture,
  vec2,
  vec3,
  vec4,
} from 'brometal';

export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  uniforms: {
    uStarMap: 'sampler2D',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uViewProj: 'mat4',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition }, { uViewProj, uCameraPosition }, v) {
    // The sphere follows the camera, so the sky never gets closer no matter where the view goes —
    // which is what "at infinity" means in practice.
    //
    // This line used to read `vec3(aPosition.x, -1.45, aPosition.z)`, flattening every vertex onto a
    // plane beneath the arena. That silently defeated the change from plane to sphere: the geometry
    // was a sphere and the shader kept squashing it, so the capture came back byte-identical and
    // looked like the edit had not applied at all.
    v.vWorld = aPosition;
    return uViewProj.mul(vec4(aPosition.add(uCameraPosition), 1));
  },

  fragment({ uStarMap, uTime }, { vWorld }) {
    // Real sky, not hashed dots.
    //
    // What this replaces: `pow(fract(sin(dot(uv, magic)) * 43758.5453), 72)` — the standard hash
    // starfield, which gives every star the same size and the same colour on a perfectly even
    // scatter. Nothing in the actual sky looks like that, and it read as television static.
    //
    // This samples NASA's Deep Star Maps instead, which carries real star positions, real magnitudes
    // and the Milky Way band.
    //
    // Drawn on a sphere around the camera rather than the old floor plane. A plane addressed by view
    // direction stretches without limit where rays run nearly parallel to it, which turned the star
    // map into radial streaks; on a sphere every direction gets equal texture.
    const direction = normalize(vWorld);
    const longitude = atan(direction.z, direction.x);
    const latitude = asin(clamp(direction.y, -1, 1));
    const skyUv = vec2(longitude * 0.159155 + 0.5, 0.5 - latitude * 0.318310);
    // Not decoded from sRGB. This is emissive sky, not a surface albedo, and the map is authored to
    // be looked at rather than lit — decoding would crush the faint stars that carry the Milky Way.
    // The Milky Way band, low frequency and exactly what a photograph is good for.
    const band = texture(uStarMap, skyUv).xyz;

    // Crisp stars on top, generated rather than sampled.
    //
    // The map alone looked blurry, and it had to: 2048x1024 stretched across a whole sky is a couple
    // of texels per degree, so every star is a soft blob. Stars are the highest-frequency thing in
    // the sky and no practical texture resolves them.
    //
    // **Each star is drawn as a point inside its cell, not as the cell.** A first attempt shaded the
    // whole cell by its hash, which at this magnification meant screen-filling squares — the grid
    // was the star. Measuring the distance from the cell's centre and falling off sharply is what
    // makes a point; the grid only decides where points may appear.
    //
    // Three densities so magnitudes vary the way a real sky does: a few bright, more middling, a
    // dust of faint. One grid gives every star the same size, which is what made the old hash
    // starfield read as television static.
    const gridAX = skyUv.x * 900;
    const gridAY = skyUv.y * 450;
    const cellA = fract(sin(dot(vec2(floor(gridAX), floor(gridAY)), vec2(12.9898, 78.233))) * 43758.5453);
    const offsetA = vec2(
      fract(gridAX) - (0.25 + fract(cellA * 31.7) * 0.5),
      fract(gridAY) - (0.25 + fract(cellA * 17.3) * 0.5),
    );
    const gridBX = skyUv.x * 420;
    const gridBY = skyUv.y * 210;
    const cellB = fract(sin(dot(vec2(floor(gridBX), floor(gridBY)), vec2(39.3468, 11.135))) * 24634.6345);
    const offsetB = vec2(
      fract(gridBX) - (0.25 + fract(cellB * 27.1) * 0.5),
      fract(gridBY) - (0.25 + fract(cellB * 13.9) * 0.5),
    );
    const gridCX = skyUv.x * 170;
    const gridCY = skyUv.y * 85;
    const cellC = fract(sin(dot(vec2(floor(gridCX), floor(gridCY)), vec2(63.7264, 10.873))) * 31879.1234);
    const offsetC = vec2(
      fract(gridCX) - (0.25 + fract(cellC * 23.3) * 0.5),
      fract(gridCY) - (0.25 + fract(cellC * 41.1) * 0.5),
    );

    // Twinkle: each star takes its rate and phase from its own hash, so the sky shimmers rather than
    // pulsing in unison — the same per-instance-frequency rule the glow shaders follow.
    const twinkleA = 0.72 + sin(uTime * (1.4 + cellA * 2.6) + cellA * 63) * 0.28;
    const twinkleB = 0.78 + sin(uTime * (0.9 + cellB * 1.8) + cellB * 47) * 0.22;
    const twinkleC = 0.84 + sin(uTime * (0.6 + cellC * 1.2) + cellC * 29) * 0.16;

    // `step` gates which cells hold a star at all; the smoothstep shapes the point within it.
    const faint = step(0.986, cellA)
      * (1 - smoothstep(0, 0.055, length(offsetA))) * twinkleA;
    const middling = step(0.976, cellB)
      * (1 - smoothstep(0, 0.05, length(offsetB))) * twinkleB;
    const bright = step(0.972, cellC)
      * (1 - smoothstep(0, 0.045, length(offsetC))) * twinkleC;

    // Colour by magnitude: the brightest read blue-white, the faint ones warm. Roughly true of the
    // real sky, and it stops the field looking like scattered pixels of one colour.
    const starLight = vec3(0.78, 0.84, 1).scale(bright * 1.15)
      .add(vec3(0.86, 0.86, 0.84).scale(middling * 0.8))
      .add(vec3(0.84, 0.76, 0.66).scale(faint * 0.5));

    return vec4(band.scale(1.15).add(starLight).add(vec3(0.004, 0.005, 0.011)), 1);
  },
});
