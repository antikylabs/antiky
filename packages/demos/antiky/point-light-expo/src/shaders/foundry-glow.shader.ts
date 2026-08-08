import { dot, max, normalize, pow, shader, vec4 } from 'brometal';

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'float',
    iColor: 'vec3',
    iPower: 'float',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vPower: 'float',
  },

  vertex(
    { aPosition, aNormal, iOffset, iScale, iColor, iPower },
    { uViewProj },
    v,
  ) {
    const world = aPosition.scale(iScale).add(iOffset);
    v.vWorld = world;
    v.vNormal = aNormal;
    v.vColor = iColor;
    v.vPower = iPower;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition }, { vWorld, vNormal, vColor, vPower }) {
    const view = normalize(uCameraPosition.sub(vWorld));
    const rim = pow(1 - max(dot(normalize(vNormal), view), 0), 2.4);
    const strength = (0.3 + rim * 2.2) * (0.35 + vPower * 0.2);
    return vec4(vColor.scale(strength), 0.32 + rim * 0.55);
  },
});
