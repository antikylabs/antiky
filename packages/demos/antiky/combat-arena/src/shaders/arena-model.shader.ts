import {
  clamp,
  dot,
  max,
  mix,
  normalize,
  pow,
  shader,
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

  fragment({ uCameraPosition, uTex }, { vWorld, vNormal, vUv, vTint, vParams }) {
    const normal = normalize(vNormal);
    const light = normalize(vec3(0.38, 0.9, 0.28));
    const view = normalize(uCameraPosition.sub(vWorld));
    const diffuse = max(dot(normal, light), 0);
    const rim = pow(1 - max(dot(normal, view), 0), 2.2);
    const sampled = texture(uTex, vUv).xyz.mul(vTint);
    const lit = sampled.scale(0.24 + diffuse * 0.68)
      .add(vTint.scale(clamp(vParams.x, 0, 1) * (0.08 + rim * 0.26)));
    const confirmed = mix(lit, vec3(1.7, 1.8, 1.9), clamp(vParams.y, 0, 1));
    return vec4(tonemapACES(confirmed), 1);
  },
});
