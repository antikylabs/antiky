import { cos, shader, sin, vec3, vec4 } from 'brometal';
import { shadowDepth } from 'brometal/shader-functions';

/**
 * Distance from the sun's stand-in light, for every surface that uses `foundry`.
 *
 * The companion to `model-depth.shader.ts`; the reasoning about why this writes distance into a
 * colour target rather than a depth buffer lives there. Two depth shaders rather than one because
 * the two families carry different instance layouts — `foundry` scales by a vector and rotates by a
 * single yaw, `reliquary-model` scales by a scalar and rotates about three axes — and a depth pass
 * has to reproduce its caster's transform exactly or the shadow lands somewhere the caster is not.
 *
 * The transform below is `foundry.shader.ts`'s vertex with everything that does not move a vertex
 * removed. Normals, tints and material parameters have no bearing on where a shadow falls.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iYaw: 'float',
  },
  uniforms: {
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition, iOffset, iScale, iYaw }, { uLightViewProj }, v) {
    const local = aPosition.mul(iScale);
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      local.x * yawCos - local.z * yawSin,
      local.y,
      local.x * yawSin + local.z * yawCos,
    );
    const world = rotated.add(iOffset);
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightPosition, uShadowRange }, { vWorld }) {
    return vec4(shadowDepth(vWorld, uLightPosition, uShadowRange), 0, 0, 1);
  },
});
