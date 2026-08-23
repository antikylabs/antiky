import {
  abs,
  clamp,
  max,
  normalize,
  pow,
  shader,
  vec3,
  vec4,
} from 'brometal';

/**
 * The night horizon — goal 08's answer to "a hard-edged trapezoid floating in a black void". A
 * sphere follows the camera (the same at-infinity construction as combat-arena's sky) carrying a
 * vertical gradient: near-black zenith, a low teal haze band at the horizon, and a faint warm
 * seam right at eye level, as though the forest continues past the reliquary into mist. The fog
 * fades the ground plane's far edge into the same haze, so the plane boundary dissolves instead
 * of cutting against black.
 *
 * Values are authored in pre-exposure scene light, the same convention as this demo's fog colour:
 * the post pass multiplies by exposure before the tone-map, so these are chosen to land where the
 * capture wants them after that chain.
 */
export default shader({
  attributes: {
    aPosition: 'vec3',
  },
  uniforms: {
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
  },

  vertex({ aPosition }, { uViewProj, uCameraPosition }, v) {
    v.vWorld = aPosition;
    return uViewProj.mul(vec4(aPosition.add(uCameraPosition), 1));
  },

  fragment(_, { vWorld }) {
    const direction = normalize(vWorld);
    const height = clamp(direction.y, -1, 1);
    // The haze hugs the horizon and dies quickly with elevation; the zenith stays near-black so
    // the frame's darks live up there.
    const haze = pow(1 - clamp(height, 0, 1), 6);
    const below = clamp(0 - height, 0, 1);
    const zenith = vec3(0.0006, 0.001, 0.001);
    const horizon = vec3(0.008, 0.017, 0.016);
    // A faint warm seam at eye level — the one warm note the night allows itself.
    const seam = pow(max(1 - abs(height) * 9, 0), 2) * 0.005;
    const sky = zenith.add(horizon.sub(zenith).scale(haze)).add(vec3(seam, seam * 0.7, seam * 0.35));
    // Below the horizon the dome fades toward the fog colour so the plane edge has something of
    // its own colour behind it.
    const ground = vec3(0.0035, 0.005, 0.0048);
    return vec4(sky.scale(1 - below).add(ground.scale(below)), 1);
  },
});
