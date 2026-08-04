import { shader, clamp, length, mix, normalize, vec3, vec4 } from 'brometal';
import { hemisphereLight, lambert } from 'brometal/shader-functions';

/**
 * One cube, drawn many times. Position, scale and colour arrive as instance
 * attributes straight from a Float32Array — the seam the whole engine is built
 * to keep clean.
 */
export default shader({
  attributes: { aPosition: 'vec3', aNormal: 'vec3' },
  instanceAttributes: { iOffset: 'vec3', iScale: 'vec3', iColor: 'vec3' },
  uniforms: {
    uViewProj: 'mat4',
    uLightDir: 'vec3',
    uFog: 'vec3',
    uCamPos: 'vec3',
    uFogDist: 'float',
  },
  varyings: { vNormal: 'vec3', vColor: 'vec3', vFog: 'float' },

  vertex({ aPosition, aNormal, iOffset, iScale, iColor }, { uViewProj, uCamPos, uFogDist }, v) {
    const world = aPosition.mul(iScale).add(iOffset);
    v.vNormal = aNormal;
    v.vColor = iColor;
    v.vFog = clamp(length(world.sub(uCamPos)) / uFogDist, 0, 1);
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightDir, uFog }, { vNormal, vColor, vFog }) {
    const n = normalize(vNormal);
    const ambient = hemisphereLight(n, vec3(0.30, 0.36, 0.48), vec3(0.09, 0.07, 0.08));
    const key = lambert(n, uLightDir);
    const lit = vColor.mul(ambient.add(vec3(1.0, 0.72, 0.45).scale(key * 0.95)));
    return vec4(mix(lit, uFog, vFog * 0.92), 1);
  },
});
