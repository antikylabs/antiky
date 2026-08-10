import {
  dot,
  length,
  max,
  mix,
  normalize,
  shader,
  sin,
  smoothstep,
  texture,
  vec3,
  vec4,
} from 'brometal';
import { rotate2 } from 'brometal/shader-functions';

export default shader({
  attributes: { aPosition: 'vec3', aNormal: 'vec3', aUv: 'vec2' },
  instanceAttributes: { iOffset: 'vec3', iScale: 'vec3', iParams: 'vec3' },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uTint: 'vec3',
    uGradeColor: 'vec3',
    uGradeMix: 'float',
    uTex: 'sampler2D',
  },
  varyings: { vWorld: 'vec3', vNormal: 'vec3', vUv: 'vec2', vWash: 'float' },

  vertex({ aPosition, aNormal, aUv, iOffset, iScale, iParams }, { uViewProj, uTime }, v) {
    const animatedYaw = iParams.x + sin(uTime * 3.1 + iParams.z) * iParams.y;
    const rotatedPosition = rotate2(aPosition.xz.mul(iScale.xz), animatedYaw);
    const rotatedNormal = rotate2(aNormal.xz, animatedYaw);
    const world = vec3(
      rotatedPosition.x + iOffset.x,
      aPosition.y * iScale.y + iOffset.y,
      rotatedPosition.y + iOffset.z,
    );
    v.vWorld = world;
    v.vNormal = normalize(vec3(rotatedNormal.x, aNormal.y, rotatedNormal.y));
    v.vUv = aUv;
    v.vWash = 0.96 + sin(world.x * 1.7 + world.y * 2.3) * 0.04;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uTint, uGradeColor, uGradeMix, uTex }, { vWorld, vNormal, vUv, vWash }) {
    const texel = texture(uTex, vUv).xyz;
    const normal = normalize(vNormal);
    const light = normalize(vec3(-0.38, 0.84, 0.48));
    const diffuse = max(dot(normal, light), 0);
    const band = 0.54 + smoothstep(0.18, 0.25, diffuse) * 0.2
      + smoothstep(0.62, 0.7, diffuse) * 0.24;
    const graded = mix(texel, uGradeColor, uGradeMix);
    const base = graded.mul(uTint).scale(band * vWash);
    const distanceFog = smoothstep(22, 58, length(uCameraPosition.sub(vWorld)));
    return vec4(mix(base, vec3(0.55, 0.65, 0.66), distanceFog * 0.42), 1);
  },
});
