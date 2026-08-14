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
 * Rec. 709 luma of the delivered bytes, normalised 0-1.
 *
 * Deliberately in encoded space, unlike `luminanceAt`. The §7.1 frame-level value targets are
 * written against "the sRGB-encoded output pixel" — what the viewer's display is handed — so
 * measuring them in linear light would silently retarget every number in the table.
 */
function encodedLumaAt(data, offset) {
  return (LUMA_R * data[offset] + LUMA_G * data[offset + 1] + LUMA_B * data[offset + 2]) / 255;
}

/** Encoded luma at or above this counts as blown for the §7.1 clipped budget. */
const ENCODED_LUMA_CLIP = 0.995;

/**
 * A pixel votes on hue only when its hue is visible: bright enough to see and saturated enough
 * that the hue angle is signal rather than sensor noise. Near-black and near-grey pixels carry
 * numerically valid hues that no viewer perceives.
 */
const CHROMATIC_MINIMUM_BYTE = 32;
const CHROMATIC_MINIMUM_SATURATION = 0.15;

/** 72 bins of 5°: fine enough to separate 25°-apart peaks, coarse enough to be stable. */
const HUE_BIN_COUNT = 72;
const HUE_DEGREES_PER_BIN = 360 / HUE_BIN_COUNT;

/** HSV hue in degrees, for a pixel already known to be chromatic (max > min). */
function hueAt(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const range = high - low;
  let hue;
  if (high === r) hue = ((g - b) / range) % 6;
  else if (high === g) hue = (b - r) / range + 2;
  else hue = (r - g) / range + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

/**
 * Count distinguishable hue clusters and how much of the chromatic population the biggest one
 * holds.
 *
 * The §7.1 criterion in mechanical form: a cluster is a peak in the circular hue histogram that
 * sits ≥ 25° from every other accepted peak with a valley between them at least 25% below the
 * lower of the two. Peaks are taken in height order, so a shoulder on a big peak never displaces
 * a genuinely separate colour. The share is computed from the raw bins, each assigned to its
 * nearest accepted peak.
 *
 * One deliberate fallback: a plateau — adjacent bins of equal height, as a frame of exactly two
 * near-identical hues produces — has no strict local maximum. If chromatic pixels exist but no
 * peak does, that is one cluster at the histogram's highest bin, not zero.
 */
function hueClusterStats(rawBins, chromaticCount) {
  if (chromaticCount === 0) return { clusterCount: 0, dominantShare: 0 };

  // Circular smoothing over ±2 bins kills single-bin noise without moving a real peak.
  const kernel = [1, 2, 3, 2, 1];
  const smoothed = new Float64Array(HUE_BIN_COUNT);
  for (let bin = 0; bin < HUE_BIN_COUNT; bin += 1) {
    let total = 0;
    for (let tap = -2; tap <= 2; tap += 1) {
      total += rawBins[(bin + tap + HUE_BIN_COUNT) % HUE_BIN_COUNT] * kernel[tap + 2];
    }
    smoothed[bin] = total / 9;
  }

  const candidates = [];
  for (let bin = 0; bin < HUE_BIN_COUNT; bin += 1) {
    const left = smoothed[(bin + HUE_BIN_COUNT - 1) % HUE_BIN_COUNT];
    const right = smoothed[(bin + 1) % HUE_BIN_COUNT];
    if (smoothed[bin] > left && smoothed[bin] > right) candidates.push(bin);
  }
  if (candidates.length === 0) {
    let highest = 0;
    for (let bin = 1; bin < HUE_BIN_COUNT; bin += 1) if (smoothed[bin] > smoothed[highest]) highest = bin;
    candidates.push(highest);
  }
  candidates.sort((a, b) => smoothed[b] - smoothed[a]);

  const circularDistance = (a, b) => {
    const direct = Math.abs(a - b);
    return Math.min(direct, HUE_BIN_COUNT - direct);
  };
  /** The deepest valley along the shorter arc between two bins. */
  const arcMinimum = (a, b) => {
    const distance = circularDistance(a, b);
    const step = ((b - a + HUE_BIN_COUNT) % HUE_BIN_COUNT) <= HUE_BIN_COUNT / 2 ? 1 : -1;
    let lowest = Infinity;
    for (let offset = 1; offset < distance; offset += 1) {
      lowest = Math.min(lowest, smoothed[(a + step * offset + HUE_BIN_COUNT) % HUE_BIN_COUNT]);
    }
    return lowest === Infinity ? 0 : lowest;
  };

  const accepted = [];
  for (const candidate of candidates) {
    const separated = accepted.every((peak) => (
      circularDistance(candidate, peak) * HUE_DEGREES_PER_BIN >= 25
      && arcMinimum(candidate, peak) <= 0.75 * Math.min(smoothed[candidate], smoothed[peak])
    ));
    if (separated) accepted.push(candidate);
  }

  const clusterTotals = new Float64Array(accepted.length);
  for (let bin = 0; bin < HUE_BIN_COUNT; bin += 1) {
    if (rawBins[bin] === 0) continue;
    let nearest = 0;
    for (let index = 1; index < accepted.length; index += 1) {
      if (circularDistance(bin, accepted[index]) < circularDistance(bin, accepted[nearest])) {
        nearest = index;
      }
    }
    clusterTotals[nearest] += rawBins[bin];
  }
  let dominant = 0;
  for (const total of clusterTotals) dominant = Math.max(dominant, total);

  return { clusterCount: accepted.length, dominantShare: dominant / chromaticCount };
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
 * How far display luminance may jump between neighbouring pixels before the step counts as hard.
 *
 * A quarter of the range. Below this, real shading gradients and texture detail start being
 * counted; above it, only genuine silhouettes qualify.
 */
const HARD_EDGE_STEP = 64;

/**
 * Fraction of pixels that jump more than `HARD_EDGE_STEP` to their right or lower neighbour.
 *
 * This is the anti-aliasing measure. A multisampled silhouette lands intermediate values between
 * the two surfaces it separates, so it reads as a run of small steps; an unsampled one is a single
 * large jump with nothing in between. The number rises when anti-aliasing is lost.
 *
 * It exists because that happened and nothing caught it. Moving point-light-expo's scene off the
 * multisampled canvas and into a render target — which defaults to one sample — took the frame
 * from 0.69% to 1.03% here while every other metric stayed put and the capture looked fine at a
 * glance.
 *
 * **This is a directional indicator, not a classifier.** On a single high-contrast silhouette it
 * separates sampled from unsampled by only about 1.2x, because the midpoint of a big jump is still
 * a big jump. It works across a whole frame, where thousands of edges sit at many contrasts and
 * averaging pushes the middle of that population under the threshold. So compare a demo against
 * its own recorded number and never against another demo's: the absolute value is content, and
 * pixel art and UI text are hard-edged on purpose.
 *
 * Measured on display bytes rather than linear light, deliberately: the question is whether a
 * viewer sees a staircase, which is about the delivered image.
 */
function hardEdgeFraction(data, width, height, channels) {
  const displayLuminance = (x, y) => {
    const offset = (y * width + x) * channels;
    return LUMA_R * data[offset] + LUMA_G * data[offset + 1] + LUMA_B * data[offset + 2];
  };
  let hard = 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const here = displayLuminance(x, y);
      const rightStep = Math.abs(displayLuminance(x + 1, y) - here);
      const downStep = Math.abs(displayLuminance(x, y + 1) - here);
      if (rightStep > HARD_EDGE_STEP || downStep > HARD_EDGE_STEP) hard += 1;
    }
  }
  return hard / ((width - 1) * (height - 1));
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
  const encodedLumas = new Float64Array(pixelCount);
  let luminanceTotal = 0;
  let saturationTotal = 0;
  let clippedHigh = 0;
  let clippedLow = 0;
  let encodedLumaClipped = 0;
  let chromaticCount = 0;
  const hueBins = new Float64Array(HUE_BIN_COUNT);

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
    const encoded = encodedLumaAt(data, offset);
    encodedLumas[index] = encoded;
    if (encoded >= ENCODED_LUMA_CLIP) encodedLumaClipped += 1;
    if (high >= CHROMATIC_MINIMUM_BYTE && saturationAt(data, offset) >= CHROMATIC_MINIMUM_SATURATION) {
      chromaticCount += 1;
      hueBins[Math.min(HUE_BIN_COUNT - 1, Math.floor(hueAt(data, offset) / HUE_DEGREES_PER_BIN))] += 1;
    }
  }
  const hueClusters = hueClusterStats(hueBins, chromaticCount);

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
  const sortedEncoded = Float64Array.prototype.slice.call(encodedLumas).sort();
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
    /** Fraction of pixels sitting on an unsampled edge. Rises when anti-aliasing is lost. */
    hardEdgeFraction: hardEdgeFraction(data, width, height, channels),
    /**
     * Rec. 709 luma of the delivered bytes, 0-1 — the space the §7.1 value targets are written
     * in. Distinct from the linear percentiles above on purpose; conflating the two scales would
     * silently retarget the whole table.
     */
    encodedLumaP05: percentile(sortedEncoded, 0.05),
    encodedLumaP50: percentile(sortedEncoded, 0.5),
    encodedLumaP95: percentile(sortedEncoded, 0.95),
    encodedLumaSpread: percentile(sortedEncoded, 0.95) - percentile(sortedEncoded, 0.05),
    /** Fraction of pixels at or above 0.995 encoded luma: the §7.1 clipped budget. */
    encodedLumaClipped: encodedLumaClipped / pixelCount,
    /** Distinguishable hue populations per §7.1: peaks ≥ 25° apart with a ≥ 25% valley. */
    hueClusterCount: hueClusters.clusterCount,
    /** Share of chromatic pixels held by the largest hue cluster. */
    hueDominantShare: hueClusters.dominantShare,
    /** Fraction of the frame bright and saturated enough to vote on hue at all. */
    chromaticFraction: chromaticCount / pixelCount,
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
