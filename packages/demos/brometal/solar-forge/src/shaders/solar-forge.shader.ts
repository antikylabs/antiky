import { abs, length, max, sin, smoothstep, vec2, vec3, vec4, shader } from 'brometal';
import { fbm2, tonemapACES, turbulence2 } from 'brometal/shader-functions';

export default shader({
  attributes: { aPosition: 'vec3', aUv: 'vec2' },
  uniforms: { uTime: 'float', uAspect: 'float', uPointer: 'vec2' },
  varyings: { vUv: 'vec2' },
  vertex({ aPosition, aUv }, _uniforms, v) {
    v.vUv = aUv;
    return vec4(aPosition, 1);
  },
  fragment({ uTime, uAspect, uPointer }, { vUv }) {
    const p = vec2(
      (vUv.x - 0.5) * uAspect + (uPointer.x - 0.5) * 0.09,
      vUv.y - 0.5 + (uPointer.y - 0.5) * 0.045,
    ).scale(2.1);
    const radius = length(p);
    const angleFlow = fbm2(p.scale(3.2).add(vec2(uTime * 0.08, -uTime * 0.05)), 5);
    const turbulent = turbulence2(p.scale(4.5).add(vec2(-uTime * 0.12, uTime * 0.07)), 5);
    const ring = 0.035 / max(abs(radius - 0.51 - angleFlow * 0.045), 0.012);
    const corona = 0.07 / max(abs(radius - 0.66 - turbulent * 0.07), 0.025);
    const coreMask = smoothstep(0.54, 0.47, radius);
    const rim = smoothstep(0.56, 0.49, radius) - smoothstep(0.49, 0.42, radius);
    const sparks = smoothstep(0.94, 0.985, sin(p.x * 83 + p.y * 47 + uTime * 3.4))
      * smoothstep(1.28, 0.68, radius) * smoothstep(0.58, 0.7, radius);
    const background = vec3(0.002, 0.003, 0.012)
      .add(vec3(0.025, 0.012, 0.05).scale(fbm2(p.scale(2.1), 4)));
    const heat = vec3(1.4, 0.16, 0.008).scale(ring * 0.34 + corona * 0.16)
      .add(vec3(1.5, 0.72, 0.16).scale(rim * 2.6 + sparks * 1.8));
    const eclipse = vec3(0.003, 0.004, 0.009).scale(coreMask);
    const color = background.scale(1 - coreMask).add(eclipse).add(heat);
    return vec4(tonemapACES(color), 1);
  },
});
