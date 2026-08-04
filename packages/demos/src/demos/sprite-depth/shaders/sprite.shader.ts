import { shader, clamp, length, mix, texture, vec2, vec3, vec4 } from 'brometal';

/**
 * A 2.3D character: one instanced quad per sprite, sampling a cell of the
 * atlas, standing in the same depth buffer as the world around it.
 *
 * The billboard yaws with the camera and never pitches. A character stands on
 * the ground; it does not lie back when the camera rises.
 */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  instanceAttributes: { iPos: 'vec3', iSize: 'vec2', iCell: 'float', iTint: 'vec3' },
  uniforms: {
    uViewProj: 'mat4',
    uRight: 'vec3',
    uAtlas: 'sampler2D',
    uCells: 'float',
    uFog: 'vec3',
    uCamPos: 'vec3',
    uFogDist: 'float',
  },
  varyings: { vUv: 'vec2', vTint: 'vec3', vFog: 'float' },

  vertex(
    { aPosition, aUv, iPos, iSize, iCell, iTint },
    { uViewProj, uRight, uCells, uCamPos, uFogDist },
    v,
  ) {
    const world = iPos
      .add(uRight.scale(aPosition.x * iSize.x))
      .add(vec3(0, 1, 0).scale((aPosition.y + 0.5) * iSize.y));
    v.vUv = vec2((aUv.x + iCell) / uCells, aUv.y);
    v.vTint = iTint;
    v.vFog = clamp(length(world.sub(uCamPos)) / uFogDist, 0, 1);
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uAtlas, uFog }, { vUv, vTint, vFog }) {
    const texel = texture(uAtlas, vUv);
    // The sprite takes the scene's fog at its own distance — the single detail
    // that stops a composited character reading as a sticker.
    return vec4(mix(texel.xyz.mul(vTint), uFog, vFog * 0.85), texel.w);
  },
});
