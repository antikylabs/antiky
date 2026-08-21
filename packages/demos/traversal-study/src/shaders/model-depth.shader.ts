import { shader, sin, vec3, vec4 } from 'brometal';
import { rotate2, shadowDepth } from 'brometal/shader-functions';

/**
 * Distance from the sun's stand-in light, for every catalog model on the course.
 *
 * **Why a colour target rather than a depth buffer.** BroMetal's depth attachments are never
 * sampleable, so the shadow pass writes *distance to the light* into an ordinary RGBA16F target —
 * the route BroMetal's own `DrawToOptions.clear` documentation describes. `shadowDepth` is the one
 * place that distance is defined, and `shadowFactor` calls the same helper when it compares, so the
 * value written and the value tested against it cannot drift apart.
 *
 * **The transform below must match `traversal-model.shader.ts` exactly**, including the animated
 * yaw. Thirteen of this demo's catalog batches sway on a clock; a caster that sways while its shadow
 * stands still reads as the shadow being detached rather than as two transforms disagreeing.
 *
 * A second depth shader exists for `traversal-surface`, because that one rotates in **XY** while
 * this rotates in **XZ**. They cannot share.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iParams: 'vec3',
  },
  uniforms: {
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition, iOffset, iScale, iParams }, { uLightViewProj, uTime }, v) {
    const animatedYaw = iParams.x + sin(uTime * 3.1 + iParams.z) * iParams.y;
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), animatedYaw);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightPosition, uShadowRange }, { vWorld }) {
    // Red only. The other channels cost nothing and are never read; giving them the same value
    // would invite someone to sample `.g` and get a different answer after a change here.
    return vec4(shadowDepth(vWorld, uLightPosition, uShadowRange), 0, 0, 1);
  },
});
