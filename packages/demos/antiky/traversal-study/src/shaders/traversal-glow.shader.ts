import {
  dot,
  max,
  normalize,
  pow,
  shader,
  sin,
  texture,
  vec2,
  vec3,
  vec4,
} from 'brometal';
import { rotate2 } from 'brometal/shader-functions';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iColor: 'vec3',
    iAlpha: 'float',
    iRotation: 'float',
    iPhase: 'float',
  },
  uniforms: {
    uBillboard: 'sampler2D',
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vAlpha: 'float',
  },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor, iAlpha, iRotation, iPhase }, { uViewProj, uTime }, v) {
    const rotatedPosition = rotate2(aPosition.xy.mul(iScale.xy), iRotation);
    const rotatedNormal = rotate2(aNormal.xy, iRotation);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      rotatedPosition.y + iOffset.y,
      aPosition.z * iScale.z + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, rotatedNormal.y, aNormal.z));
    v.vColor = iColor;
      // Per-instance frequency, not just per-instance phase.
      //
      // This used to be `sin(uTime * K + iPhase * n)` with one shared K. Offsetting the phase makes
      // instances start apart, but identical frequencies mean they drift back into alignment and
      // then pulse as one — a crowd of independent effects breathing in unison, which reads as a
      // metronome rather than as many things happening. Varying the rate per instance means they
      // never re-synchronise.
    v.vAlpha = iAlpha * (0.8 + sin(uTime * (3.9 + iPhase * 1.8) + iPhase) * 0.2);
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uBillboard }, { vWorld, vNormal, vColor, vAlpha }) {
    const facing = max(dot(normalize(vNormal), normalize(uCameraPosition.sub(vWorld))), 0);
    const core = pow(facing, 2.5);
    const rim = pow(1 - facing, 1.45);
    // Structure, so a trail of these reads as a trail rather than as a row of identical circles.
    // These are spheres and tori with no `vUv`, so the view-facing normal is the texture coordinate:
    // it reaches the sprite's rim, where alpha is already zero, exactly at the silhouette.
    const surfaceNormal = normalize(vNormal);
    const structure = texture(uBillboard, vec2(surfaceNormal.x * 0.5 + 0.5, surfaceNormal.y * 0.5 + 0.5)).w;
    const textured = 0.55 + structure * 0.45;
    return vec4(
      vColor.scale((0.45 + core * 1.2 + rim * 0.45) * textured),
      vAlpha * (0.4 + core * 0.5 + rim * 0.24) * textured,
    );
  },
});
