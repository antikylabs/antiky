import sharp from 'sharp';

/** Encoded-luminance drift between two same-sized PNGs. */
export async function measurePixelDrift(firstPath, secondPath) {
  const read = (file) => sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [first, second] = await Promise.all([read(firstPath), read(secondPath)]);
  if (
    first.info.width !== second.info.width
    || first.info.height !== second.info.height
    || first.info.channels !== 3
    || second.info.channels !== 3
  ) throw new Error('Repeatability captures must have equal RGB dimensions.');
  const differences = new Float32Array(first.info.width * first.info.height);
  let total = 0;
  let maximum = 0;
  for (let pixel = 0; pixel < differences.length; pixel += 1) {
    const offset = pixel * 3;
    const luma = (bytes) => (
      bytes[offset] * 0.2126 + bytes[offset + 1] * 0.7152 + bytes[offset + 2] * 0.0722
    ) / 255;
    const difference = Math.abs(luma(first.data) - luma(second.data));
    differences[pixel] = difference;
    total += difference;
    maximum = Math.max(maximum, difference);
  }
  differences.sort();
  return Object.freeze({
    comparedPixels: differences.length,
    meanAbsoluteLuminanceDifference: Number((total / differences.length).toFixed(8)),
    p99AbsoluteLuminanceDifference: Number(
      differences[Math.min(differences.length - 1, Math.floor(differences.length * 0.99))].toFixed(8),
    ),
    maximumAbsoluteLuminanceDifference: Number(maximum.toFixed(8)),
    declaredP99Bound: 0.01,
  });
}

async function readRgbRegion(file, roi) {
  const result = await sharp(file).extract({
    left: roi.x,
    top: roi.y,
    width: roi.width,
    height: roi.height,
  }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (result.info.channels !== 3) throw new Error('Visual evidence must decode to RGB.');
  return result;
}

function encodedLuminance(bytes, pixel) {
  const offset = pixel * 3;
  return (
    bytes[offset] * 0.2126 + bytes[offset + 1] * 0.7152 + bytes[offset + 2] * 0.0722
  ) / 255;
}

function regionComparison(control, treatment) {
  const differences = new Float32Array(control.info.width * control.info.height);
  let controlTotal = 0;
  let treatmentTotal = 0;
  let changed = 0;
  for (let pixel = 0; pixel < differences.length; pixel += 1) {
    const controlLuma = encodedLuminance(control.data, pixel);
    const treatmentLuma = encodedLuminance(treatment.data, pixel);
    const difference = Math.abs(controlLuma - treatmentLuma);
    differences[pixel] = difference;
    controlTotal += controlLuma;
    treatmentTotal += treatmentLuma;
    if (difference > 1 / 255) changed += 1;
  }
  differences.sort();
  const controlMean = controlTotal / differences.length;
  const treatmentMean = treatmentTotal / differences.length;
  return {
    pixels: differences.length,
    controlMeanLuminance: Number(controlMean.toFixed(8)),
    treatmentMeanLuminance: Number(treatmentMean.toFixed(8)),
    controlToTreatmentRatio: Number((controlMean / Math.max(treatmentMean, 1e-8)).toFixed(6)),
    changedPixelFraction: Number((changed / differences.length).toFixed(8)),
    p99AbsoluteLuminanceDifference: Number(
      differences[Math.min(differences.length - 1, Math.floor(differences.length * 0.99))].toFixed(8),
    ),
  };
}

async function registeredCameraDifference(controlPath, treatmentPath, roi) {
  const scale = 0.25;
  const width = Math.max(1, Math.round(roi.width * scale));
  const height = Math.max(1, Math.round(roi.height * scale));
  const read = (file) => sharp(file)
    .extract({ left: roi.x, top: roi.y, width: roi.width, height: roi.height })
    .resize(width, height, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [control, treatment] = await Promise.all([read(controlPath), read(treatmentPath)]);
  let best = { mean: Number.POSITIVE_INFINITY, dx: 0, dy: 0 };
  for (let dy = -12; dy <= 12; dy += 1) {
    for (let dx = -12; dx <= 12; dx += 1) {
      let total = 0;
      let count = 0;
      for (let y = Math.max(0, -dy); y < Math.min(height, height - dy); y += 2) {
        for (let x = Math.max(0, -dx); x < Math.min(width, width - dx); x += 2) {
          total += Math.abs(control.data[y * width + x] - treatment.data[(y + dy) * width + x + dx]);
          count += 1;
        }
      }
      const mean = total / Math.max(count, 1);
      if (mean < best.mean) best = { mean, dx, dy };
    }
  }
  const differences = [];
  for (let y = Math.max(0, -best.dy); y < Math.min(height, height - best.dy); y += 1) {
    for (let x = Math.max(0, -best.dx); x < Math.min(width, width - best.dx); x += 1) {
      differences.push(
        Math.abs(control.data[y * width + x] - treatment.data[(y + best.dy) * width + x + best.dx]) / 255,
      );
    }
  }
  differences.sort((a, b) => a - b);
  return {
    knownWorldDelta: { x: 0.5, y: 0, z: 0 },
    registeredPixelOffset: { x: best.dx / scale, y: best.dy / scale },
    comparedPixels: differences.length,
    p99AbsoluteLuminanceDifference: Number(
      differences[Math.min(differences.length - 1, Math.floor(differences.length * 0.99))].toFixed(8),
    ),
    declaredP99Bound: 0.1,
  };
}

function boundaryGradient(region) {
  const { width, height } = region.info;
  const gradients = [];
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const pixel = y * width + x;
      const value = encodedLuminance(region.data, pixel);
      const gradient = Math.max(
        Math.abs(value - encodedLuminance(region.data, pixel + 1)),
        Math.abs(value - encodedLuminance(region.data, pixel + width)),
      );
      if (gradient > 1 / 1024) gradients.push(gradient);
    }
  }
  gradients.sort((a, b) => a - b);
  const p99 = gradients[Math.min(gradients.length - 1, Math.floor(gradients.length * 0.99))] ?? 0;
  return {
    measuredBoundaryPixels: gradients.length,
    p99LuminanceGradientPerPixel: Number(p99.toFixed(8)),
    minimumFalloffPixelsAtP99: p99 === 0 ? null : Number((1 / p99).toFixed(4)),
    declaredMaximumGradientPerPixel: 0.1,
  };
}

/** Measure one named control pair over its declared region. */
export async function measureControlPair(controlPath, treatmentPath, declaration) {
  if (declaration.kind === 'camera-registration') {
    return registeredCameraDifference(controlPath, treatmentPath, declaration.roi);
  }
  const [control, treatment] = await Promise.all([
    readRgbRegion(controlPath, declaration.roi),
    readRgbRegion(treatmentPath, declaration.roi),
  ]);
  const comparison = regionComparison(control, treatment);
  if (declaration.kind === 'vfx-boundary') {
    return { ...comparison, ...boundaryGradient(treatment), declaredChangedPixelMinimum: 0.0001 };
  }
  if (declaration.kind === 'vignette') {
    const metadata = await sharp(controlPath).metadata();
    const center = {
      x: Math.floor((metadata.width - declaration.roi.width) / 2),
      y: Math.floor((metadata.height - declaration.roi.height) / 2),
      width: declaration.roi.width,
      height: declaration.roi.height,
    };
    const [controlCenter, treatmentCenter] = await Promise.all([
      readRgbRegion(controlPath, center),
      readRgbRegion(treatmentPath, center),
    ]);
    const centerComparison = regionComparison(controlCenter, treatmentCenter);
    const controlCornerToCenter = comparison.controlMeanLuminance
      / Math.max(centerComparison.controlMeanLuminance, 1e-8);
    const treatmentCornerToCenter = comparison.treatmentMeanLuminance
      / Math.max(centerComparison.treatmentMeanLuminance, 1e-8);
    return {
      ...comparison,
      centerRegion: center,
      cornerAttenuation: Number((1 - controlCornerToCenter / treatmentCornerToCenter).toFixed(6)),
      declaredAttenuationRange: [0.1, 0.25],
    };
  }
  return comparison;
}

/** Classify a measured criterion without hiding a failed visual target as an instrument failure. */
export function evaluateControlPair(kind, measurement) {
  if (kind === 'vfx-boundary') {
    return measurement.measuredBoundaryPixels > 0
      && measurement.changedPixelFraction >= measurement.declaredChangedPixelMinimum
      && measurement.p99LuminanceGradientPerPixel <= measurement.declaredMaximumGradientPerPixel
      ? 'pass' : 'fail';
  }
  if (kind === 'camera-registration') {
    return measurement.comparedPixels > 0
      && measurement.p99AbsoluteLuminanceDifference <= measurement.declaredP99Bound
      ? 'pass' : 'fail';
  }
  if (kind === 'translucency') {
    return measurement.changedPixelFraction > 0 && measurement.controlToTreatmentRatio >= 1.4
      ? 'pass' : 'fail';
  }
  if (kind === 'bloom') {
    return measurement.changedPixelFraction > 0 && measurement.controlToTreatmentRatio >= 1.2
      ? 'pass' : 'fail';
  }
  if (kind === 'vignette') {
    const [minimum, maximum] = measurement.declaredAttenuationRange;
    return measurement.cornerAttenuation >= minimum && measurement.cornerAttenuation <= maximum
      ? 'pass' : 'fail';
  }
  if (kind === 'shadow') {
    return measurement.changedPixelFraction > 0 && measurement.controlToTreatmentRatio <= 0.75
      ? 'pass' : 'fail';
  }
  throw new Error(`Unknown control-pair measurement kind "${kind}".`);
}
