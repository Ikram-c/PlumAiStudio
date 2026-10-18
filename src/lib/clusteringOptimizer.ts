import { COCODataset, AnchorBoxRec, DetectionOptimizerOutput } from '../types';

/**
 * Geometric clustering and detection optimizer.
 * Ported from vision_toolkit.clustering.detection_optimizer.py and analyzer.py.
 */
export function runDetectionOptimizer(
  dataset: COCODataset,
  numAnchors: number = 5
): DetectionOptimizerOutput {
  const annotations = dataset.annotations;
  if (!annotations.length) {
    return {
      anchorBoxes: [],
      augmentations: ["Add annotations to dataset to compute anchor boxes."],
      classWeights: ["No annotations present."],
      clusters: [],
    };
  }

  // Extract box features
  const boxes = annotations.map((a) => {
    const [x, y, w, h] = a.bbox;
    return {
      w: Math.max(1, w),
      h: Math.max(1, h),
      area: a.area || w * h,
      aspectRatio: h > 0 ? w / h : 1,
      catId: a.category_id,
      catName: a.category_name || `Cat ${a.category_id}`,
    };
  });

  // Simple k-means on width & height
  const k = Math.min(numAnchors, boxes.length);
  // Initialize centroids
  const centroids: { w: number; h: number }[] = [];
  const step = Math.floor(boxes.length / k);
  for (let i = 0; i < k; i++) {
    centroids.push({ w: boxes[i * step].w, h: boxes[i * step].h });
  }

  const clusterAssignments = new Int32Array(boxes.length);

  for (let iter = 0; iter < 10; iter++) {
    // Assign
    for (let i = 0; i < boxes.length; i++) {
      let minDist = Infinity;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        const dw = boxes[i].w - centroids[c].w;
        const dh = boxes[i].h - centroids[c].h;
        const d = dw * dw + dh * dh;
        if (d < minDist) {
          minDist = d;
          bestC = c;
        }
      }
      clusterAssignments[i] = bestC;
    }

    // Update
    const counts = new Uint32Array(k);
    const sumW = new Float64Array(k);
    const sumH = new Float64Array(k);

    for (let i = 0; i < boxes.length; i++) {
      const c = clusterAssignments[i];
      counts[c]++;
      sumW[c] += boxes[i].w;
      sumH[c] += boxes[i].h;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c].w = Math.round(sumW[c] / counts[c]);
        centroids[c].h = Math.round(sumH[c] / counts[c]);
      }
    }
  }

  // Anchor boxes sorted by area descending
  const anchorBoxes: AnchorBoxRec[] = centroids
    .map((c) => ({
      width: Math.round(c.w),
      height: Math.round(c.h),
      area: Math.round(c.w * c.h),
      aspectRatio: Number((c.w / Math.max(1, c.h)).toFixed(2)),
    }))
    .sort((a, b) => b.area - a.area);

  // Cluster stats
  const clusterStats = centroids.map((c, idx) => {
    const clusterBoxes = boxes.filter((_, i) => clusterAssignments[i] === idx);
    const catMap = new Map<string, number>();
    clusterBoxes.forEach((b) => catMap.set(b.catName, (catMap.get(b.catName) || 0) + 1));
    let dominantCat = 'Mixed';
    let maxCatCount = 0;
    catMap.forEach((cnt, name) => {
      if (cnt > maxCatCount) {
        maxCatCount = cnt;
        dominantCat = name;
      }
    });

    return {
      clusterId: idx + 1,
      count: clusterBoxes.length,
      dominantCategory: dominantCat,
      avgWidth: Math.round(c.w),
      avgHeight: Math.round(c.h),
    };
  });

  // Augmentation advice
  const aspectRatios = boxes.map((b) => b.aspectRatio);
  const minAr = Math.min(...aspectRatios);
  const maxAr = Math.max(...aspectRatios);
  const augmentations: string[] = [];

  if (maxAr / Math.max(0.01, minAr) > 4.0) {
    augmentations.push('High aspect-ratio variance detected: apply random scaling and aspect-ratio jitter.');
  }
  augmentations.push('Apply random horizontal and vertical spatial flips with p=0.5 (suitable for quadrat/nadir imagery).');
  augmentations.push('Apply multi-scale mosaic training (320px to 896px) to maintain detection performance across both macro and micro objects.');
  augmentations.push('Recommend random brightness & contrast jitter (±15%) for underwater light falloff resilience.');

  // Class weighting advice
  const catCounts = new Map<string, number>();
  boxes.forEach((b) => catCounts.set(b.catName, (catCounts.get(b.catName) || 0) + 1));
  const countsArr = Array.from(catCounts.values());
  const maxCount = Math.max(...countsArr);
  const minCount = Math.min(...countsArr);

  const classWeights: string[] = [];
  if (maxCount / Math.max(1, minCount) > 3.0) {
    classWeights.push(
      `Class imbalance detected (${maxCount}:${minCount}): apply effective-number of samples weighting or focal loss (gamma=2.0).`
    );
  } else {
    classWeights.push('Class distributions are reasonably balanced: standard Cross-Entropy / Focal Loss default weights suffice.');
  }

  catCounts.forEach((count, name) => {
    if (count < 5) {
      classWeights.push(`Rare class "${name}" (${count} instances): consider oversampling or targeted hard-example mining.`);
    }
  });

  return {
    anchorBoxes,
    augmentations,
    classWeights,
    clusters: clusterStats,
  };
}
