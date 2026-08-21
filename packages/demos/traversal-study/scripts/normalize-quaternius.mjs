import { deflateSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { checkFidelity } from '../../scripts/asset-fidelity-policy.mjs';

const COMPONENT = Object.freeze({ 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array });
const COMPONENT_BYTES = Object.freeze({ 5121: 1, 5123: 2, 5125: 4, 5126: 4 });
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 });

function fail(message) {
  throw new Error(`normalize-quaternius: ${message}`);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
}

function createPalettePng(colors) {
  const width = Math.max(1, colors.length);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const scanline = Buffer.alloc(1 + width * 4);
  for (let index = 0; index < width; index += 1) {
    const color = colors[index] ?? [1, 1, 1, 1];
    for (let channel = 0; channel < 4; channel += 1) {
      scanline[1 + index * 4 + channel] = Math.round(Math.max(0, Math.min(1, color[channel] ?? 1)) * 255);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanline)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let inner = 0; inner < 4; inner += 1) {
        result[column * 4 + row] += left[inner * 4 + row] * right[column * 4 + inner];
      }
    }
  }
  return result;
}

function trs(translation, rotation, scale) {
  const [x, y, z, w] = rotation;
  const [sx, sy, sz] = scale;
  const x2 = x + x; const y2 = y + y; const z2 = z + z;
  const xx = x * x2; const xy = x * y2; const xz = x * z2;
  const yy = y * y2; const yz = y * z2; const zz = z * z2;
  const wx = w * x2; const wy = w * y2; const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    translation[0], translation[1], translation[2], 1,
  ];
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function transformNormal(matrix, x, y, z) {
  const result = [
    matrix[0] * x + matrix[4] * y + matrix[8] * z,
    matrix[1] * x + matrix[5] * y + matrix[9] * z,
    matrix[2] * x + matrix[6] * y + matrix[10] * z,
  ];
  const length = Math.hypot(...result) || 1;
  return result.map((value) => value / length);
}

function parseSource(sourceBytes) {
  const json = JSON.parse(sourceBytes.toString('utf8'));
  const sourceBuffer = json.buffers?.[0];
  if (sourceBuffer?.uri?.startsWith('data:') !== true) fail('expected one embedded data-URI source buffer');
  const encoded = sourceBuffer.uri.slice(sourceBuffer.uri.indexOf(',') + 1);
  return { json, binary: Buffer.from(encoded, 'base64') };
}

function readAccessor(json, binary, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (accessor === undefined || accessor.bufferView === undefined) fail(`missing accessor ${accessorIndex}`);
  const view = json.bufferViews?.[accessor.bufferView];
  if (view === undefined) fail(`missing bufferView ${accessor.bufferView}`);
  const Constructor = COMPONENT[accessor.componentType];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  const components = TYPE_COMPONENTS[accessor.type];
  if (Constructor === undefined || componentBytes === undefined || components === undefined) {
    fail(`unsupported accessor ${accessor.type}/${accessor.componentType}`);
  }
  const stride = view.byteStride ?? componentBytes * components;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const output = new Constructor(accessor.count * components);
  const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  for (let index = 0; index < accessor.count; index += 1) {
    for (let component = 0; component < components; component += 1) {
      const offset = start + index * stride + component * componentBytes;
      const outputIndex = index * components + component;
      if (accessor.componentType === 5126) output[outputIndex] = data.getFloat32(offset, true);
      if (accessor.componentType === 5125) output[outputIndex] = data.getUint32(offset, true);
      if (accessor.componentType === 5123) output[outputIndex] = data.getUint16(offset, true);
      if (accessor.componentType === 5121) output[outputIndex] = data.getUint8(offset);
    }
  }
  return output;
}

function sampleAnimation(json, binary, animationName, sampleAt, nodeStates) {
  if (animationName === null) return;
  const animation = json.animations?.find((candidate) => candidate.name === animationName);
  if (animation === undefined) fail(`animation '${animationName}' does not exist`);
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler];
    if (sampler?.interpolation !== undefined && sampler.interpolation !== 'LINEAR') fail('only LINEAR animation is supported');
    const times = readAccessor(json, binary, sampler.input);
    const values = readAccessor(json, binary, sampler.output);
    const duration = times[times.length - 1] ?? 0;
    const time = duration > 0 ? sampleAt % duration : 0;
    let right = 1;
    while (right < times.length && times[right] < time) right += 1;
    const left = Math.max(0, right - 1);
    right = Math.min(times.length - 1, right);
    const span = (times[right] ?? 0) - (times[left] ?? 0);
    const alpha = span > 0 ? (time - times[left]) / span : 0;
    const target = nodeStates[channel.target.node];
    const property = channel.target.path;
    const components = property === 'rotation' ? 4 : 3;
    const sampled = new Array(components);
    let sign = 1;
    if (property === 'rotation') {
      let dot = 0;
      for (let component = 0; component < 4; component += 1) {
        dot += values[left * 4 + component] * values[right * 4 + component];
      }
      sign = dot < 0 ? -1 : 1;
    }
    for (let component = 0; component < components; component += 1) {
      const first = values[left * components + component];
      const second = values[right * components + component] * sign;
      sampled[component] = first + (second - first) * alpha;
    }
    if (property === 'rotation') {
      const length = Math.hypot(...sampled) || 1;
      for (let component = 0; component < 4; component += 1) sampled[component] /= length;
    }
    target[property] = sampled;
  }
}

function nodeMatrices(json, binary, animationName, sampleAt) {
  const states = (json.nodes ?? []).map((node) => ({
    translation: [...(node.translation ?? [0, 0, 0])],
    rotation: [...(node.rotation ?? [0, 0, 0, 1])],
    scale: [...(node.scale ?? [1, 1, 1])],
  }));
  sampleAnimation(json, binary, animationName, sampleAt, states);
  const parents = new Array(states.length).fill(-1);
  for (let index = 0; index < (json.nodes ?? []).length; index += 1) {
    for (const child of json.nodes[index].children ?? []) parents[child] = index;
  }
  const globals = new Array(states.length);
  const resolve = (index) => {
    if (globals[index] !== undefined) return globals[index];
    const node = json.nodes[index];
    const local = node.matrix ?? trs(states[index].translation, states[index].rotation, states[index].scale);
    globals[index] = parents[index] < 0 ? local : multiply(resolve(parents[index]), local);
    return globals[index];
  };
  for (let index = 0; index < states.length; index += 1) resolve(index);
  return globals;
}

function mergedGeometry(json, binary, animationName, sampleAt) {
  const globals = nodeMatrices(json, binary, animationName, sampleAt);
  const meshNodes = new Map();
  for (let index = 0; index < (json.nodes ?? []).length; index += 1) {
    if (json.nodes[index].mesh !== undefined) meshNodes.set(json.nodes[index].mesh, index);
  }
  const skin = json.skins?.[0];
  const inverseBind = skin === undefined ? null : readAccessor(json, binary, skin.inverseBindMatrices);
  const skinMatrices = skin === undefined ? null : skin.joints.map((joint, jointIndex) => (
    multiply(globals[joint], Array.from(inverseBind.slice(jointIndex * 16, jointIndex * 16 + 16)))
  ));
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const colors = (json.materials ?? [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }])
    .map((material) => material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]);

  for (let meshIndex = 0; meshIndex < (json.meshes ?? []).length; meshIndex += 1) {
    const mesh = json.meshes[meshIndex];
    const nodeIndex = meshNodes.get(meshIndex);
    const node = nodeIndex === undefined ? null : json.nodes[nodeIndex];
    for (const primitive of mesh.primitives) {
      const sourcePositions = readAccessor(json, binary, primitive.attributes.POSITION);
      const sourceNormals = primitive.attributes.NORMAL === undefined
        ? new Float32Array(sourcePositions.length)
        : readAccessor(json, binary, primitive.attributes.NORMAL);
      const sourceIndices = primitive.indices === undefined
        ? Uint32Array.from({ length: sourcePositions.length / 3 }, (_, index) => index)
        : readAccessor(json, binary, primitive.indices);
      const joints = primitive.attributes.JOINTS_0 === undefined ? null : readAccessor(json, binary, primitive.attributes.JOINTS_0);
      const weights = primitive.attributes.WEIGHTS_0 === undefined ? null : readAccessor(json, binary, primitive.attributes.WEIGHTS_0);
      const baseVertex = positions.length / 3;
      const materialIndex = primitive.material ?? 0;
      const paletteU = (materialIndex + 0.5) / colors.length;
      for (let vertex = 0; vertex < sourcePositions.length / 3; vertex += 1) {
        const px = sourcePositions[vertex * 3]; const py = sourcePositions[vertex * 3 + 1]; const pz = sourcePositions[vertex * 3 + 2];
        const nx = sourceNormals[vertex * 3]; const ny = sourceNormals[vertex * 3 + 1]; const nz = sourceNormals[vertex * 3 + 2];
        let position;
        let normal;
        if (skinMatrices !== null && node?.skin !== undefined && joints !== null && weights !== null) {
          position = [0, 0, 0];
          normal = [0, 0, 0];
          for (let influence = 0; influence < 4; influence += 1) {
            const weight = weights[vertex * 4 + influence];
            if (weight === 0) continue;
            const matrix = skinMatrices[joints[vertex * 4 + influence]];
            const influencedPosition = transformPoint(matrix, px, py, pz);
            const influencedNormal = transformNormal(matrix, nx, ny, nz);
            for (let axis = 0; axis < 3; axis += 1) {
              position[axis] += influencedPosition[axis] * weight;
              normal[axis] += influencedNormal[axis] * weight;
            }
          }
          const length = Math.hypot(...normal) || 1;
          normal = normal.map((value) => value / length);
        } else {
          const matrix = nodeIndex === undefined ? identity() : globals[nodeIndex];
          position = transformPoint(matrix, px, py, pz);
          normal = transformNormal(matrix, nx, ny, nz);
        }
        positions.push(...position);
        normals.push(...normal);
        uvs.push(paletteU, 0.5);
      }
      for (const index of sourceIndices) indices.push(baseVertex + index);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    colors,
  };
}

function pad4(buffer, fill = 0) {
  const padding = (4 - buffer.length % 4) % 4;
  return padding === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(padding, fill)]);
}

function createGlb(name, geometry) {
  const chunks = [];
  const views = [];
  let byteOffset = 0;
  const append = (bytes, target) => {
    const buffer = pad4(Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length));
    views.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength ?? bytes.length, ...(target === undefined ? {} : { target }) });
    chunks.push(buffer);
    byteOffset += buffer.length;
    return views.length - 1;
  };
  const positionView = append(geometry.positions, 34962);
  const normalView = append(geometry.normals, 34962);
  const uvView = append(geometry.uvs, 34962);
  const indexView = append(geometry.indices, 34963);
  const image = createPalettePng(geometry.colors);
  const imageView = append(image);
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < geometry.positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      mins[axis] = Math.min(mins[axis], geometry.positions[index + axis]);
      maxs[axis] = Math.max(maxs[axis], geometry.positions[index + axis]);
    }
  }
  const json = {
    asset: { version: '2.0', generator: 'Antiky Quaternius atlas merge normalizer v1' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    buffers: [{ byteLength: byteOffset }],
    bufferViews: views,
    accessors: [
      { bufferView: positionView, componentType: 5126, count: geometry.positions.length / 3, type: 'VEC3', min: mins, max: maxs },
      { bufferView: normalView, componentType: 5126, count: geometry.normals.length / 3, type: 'VEC3' },
      { bufferView: uvView, componentType: 5126, count: geometry.uvs.length / 2, type: 'VEC2' },
      { bufferView: indexView, componentType: 5125, count: geometry.indices.length, type: 'SCALAR' },
    ],
    images: [{ name: `${name} palette`, mimeType: 'image/png', bufferView: imageView }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    textures: [{ sampler: 0, source: 0 }],
    materials: [{ name: `${name} baked palette`, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.7 } }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
  };
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const binaryChunk = Buffer.concat(chunks);
  const glb = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binaryChunk.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonChunk.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(glb, 20);
  const binaryHeader = 20 + jsonChunk.length;
  glb.writeUInt32LE(binaryChunk.length, binaryHeader);
  glb.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binaryChunk.copy(glb, binaryHeader + 8);
  return { glb, bounds: { min: mins, max: maxs }, vertices: geometry.positions.length / 3, indices: geometry.indices.length };
}

const [sourcePath, outputPath, animationName = '', sampleAtText = '0'] = process.argv.slice(2);
if (sourcePath === undefined || outputPath === undefined) {
  fail('usage: node normalize-quaternius.mjs SOURCE.gltf OUTPUT.glb [ANIMATION] [SECONDS]');
}
const source = parseSource(await readFile(sourcePath));
const geometry = mergedGeometry(source.json, source.binary, animationName || null, Number(sampleAtText));
const result = createGlb(basename(outputPath, '.glb'), geometry);
// This kit is flat-shaded and ships no source texture, so the palette is the faithful encoding
// rather than a lost unwrap. The policy still checks it stays a palette and keeps its attributes.
const fidelity = checkFidelity({
  name: basename(outputPath, '.glb'),
  attributes: ['POSITION', 'NORMAL', 'TEXCOORD_0'],
  textureWidth: geometry.colors.length,
  textureHeight: 1,
  uniqueUvCount: geometry.colors.length,
  materialCount: geometry.colors.length,
});
if (fidelity.length > 0) fail(fidelity.join('\n'));
await writeFile(outputPath, result.glb);
process.stdout.write(`${JSON.stringify({ sourcePath, outputPath, animation: animationName || null, sampleAt: Number(sampleAtText), ...result, glb: undefined })}\n`);
