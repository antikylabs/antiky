import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  FogExp2,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
} from 'three';
import type { Material, BufferGeometry as ThreeGeometry } from 'three';
import type { StudioGameEntry } from './studio-game.ts';
import { createShardOrbits } from './scene-layout.ts';
import { createResizeGuard } from './resize-guard.ts';

const STAR_COUNT = 1_400;
const SHARD_COUNT = 180;

function starPositions(count: number): Float32Array {
  const values = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const longitude = index * 2.399963229728653;
    const latitude = Math.acos(1 - 2 * ((index + 0.5) / count));
    const radius = 24 + (index % 17) * 0.22;
    values[index * 3] = Math.sin(latitude) * Math.cos(longitude) * radius;
    values[index * 3 + 1] = Math.cos(latitude) * radius;
    values[index * 3 + 2] = Math.sin(latitude) * Math.sin(longitude) * radius;
  }
  return values;
}

const game: StudioGameEntry = ({ canvas, pointer, report }) => {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));

  const scene = new Scene();
  scene.background = new Color(0x01030c);
  scene.fog = new FogExp2(0x01030c, 0.018);
  const camera = new PerspectiveCamera(42, 16 / 9, 0.1, 80);
  camera.position.set(0, 5.5, 14);
  scene.add(new AmbientLight(0x355080, 0.32));

  const geometries: ThreeGeometry[] = [];
  const materials: Material[] = [];
  const sunGeometry = new SphereGeometry(1.35, 48, 32);
  const sunMaterial = new MeshBasicMaterial({ color: 0xffc15d });
  const haloGeometry = new SphereGeometry(1.72, 40, 24);
  const haloMaterial = new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: 0xff6828,
    depthWrite: false,
    opacity: 0.16,
    side: DoubleSide,
    transparent: true,
  });
  geometries.push(sunGeometry, haloGeometry);
  materials.push(sunMaterial, haloMaterial);
  const sun = new Mesh(sunGeometry, sunMaterial);
  const halo = new Mesh(haloGeometry, haloMaterial);
  scene.add(sun);
  scene.add(halo);
  const sunLight = new PointLight(0xff9a42, 520, 45, 2);
  scene.add(sunLight);

  const orbitOne = new Group();
  const planetOneGeometry = new SphereGeometry(0.72, 36, 24);
  const planetOneMaterial = new MeshStandardMaterial({
    color: 0x285b99,
    metalness: 0.32,
    roughness: 0.38,
    emissive: 0x031633,
  });
  geometries.push(planetOneGeometry);
  materials.push(planetOneMaterial);
  const planetOne = new Mesh(planetOneGeometry, planetOneMaterial);
  planetOne.position.x = 4.6;
  orbitOne.add(planetOne);
  scene.add(orbitOne);

  const moonOrbit = new Group();
  moonOrbit.position.copy(planetOne.position);
  const moonGeometry = new SphereGeometry(0.2, 20, 14);
  const moonMaterial = new MeshStandardMaterial({ color: 0x9ed7e5, roughness: 0.72 });
  geometries.push(moonGeometry);
  materials.push(moonMaterial);
  const moon = new Mesh(moonGeometry, moonMaterial);
  moon.position.x = 1.25;
  moonOrbit.add(moon);
  orbitOne.add(moonOrbit);

  const orbitTwo = new Group();
  const planetTwoGeometry = new SphereGeometry(0.9, 40, 28);
  const planetTwoMaterial = new MeshStandardMaterial({
    color: 0x7f3fb2,
    metalness: 0.5,
    roughness: 0.26,
    emissive: 0x180628,
  });
  geometries.push(planetTwoGeometry);
  materials.push(planetTwoMaterial);
  const planetTwo = new Mesh(planetTwoGeometry, planetTwoMaterial);
  planetTwo.position.x = -7;
  orbitTwo.add(planetTwo);
  const ringGeometry = new RingGeometry(1.25, 1.72, 72);
  const ringMaterial = new MeshBasicMaterial({ color: 0xdac4ff, transparent: true, opacity: 0.48, side: 2 });
  geometries.push(ringGeometry);
  materials.push(ringMaterial);
  const ring = new Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2.6;
  planetTwo.add(ring);
  scene.add(orbitTwo);

  const orbitMaterial = new MeshBasicMaterial({ color: 0x4b84ad, transparent: true, opacity: 0.3 });
  materials.push(orbitMaterial);
  [4.6, 7].forEach((radius, index) => {
    const geometry = new TorusGeometry(radius, 0.012, 6, 192);
    geometries.push(geometry);
    const orbitGuide = new Mesh(geometry, orbitMaterial);
    orbitGuide.rotation.x = Math.PI / 2 + index * 0.045;
    scene.add(orbitGuide);
  });

  const shardGeometry = new OctahedronGeometry(0.085, 0);
  const shardMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.68,
    transparent: true,
  });
  geometries.push(shardGeometry);
  materials.push(shardMaterial);
  const shards = new InstancedMesh(shardGeometry, shardMaterial, SHARD_COUNT);
  shards.instanceMatrix.setUsage(DynamicDrawUsage);
  shards.frustumCulled = false;
  scene.add(shards);

  const shardOrbits = createShardOrbits(SHARD_COUNT);
  const shardTransform = new Object3D();
  const shardColor = new Color();
  const updateShards = (time: number): void => {
    shardOrbits.forEach((orbit, index) => {
      const angle = orbit.phase + time * orbit.speed;
      const wave = Math.sin(angle * 3.2 + index * 0.037);
      const radius = orbit.radius + wave * 0.16;
      shardTransform.position.set(
        Math.cos(angle) * radius,
        orbit.height + Math.sin(angle * 2.1 + time * 0.22) * 0.22,
        Math.sin(angle) * radius,
      );
      shardTransform.rotation.set(angle * 0.7 + orbit.tilt, angle * 1.8, wave * 0.8);
      shardTransform.scale.set(orbit.scale * 0.42, orbit.scale * (1.3 + Math.abs(wave) * 0.72), orbit.scale * 0.42);
      shardTransform.updateMatrix();
      shards.setMatrixAt(index, shardTransform.matrix);
      shardColor.setHSL(0.52 + ((index % 23) / 23) * 0.4, 0.82, 0.36 + wave * 0.045);
      shards.setColorAt(index, shardColor);
    });
    shards.instanceMatrix.needsUpdate = true;
    const instanceColor = shards.instanceColor;
    if (instanceColor) instanceColor.needsUpdate = true;
  };
  updateShards(0);

  const starsGeometry = new BufferGeometry();
  starsGeometry.setAttribute('position', new Float32BufferAttribute(starPositions(STAR_COUNT), 3));
  const starsMaterial = new PointsMaterial({
    blending: AdditiveBlending,
    color: 0xc8e5ff,
    depthWrite: false,
    size: 0.065,
    sizeAttenuation: true,
    transparent: true,
  });
  geometries.push(starsGeometry);
  materials.push(starsMaterial);
  const stars = new Points(starsGeometry, starsMaterial);
  scene.add(stars);

  report({
    instances: STAR_COUNT + SHARD_COUNT + 7,
    drawCalls: 11,
    uploadBytesPerFrame: SHARD_COUNT * (16 + 3) * Float32Array.BYTES_PER_ELEMENT,
    note: 'dynamic Three.js instancing, hierarchy, and per-instance color hosted by Studio',
  });

  let disposed = false;
  const applyResize = createResizeGuard((width, height) => {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  const resize = (): void => applyResize(canvas.clientWidth, canvas.clientHeight);

  return Object.freeze({
    frame(time: number): void {
      if (disposed) return;
      resize();
      orbitOne.rotation.y = time * 0.28;
      moonOrbit.rotation.y = time * 1.15;
      orbitTwo.rotation.y = time * -0.16 + 1.8;
      planetOne.rotation.y = time * 0.42;
      planetTwo.rotation.y = time * -0.2;
      sun.scale.setScalar(1 + Math.sin(time * 2.2) * 0.025);
      halo.scale.setScalar(1 + Math.sin(time * 1.7) * 0.08);
      halo.rotation.y = time * -0.08;
      stars.rotation.y = time * 0.008;
      updateShards(time);
      const cameraAngle = (pointer.x - 0.5) * 0.7;
      camera.position.x = Math.sin(cameraAngle) * 14;
      camera.position.z = Math.cos(cameraAngle) * 14;
      camera.position.y = 5.5 + (pointer.y - 0.5) * 2.2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
    },
  });
};

export default game;
