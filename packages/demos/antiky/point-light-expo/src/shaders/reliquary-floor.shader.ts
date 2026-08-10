import {
  abs,
  clamp,
  dot,
  max,
  mix,
  normalize,
  shader,
  smoothstep,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';
import { specGGX, tonemapACES } from 'brometal/shader-functions';

function materialPresentationFloorLight(
  world: Vec3,
  normal: Vec3,
  view: Vec3,
  lightPosition: Vec3,
  lightColor: Vec3,
  lightPower: number,
  lightRadius: number,
  roughness: number,
): Vec3 {
  const toLight = lightPosition.sub(world);
  const distanceSq = dot(toLight, toLight);
  const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
  const light = normalize(toLight);
  const diffuse = max(dot(normal, light), 0);
  const specular = specGGX(normal, light, view, roughness) * 0.12;
  return lightColor.scale(lightPower * range * range * (diffuse + specular));
}

export default shader({
  attributes: {
    aPosition: 'vec3',
    aUv: 'vec2',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uDiffuse: 'sampler2D',
    uAo: 'sampler2D',
    uRoughness: 'sampler2D',
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
    vUv: 'vec2',
  },

  vertex({ aPosition, aUv }, { uViewProj }, v) {
    const world = vec3(aPosition.x, -0.42, -aPosition.y);
    v.vWorld = world;
    v.vUv = aUv.mul(vec2(4.5, 3.35));
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({
    uCameraPosition,
    uDiffuse,
    uAo,
    uRoughness,
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
  }, { vWorld, vUv }) {
    const diffuseSample = texture(uDiffuse, vUv).xyz;
    const ao = mix(0.48, 1, texture(uAo, vUv).x);
    const roughness = clamp(texture(uRoughness, vUv).x, 0.2, 0.98);
    const normal = vec3(0, 1, 0);
    const view = normalize(uCameraPosition.sub(vWorld));
    const amber = materialPresentationFloorLight(vWorld, normal, view, uEmberPosition, uEmberColor, uEmberPower, uEmberRadius, roughness);
    const blue = materialPresentationFloorLight(vWorld, normal, view, uIonPosition, uIonColor, uIonPower, uIonRadius, roughness);
    const plum = materialPresentationFloorLight(vWorld, normal, view, uVioletPosition, uVioletColor, uVioletPower, uVioletRadius, roughness);
    const irradiance = amber.add(blue).add(plum);
    const dampEarth = diffuseSample.mul(vec3(0.58, 0.62, 0.55));
    const ambient = vec3(0.055, 0.065, 0.06).scale(ao);
    const lit = dampEarth.mul(ambient.add(irradiance.scale(0.78)));
    const stonePath = smoothstep(0.44, 0.5, max(0.6 - abs(vWorld.x) * 0.12, 0.6 - abs(vWorld.z) * 0.12));
    const pathTint = mix(vec3(1, 1, 1), vec3(0.74, 0.78, 0.72), stonePath * 0.18);
    return vec4(tonemapACES(lit.mul(pathTint).add(irradiance.scale(0.025))), 1);
  },
});
