import { shader, clamp, floor, fract, vec4 } from 'brometal';

/**
 * Packed directional-shadow depth for the merged world surface.
 *
 * Draw into an RGBA16F RenderTarget({ depth: true }) using the same aPosition
 * buffer as town-voxel. The CPU supplies an orthographic uLightViewProj with
 * aspect exactly 1.0. Clear every pass to [1,1,1,1]. RG stores an 8+fraction
 * split of normalized clip depth; B retains raw depth for visual debugging.
 */
export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: { uLightViewProj: 'mat4' },
  varyings: { vWorld: 'vec3' },

  vertex({ aPosition }, { uLightViewProj }, v) {
    v.vWorld = aPosition;
    return uLightViewProj.mul(vec4(aPosition, 1));
  },

  fragment({ uLightViewProj }, { vWorld }) {
    const clip = uLightViewProj.mul(vec4(vWorld, 1));
    const depth = clamp(clip.z / clip.w * 0.5 + 0.5, 0, 1);
    const scaled = depth * 255;
    const high = floor(scaled) / 255;
    const low = fract(scaled);
    return vec4(high, low, depth, 1);
  },
});
