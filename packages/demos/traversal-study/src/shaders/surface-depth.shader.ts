import { shader, vec3, vec4 } from 'brometal';
import { rotate2, shadowDepth } from 'brometal/shader-functions';

/**
 * Distance from the sun's stand-in light, for the platforms and procedural surfaces.
 *
 * The companion to `model-depth.shader.ts`; the reasoning about why this writes distance into a
 * colour target lives there. Two shaders rather than one because `traversal-surface` rotates its
 * instances in **XY** about `iMaterial.z` and extrudes along z, while `traversal-model` rotates in
 * **XZ** about an animated yaw. A depth pass has to reproduce its caster's transform exactly or the
 * shadow lands somewhere the caster is not, so the two cannot share.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iMaterial: 'vec3',
  },
  uniforms: {
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition, iOffset, iScale, iMaterial }, { uLightViewProj }, v) {
    const rotatedPosition = rotate2(aPosition.xy.mul(iScale.xy), iMaterial.z);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      rotatedPosition.y + iOffset.y,
      aPosition.z * iScale.z + iOffset.z,
    );
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightPosition, uShadowRange }, { vWorld }) {
    return vec4(shadowDepth(vWorld, uLightPosition, uShadowRange), 0, 0, 1);
  },
});
