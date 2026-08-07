import {
  shader,
  clamp,
  cos,
  discard,
  floor,
  fract,
  max,
  normalize,
  sin,
  texture,
  vec2,
  vec3,
  vec4,
} from 'brometal';

/** Alpha-tested prop caster using the exact visible card bend and thickness. */
export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  instanceAttributes: {
    iCenter: 'vec3',
    iSize: 'vec2',
    iUvRect: 'vec4',
    iYaw: 'float',
    iCurvature: 'float',
    iTile: 'float',
  },
  uniforms: { uLightViewProj: 'mat4', uAtlas: 'sampler2D', uCutoff: 'float' },
  varyings: { vUv: 'vec2', vWorld: 'vec3' },

  vertex(
    { aPosition, aUv, iCenter, iSize, iUvRect, iYaw, iCurvature, iTile },
    { uLightViewProj },
    v,
  ) {
    const bend = max(iCurvature * 2.4, 0.001);
    const angle = aPosition.x * bend;
    const lean = 0.12;
    const localX = sin(angle) / bend * iSize.x;
    const localY = aPosition.y * iSize.y;
    const localZ = (cos(angle) - 1) / bend * iSize.x -
      aPosition.y * iSize.y * lean + iTile * 0;
    const frontNormal = normalize(vec3(sin(angle), cos(angle) * lean, cos(angle)));
    const yawCos = cos(iYaw);
    const yawSin = sin(iYaw);
    const rotated = vec3(
      yawCos * localX + yawSin * localZ,
      localY,
      -yawSin * localX + yawCos * localZ,
    );
    const rotatedFrontNormal = normalize(vec3(
      yawCos * frontNormal.x + yawSin * frontNormal.z,
      frontNormal.y,
      -yawSin * frontNormal.x + yawCos * frontNormal.z,
    ));
    const surfaceNormal = rotatedFrontNormal.scale(aPosition.z);
    const thickness = 0.012 + iSize.x * 0.012;
    const world = iCenter.add(rotated).add(surfaceNormal.scale(thickness));
    v.vUv = iUvRect.xy.add(aUv.mul(vec2(iUvRect.z, iUvRect.w)));
    v.vWorld = world;
    return uLightViewProj.mul(vec4(world, 1));
  },

  fragment({ uLightViewProj, uAtlas, uCutoff }, { vUv, vWorld }) {
    if (texture(uAtlas, vUv).w < uCutoff) discard();
    const clip = uLightViewProj.mul(vec4(vWorld, 1));
    const depth = clamp(clip.z / clip.w * 0.5 + 0.5, 0, 1);
    const scaled = depth * 255;
    return vec4(floor(scaled) / 255, fract(scaled), depth, 1);
  },
});
