import {
  cos,
  dot,
  max,
  mix,
  normalize,
  pow,
  shader,
  sin,
  step,
  texture,
  vec2,
  vec3,
  vec4,
  type Vec3,
} from 'brometal';

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
    iPhase: 'float',
    iMotion: 'float',
  },
  uniforms: {
    uBillboard: 'sampler2D',
    uViewProj: 'mat4',
    uCameraPosition: 'vec3',
    uTime: 'float',
  },
  varyings: {
    vWorld: 'vec3',
    vNormal: 'vec3',
    vColor: 'vec3',
    vPower: 'float',
  },

  vertex(
    { aPosition, aNormal, iOffset, iScale, iColor, iPower, iPhase, iMotion },
    { uViewProj, uTime },
    v,
  ) {
    const drift = vec3(
      sin(uTime * (0.42 + iMotion) + iPhase) * 0.42 * iMotion,
      sin(uTime * (0.68 + iMotion * 0.5) + iPhase * 1.7) * 0.34 * iMotion,
      cos(uTime * (0.36 + iMotion) + iPhase) * 0.28 * iMotion,
    );
    const world = aPosition.scale(iScale).add(iOffset).add(drift);
    v.vWorld = world;
    v.vNormal = aNormal;
    v.vColor = iColor;
    v.vPower = iPower * (1 + sin(uTime * 2.2 + iPhase) * 0.18 * iMotion);
    return uViewProj.mul(vec4(world, 1));
  },

  fragment({ uCameraPosition, uBillboard }, { vWorld, vNormal, vColor, vPower }) {
    const view = normalize(uCameraPosition.sub(vWorld));
    const rim = pow(1 - max(dot(normalize(vNormal), view), 0), 2.4);
    const strength = (0.3 + rim * 2.2) * (0.35 + vPower * 0.2);
    // Structure, so a cluster of relays reads as a cluster of things rather than as copies of one
    // circle. These glows are spheres and carry no `vUv`, so the view-facing normal is the texture
    // coordinate: `normal.xy` maps the visible hemisphere onto the sprite and reaches its rim, where
    // the alpha is already zero, exactly at the silhouette — so the edge softens instead of ending.
    const surfaceNormal = normalize(vNormal);
    const structure = texture(uBillboard, vec2(surfaceNormal.x * 0.5 + 0.5, surfaceNormal.y * 0.5 + 0.5)).w;
    const textured = 0.55 + structure * 0.45;
    // Linear, blended into the HDR target and tone-mapped with everything else.
    return vec4(vColor.scale(strength * textured), (0.32 + rim * 0.55) * textured);
  },
});
