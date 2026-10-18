import { COCODataset, AnchorBoxRec, DetectionOptimizerOutput } from '../types';

/**
 * Calculates Intersection over Union between two box sizes centered at (0, 0).
 */
function boxIoU(w1: number, h1: number, w2: number, h2: number): number {
  const minW = Math.min(w1, w2);
  const minH = Math.min(h1, h2);
  const inter = minW * minH;
  const union = w1 * h1 + w2 * h2 - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Geometric clustering and detection optimizer with K-Means++ initialization.
 * Ported and optimized from vision_toolkit.clustering.detection_optimizer.py.
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
      w: Math.max(2, w),
      h: Math.max(2, h),
      area: a.area || w * h,
      aspectRatio: h > 0 ? w / h : 1,
      catId: a.category_id,
      catName: a.category_name || `Cat ${a.category_id}`,
    };
  });

  const k = Math.min(numAnchors, boxes.length);

  // K-Means++ Initialization
  const centroids: { w: number; h: number }[] = [];
  // 1. Pick first center uniformly at random or median
  const firstIdx = Math.floor(boxes.length / 2);
  centroids.push({ w: boxes[firstIdx].w, h: boxes[firstIdx].h });

  // 2. Pick remaining k-1 centers with probability proportional to D(x)^2
  while (centroids.length < k) {
    const distSq = new Float64Array(boxes.length);
    let sumDistSq = 0;

    for (let i = 0; i < boxes.length; i++) {
      let minDistSq = Infinity;
      for (const c of centroids) {
        const dw = boxes[i].w - c.w;
        const dh = boxes[i].h - c.h;
        const d2 = dw * dw + dh * dh;
        if (d2 < minDistSq) minDistSq = d2;
      }
      distSq[i] = minDistSq;
      sumDistSq += minDistSq;
    }

    // Cumulative probabilistic sampling
    let r = Math.random() * sumDistSq;
    let chosenIdx = 0;
    for (let i = 0; i < boxes.length; i++) {
      r -= distSq[i];
      if (r <= 0) {
        chosenIdx = i;
        break;
      }
    }
    centroids.push({ w: boxes[chosenIdx].w, h: boxes[chosenIdx].h });
  }

  // K-Means Convergence Loop
  const clusterAssignments = new Int32Array(boxes.length);

  for (let iter = 0; iter < 15; iter++) {
    let changed = false;

    // Assignment step (minimize 1 - IoU distance)
    for (let i = 0; i < boxes.length; i++) {
      let maxIoU = -1;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        const iou = boxIoU(boxes[i].w, boxes[i].h, centroids[c].w, centroids[c].h);
        if (iou > maxIoU) {
          maxIoU = iou;
          bestC = c;
        }
      }
      if (clusterAssignments[i] !== bestC) {
        clusterAssignments[i] = bestC;
        changed = true;
      }
    }

    if (!changed && iter > 2) break;

    // Update step: median/mean of cluster members
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

  // Calculate Mean Best Overlap (IoU) of anchors across the dataset
  let totalBestIoU = 0;
  for (const b of boxes) {
    let best = 0;
    for (const a of anchorBoxes) {
      const iou = boxIoU(b.w, b.h, a.width, a.height);
      if (iou > best) best = iou;
    }
    totalBestIoU += best;
  }
  const meanBestIoU = (totalBestIoU / boxes.length) * 100;

  // Augmentation advice
  const aspectRatios = boxes.map((b) => b.aspectRatio);
  const minAr = Math.min(...aspectRatios);
  const maxAr = Math.max(...aspectRatios);
  const augmentations: string[] = [];

  augmentations.push(`Anchor IoU Coverage: ${meanBestIoU.toFixed(1)}% Mean Best Overlap achieved.`);
  if (maxAr / Math.max(0.01, minAr) > 4.0) {
    augmentations.push('High aspect-ratio variance detected: apply random scaling and aspect-ratio jitter (0.8x to 1.33x).');
  }
  augmentations.push('Apply random horizontal and vertical spatial flips with p=0.5 (ideal for nadir & quadrat surveys).');
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
