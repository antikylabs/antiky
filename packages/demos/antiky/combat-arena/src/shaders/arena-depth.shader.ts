import { shader, sin, vec3, vec4 } from 'brometal';
import { rotate2, shadowDepth } from 'brometal/shader-functions';

/**
 * Distance from the sun's stand-in light, for every caster in the arena.
 *
 * One depth shader rather than three, because `arena-model`, `ship-model` and `arena-surface` place
 * a vertex the same way — `rotate2(aPosition.xz * iScale.xz, iParams.z)` about Y, then offset — and
 * differ only in what they do with normals and colour, none of which moves a vertex. Their instance
 * layouts differ, but a depth pass only needs the three attributes that decide position.
 *
 * **The transform below must match those three exactly.** A depth pass that places a caster even
 * slightly differently from the pass that lights it produces a shadow offset from its caster, and
 * that reads as "the shadows are wrong" rather than as "two transforms disagree".
 *
 * **Why a colour target rather than a depth buffer.** BroMetal's depth attachments are never
 * sampleable. So the shadow pass writes *distance to the light* into an ordinary RGBA16F target,
 * which is the route BroMetal's own `DrawToOptions.clear` documentation describes. `shadowDepth` is
 * the one place that distance is defined, and `shadowFactor` calls the same helper when it compares,
 * so the value written and the value tested against it cannot drift apart.
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
    /**
     * 1 for `arena-surface`, 0 for the two model shaders.
     *
     * `arena-surface` bobs its instances vertically on a clock, and a shadow that does not bob with
     * its caster slides out from under it. The other two do not bob, and their `iParams.x` means
     * something else entirely — ship charge — so applying the term unconditionally would make every
     * ship's shadow wander. A uniform switch rather than a second shader: the alternative is two
     * near-identical files that have to be kept in step by hand.
     */
    uBobStrength: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition, iOffset, iScale, iParams }, { uLightViewProj, uTime, uBobStrength }, v) {
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), iParams.z);
    const bob = sin(uTime * (2.1 + iParams.z * 0.2) + iOffset.x + iOffset.z)
      * iParams.x * 0.025 * uBobStrength;
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y + bob,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightPosition, uShadowRange }, { vWorld }) {
    // Red only. The other channels cost nothing to write and are never read, and giving them the
    // same value would invite someone to sample `.g` and get a different answer after a change here.
    return vec4(shadowDepth(vWorld, uLightPosition, uShadowRange), 0, 0, 1);
  },
});
