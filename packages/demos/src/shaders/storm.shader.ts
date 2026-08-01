import { shader, cos, fract, sin, vec3, vec4 } from 'brometal';
import { cosinePalette, lambert, rotate3 } from 'brometal/shader-functions';

/**
 * Residency, stated as a shader. Every instance carries four random numbers
 * uploaded once; position, spin and colour are functions of those numbers and
 * `uTime`, evaluated in the vertex stage. After the first frame the CPU sends
 * one mat4 and one float — nothing else, at any instance count.
 */
export default shader({
  attributes: { aPosition: 'vec3', aNormal: 'vec3' },
  instanceAttributes: { iSeed: 'vec4' },
  uniforms: { uViewProj: 'mat4', uTime: 'float', uSpread: 'float' },
  varyings: { vColor: 'vec3', vNormal: 'vec3' },

  vertex({ aPosition, aNormal, iSeed }, { uViewProj, uTime, uSpread }, v) {
    const orbit = iSeed.x * 6.2831853 + uTime * (0.08 + iSeed.y * 0.22);
    const radius = (0.25 + iSeed.z * 0.75) * uSpread;
    const rise = sin(uTime * (0.2 + iSeed.w * 0.5) + iSeed.x * 9.0) * uSpread * 0.32;

    const centre = vec3(cos(orbit) * radius, rise + (iSeed.w - 0.5) * uSpread * 0.5, sin(orbit) * radius);
    const axis = vec3(iSeed.y - 0.5, iSeed.z + 0.2, iSeed.x - 0.5);
    const spun = rotate3(aPosition.scale(0.06 + iSeed.z * 0.05), axis, uTime * (0.6 + iSeed.y * 2.0));

    v.vNormal = rotate3(aNormal, axis, uTime * (0.6 + iSeed.y * 2.0));
    v.vColor = cosinePalette(
      fract(iSeed.x * 0.7 + iSeed.z * 0.3),
      vec3(0.42, 0.30, 0.28),
      vec3(0.45, 0.32, 0.30),
      vec3(1.0, 0.9, 0.7),
      vec3(0.0, 0.15, 0.35),
    );
    return uViewProj.mul(vec4(spun.add(centre), 1));
  },

  fragment(_uniforms, { vColor, vNormal }) {
    const key = lambert(vNormal, vec3(0.4, 0.8, 0.45));
    return vec4(vColor.scale(0.30 + key * 0.9), 1);
  },
});
