import {
  asin,
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

  fragment({ uStarMap }, { vWorld }) {
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
    const sky = texture(uStarMap, skyUv).xyz;
    // Lifted slightly so the darkest sky is not pure black, which is what makes a starfield read as
    // depth rather than as a hole.
    return vec4(sky.scale(1.35).add(vec3(0.004, 0.005, 0.011)), 1);
  },
});
