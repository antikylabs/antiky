import {
  clamp,
  dot,
  length,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  smoothstep,
  texture,
  vec3,
  vec4,
} from 'brometal';
import { rotate2, tonemapACES } from 'brometal/shader-functions';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
    aUv: 'vec2',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iTint: 'vec3',
    iParams: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTex: 'sampler2D',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vUv: 'vec2',
    vTint: 'vec3',
    vParams: 'vec3',
  },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iTint, iParams }, { uViewProj }, v) {
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), iParams.z);
    const rotatedNormal = rotate2(aNormal.xz, iParams.z);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
    v.vUv = aUv;
    v.vTint = iTint;
    v.vParams = iParams;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uTex, uTime }, { vWorld, vNormal, vUv, vTint, vParams }) {
    const normal = normalize(vNormal);
    // Key light for the whole arena. This vector is repeated in every combat-arena shader because
    // the BroMetal MVP cannot read a module-level constant from a shader body ("unknown identifier
    // — only shader parameters and local consts are in scope"). `pipeline-invariants.test.mjs`
    // fails if the copies ever disagree, so the test is what keeps them in step.
    //
    // It is the ship shader's original value. The ships are the subject, and the contact shadows
    // land on the arena floor, so the floor must agree with what lights the ships rather than the
    // other way round. The floor's old +X sun lit it from the opposite side from the ships.
    const light = normalize(vec3(-0.44, 0.86, 0.42));
    const view = normalize(uCameraPosition.sub(vWorld));
    const diffuse = max(dot(normal, light), 0);
    const rim = pow(1 - max(dot(normal, view), 0), 2.2);
    const sampled = texture(uTex, vUv).xyz.mul(vTint);
    const fill = max(normal.y, 0) * 0.1;
    const pulse = 0.72 + sin(uTime * 5.2 + vWorld.x * 0.8 - vWorld.z * 0.55) * 0.28;
    const lit = sampled.scale(0.16 + diffuse * 0.74 + fill)
      .add(vTint.scale(clamp(vParams.x, 0, 1) * pulse * (0.12 + rim * 0.34)));
    const confirmed = mix(lit, vec3(1.7, 1.8, 1.9), clamp(vParams.y, 0, 1));
    // One fog range for the arena, matching the sun above: same reason, same guard. 17..34 is the
    // ship shader's original range. The tighter floor ranges faded the ground while ships at the
    // same distance were still crisp, which is what made near and far disagree about depth.
    const fog = smoothstep(17, 34, length(uCameraPosition.sub(vWorld)));
    return vec4(tonemapACES(mix(confirmed, vec3(0.006, 0.01, 0.018), fog * 0.72)), 1);
  },
});
