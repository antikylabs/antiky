/**
 * Series analysis for judging motion.
 *
 * A sibling to `frame-stats.mjs`, and the same shape: pure functions, no I/O, no GPU, no browser.
 *
 * The reason this exists rather than a video pipeline: essentially no model accepts video, and
 * motion defects are cheaper and more exactly observed from the simulation than from pixels. A
 * camera path is a function of the simulation state, so shake, judder and VFX timing can be
 * measured by driving that function directly — in milliseconds, with no capture involved. Pixels
 * remain the only place a *rendering* bug appears, so they are still worth capturing; they are
 * just not where motion is best measured.
 *
 * Everything here takes a plain array of numbers sampled at a fixed rate.
 */

/** Per-step differences. Length is one less than the input. */
export function deltas(series) {
  const out = [];
  for (let index = 1; index < series.length; index += 1) out.push(series[index] - series[index - 1]);
  return out;
}

/**
 * Runs of consecutive samples that do not change, longest first.
 *
 * This is what missing render interpolation looks like: a simulation stepping at 60 Hz presented
 * at 120 Hz repeats each value, so the series holds for two samples at a time. A smoothly
 * interpolated series has no runs longer than one.
 */
export function holds(series, epsilon = 1e-9) {
  const runs = [];
  let start = 0;
  for (let index = 1; index <= series.length; index += 1) {
    const same = index < series.length && Math.abs(series[index] - series[start]) <= epsilon;
    if (same) continue;
    if (index - start > 1) runs.push({ start, length: index - start, value: series[start] });
    start = index;
  }
  return runs.sort((a, b) => b.length - a.length);
}

function centred(series) {
  const mean = series.reduce((total, value) => total + value, 0) / series.length;
  return series.map((value) => value - mean);
}

/**
 * Normalised autocorrelation for lags 0..maxLag. Index 0 is always 1.
 *
 * A peak away from lag 0 means the signal repeats itself at that lag, which is what separates
 * "an impact happened" from "something is vibrating on a timer". Periodic motion reads to the eye
 * as a malfunction, so this is the test for whether a shake is really an impulse.
 */
export function autocorrelation(series, maxLag = Math.floor(series.length / 2)) {
  const values = centred(series);
  const denominator = values.reduce((total, value) => total + value * value, 0);
  if (denominator === 0) return new Array(maxLag + 1).fill(0);
  const out = [];
  for (let lag = 0; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let index = 0; index + lag < values.length; index += 1) sum += values[index] * values[index + lag];
    out.push(sum / denominator);
  }
  return out;
}

/** The strongest repeat away from lag 0, ignoring lags below `minLag` (adjacent-sample noise). */
export function strongestRepeat(series, sampleRateHz, minLag = 3) {
  const correlations = autocorrelation(series);
  let best = { lag: 0, correlation: 0, seconds: 0 };
  for (let lag = minLag; lag < correlations.length; lag += 1) {
    if (correlations[lag] > best.correlation) {
      best = { lag, correlation: correlations[lag], seconds: lag / sampleRateHz };
    }
  }
  return best;
}

/**
 * Magnitude spectrum via a direct transform.
 *
 * Deliberately the naive O(n²) form: it runs in about 4 ms at n = 600, and an FFT dependency buys
 * nothing at the sizes a few seconds of gameplay produces. Bin 0 (DC) is dropped, because the
 * average position of a camera says nothing about how it moves.
 */
export function spectrum(series, sampleRateHz) {
  const values = centred(series);
  const bins = Math.floor(values.length / 2);
  const frequencies = [];
  const magnitudes = [];
  for (let bin = 1; bin <= bins; bin += 1) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < values.length; index += 1) {
      const angle = (-2 * Math.PI * bin * index) / values.length;
      real += values[index] * Math.cos(angle);
      imaginary += values[index] * Math.sin(angle);
    }
    frequencies.push((bin * sampleRateHz) / values.length);
    magnitudes.push(Math.hypot(real, imaginary) / values.length);
  }
  return { frequencies, magnitudes };
}

/** The frequency carrying the most energy, in Hz. */
export function dominantFrequency(series, sampleRateHz) {
  const { frequencies, magnitudes } = spectrum(series, sampleRateHz);
  if (magnitudes.length === 0) return 0;
  let bestIndex = 0;
  for (let index = 1; index < magnitudes.length; index += 1) {
    if (magnitudes[index] > magnitudes[bestIndex]) bestIndex = index;
  }
  return frequencies[bestIndex];
}

/**
 * The largest single bin's share of total spectral energy, 0..1.
 *
 * Near 1 means one frequency dominates — a pure tone, which is what a hand-written sine produces
 * and what makes a shake feel mechanical. Noise spreads its energy and scores low.
 */
export function spectralConcentration(series, sampleRateHz) {
  const { magnitudes } = spectrum(series, sampleRateHz);
  const total = magnitudes.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  return Math.max(...magnitudes) / total;
}

/**
 * How a burst rises and falls: its peak, and how long it takes to reach it and to decay.
 *
 * An impact should rise fast and fall away. A value that rises slowly, or never returns toward
 * zero, is not an impact — it is a state.
 */
export function onsetShape(series) {
  if (series.length === 0) return { peak: 0, peakIndex: 0, riseSamples: 0, quarterDecaySamples: 0 };
  let peakIndex = 0;
  for (let index = 1; index < series.length; index += 1) {
    if (Math.abs(series[index]) > Math.abs(series[peakIndex])) peakIndex = index;
  }
  const peak = Math.abs(series[peakIndex]);
  let riseSamples = peakIndex;
  for (let index = peakIndex; index >= 0; index -= 1) {
    if (Math.abs(series[index]) <= peak * 0.1) {
      riseSamples = peakIndex - index;
      break;
    }
  }
  let quarterDecaySamples = series.length - 1 - peakIndex;
  for (let index = peakIndex; index < series.length; index += 1) {
    if (Math.abs(series[index]) <= peak * 0.25) {
      quarterDecaySamples = index - peakIndex;
      break;
    }
  }
  return { peak, peakIndex, riseSamples, quarterDecaySamples };
}

/** Pearson correlation at lag 0, plus the lag with the strongest correlation. */
export function crossCorrelation(a, b, maxLag = 0) {
  const length = Math.min(a.length, b.length);
  const left = centred(a.slice(0, length));
  const right = centred(b.slice(0, length));
  const at = (lag) => {
    let numerator = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = 0; index + lag < length; index += 1) {
      numerator += left[index] * right[index + lag];
      leftEnergy += left[index] * left[index];
      rightEnergy += right[index + lag] * right[index + lag];
    }
    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    return denominator === 0 ? 0 : numerator / denominator;
  };
  let best = { lag: 0, correlation: at(0) };
  for (let lag = 1; lag <= maxLag; lag += 1) {
    const correlation = at(lag);
    if (Math.abs(correlation) > Math.abs(best.correlation)) best = { lag, correlation };
  }
  return { atZero: at(0), best };
}

/** Fraction of samples above a threshold — how much of the time something is active. */
export function dutyCycle(series, threshold) {
  if (series.length === 0) return 0;
  return series.filter((value) => Math.abs(value) > threshold).length / series.length;
}

/** A short text rendering, for reports. Never assert on this. */
export function sparkline(series, width = 40) {
  if (series.length === 0) return '';
  const marks = '▁▂▃▄▅▆▇█';
  const step = Math.max(1, Math.floor(series.length / width));
  const sampled = [];
  for (let index = 0; index < series.length; index += step) sampled.push(series[index]);
  const low = Math.min(...sampled);
  const high = Math.max(...sampled);
  const span = high - low;
  return sampled
    .map((value) => marks[span === 0 ? 0 : Math.min(marks.length - 1, Math.floor(((value - low) / span) * marks.length))])
    .join('');
}
