import { shader, abs, clamp, fract, length, max, mix, smoothstep, vec3, vec4 } from 'brometal';

/** The floor the sprites stand on: a world-space grid, fogged with distance. */
export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: {
    uViewProj: 'mat4',
    uModel: 'mat4',
    uFog: 'vec3',
    uCamPos: 'vec3',
    uFogDist: 'float',
    uBase: 'vec3',
    uLine: 'vec3',
  },
  varyings: { vWorld: 'vec3' },

  vertex({ aPosition }, { uViewProj, uModel }, v) {
    const world = uModel.mul(vec4(aPosition, 1));
    v.vWorld = world.xyz;
    return uViewProj.mul(world);
  },

  fragment({ uFog, uCamPos, uFogDist, uBase, uLine }, { vWorld }) {
    const gx = abs(fract(vWorld.x) - 0.5);
    const gz = abs(fract(vWorld.z) - 0.5);
    const grid = smoothstep(0.44, 0.5, max(gx, gz));
    const fog = clamp(length(vWorld.sub(uCamPos)) / uFogDist, 0, 1);
    return vec4(mix(mix(uBase, uLine, grid * 0.7), uFog, fog * 0.95), 1);
  },
});
