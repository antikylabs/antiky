#!/usr/bin/env node
/**
 * Bake an HDRI down to nine spherical-harmonic coefficients of diffuse irradiance.
 *
 * The problem this solves: every demo's ambient light is one flat colour. A flat ambient says a
 * surface receives the same light whichever way it faces, which is false everywhere and is why
 * detail normals and baked occlusion have so little to work with — a perturbed normal that changes
 * nothing about how much light arrives is a perturbed normal nobody can see.
 *
 * Nine coefficients reconstruct the diffuse response of a whole environment to within a couple of
 * percent. That is not an approximation anyone regrets: the diffuse transfer function is a very wide
 * low-pass filter, so everything above the second band is already gone by the time light leaves a
 * rough surface. Ramamoorthi and Hanrahan, "An Efficient Representation for Irradiance Environment
 * Maps" (2001), is the source for both the projection and the three convolution constants.
 *
 * Why not image-based lighting proper: it needs cubemaps and explicit-LOD sampling, and BroMetal has
 * neither — `dsl/types.d.ts` lists `sampler2D` and `sampler3D` only. This is the diffuse half, which
 * is the half that costs nine multiply-adds and no texture fetch at all.
 *
 * The HDRI itself is deliberately not committed. It is a 1K download used once at bake time; what
 * ships is twenty-seven floats and a receipt saying where they came from.
 *
 * Usage:
 *   node bake-sh9-irradiance.mjs --slug dikhololo-night --demo point-light-expo --name RELIQUARY
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const demosRoot = fileURLToPath(new URL('..', import.meta.url));
const cacheRoot = path.join(demosRoot, '..', '..', '.hdri-cache');

/**
 * Decode a Radiance RGBE (`.hdr`) image to linear floating-point RGB.
 *
 * The format stores three 8-bit mantissas and one shared 8-bit exponent per pixel, which is how it
 * fits high dynamic range into four bytes. Scanlines use the "new RLE" form: a `2, 2, hi, lo`
 * header, then each of the four channels separately as alternating run and literal spans.
 *
 * Hand-rolled because the alternative is a dependency for one file format read once at build time,
 * and because EXR — the other format Poly Haven offers — genuinely would need one.
 */
function decodeRadiance(buffer) {
  let offset = 0;
  const readLine = () => {
    let end = offset;
    while (end < buffer.length && buffer[end] !== 0x0a) end += 1;
    const text = buffer.toString('ascii', offset, end);
    offset = end + 1;
    return text;
  };

  if (!readLine().startsWith('#?')) throw new Error('Not a Radiance file: missing the #? signature.');
  let format;
  for (;;) {
    const header = readLine();
    if (header === '') break;
    if (header.startsWith('FORMAT=')) format = header.slice(7);
  }
  if (format !== '32-bit_rle_rgbe') throw new Error(`Unsupported Radiance format "${format}".`);

  const resolution = readLine().trim().split(/\s+/);
  if (resolution[0] !== '-Y' || resolution[2] !== '+X') {
    throw new Error(`Only -Y/+X scanline order is handled, got "${resolution.join(' ')}".`);
  }
  const height = Number(resolution[1]);
  const width = Number(resolution[3]);
  const pixels = new Float32Array(width * height * 3);
  const scanline = new Uint8Array(width * 4);

  for (let y = 0; y < height; y += 1) {
    const encoded = buffer[offset] === 2 && buffer[offset + 1] === 2
      && ((buffer[offset + 2] << 8) | buffer[offset + 3]) === width;
    if (!encoded) throw new Error(`Scanline ${y} is not new-RLE encoded, which this decoder requires.`);
    offset += 4;
    for (let channel = 0; channel < 4; channel += 1) {
      let x = 0;
      while (x < width) {
        let count = buffer[offset];
        offset += 1;
        if (count > 128) {
          // A run: one value repeated `count - 128` times.
          const value = buffer[offset];
          offset += 1;
          count -= 128;
          for (let step = 0; step < count; step += 1) scanline[(x + step) * 4 + channel] = value;
        } else {
          // A literal span of `count` distinct values.
          for (let step = 0; step < count; step += 1) {
            scanline[(x + step) * 4 + channel] = buffer[offset + step];
          }
          offset += count;
        }
        x += count;
      }
    }
    for (let x = 0; x < width; x += 1) {
      const exponent = scanline[x * 4 + 3];
      // Exponent 0 means the pixel is exactly black, not 2^-128.
      const scale = exponent === 0 ? 0 : 2 ** (exponent - 136);
      const at = (y * width + x) * 3;
      pixels[at] = scanline[x * 4] * scale;
      pixels[at + 1] = scanline[x * 4 + 1] * scale;
      pixels[at + 2] = scanline[x * 4 + 2] * scale;
    }
  }
  return { width, height, pixels };
}

/**
 * Project an equirectangular radiance map onto the first nine real spherical harmonics.
 *
 * Every texel contributes its radiance times the harmonic's value in that direction times the solid
 * angle it covers. The `sin(theta)` in the solid angle is what stops the poles — where texels are
 * geometrically tiny — from counting as much as the equator, and leaving it out is the classic way
 * to get a bake that is subtly wrong in a way nobody can point at.
 */
function projectToSh9({ width, height, pixels }) {
  const coefficients = Array.from({ length: 9 }, () => [0, 0, 0]);
  for (let y = 0; y < height; y += 1) {
    const theta = Math.PI * (y + 0.5) / height;
    const sinTheta = Math.sin(theta);
    const solidAngle = (2 * Math.PI / width) * (Math.PI / height) * sinTheta;
    for (let x = 0; x < width; x += 1) {
      const phi = 2 * Math.PI * (x + 0.5) / width - Math.PI;
      // +Y up, matching every demo's world. The map's centre column faces -Z.
      const dx = sinTheta * Math.sin(phi);
      const dy = Math.cos(theta);
      const dz = -sinTheta * Math.cos(phi);
      const basis = [
        0.282095,
        0.488603 * dy,
        0.488603 * dz,
        0.488603 * dx,
        1.092548 * dx * dy,
        1.092548 * dy * dz,
        0.315392 * (3 * dz * dz - 1),
        1.092548 * dx * dz,
        0.546274 * (dx * dx - dy * dy),
      ];
      const at = (y * width + x) * 3;
      for (let index = 0; index < 9; index += 1) {
        const weight = basis[index] * solidAngle;
        coefficients[index][0] += pixels[at] * weight;
        coefficients[index][1] += pixels[at + 1] * weight;
        coefficients[index][2] += pixels[at + 2] * weight;
      }
    }
  }
  return coefficients;
}

/**
 * Fold the cosine-lobe convolution and the basis constants into the coefficients themselves.
 *
 * Doing it here rather than in the shader means the runtime reconstruction is nine multiply-adds
 * against raw normal components, with no constants to get wrong in four different copies of the
 * same shader block.
 */
function convolveForIrradiance(coefficients) {
  const A = [3.141593, 2.094395, 2.094395, 2.094395, 0.785398, 0.785398, 0.785398, 0.785398, 0.785398];
  const basisConstants = [0.282095, 0.488603, 0.488603, 0.488603, 1.092548, 1.092548, 0.315392, 1.092548, 0.546274];
  return coefficients.map((channelValues, index) => channelValues.map(
    // Divided by pi so the shader's output is reflected radiance for an albedo of 1, which is the
    // quantity every one of these shaders already multiplies its albedo by.
    (value) => value * A[index] * basisConstants[index] / Math.PI,
  ));
}

async function fetchHdri(slug, upstreamId) {
  await mkdir(cacheRoot, { recursive: true });
  const cached = path.join(cacheRoot, `${slug}_1k.hdr`);
  if (existsSync(cached)) return { path: cached, bytes: await readFile(cached) };
  const url = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${upstreamId}_1k.hdr`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Poly Haven returned ${response.status} for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(cached, bytes);
  return { path: cached, bytes };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--slug') options.slug = argv[index += 1];
    else if (argv[index] === '--demo') options.demo = argv[index += 1];
    else if (argv[index] === '--name') options.name = argv[index += 1];
    else throw new Error(`Unknown argument "${argv[index]}".`);
  }
  for (const required of ['slug', 'demo', 'name']) {
    if (options[required] === undefined) throw new Error(`--${required} is required.`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const catalog = JSON.parse(await readFile(
    path.join(demosRoot, '..', 'asset-catalog', 'data', 'poly-haven.generated.json'),
    'utf8',
  ));
  const entries = Array.isArray(catalog) ? catalog : catalog.assets ?? catalog.items;
  const entry = entries.find((candidate) => candidate.slug === options.slug);
  if (entry === undefined) throw new Error(`No catalog entry for "${options.slug}".`);
  if (entry.kind !== 'hdri') throw new Error(`"${options.slug}" is a ${entry.kind}, not an hdri.`);

  const { bytes } = await fetchHdri(options.slug, entry.upstream.id);
  const image = decodeRadiance(bytes);
  const coefficients = convolveForIrradiance(projectToSh9(image));

  const format = (value) => value.toFixed(6).replace(/\.?0+$/, '') || '0';
  const rows = coefficients
    .map((channelValues) => `  [${channelValues.map(format).join(', ')}],`)
    .join('\n');
  const source = `/**
 * Diffuse irradiance from \`${options.slug}\`, projected onto the first nine spherical harmonics.
 *
 * Generated by \`packages/demos/scripts/bake-sh9-irradiance.mjs\`. Do not hand-edit: re-run the bake.
 *
 * ${entry.name} — ${entry.upstream.url}
 * CC0. Source HDRI sha256 ${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}
 *
 * The convolution and basis constants are already folded in, so reconstructing irradiance for a
 * surface normal is nine multiply-adds and nothing else:
 *
 *   E(n) = c0
 *        + c1*n.y + c2*n.z + c3*n.x
 *        + c4*n.x*n.y + c5*n.y*n.z + c6*(3*n.z*n.z - 1) + c7*n.x*n.z + c8*(n.x*n.x - n.y*n.y)
 *
 * The result is reflected radiance for an albedo of 1, which is what every material shader here
 * already multiplies its albedo by — so it drops straight in where the flat ambient constant was.
 */
export const ${options.name}_SH9_IRRADIANCE = Object.freeze([
${rows}
] as const);
`;

  const destination = path.join(demosRoot, 'antiky', options.demo, 'src', 'sh9-irradiance.gen.ts');
  await writeFile(destination, source);
  process.stdout.write(
    `${options.slug} → ${path.relative(demosRoot, destination)}\n`
    + `  ambient (band 0): ${coefficients[0].map(format).join(', ')}\n`,
  );
}

await main();
