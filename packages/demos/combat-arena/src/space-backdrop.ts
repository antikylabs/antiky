import {
  createProgram,
  createSphere,
  loadTexture,
  type BroMetalProgram,
  type BroMetalTexture,
  type Renderer,
} from 'brometal';

import { horizontalGeometry } from './render-batches.ts';
import earthGlobeShader from './shaders/earth-globe.shader.gen.ts';
import spaceBackdropShader from './shaders/space-backdrop.shader.gen.ts';

const STAR_MAP_URL = new URL('../assets/nasa/starmap-2048.jpg', import.meta.url).href;
const EARTH_ALBEDO_URL = new URL('../assets/nasa/earth-day-2048.jpg', import.meta.url).href;
const EARTH_CLOUDS_URL = new URL('../assets/nasa/earth-clouds-2048.jpg', import.meta.url).href;

/**
 * Where Earth sits, and how big.
 *
 * Off to one side and below the arena's plane so the planet fills a corner of the frame and the
 * play area stays legible against it. The radius is large and the distance larger, which is what
 * gives the limb its shallow curve — a small sphere placed close reads as a beach ball.
 */
// Further out and further round, so the whole limb is in frame and the curvature reads. Pulled up
// too: with the planet below the arena its terminator ran the wrong way against the key light.
// The key light points (-0.44, 0.86, 0.42), so the planet sits down-sun of the arena — off to the
// left, below, and behind. Placed the other way its dayside faces away from camera and the frame
// gets a black disc with a bright rim, which is a real thing to look at but not this one.
const EARTH_CENTER = Object.freeze([-58, -34, -30] as const);
const EARTH_RADIUS = 34;

// One instance each of two distinct meshes — the sky plane and Earth's globe — so this is two draws
// but still one instance apiece, not two instances of anything.
export const SPACE_BACKDROP_INSTANCES = 1;
export const SPACE_BACKDROP_DRAWS = 2;
export const SPACE_BACKDROP_ENVIRONMENT_LAYERS = 1;

export type SpaceBackdrop = Readonly<{
  frame(viewProjection: Float32Array, time: number, cameraPosition: Float32Array): void;
  draw(): void;
  dispose(): void;
}>;

type BackdropProgramFactory = (renderer: Renderer) => BroMetalProgram;

export type SkyTextures = Readonly<{
  starMap: BroMetalTexture;
  earthAlbedo: BroMetalTexture;
  earthClouds: BroMetalTexture;
}>;

/**
 * Injected like every other GPU resource in this demo, so the geometry tests can build a backdrop
 * without a DOM. `loadTexture` reaches for `Image`, which Node does not have.
 *
 * `repeat` on the horizontal axis: the equirectangular lookup runs past 0 and 1 as the planet turns,
 * and clamping would smear the edge column across half the globe at the date line.
 */
export async function loadSkyTextures(renderer: Renderer): Promise<SkyTextures> {
  const options = { wrap: 'repeat', filter: 'smooth', anisotropy: 8, flipY: false } as const;
  const [starMap, earthAlbedo, earthClouds] = await Promise.all([
    loadTexture(renderer, STAR_MAP_URL, options),
    loadTexture(renderer, EARTH_ALBEDO_URL, options),
    loadTexture(renderer, EARTH_CLOUDS_URL, options),
  ]);
  return Object.freeze({ starMap, earthAlbedo, earthClouds });
}

export async function createSpaceBackdrop(
  renderer: Renderer,
  programFactory: BackdropProgramFactory = (target) => createProgram(target, spaceBackdropShader),
  globeFactory: BackdropProgramFactory = (target) => createProgram(target, earthGlobeShader),
  loadTextures: (renderer: Renderer) => Promise<SkyTextures> = loadSkyTextures,
): Promise<SpaceBackdrop> {
  // A sky sphere, not a floor plane.
  //
  // The backdrop used to be a 56x56 plane beneath the arena, which worked while the sky was hashed
  // dots with no orientation. A real star map has to be addressed by direction, and a plane sampled
  // by direction stretches without limit as rays approach parallel to it — the result was radial
  // motion-blur streaks rather than stars.
  //
  // Wound inside-out so the camera sits within it and the renderer's back-face culling keeps the
  // near hemisphere from covering the scene.
  const geometry = createSphere({ radius: 120, widthSegments: 64, heightSegments: 40 });
  const upwardIndices = new Uint16Array(geometry.indices);
  for (let index = 0; index < upwardIndices.length; index += 3) {
    const second = upwardIndices[index + 1]!;
    upwardIndices[index + 1] = upwardIndices[index + 2]!;
    upwardIndices[index + 2] = second;
  }
  const program = programFactory(renderer);
  const owned: { dispose(): void }[] = [program];
  let starMap: BroMetalTexture;
  let earthAlbedo: BroMetalTexture;
  let earthClouds: BroMetalTexture;
  let globe: BroMetalProgram;
  try {
    program.attributes.aPosition!.set(geometry.positions);
    program.setIndices(upwardIndices);
    // `repeat` on the horizontal axis: the equirectangular lookup runs past 0 and 1 as the planet
    // turns, and clamping would smear the edge column across half the globe at the date line.
    const textures = await loadTextures(renderer);
    starMap = textures.starMap;
    earthAlbedo = textures.earthAlbedo;
    earthClouds = textures.earthClouds;
    owned.push(starMap, earthAlbedo, earthClouds);
    program.uniforms.uStarMap!.set(starMap);

    // Enough segments that the limb is a curve rather than a polygon. The silhouette is the whole
    // read of a planet, and this is one sphere in the scene — the vertices are free.
    const sphere = createSphere({ radius: 1, widthSegments: 96, heightSegments: 64 });
    globe = globeFactory(renderer);
    owned.push(globe);
    globe.attributes.aPosition!.set(sphere.positions);
    globe.attributes.aNormal!.set(sphere.normals);
    globe.setIndices(sphere.indices);
    globe.uniforms.uAlbedo!.set(earthAlbedo);
    globe.uniforms.uClouds!.set(earthClouds);
    globe.uniforms.uCenter!.set(EARTH_CENTER);
    globe.uniforms.uRadius!.set(EARTH_RADIUS);
  } catch (cause: unknown) {
    for (const resource of owned.reverse()) resource.dispose();
    throw cause;
  }
  return Object.freeze({
    frame(viewProjection, time, cameraPosition): void {
      program.uniforms.uViewProj!.set(viewProjection);
      program.uniforms.uCameraPosition!.set(cameraPosition);
      globe.uniforms.uViewProj!.set(viewProjection);
      globe.uniforms.uTime!.set(time);
    },
    draw(): void {
      program.draw();
      globe.draw();
    },
    dispose(): void {
      for (const resource of owned.reverse()) resource.dispose();
    },
  });
}
