import { cos, shader, sin, vec3, vec4, type Vec3 } from 'brometal';
import { shadowDepth } from 'brometal/shader-functions';

/**
 * Distance from the sun's stand-in light, for every prop that uses `reliquary-model`.
 *
 * **Why a colour target rather than a depth buffer.** BroMetal's depth attachments are never
 * sampleable — you cannot render depth and then read it. So the shadow pass writes *distance to the
 * light* into an ordinary RGBA16F target, which is the route BroMetal's own `DrawToOptions.clear`
 * documentation describes. `shadowDepth` is the one place that distance is defined, and
 * `shadowFactor` calls the same helper when it compares, so the value written and the value tested
 * against it cannot drift apart.
 *
 * **The vertex transform below must match `reliquary-model.shader.ts` exactly.** A depth pass that
 * places a prop even slightly differently from the pass that lights it produces a shadow offset from
 * its caster, and that reads as "the shadows are wrong" rather than as "two transforms disagree".
 * `pipeline-invariants.test.mjs` asserts the compiled `rotateModel` bodies are identical.
 */
function rotateModel(value: Vec3, rotation: Vec3): Vec3 {
  const cosZ = cos(rotation.z);
  const sinZ = sin(rotation.z);
  const aroundZ = vec3(
    value.x * cosZ - value.y * sinZ,
    value.x * sinZ + value.y * cosZ,
    value.z,
  );
  const cosX = cos(rotation.x);
  const sinX = sin(rotation.x);
  const aroundX = vec3(
    aroundZ.x,
    aroundZ.y * cosX - aroundZ.z * sinX,
    aroundZ.y * sinX + aroundZ.z * cosX,
  );
  const cosY = cos(rotation.y);
  const sinY = sin(rotation.y);
  return vec3(
    aroundX.x * cosY - aroundX.z * sinY,
    aroundX.y,
    aroundX.x * sinY + aroundX.z * cosY,
  );
}

export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'float',
    iRotation: 'vec3',
  },
  uniforms: {
    uLightViewProj: 'mat4',
    uLightPosition: 'vec3',
    uShadowRange: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition, iOffset, iScale, iRotation }, { uLightViewProj }, v) {
    const world = rotateModel(aPosition.scale(iScale), iRotation).add(iOffset);
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightPosition, uShadowRange }, { vWorld }) {
    // Red only. The other channels cost nothing to write and are never read, and giving them the
    // same value would invite someone to sample `.g` and get a different answer after a change here.
    return vec4(shadowDepth(vWorld, uLightPosition, uShadowRange), 0, 0, 1);
  },
});
