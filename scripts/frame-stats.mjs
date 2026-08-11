/**
 * Frame statistics for captured demo frames.
 *
 * Visual acceptance criteria are only meaningful if something can measure them. This module is
 * that something. It reads a PNG and reports the numbers the demo visual budgets assert against.
 *
 * Luminance is computed on **linearised** channels. sRGB is a non-linear encoding, so averaging
 * or comparing the stored bytes directly answers a different question than "how bright is this".
 * Every value returned here is in linear light, in the range 0 to 1.
 */
import sharp from 'sharp';

/** Rec. 709 luminance weights, applied to linear channels. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/** A byte is "clipped" when it reaches the end of the encodable range. */
const CLIPPED_LOW_BYTE = 0;
const CLIPPED_HIGH_BYTE = 255;

/** Decode one sRGB byte to linear light. */
function srgbByteToLinear(byte) {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

const LINEAR_BY_BYTE = Float64Array.from({ length: 256 }, (_, byte) => srgbByteToLinear(byte));

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return 0;
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  const mean = total / values.length;
  let variance = 0;
  for (const value of values) variance += (value - mean) ** 2;
  return Math.sqrt(variance / values.length);
}

/**
 * Read raw RGB bytes and the image dimensions.
 *
 * Alpha is dropped rather than composited. A capture of an opaque game canvas has no meaningful
 * alpha, and flattening against an invented background colour would change the measured luminance.
 */
async function readPixels(pngPath) {
  const image = sharp(pngPath).removeAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function luminanceAt(data, offset) {
  return LUMA_R * LINEAR_BY_BYTE[data[offset]]
    + LUMA_G * LINEAR_BY_BYTE[data[offset + 1]]
    + LUMA_B * LINEAR_BY_BYTE[data[offset + 2]];
}

/**
 * Saturation as the chroma of the encoded colour: (max - min) / max over the sRGB bytes.
 *
 * This one deliberately stays in encoded space. It answers "how colourful does this look",
 * which is a perceptual question about the delivered image, not a light-transport question.
 */
function saturationAt(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const high = Math.max(r, g, b);
  if (high === 0) return 0;
  return (high - Math.min(r, g, b)) / high;
}

/**
 * Statistics for one named rectangle, for probe-based assertions such as
 * "the ground under this object is darker than the ground beside it".
 */
function probeStats(data, width, height, channels, rectangle) {
  const left = Math.max(0, Math.round(rectangle.x));
  const top = Math.max(0, Math.round(rectangle.y));
  const right = Math.min(width, left + Math.round(rectangle.width));
  const bottom = Math.min(height, top + Math.round(rectangle.height));
  if (right <= left || bottom <= top) {
    throw new Error(`Probe rectangle falls outside the ${width}x${height} frame.`);
  }
  const luminances = [];
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      luminances.push(luminanceAt(data, (y * width + x) * channels));
    }
  }
  let total = 0;
  for (const value of luminances) total += value;
  return Object.freeze({
    meanLuminance: total / luminances.length,
    luminanceStandardDeviation: standardDeviation(luminances),
    pixels: luminances.length,
  });
}

/**
 * Compute frame statistics for a captured PNG.
 *
 * `probes` maps a name to a `{ x, y, width, height }` rectangle in pixels. Probes are addressed
 * by name so tests read as intent rather than as coordinates.
 */
export async function readFrameStats(pngPath, options = {}) {
  const probes = options.probes ?? {};
  const { data, width, height, channels } = await readPixels(pngPath);
  const pixelCount = width * height;

  const luminances = new Float64Array(pixelCount);
  let luminanceTotal = 0;
  let saturationTotal = 0;
  let clippedHigh = 0;
  let clippedLow = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * channels;
    const luminance = luminanceAt(data, offset);
    luminances[index] = luminance;
    luminanceTotal += luminance;
    saturationTotal += saturationAt(data, offset);
    const high = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    if (high === CLIPPED_HIGH_BYTE) clippedHigh += 1;
    if (high === CLIPPED_LOW_BYTE) clippedLow += 1;
  }

  const sorted = Float64Array.prototype.slice.call(luminances).sort();
  const probeResults = {};
  for (const [name, rectangle] of Object.entries(probes)) {
    probeResults[name] = probeStats(data, width, height, channels, rectangle);
  }

  return Object.freeze({
    width,
    height,
    meanLuminance: luminanceTotal / pixelCount,
    luminanceP05: percentile(sorted, 0.05),
    luminanceP50: percentile(sorted, 0.5),
    luminanceP95: percentile(sorted, 0.95),
    /** The spread between p05 and p95. A flat, lifeless frame has a small value here. */
    luminanceSpread: percentile(sorted, 0.95) - percentile(sorted, 0.05),
    clippedHigh: clippedHigh / pixelCount,
    clippedLow: clippedLow / pixelCount,
    meanSaturation: saturationTotal / pixelCount,
    probes: Object.freeze(probeResults),
  });
}

/** True when every pixel in the frame is the same colour, which is what a failed capture looks like. */
export async function isUniformFrame(pngPath) {
  const { data, width, height, channels } = await readPixels(pngPath);
  const pixelCount = width * height;
  if (pixelCount === 0) return true;
  const r = data[0];
  const g = data[1];
  const b = data[2];
  for (let index = 1; index < pixelCount; index += 1) {
    const offset = index * channels;
    if (data[offset] !== r || data[offset + 1] !== g || data[offset + 2] !== b) return false;
  }
  return true;
}
