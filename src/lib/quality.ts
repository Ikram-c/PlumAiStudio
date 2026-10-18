import { ExposureAnalysis, SpatialFrequencyAnalysis } from '../types';

/**
 * Analyzes image exposure from canvas/pixel data.
 * Implements ExposureAnalyzer from vision_toolkit.quality.exposure.
 */
export function analyzeImageExposure(
  imageData: ImageData,
  options: {
    overexposureThreshold?: number;
    underexposureThreshold?: number;
    significantPercentage?: number;
  } = {}
): ExposureAnalysis {
  const {
    overexposureThreshold = 240,
    underexposureThreshold = 15,
    significantPercentage = 2.0,
  } = options;

  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;

  const luminances = new Float32Array(totalPixels);
  const histogram = new Uint32Array(256);
  let overexposed = 0;
  let underexposed = 0;
  let sumLuminance = 0;

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    // Rec. 709 luminance (0.2126 R + 0.7152 G + 0.0722 B) matching exposure.py
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminances[i] = lum;
    sumLuminance += lum;

    const bin = Math.min(255, Math.max(0, Math.round(lum)));
    histogram[bin]++;

    if (lum >= overexposureThreshold) overexposed++;
    if (lum <= underexposureThreshold) underexposed++;
  }

  const avgLuminance = sumLuminance / totalPixels;

  // Standard deviation
  let sumSqDiff = 0;
  for (let i = 0; i < totalPixels; i++) {
    const diff = luminances[i] - avgLuminance;
    sumSqDiff += diff * diff;
  }
  const stdLuminance = Math.sqrt(sumSqDiff / totalPixels);

  // Approximate percentiles
  let cum = 0;
  let p1 = 0;
  let p5 = 0;
  let p50 = 128;
  let p95 = 255;
  let p99 = 255;
  let minLum = 255;
  let maxLum = 0;
  let entropy = 0;
  let peakBin = 0;
  let peakCount = 0;

  let shadowsCount = 0;
  let midtonesCount = 0;
  let highlightsCount = 0;

  for (let bin = 0; bin < 256; bin++) {
    const count = histogram[bin];
    if (count > 0) {
      if (bin < minLum) minLum = bin;
      if (bin > maxLum) maxLum = bin;
      const prob = count / totalPixels;
      entropy -= prob * Math.log2(prob);
    }
    if (count > peakCount) {
      peakCount = count;
      peakBin = bin;
    }

    if (bin < 85) shadowsCount += count;
    else if (bin < 171) midtonesCount += count;
    else highlightsCount += count;

    cum += count;
    const pct = (cum / totalPixels) * 100;
    if (pct >= 1 && p1 === 0) p1 = bin;
    if (pct >= 5 && p5 === 0) p5 = bin;
    if (pct >= 50 && p50 === 128) p50 = bin;
    if (pct >= 95 && p95 === 255) p95 = bin;
    if (pct >= 99 && p99 === 255) p99 = bin;
  }

  const overexposurePercentage = (overexposed / totalPixels) * 100;
  const underexposurePercentage = (underexposed / totalPixels) * 100;
  const isOverexposed = overexposurePercentage > significantPercentage;
  const isUnderexposed = underexposurePercentage > significantPercentage;

  let tonalDistribution: 'shadows-heavy' | 'highlights-heavy' | 'balanced' = 'balanced';
  if (shadowsCount / totalPixels > 0.5) tonalDistribution = 'shadows-heavy';
  else if (highlightsCount / totalPixels > 0.5) tonalDistribution = 'highlights-heavy';

  const dynamicRangeFull = maxLum - minLum;
  const dynamicRange99p = p99 - p1;
  const rangeUtilizationPercent = (dynamicRange99p / 255) * 100;

  // Compensation stops & recommendations matching Python exposure.py
  let compensationStops = 0.0;
  const recommendations: string[] = [];

  if (overexposurePercentage > 10) {
    compensationStops = -2.0;
    recommendations.push('Significantly overexposed: reduce exposure by 2.0 stops.');
  } else if (overexposurePercentage > 5) {
    compensationStops = -1.0;
    recommendations.push('Overexposed: reduce exposure by 1.0 stop.');
  } else if (overexposurePercentage > significantPercentage) {
    compensationStops = -0.5;
    recommendations.push('Slightly overexposed: reduce exposure by 0.5 stops.');
  } else if (underexposurePercentage > 10) {
    compensationStops = 2.0;
    recommendations.push('Significantly underexposed: increase exposure by 2.0 stops.');
  } else if (underexposurePercentage > 5) {
    compensationStops = 1.0;
    recommendations.push('Underexposed: increase exposure by 1.0 stop.');
  } else if (underexposurePercentage > significantPercentage) {
    compensationStops = 0.5;
    recommendations.push('Slightly underexposed: increase exposure by 0.5 stops.');
  } else if (avgLuminance < 85) {
    compensationStops = 0.5;
    recommendations.push('Image appears dark: consider slight exposure lift for deep shadows.');
  } else if (avgLuminance > 170) {
    compensationStops = -0.5;
    recommendations.push('Image appears bright: consider slight exposure decrease to protect highlights.');
  } else {
    recommendations.push('Exposure is well-balanced across highlights and shadows.');
  }

  let overallQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Good';
  if (overexposurePercentage > 10 || underexposurePercentage > 10) overallQuality = 'Poor';
  else if (overexposurePercentage > 5 || underexposurePercentage > 5) overallQuality = 'Fair';
  else if (overexposurePercentage < 1 && underexposurePercentage < 1 && avgLuminance >= 85 && avgLuminance <= 170) {
    overallQuality = 'Excellent';
  }

  return {
    avgLuminance: Number(avgLuminance.toFixed(1)),
    medianLuminance: p50,
    stdLuminance: Number(stdLuminance.toFixed(1)),
    minLuminance: minLum,
    maxLuminance: maxLum,
    luminanceRange: dynamicRangeFull,
    overexposedPixels: overexposed,
    overexposurePercentage: Number(overexposurePercentage.toFixed(2)),
    isOverexposed,
    underexposedPixels: underexposed,
    underexposurePercentage: Number(underexposurePercentage.toFixed(2)),
    isUnderexposed,
    hasExposureIssues: isOverexposed || isUnderexposed,
    shadowsPercentage: Number(((shadowsCount / totalPixels) * 100).toFixed(1)),
    midtonesPercentage: Number(((midtonesCount / totalPixels) * 100).toFixed(1)),
    highlightsPercentage: Number(((highlightsCount / totalPixels) * 100).toFixed(1)),
    histogramCenter: Number(avgLuminance.toFixed(1)),
    histogramEntropy: Number(entropy.toFixed(2)),
    histogramPeak: peakBin,
    tonalDistribution,
    dynamicRangeFull,
    dynamicRange99p,
    dynamicRange95p: p95 - p5,
    rangeUtilizationPercent: Number(rangeUtilizationPercent.toFixed(1)),
    hasGoodDynamicRange: rangeUtilizationPercent > 70.0,
    exposureCompensationStops: compensationStops,
    recommendations,
    overallQuality,
    histogramData: Array.from(histogram),
  };
}

/**
 * Computes spatial frequency energy distribution & 2D power spectrum.
 * Matches vision_toolkit.quality.spatial_frequency.py.
 */
export function analyzeSpatialFrequency(
  imageData: ImageData,
  numAngleBins: number = 36
): SpatialFrequencyAnalysis {
  const width = Math.min(imageData.width, 128);
  const height = Math.min(imageData.height, 128);

  // Compute 2D power spectrum on downscaled sample
  const gray = new Float32Array(width * height);
  const stepX = imageData.width / width;
  const stepY = imageData.height / height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (Math.floor(y * stepY) * imageData.width + Math.floor(x * stepX)) * 4;
      const r = imageData.data[srcIdx];
      const g = imageData.data[srcIdx + 1];
      const b = imageData.data[srcIdx + 2];
      gray[y * width + x] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    }
  }

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.floor(Math.sqrt(cx * cx + cy * cy));
  const radialProfile = new Float32Array(maxRadius);
  const radialCounts = new Uint32Array(maxRadius);

  const angleBins = new Float32Array(numAngleBins);
  let totalEnergy = 0;
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let weightedDistanceSum = 0;
  let sumMag = 0;

  // Discrete spatial gradient approximation of high/mid/low frequencies
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const dx = (gray[y * width + (x + 1)] - gray[y * width + (x - 1)]) * 0.5;
      const dy = (gray[(y + 1) * width + x] - gray[(y - 1) * width + x]) * 0.5;
      const mag = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx); // [-PI, PI]
      const binIdx = Math.min(
        numAngleBins - 1,
        Math.floor(((angle + Math.PI) / (2 * Math.PI)) * numAngleBins)
      );

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const radIdx = Math.min(maxRadius - 1, Math.floor(dist));

      radialProfile[radIdx] += mag;
      radialCounts[radIdx]++;
      angleBins[binIdx] += mag * mag;

      const energy = mag * mag;
      totalEnergy += energy;
      if (dist <= maxRadius * 0.25) lowEnergy += energy;
      else if (dist >= maxRadius * 0.75) highEnergy += energy;
      else midEnergy += energy;

      weightedDistanceSum += mag * dist;
      sumMag += mag;
    }
  }

  // Normalize radial profile
  for (let r = 0; r < maxRadius; r++) {
    if (radialCounts[r] > 0) radialProfile[r] /= radialCounts[r];
  }

  const denom = totalEnergy > 0 ? totalEnergy : 1;
  let maxAngleBin = 0;
  let maxAngleVal = 0;
  for (let b = 0; b < numAngleBins; b++) {
    if (angleBins[b] > maxAngleVal) {
      maxAngleVal = angleBins[b];
      maxAngleBin = b;
    }
  }
  const dominantDirection = ((maxAngleBin / numAngleBins) * 360 - 180);

  return {
    lowFreqEnergyRatio: Number((lowEnergy / denom).toFixed(3)),
    midFreqEnergyRatio: Number((midEnergy / denom).toFixed(3)),
    highFreqEnergyRatio: Number((highEnergy / denom).toFixed(3)),
    directionalEnergy: Array.from(angleBins),
    dominantDirection: Math.round(dominantDirection),
    frequencyCentroid: Number((sumMag > 0 ? weightedDistanceSum / sumMag : 0).toFixed(2)),
    radialProfile: Array.from(radialProfile).slice(0, 32),
  };
}
