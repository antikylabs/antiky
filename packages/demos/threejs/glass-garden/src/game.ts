import {
  ACESFilmicToneMapping,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  TorusKnotGeometry,
  Vector2,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { BufferGeometry, Material } from 'three';
import type { StudioGameEntry } from './studio-game.ts';
import { createGlassBloomLayout } from './scene-layout.ts';

const terrainNoise = new ImprovedNoise();

function terrainHeight(x: number, z: number): number {
  const broad = terrainNoise.noise(x * 0.105, z * 0.105, 4.7) * 0.68;
  const detail = terrainNoise.noise(x * 0.29, z * 0.29, 9.3) * 0.18;
  const gardenBowl = Math.min(0.52, Math.hypot(x * 0.04, z * 0.04) * 0.34);
  return broad + detail + gardenBowl - 0.58;
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
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2));
  renderer.shadowMap.enabled = true;

  const environmentGenerator = new PMREMGenerator(renderer);
  const environment = environmentGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  const scene = new Scene();
  scene.background = new Color(0x020813);
  scene.environment = environment;
  scene.fog = new FogExp2(0x020813, 0.032);
  const camera = new PerspectiveCamera(46, 16 / 9, 0.1, 50);
  camera.position.set(0, 4.25, 11.2);
  scene.add(new HemisphereLight(0x9bdcff, 0x12091e, 1.35));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new Vector2(1280, 720), 0.72, 0.42, 0.76);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const garden = new Group();
  scene.add(garden);

  const crystalGeometry = new IcosahedronGeometry(0.82, 1);
  const budGeometry = new OctahedronGeometry(0.46, 0);
  const stemGeometry = new CylinderGeometry(0.055, 0.12, 2.7, 10);
  geometries.push(crystalGeometry, budGeometry, stemGeometry);
  const glassMaterials = [
    new MeshPhysicalMaterial({
      color: 0x67e8ff,
      emissive: 0x0d8196,
      emissiveIntensity: 0.72,
      metalness: 0.05,
      roughness: 0.12,
      transmission: 0.72,
      thickness: 1.3,
      transparent: true,
      opacity: 0.82,
    }),
    new MeshPhysicalMaterial({
      color: 0xd287ff,
      emissive: 0x7412a2,
      emissiveIntensity: 0.68,
      metalness: 0.08,
      roughness: 0.16,
      transmission: 0.66,
      thickness: 1.1,
      transparent: true,
      opacity: 0.84,
    }),
    new MeshPhysicalMaterial({
      color: 0xffb85e,
      emissive: 0xb3470d,
      emissiveIntensity: 0.65,
      metalness: 0.12,
      roughness: 0.18,
      transmission: 0.58,
      thickness: 1.0,
      transparent: true,
      opacity: 0.86,
    }),
  ];
  const stemMaterial = new MeshStandardMaterial({
    color: 0x284659,
    emissive: 0x07131b,
    metalness: 0.7,
    roughness: 0.24,
  });
  const coreMaterials = [
    new MeshBasicMaterial({ color: new Color().setRGB(0.38, 1.55, 2.2) }),
    new MeshBasicMaterial({ color: new Color().setRGB(1.42, 0.42, 2.05) }),
    new MeshBasicMaterial({ color: new Color().setRGB(2.15, 0.82, 0.22) }),
  ];
  materials.push(...glassMaterials, stemMaterial, ...coreMaterials);

  const blooms: Group[] = [];
  const bloomLayout = createGlassBloomLayout();
  bloomLayout.forEach((layout, index) => {
    const bloom = new Group();
    const [x, z] = layout.position;
    const height = terrainHeight(x, z);
    bloom.position.set(x, height, z);
    const stem = new Mesh(stemGeometry, stemMaterial);
    const heightScale = layout.heightScale;
    stem.position.y = 1.02;
    stem.scale.y = heightScale;
    stem.castShadow = true;
    bloom.add(stem);
    const crystal = new Mesh(index % 2 === 0 ? crystalGeometry : budGeometry, glassMaterials[layout.materialIndex]!);
    crystal.position.y = 2.05 + heightScale * 0.55;
    crystal.scale.set(layout.crownScale, layout.crownScale * (1.35 + (index % 2) * 0.28), layout.crownScale);
    crystal.castShadow = true;
    bloom.add(crystal);
    const core = new Mesh(budGeometry, coreMaterials[layout.materialIndex]!);
    core.position.copy(crystal.position);
    core.scale.setScalar(0.38);
    bloom.add(core);
    garden.add(bloom);
    blooms.push(bloom);
  });

  const knotGeometry = new TorusKnotGeometry(1.18, 0.12, 128, 18, 2, 5);
  const knotMaterial = new MeshStandardMaterial({
    color: 0x8cb9d2,
    emissive: 0x123c52,
    emissiveIntensity: 0.72,
    metalness: 0.9,
    roughness: 0.18,
  });
  geometries.push(knotGeometry);
  materials.push(knotMaterial);
  const crown = new Mesh(knotGeometry, knotMaterial);
  crown.position.set(0, 3.65, -3.8);
  crown.castShadow = true;
  garden.add(crown);

  const archGeometry = new TorusGeometry(5.1, 0.065, 12, 160, Math.PI);
  const innerArchGeometry = new TorusGeometry(4.2, 0.045, 10, 144, Math.PI);
  const archMaterial = new MeshStandardMaterial({
    color: 0x3edff2,
    emissive: 0x087c9c,
    emissiveIntensity: 1.1,
    metalness: 0.76,
    roughness: 0.22,
  });
  const innerArchMaterial = new MeshStandardMaterial({
    color: 0xc26aff,
    emissive: 0x6816b5,
    emissiveIntensity: 0.92,
    metalness: 0.68,
    roughness: 0.24,
  });
  geometries.push(archGeometry, innerArchGeometry);
  materials.push(archMaterial, innerArchMaterial);
  const arch = new Mesh(archGeometry, archMaterial);
  arch.position.set(0, 0.45, -4.8);
  const innerArch = new Mesh(innerArchGeometry, innerArchMaterial);
  innerArch.position.set(0, 0.5, -4.72);
  garden.add(arch, innerArch);

  const floorGeometry = new PlaneGeometry(32, 24, 128, 96);
  const terrainPosition = floorGeometry.attributes.position!;
  const terrainColors = new Float32Array(terrainPosition.count * 3);
  const lowColor = new Color(0x071625);
  const highColor = new Color(0x164c55);
  const terrainColor = new Color();
  for (let index = 0; index < terrainPosition.count; index += 1) {
    const x = terrainPosition.getX(index);
    const z = -terrainPosition.getY(index);
    const height = terrainHeight(x, z);
    terrainPosition.setZ(index, height);
    terrainColor.copy(lowColor).lerp(highColor, Math.min(1, Math.max(0, (height + 0.9) / 1.45)));
    terrainColors[index * 3] = terrainColor.r;
    terrainColors[index * 3 + 1] = terrainColor.g;
    terrainColors[index * 3 + 2] = terrainColor.b;
  }
  floorGeometry.setAttribute('color', new Float32BufferAttribute(terrainColors, 3));
  floorGeometry.rotateX(-Math.PI / 2);
  floorGeometry.computeVertexNormals();
  const floorMaterial = new MeshStandardMaterial({
    metalness: 0.32,
    roughness: 0.64,
    vertexColors: true,
  });
  geometries.push(floorGeometry);
  materials.push(floorMaterial);
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.receiveShadow = true;
  scene.add(floor);

  const cyanLight = new PointLight(0x54ddff, 175, 16, 2);
  const violetLight = new PointLight(0xba5cff, 165, 15, 2);
  const amberLight = new PointLight(0xff923d, 145, 14, 2);
  cyanLight.castShadow = true;
  cyanLight.position.set(-3.5, 4.6, 3.2);
  violetLight.position.set(3.4, 3.8, 1.2);
  amberLight.position.set(0, 2.4, 4.4);
  scene.add(cyanLight, violetLight, amberLight);

  report({
    instances: bloomLayout.length * 3 + 7,
    drawCalls: bloomLayout.length * 3 + 7,
    uploadBytesPerFrame: 0,
    note: 'procedural Three.js terrain, physical glass, and bloom composition hosted by Studio',
  });

  let disposed = false;
  let renderWidth = 0;
  let renderHeight = 0;
  const resize = (): void => {
    const width = Math.max(1, canvas.clientWidth || 1280);
    const height = Math.max(1, canvas.clientHeight || 720);
    if (renderWidth === width && renderHeight === height) return;
    renderWidth = width;
    renderHeight = height;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
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
        const core = bloom.children[2]!;
        core.rotation.y = -time * (0.52 + index * 0.025);
        const baseHeight = terrainHeight(bloom.position.x, bloom.position.z);
        bloom.position.y = baseHeight + Math.sin(time * 0.8 + index * 1.4) * 0.07;
      });
      crown.rotation.x = time * 0.13;
      crown.rotation.y = time * 0.24;
      cyanLight.position.x = Math.sin(time * 0.42) * 4.2;
      violetLight.position.z = Math.cos(time * 0.37) * 3.4;
      const angle = (pointer.x - 0.5) * 0.58;
      camera.position.x = Math.sin(angle) * 11.2;
      camera.position.z = Math.cos(angle) * 11.2;
      camera.position.y = 4.25 + (pointer.y - 0.5) * 1.45;
      camera.lookAt(0, 1.35, -1.25);
      composer.render();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      composer.dispose();
      environment.dispose();
      environmentGenerator.dispose();
      renderer.dispose();
    },
  });
};

export default game;
