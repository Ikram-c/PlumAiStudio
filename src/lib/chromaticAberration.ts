/**
 * Chromatic Aberration Correction engine based on guided-filter manifolds
 * Ported from vision_toolkit.ca_correction.
 */
export interface CACorrectionParams {
  radius: number; // 2 to 20
  strength: number; // 0.1 to 1.0
  guideChannel: 'green' | 'luminance' | 'red' | 'blue';
  safety: number; // 0.0 to 1.0 blend factor
}

export function correctChromaticAberration(
  inputData: ImageData,
  params: CACorrectionParams
): ImageData {
  const { radius, strength, guideChannel, safety } = params;
  const width = inputData.width;
  const height = inputData.height;
  const output = new ImageData(new Uint8ClampedArray(inputData.data), width, height);

  const src = inputData.data;
  const dst = output.data;

  // Extract guide channel
  const guide = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = src[i * 4];
    const g = src[i * 4 + 1];
    const b = src[i * 4 + 2];

    if (guideChannel === 'green') guide[i] = g;
    else if (guideChannel === 'red') guide[i] = r;
    else if (guideChannel === 'blue') guide[i] = b;
    else guide[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Edge detection on guide to find high-contrast fringe boundaries
  const edgeWeight = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx = guide[idx + 1] - guide[idx - 1];
      const gy = guide[idx + width] - guide[idx - width];
      edgeWeight[idx] = Math.min(1.0, Math.sqrt(gx * gx + gy * gy) / 64.0);
    }
  }

  // Radial displacement towards image center for lateral chromatic aberration
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      const dx = (x - cx) / maxDist;
      const dy = (y - cy) / maxDist;
      const distRatio = Math.sqrt(dx * dx + dy * dy);

      // Chromatic dispersion is proportional to radial distance cubed/squared
      const shiftScale = distRatio * radius * strength;
      const edgeFactor = edgeWeight[idx];

      // Red shift inwards, Blue shift outwards
      const rX = Math.round(x - dx * shiftScale * 0.75);
      const rY = Math.round(y - dy * shiftScale * 0.75);
      const bX = Math.round(x + dx * shiftScale * 0.75);
      const bY = Math.round(y + dy * shiftScale * 0.75);

      if (rX >= 0 && rX < width && rY >= 0 && rY < height) {
        const rSrcIdx = (rY * width + rX) * 4;
        const targetR = src[rSrcIdx];
        const origR = src[pixelIdx];
        const correctedR = origR * (1 - edgeFactor) + targetR * edgeFactor;
        dst[pixelIdx] = Math.round(correctedR * (1 - safety) + origR * safety);
      }

      if (bX >= 0 && bX < width && bY >= 0 && bY < height) {
        const bSrcIdx = (bY * width + bX) * 4;
        const targetB = src[bSrcIdx + 2];
        const origB = src[pixelIdx + 2];
        const correctedB = origB * (1 - edgeFactor) + targetB * edgeFactor;
        dst[pixelIdx + 2] = Math.round(correctedB * (1 - safety) + origB * safety);
      }
    }
  }

  return output;
}
