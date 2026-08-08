import {
  clamp,
  dot,
  length,
  max,
  min,
  mix,
  normalize,
  shader,
  sin,
  smoothstep,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX, tonemapACES } from 'brometal/shader-functions';

function pointRadiance(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
  metalness: number,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const attenuation = range * range;
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = min(specGGX(normal, light, view, roughness), 2.4)
    * (0.16 + metalness * 0.84);
  return lightColor.scale(lightPower * attenuation * (diffuse + specular));
}

export default shader({
  attributes: {
    aPosition: 'vec3',
    aNormal: 'vec3',
  },
  instanceAttributes: {
    iOffset: 'vec3',
    iScale: 'vec3',
    iBaseColor: 'vec3',
    iMaterial: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uModel: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
    uEmberPosition: 'vec3',
    uEmberColor: 'vec3',
    uEmberPower: 'float',
    uEmberRadius: 'float',
    uIonPosition: 'vec3',
    uIonColor: 'vec3',
    uIonPower: 'float',
    uIonRadius: 'float',
    uVioletPosition: 'vec3',
    uVioletColor: 'vec3',
    uVioletPower: 'float',
    uVioletRadius: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vBaseColor: 'vec3',
    vMaterial: 'vec3',
  },

  vertex(
    { aPosition, aNormal, iOffset, iScale, iBaseColor, iMaterial },
    { uViewProj, uModel },
    v,
  ) {
    const local = aPosition.mul(iScale);
    const world = uModel.mul(vec4(local, 1)).xyz.add(iOffset);
    v.vWorld = world;
    v.vNormal = normalize(uModel.mul(vec4(aNormal, 0)).xyz);
    v.vBaseColor = iBaseColor;
    v.vMaterial = iMaterial;
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uTime,
    uEmberPosition,
    uEmberColor,
    uEmberPower,
    uEmberRadius,
    uIonPosition,
    uIonColor,
    uIonPower,
    uIonRadius,
    uVioletPosition,
    uVioletColor,
    uVioletPower,
    uVioletRadius,
  }, { vWorld, vNormal, vBaseColor, vMaterial }) {
    const normal = normalize(vNormal);
    const view = normalize(uCameraPosition.sub(vWorld));
    const roughness = clamp(vMaterial.x, 0.08, 1);
    const metalness = clamp(vMaterial.y, 0, 1);
    const ember = pointRadiance(
      vWorld,
      normal,
      view,
      uEmberPosition,
      uEmberColor,
      uEmberPower,
      uEmberRadius,
      roughness,
      metalness,
    );
    const ion = pointRadiance(
      vWorld,
      normal,
      view,
      uIonPosition,
      uIonColor,
      uIonPower,
      uIonRadius,
      roughness,
      metalness,
    );
    const violet = pointRadiance(
      vWorld,
      normal,
      view,
      uVioletPosition,
      uVioletColor,
      uVioletPower,
      uVioletRadius,
      roughness,
      metalness,
    );
    const radiance = ember.add(ion).add(violet);
    const sky = vec3(0.07, 0.095, 0.15).scale(0.38 + normal.y * 0.12);
    const lit = vBaseColor.mul(sky.add(radiance.scale(0.82)))
      .add(radiance.scale(metalness * 0.28));
    const pulse = 0.92 + sin(uTime * 2.4 + vWorld.x * 0.5) * 0.08;
    const emissive = vBaseColor.scale(vMaterial.z * pulse);
    const fog = smoothstep(9, 18, length(uCameraPosition.sub(vWorld)));
    const color = mix(lit.add(emissive), vec3(0.008, 0.012, 0.025), fog * 0.72);
    return vec4(tonemapACES(color), 1);
  },
});
