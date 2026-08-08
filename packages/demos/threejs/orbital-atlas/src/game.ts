import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
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
  const sunMaterial = new MeshBasicMaterial({ color: 0xffb347 });
  geometries.push(sunGeometry);
  materials.push(sunMaterial);
  const sun = new Mesh(sunGeometry, sunMaterial);
  scene.add(sun);
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

  const orbitGeometry = new TorusGeometry(4.6, 0.012, 6, 160);
  const orbitMaterial = new MeshBasicMaterial({ color: 0x315075, transparent: true, opacity: 0.42 });
  geometries.push(orbitGeometry);
  materials.push(orbitMaterial);
  const orbitGuide = new Mesh(orbitGeometry, orbitMaterial);
  orbitGuide.rotation.x = Math.PI / 2;
  scene.add(orbitGuide);

  const starsGeometry = new BufferGeometry();
  starsGeometry.setAttribute('position', new Float32BufferAttribute(starPositions(900), 3));
  const starsMaterial = new PointsMaterial({ color: 0xb9d8ff, size: 0.055, sizeAttenuation: true });
  geometries.push(starsGeometry);
  materials.push(starsMaterial);
  const stars = new Points(starsGeometry, starsMaterial);
  scene.add(stars);

  report({
    instances: 905,
    drawCalls: 7,
    uploadBytesPerFrame: 0,
    note: 'pure Three.js scene graph hosted by Studio',
  });

  let disposed = false;
  const resize = (): void => {
    const width = Math.max(1, canvas.clientWidth || 1280);
    const height = Math.max(1, canvas.clientHeight || 720);
    if (canvas.width === width && canvas.height === height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

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
      stars.rotation.y = time * 0.008;
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
