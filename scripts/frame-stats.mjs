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

/**
 * CIE L*, perceptual lightness, from linear luminance. 0 is black, 100 is white.
 *
 * Linear luminance is proportional to photons, which is not how the eye works: the difference
 * between 0.01 and 0.02 is far more visible than between 0.51 and 0.52. Contrast has to be
 * measured in a space where equal steps look equal, or every dark scene scores as flat.
 */
function linearToLStar(luminance) {
  const epsilon = (6 / 29) ** 3;
  const value = luminance > epsilon
    ? Math.cbrt(luminance)
    : luminance / (3 * (6 / 29) ** 2) + 4 / 29;
  return 116 * value - 16;
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
  const left = Math.round(rectangle.x);
  const top = Math.round(rectangle.y);
  const right = left + Math.round(rectangle.width);
  const bottom = top + Math.round(rectangle.height);
  // Clamping a partly off-frame probe would silently shift the window and measure a different
  // region than the caller named, while still returning a plausible pixel count. Probe-based
  // assertions are only meaningful if the probe is where the test says it is.
  if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top) {
    throw new Error(
      `Probe rectangle (${rectangle.x}, ${rectangle.y}, ${rectangle.width}x${rectangle.height}) `
      + `falls outside the ${width}x${height} frame.`,
    );
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
    saturationTotal += saturationAt(data, offset) * luminance;
    const low = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const high = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    if (low === CLIPPED_HIGH_BYTE) clippedHigh += 1;
    if (high === CLIPPED_LOW_BYTE) clippedLow += 1;
  }

  // Local contrast: the median, across tiles, of the per-tile spread of perceptual lightness.
  //
  // This is the metric that answers "does this frame have form". A full-frame percentile spread
  // cannot: it is dominated by the brightest and darkest things anywhere in the image, so a frame
  // that is half black void and half flat subject scores well, and a beautifully modelled dark
  // scene scores the same as an unlit one. Measuring inside small windows and taking the median
  // asks a different question — does light vary across a surface, typically? — and that question
  // is independent of how bright the scene is overall.
  const tileSize = options.tileSize ?? 32;
  const tileContrasts = [];
  for (let tileTop = 0; tileTop + tileSize <= height; tileTop += tileSize) {
    for (let tileLeft = 0; tileLeft + tileSize <= width; tileLeft += tileSize) {
      const tile = [];
      for (let y = tileTop; y < tileTop + tileSize; y += 1) {
        for (let x = tileLeft; x < tileLeft + tileSize; x += 1) {
          tile.push(linearToLStar(luminances[y * width + x]));
        }
      }
      tileContrasts.push(standardDeviation(tile));
    }
  }
  tileContrasts.sort((a, b) => a - b);

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
    /**
     * The spread between p05 and p95, in linear light.
     *
     * Treat this as a description, not a quality target. Across real captures it tracks p95 almost
     * exactly (r = 0.99), because p05 is near zero for any scene containing shadows — so asserting
     * on it is very nearly asserting "be brighter". Use `localContrastMedian` to judge form.
     */
    luminanceSpread: percentile(sorted, 0.95) - percentile(sorted, 0.05),
    /** Median per-tile L* standard deviation. The measure of form, independent of brightness. */
    localContrastMedian: percentile(tileContrasts, 0.5),
    /** The dullest tenth of the frame. A high value here means detail everywhere, not just locally. */
    localContrastP10: percentile(tileContrasts, 0.1),
    /**
     * Fraction of pixels where every channel is at maximum: genuinely blown highlights.
     *
     * Deliberately not "any channel at maximum" — a fully saturated red is at maximum in one
     * channel while sitting at mid luminance, so that definition reports saturated colour as
     * over-exposure and would punish exactly the vivid VFX these demos are supposed to have.
     */
    clippedHigh: clippedHigh / pixelCount,
    /** Fraction of pixels where every channel is zero: crushed blacks with no recoverable detail. */
    clippedLow: clippedLow / pixelCount,
    /**
     * Luminance-weighted mean saturation.
     *
     * An unweighted mean is dominated by near-black pixels, where chroma is both numerically
     * maximal and perceptually invisible: rgb(1,0,0) scores a perfect 1.0. Weighting by luminance
     * measures the colourfulness of the part of the image a viewer can actually see.
     */
    meanSaturation: luminanceTotal > 0 ? saturationTotal / luminanceTotal : 0,
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

/**
 * Statistics across a captured sequence, plus how much the picture changes between frames.
 *
 * The between-frame measure is **Temporal Information** as ITU-T P.910 defines it: the *standard
 * deviation* of the per-pixel difference between consecutive frames, not its mean. The mean is
 * moved by a uniform brightness change — a fade, an exposure shift, a light turning on — which is
 * not motion. The standard deviation only rises when different parts of the frame change by
 * different amounts, which is what motion actually looks like. Both are reported, because their
 * disagreement is itself informative: a high mean with a low deviation is the whole frame getting
 * brighter, and nothing moving.
 */
export async function readSequenceStats(pngPaths, options = {}) {
  if (pngPaths.length === 0) throw new Error('A sequence needs at least one frame.');

  const frames = [];
  for (const pngPath of pngPaths) frames.push(await readFrameStats(pngPath, options));

  const differences = [];
  let previous = null;
  for (const pngPath of pngPaths) {
    const current = await readPixels(pngPath);
    if (previous !== null) {
      if (previous.width !== current.width || previous.height !== current.height) {
        throw new Error('Sequence frames differ in size, so they cannot be compared.');
      }
      const pixelCount = current.width * current.height;
      const perPixel = new Float64Array(pixelCount);
      for (let index = 0; index < pixelCount; index += 1) {
        const offset = index * current.channels;
        perPixel[index] = Math.abs(
          luminanceAt(current.data, offset) - luminanceAt(previous.data, offset),
        );
      }
      let total = 0;
      for (const value of perPixel) total += value;
      const mean = total / pixelCount;
      let variance = 0;
      for (const value of perPixel) variance += (value - mean) ** 2;
      differences.push({ mean, standardDeviation: Math.sqrt(variance / pixelCount) });
    }
    previous = current;
  }

  const series = (pick) => frames.map(pick);
  return Object.freeze({
    frameCount: frames.length,
    frames,
    /** One entry per adjacent pair, so length is `frameCount - 1`. */
    temporalDifference: differences,
    /** Per-frame series, ready to hand to `motion-stats`. */
    series: Object.freeze({
      meanLuminance: series((frame) => frame.meanLuminance),
      localContrastMedian: series((frame) => frame.localContrastMedian),
      clippedHigh: series((frame) => frame.clippedHigh),
    }),
  });
}
