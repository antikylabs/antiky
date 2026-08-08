import { abs, length, max, sin, smoothstep, vec2, vec3, vec4, shader } from 'brometal';
import { fbm2, tonemapACES, voronoi2 } from 'brometal/shader-functions';

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
      (vUv.x - 0.5) * uAspect + (uPointer.x - 0.5) * 0.08,
      vUv.y - 0.5 + (uPointer.y - 0.5) * 0.04,
    ).scale(2.35);
    const depth = smoothstep(0.8, -1.0, p.y);
    const waterNoise = fbm2(p.scale(2.2).add(vec2(uTime * 0.035, -uTime * 0.025)), 5);
    const causticCells = voronoi2(p.scale(7.5).add(vec2(uTime * 0.11, uTime * 0.04)));
    const caustics = smoothstep(0.18, 0.02, causticCells) * smoothstep(-0.9, 0.75, p.y);
    const leftJelly = length(vec2((p.x + 0.58) * 1.1, (p.y - 0.12) * 1.45));
    const rightJelly = length(vec2((p.x - 0.52) * 1.15, (p.y + 0.04) * 1.5));
    const jellyA = smoothstep(0.34, 0.27, leftJelly)
      + 0.025 / max(abs(leftJelly - 0.31), 0.012);
    const jellyB = smoothstep(0.29, 0.23, rightJelly)
      + 0.02 / max(abs(rightJelly - 0.26), 0.012);
    const seabed = smoothstep(0.05, -0.03, p.y + 0.73 + sin(p.x * 3.2) * 0.08);
    const coral = smoothstep(0.055, 0.015, abs(sin(p.x * 8.0 + p.y * 4.0)))
      * smoothstep(-0.3, -0.82, p.y) * (1 - seabed);
    const background = vec3(0.002, 0.018, 0.045)
      .add(vec3(0.005, 0.11, 0.16).scale(depth * 0.8 + waterNoise * 0.34));
    const glow = vec3(0.03, 0.9, 0.78).scale(jellyA * (0.6 + sin(uTime * 1.7) * 0.08))
      .add(vec3(0.34, 0.18, 1.2).scale(jellyB * (0.62 + sin(uTime * 1.3 + 2.0) * 0.1)))
      .add(vec3(0.08, 0.52, 0.62).scale(caustics * 0.36))
      .add(vec3(0.03, 0.34, 0.23).scale(coral * 0.7));
    const floorColor = vec3(0.012, 0.035, 0.05).scale(seabed);
    return vec4(tonemapACES(background.add(glow).add(floorColor)), 1);
  },
});
