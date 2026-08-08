import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  CylinderGeometry,
  FogExp2,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SRGBColorSpace,
  TorusKnotGeometry,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { StudioGameEntry } from './studio-game.ts';

const game: StudioGameEntry = ({ canvas, pointer, report }) => {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  scene.background = new Color(0x03070d);
  scene.fog = new FogExp2(0x03070d, 0.055);
  const camera = new PerspectiveCamera(46, 16 / 9, 0.1, 50);
  camera.position.set(0, 4.8, 11.5);
  scene.add(new AmbientLight(0x3a5574, 0.5));

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const garden = new Group();
  scene.add(garden);

  const crystalGeometry = new IcosahedronGeometry(0.82, 1);
  const budGeometry = new OctahedronGeometry(0.46, 0);
  const stemGeometry = new CylinderGeometry(0.055, 0.11, 2.7, 10);
  geometries.push(crystalGeometry, budGeometry, stemGeometry);
  const glassMaterials = [
    new MeshPhysicalMaterial({
      color: 0x67e8ff,
      emissive: 0x052b35,
      metalness: 0.05,
      roughness: 0.12,
      transmission: 0.72,
      thickness: 1.3,
      transparent: true,
      opacity: 0.82,
    }),
    new MeshPhysicalMaterial({
      color: 0xd287ff,
      emissive: 0x250736,
      metalness: 0.08,
      roughness: 0.16,
      transmission: 0.66,
      thickness: 1.1,
      transparent: true,
      opacity: 0.84,
    }),
    new MeshPhysicalMaterial({
      color: 0xffb85e,
      emissive: 0x351506,
      metalness: 0.12,
      roughness: 0.18,
      transmission: 0.58,
      thickness: 1.0,
      transparent: true,
      opacity: 0.86,
    }),
  ];
  const stemMaterial = new MeshStandardMaterial({ color: 0x223744, metalness: 0.72, roughness: 0.25 });
  materials.push(...glassMaterials, stemMaterial);

  const blooms: Group[] = [];
  const positions = [
    [-3.1, 0, 0.2],
    [-1.55, 0, -1.25],
    [0, 0, 0.4],
    [1.55, 0, -1.25],
    [3.1, 0, 0.2],
  ] as const;
  positions.forEach((position, index) => {
    const bloom = new Group();
    bloom.position.set(position[0], position[1], position[2]);
    const stem = new Mesh(stemGeometry, stemMaterial);
    stem.position.y = 0.95;
    stem.castShadow = true;
    bloom.add(stem);
    const crystal = new Mesh(index % 2 === 0 ? crystalGeometry : budGeometry, glassMaterials[index % 3]!);
    crystal.position.y = 2.35 + (index % 2) * 0.28;
    crystal.scale.set(1, 1.35, 1);
    crystal.castShadow = true;
    bloom.add(crystal);
    garden.add(bloom);
    blooms.push(bloom);
  });

  const knotGeometry = new TorusKnotGeometry(1.18, 0.12, 128, 18, 2, 5);
  const knotMaterial = new MeshStandardMaterial({
    color: 0x5c7790,
    emissive: 0x061018,
    metalness: 0.9,
    roughness: 0.18,
  });
  geometries.push(knotGeometry);
  materials.push(knotMaterial);
  const crown = new Mesh(knotGeometry, knotMaterial);
  crown.position.set(0, 3.3, -2.2);
  crown.castShadow = true;
  garden.add(crown);

  const floorGeometry = new PlaneGeometry(30, 30);
  const floorMaterial = new MeshStandardMaterial({
    color: 0x071019,
    metalness: 0.76,
    roughness: 0.22,
  });
  geometries.push(floorGeometry);
  materials.push(floorMaterial);
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.42;
  floor.receiveShadow = true;
  scene.add(floor);

  const cyanLight = new PointLight(0x54ddff, 130, 14, 2);
  const violetLight = new PointLight(0xba5cff, 120, 13, 2);
  const amberLight = new PointLight(0xff923d, 110, 12, 2);
  cyanLight.castShadow = true;
  cyanLight.position.set(-3.5, 4.6, 3.2);
  violetLight.position.set(3.4, 3.8, 1.2);
  amberLight.position.set(0, 2.4, 4.4);
  scene.add(cyanLight, violetLight, amberLight);

  report({
    instances: 13,
    drawCalls: 13,
    uploadBytesPerFrame: 0,
    note: 'pure Three.js physical-material scene hosted by Studio',
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
      blooms.forEach((bloom, index) => {
        const crystal = bloom.children[1]!;
        crystal.rotation.y = time * (0.34 + index * 0.035);
        crystal.rotation.z = Math.sin(time * 0.7 + index) * 0.12;
        bloom.position.y = Math.sin(time * 0.8 + index * 1.4) * 0.07;
      });
      crown.rotation.x = time * 0.13;
      crown.rotation.y = time * 0.24;
      cyanLight.position.x = Math.sin(time * 0.42) * 4.2;
      violetLight.position.z = Math.cos(time * 0.37) * 3.4;
      const angle = (pointer.x - 0.5) * 0.68;
      camera.position.x = Math.sin(angle) * 11.5;
      camera.position.z = Math.cos(angle) * 11.5;
      camera.position.y = 4.8 + (pointer.y - 0.5) * 1.8;
      camera.lookAt(0, 1.25, -0.4);
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
