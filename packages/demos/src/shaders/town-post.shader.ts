import {
  shader,
  abs,
  clamp,
  cos,
  dot,
  length,
  max,
  mix,
  sin,
  smoothstep,
  sqrt,
  targetUv,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec2,
  type Vec3,
} from 'brometal';
import {
  adjustSaturation,
  brightnessContrast,
  gammaCorrect,
  luminance,
  tonemapACES,
} from 'brometal/shader-functions';

function restrainedWarm(color: Vec3, chroma: number): Vec3 {
  const luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  const warmNeutral = vec3(luma * 1.05, luma * 1.01, luma * 0.94);
  return mix(warmNeutral, color, chroma);
}

function townSky(
  uv: Vec2,
  zenith: Vec3,
  horizon: Vec3,
  sunColor: Vec3,
  sunPosition: Vec2,
  sunRadius: number,
): Vec3 {
  // This receives a screen coordinate, not a render-target coordinate.
  // y=0 is the lower edge and y=1 the upper edge.
  const height = uv.y;
  const balancedHorizon = restrainedWarm(horizon, 0.58);
  const balancedSun = restrainedWarm(sunColor, 0.52);
  let color = mix(balancedHorizon, zenith, smoothstep(0.08, 0.92, height));
  const sunDelta = uv.sub(sunPosition).mul(vec2(1.18, 1));
  const sunDistance = length(sunDelta);
  const disc = 1 - smoothstep(sunRadius * 0.3, sunRadius, sunDistance);
  const halo = 1 - smoothstep(sunRadius, sunRadius * 5.5, sunDistance);
  color = color.add(balancedSun.scale(disc * 0.72 + halo * 0.16));
  return color;
}

/**
 * Restrained HDR presentation pass.
 *
 * uScene.rgb is linear HDR and uScene.a is linear camera distance. DOF has two
 * explicit dead zones around focus: near blur begins before
 * (uFocus-uNearFocusRange), far blur after (uFocus+uFarFocusRange), and the
 * transition is uDofTransition world units. Midground/characters therefore stay
 * sample-for-sample crisp. uDofMaxRadius and uBloomRadius are pixel radii.
 *
 * The pass uses eight shared ring taps plus center. Bloom is thresholded; DOF is
 * depth-rejected at silhouettes; there is no motion blur, dust noise, or broad
 * screen blur. Exposure is fixed/manual, followed by ACES and explicit gamma.
 */
export default shader({
  attributes: { aPosition: 'vec3' },
  uniforms: {
    uScene: 'sampler2D',
    uTexel: 'vec2',
    uFocus: 'float',
    uNearFocusRange: 'float',
    uFarFocusRange: 'float',
    uDofTransition: 'float',
    uDofMaxRadius: 'float',
    uDofStrength: 'float',
    uDepthReject: 'float',
    uBloomRadius: 'float',
    uBloomThreshold: 'float',
    uBloomKnee: 'float',
    uBloomStrength: 'float',
    uBloomTint: 'vec3',
    uExposure: 'float',
    uSaturation: 'float',
    uContrast: 'float',
    uGradeStrength: 'float',
    uShadowTint: 'vec3',
    uHighlightTint: 'vec3',
    uVignette: 'float',
    uAtmosphereColor: 'vec3',
    uAtmosphereStart: 'float',
    uAtmosphereEnd: 'float',
    uAtmosphereStrength: 'float',
    uSkyZenith: 'vec3',
    uSkyHorizon: 'vec3',
    uSunColor: 'vec3',
    uSunScreenPosition: 'vec2',
    uSunRadius: 'float',
    uFarDepth: 'float',
  },
  varyings: { vUv: 'vec2', vScreenUv: 'vec2' },

  vertex({ aPosition }, _uniforms, v) {
    v.vUv = targetUv(vec4(aPosition.x, aPosition.y, 0, 1));
    // targetUv intentionally flips Y for WebGPU render-target sampling. Keep a
    // second unflipped coordinate for the procedural sky, sun and vignette so
    // those effects land in the same screen-space position.
    v.vScreenUv = vec2(aPosition.x * 0.5 + 0.5, aPosition.y * 0.5 + 0.5);
    return vec4(aPosition.x, aPosition.y, 0, 1);
  },

  fragment(
    {
      uScene,
      uTexel,
      uFocus,
      uNearFocusRange,
      uFarFocusRange,
      uDofTransition,
      uDofMaxRadius,
      uDofStrength,
      uDepthReject,
      uBloomRadius,
      uBloomThreshold,
      uBloomKnee,
      uBloomStrength,
      uBloomTint,
      uExposure,
      uSaturation,
      uContrast,
      uGradeStrength,
      uShadowTint,
      uHighlightTint,
      uVignette,
      uAtmosphereColor,
      uAtmosphereStart,
      uAtmosphereEnd,
      uAtmosphereStrength,
      uSkyZenith,
      uSkyHorizon,
      uSunColor,
      uSunScreenPosition,
      uSunRadius,
      uFarDepth,
    },
    { vUv, vScreenUv },
  ) {
    const raw = texture(uScene, vUv);
    const isSky = smoothstep(uFarDepth * 0.985, uFarDepth * 0.998, raw.w);
    const sky = townSky(
      vScreenUv,
      uSkyZenith,
      uSkyHorizon,
      uSunColor,
      uSunScreenPosition,
      uSunRadius,
    );
    const center = mix(raw.xyz, sky, isSky);

    const nearEdge = uFocus - uNearFocusRange;
    const farEdge = uFocus + uFarFocusRange;
    const nearCoc = 1 - smoothstep(nearEdge - uDofTransition, nearEdge, raw.w);
    const farCoc = smoothstep(farEdge, farEdge + uDofTransition, raw.w);
    const coc = clamp(max(nearCoc, farCoc) * uDofStrength, 0, 1);
    const sampleRadius = max(uBloomRadius, coc * uDofMaxRadius);

    let dofSum = center;
    let dofWeight = 1;
    const centerLuma = luminance(center);
    const centerBloomMask = smoothstep(
      uBloomThreshold - uBloomKnee,
      uBloomThreshold + uBloomKnee,
      centerLuma,
    );
    const centerBloomEnergy = max(
      centerLuma - (uBloomThreshold - uBloomKnee),
      0,
    ) / max(centerLuma, 0.001);
    let bloomSum = center.scale(centerBloomMask * centerBloomEnergy);

    for (let i = 0; i < 8; i += 1) {
      const angle = i * 2.39996;
      const spread = sqrt((i + 0.5) / 8);
      const offset = vec2(cos(angle), sin(angle)).scale(spread * sampleRadius);
      const rawUv = vUv.add(offset.mul(uTexel));
      const uv = vec2(
        clamp(rawUv.x, 0.001, 0.999),
        clamp(rawUv.y, 0.001, 0.999),
      );
      const tapRaw = texture(uScene, uv);
      const tapIsSky = smoothstep(uFarDepth * 0.985, uFarDepth * 0.998, tapRaw.w);
      const tapSky = townSky(
        vScreenUv,
        uSkyZenith,
        uSkyHorizon,
        uSunColor,
        uSunScreenPosition,
        uSunRadius,
      );
      const tapColor = mix(tapRaw.xyz, tapSky, tapIsSky);
      const depthGate = 1 - smoothstep(
        uDepthReject,
        uDepthReject * 2,
        abs(tapRaw.w - raw.w),
      );
      dofSum = dofSum.add(tapColor.scale(depthGate));
      dofWeight = dofWeight + depthGate;

      const tapLuma = luminance(tapColor);
      const bloomMask = smoothstep(
        uBloomThreshold - uBloomKnee,
        uBloomThreshold + uBloomKnee,
        tapLuma,
      );
      const bloomEnergy = max(
        tapLuma - (uBloomThreshold - uBloomKnee),
        0,
      ) / max(tapLuma, 0.001);
      bloomSum = bloomSum.add(tapColor.scale(bloomMask * bloomEnergy));
    }

    const dofColor = dofSum.scale(1 / dofWeight);
    let color = mix(center, dofColor, coc);
    color = color.add(bloomSum.scale(uBloomStrength / 9).mul(uBloomTint));

    // Distance-only aerial perspective: no screen-wide veil over the crisp
    // focal band. Haze warms only near the sun's projected halo.
    const sunDelta = vScreenUv.sub(uSunScreenPosition).mul(vec2(1.18, 1));
    const sunHaze = 1 - smoothstep(uSunRadius, uSunRadius * 6.5, length(sunDelta));
    const hazeBase = restrainedWarm(uAtmosphereColor, 0.46);
    const hazeSun = restrainedWarm(uSunColor, 0.5);
    const hazeColor = mix(hazeBase, hazeSun, sunHaze * 0.32);
    // The authored 0.16 strength becomes roughly a 22% far-background
    // contrast reduction. The depth ramp starts beyond the plaza, so bridge,
    // characters and focal architecture remain sample-for-sample sharp.
    const atmosphere = smoothstep(uAtmosphereStart, uAtmosphereEnd, raw.w) *
      clamp(uAtmosphereStrength * 1.4, 0, 1) * (1 - isSky);
    color = mix(color, hazeColor, atmosphere);

    // Calibrate the renderer's nominal exposure to the reference's retained
    // highlight detail; this leaves headroom for tile, water and metal response
    // instead of flattening sunlit plaster against the ACES shoulder.
    let graded = color.scale(max(uExposure, 0) * 0.65);
    const gradeLuma = luminance(graded);
    const shadowWeight = 1 - smoothstep(0.08, 0.5, gradeLuma);
    const highlightWeight = smoothstep(0.42, 1.15, gradeLuma);
    const gradeStrength = clamp(uGradeStrength * 0.72, 0, 1);
    graded = mix(
      graded,
      graded.mul(uShadowTint),
      shadowWeight * gradeStrength,
    );
    graded = mix(
      graded,
      graded.mul(uHighlightTint),
      highlightWeight * gradeStrength,
    );
    const restrainedSaturation = 1 + (uSaturation - 1) * 0.68;
    graded = adjustSaturation(graded, restrainedSaturation);
    const preToneLuma = luminance(graded);
    const toeLift = 1 - smoothstep(0.02, 0.22, preToneLuma);
    graded = graded.add(vec3(0.006, 0.009, 0.015).scale(toeLift));
    const positiveGrade = vec3(max(graded.x, 0), max(graded.y, 0), max(graded.z, 0));
    graded = gammaCorrect(tonemapACES(positiveGrade), 2.2);
    graded = brightnessContrast(graded, 0, uContrast);

    const centered = vScreenUv.sub(vec2(0.5, 0.5)).mul(vec2(1, 0.86));
    const radial = length(centered) * 1.41421;
    const vignette = 1 - clamp(uVignette, 0, 0.45) * smoothstep(0.56, 1.02, radial);
    graded = clamp(graded.scale(vignette), 0, 1);
    return vec4(graded, 1);
  },
});
