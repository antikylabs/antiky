import {
  cross,
  normalize,
  shader,
  step,
  texture,
  vec2,
  vec4,
} from 'brometal';

/**
 * Ribbon trail segments — item 16. A projectile's trail used to be a chain of glow sprites, which
 * reads as beads however close together they land. Each instance here is one segment of a
 * continuous tapered ribbon: two endpoints from the projection's CPU history buffer, turned to
 * face the camera around the segment's own axis, so consecutive segments share endpoints and the
 * trail reads as one stroke.
 *
 * Additive, and the alpha channel is deliberately constant 1: BroMetal's additive blend is
 * `(src-alpha, one)`, not `(one, one)`, so anything written to alpha silently scales the colour.
 * Intensity lives in RGB, where the goal's blend-coupling note says it belongs.
 */
export default shader({
  attributes: {
    // x runs 0..1 along the segment, y runs -1..1 across it.
    aPosition: 'vec3',
  },
  instanceAttributes: {
    iStart: 'vec3',
    iEnd: 'vec3',
    iColor: 'vec3',
    /** width, intensity, and the head-to-tail fade for this segment. */
    iParams: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uBillboard: 'sampler2D',
  },
  varyings: {
    vUv: 'vec2',
    vColor: 'vec3',
    vStrength: 'float',
  },

  vertex({ aPosition, iStart, iEnd, iColor, iParams }, { uViewProj, uCameraPosition }, v) {
    const along = iStart.add(iEnd.sub(iStart).scale(aPosition.x));
    // Cylindrical billboard: the ribbon turns to face the camera around its own axis, which is
    // what keeps a trail flat-on from every direction a fight is watched from.
    const side = normalize(cross(iEnd.sub(iStart), uCameraPosition.sub(along)));
    // Slightly wider toward the head, so the stroke tapers into its own past.
    const width = iParams.x * (0.55 + aPosition.x * 0.45);
    const world = along.add(side.scale(width * aPosition.y));
    v.vUv = vec2(aPosition.x, aPosition.y * 0.5 + 0.5);
    v.vColor = iColor;
    v.vStrength = iParams.y * iParams.z;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uBillboard }, { vUv, vColor, vStrength }) {
    // The sprite's centre column is a pure radial falloff — sampled across the ribbon it gives the
    // soft cross-section AC-V1 measures, with no edge for the rasteriser to show.
    const profile = texture(uBillboard, vec2(0.5, vUv.y)).x;
    // A cleared segment has zero strength; the gate keeps its collapsed quad from ever adding a
    // pixel at the origin — the contact-shadow batch already learned this the hard way.
    const alive = step(0.0001, vStrength);
    return vec4(vColor.scale(profile * vStrength * alive), 1);
  },
});
