import { COCODataset, COCOAnnotation, OverlapResult, CategorySummary } from '../types';

/**
 * 2D Segment intersection helper for sweep-line self-intersection testing.
 */
function ccw(p1: [number, number], p2: [number, number], p3: [number, number]): number {
  return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
}

function segmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

/**
 * Checks if a flat coordinate array [x1, y1, x2, y2, ...] defines a self-intersecting polygon.
 * Directly implements the self-intersection validation logic from vision_toolkit.coco_tools.
 */
export function isSelfIntersecting(coords: number[]): boolean {
  if (coords.length < 8) return false; // Minimum 4 vertices needed to self-intersect
  const points: [number, number][] = [];
  for (let i = 0; i < coords.length; i += 2) {
    points.push([coords[i], coords[i + 1]]);
  }

  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // Adjacent edge in closed polygon
      const p3 = points[j];
      const p4 = points[(j + 1) % n];

      if (segmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Sweep-line nested and overlapping bounding box detector.
 * Ported from vision_toolkit.coco_tools_overlap.py (find_all_invalid_inds).
 */
export function analyzeOverlaps(annotations: COCOAnnotation[]): OverlapResult {
  const n = annotations.length;
  if (n === 0) {
    return {
      overlapGroups: [],
      nestedIndices: [],
      overlapInvalid: [],
      allInvalid: [],
      validAnnotations: [],
    };
  }

  // Convert COCO bbox [x, y, w, h] to [x0, y0, x1, y1]
  const rects: { id: number; idx: number; x0: number; y0: number; x1: number; y1: number; area: number }[] =
    annotations.map((ann, idx) => {
      const [x, y, w, h] = ann.bbox;
      return {
        id: ann.id,
        idx,
        x0: x,
        y0: y,
        x1: x + w,
        y1: y + h,
        area: ann.area || w * h,
      };
    });

  const nestedIndicesSet = new Set<number>();
  const overlapPairs: [number, number][] = [];

  // Detect exact or partial overlaps & complete containment (nesting)
  for (let i = 0; i < n; i++) {
    const a = rects[i];
    for (let j = i + 1; j < n; j++) {
      const b = rects[j];

      // Check if bounding boxes overlap
      const overlapX = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
      const overlapY = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      const interArea = overlapX * overlapY;

      if (interArea > 0) {
        overlapPairs.push([i, j]);

        // Check if one is strictly nested inside another
        // a inside b
        if (a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1) {
          nestedIndicesSet.add(i);
        }
        // b inside a
        else if (b.x0 >= a.x0 && b.x1 <= a.x1 && b.y0 >= a.y0 && b.y1 <= a.y1) {
          nestedIndicesSet.add(j);
        }
      }
    }
  }

  // Transitive connected component graph for overlap groups
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(x: number, y: number) {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX !== rootY) parent[rootX] = rootY;
  }

  for (const [u, v] of overlapPairs) {
    union(u, v);
  }

  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(i);
  }

  const overlapGroups: number[][] = [];
  const overlapInvalidSet = new Set<number>();

  for (const group of groupMap.values()) {
    if (group.length > 1) {
      overlapGroups.push(group);
      // In vision_toolkit, keep the largest area annotation, flag the rest as invalid
      let maxIdx = group[0];
      let maxArea = rects[group[0]].area;
      for (const idx of group) {
        if (rects[idx].area > maxArea) {
          maxArea = rects[idx].area;
          maxIdx = idx;
        }
      }
      for (const idx of group) {
        if (idx !== maxIdx) {
          overlapInvalidSet.add(idx);
        }
      }
    }
  }

  const nestedIndices = Array.from(nestedIndicesSet).sort((a, b) => a - b);
  const overlapInvalid = Array.from(overlapInvalidSet).sort((a, b) => a - b);
  const allInvalidSet = new Set([...nestedIndices, ...overlapInvalid]);
  const allInvalid = Array.from(allInvalidSet).sort((a, b) => a - b);

  const validAnnotations = annotations.filter((_, idx) => !allInvalidSet.has(idx));

  return {
    overlapGroups,
    nestedIndices,
    overlapInvalid,
    allInvalid,
    validAnnotations,
  };
}

/**
 * 32-bit MurmurHash3 simulation for Bloom filter ID collision remapping.
 */
function murmurHash3(key: string, seed: number = 0): number {
  let h = seed ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

export class AnnotationBloomFilter {
  private size: number;
  private hashCount: number;
  private bitArray: Uint8Array;
  public itemsCount: number = 0;

  constructor(capacity: number = 10000, falsePositiveRate: number = 0.001) {
    this.size = Math.max(64, Math.ceil(-(capacity * Math.log(falsePositiveRate)) / (Math.LN2 ** 2)));
    this.hashCount = Math.max(1, Math.ceil((this.size / capacity) * Math.LN2));
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }

  private getHashes(val: string | number): number[] {
    const str = String(val);
    const h1 = murmurHash3(str, 0);
    const h2 = murmurHash3(str, 1);
    const hashes: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push((h1 + i * h2) % this.size);
    }
    return hashes;
  }

  add(val: string | number): void {
    const hashes = this.getHashes(val);
    for (const h of hashes) {
      const byteIdx = Math.floor(h / 8);
      const bitIdx = h % 8;
      this.bitArray[byteIdx] |= 1 << bitIdx;
    }
    this.itemsCount++;
  }

  contains(val: string | number): boolean {
    const hashes = this.getHashes(val);
    for (const h of hashes) {
      const byteIdx = Math.floor(h / 8);
      const bitIdx = h % 8;
      if ((this.bitArray[byteIdx] & (1 << bitIdx)) === 0) {
        return false;
      }
    }
    return true;
  }

  getMetrics() {
    return {
      sizeBits: this.size,
      hashFunctions: this.hashCount,
      itemsCount: this.itemsCount,
      estimatedFillRatio: this.itemsCount / (this.size / 8),
    };
  }
}

/**
 * Extracts category summary statistics matching vision_toolkit.stats.coco_dashboard.
 */
export function extractCategorySummary(dataset: COCODataset): CategorySummary[] {
  const catMap = new Map<number, string>();
  dataset.categories.forEach((c) => catMap.set(c.id, c.name));

  const statsMap = new Map<number, { count: number; areas: number[]; aspectRatios: number[] }>();

  dataset.annotations.forEach((ann) => {
    if (!statsMap.has(ann.category_id)) {
      statsMap.set(ann.category_id, { count: 0, areas: [], aspectRatios: [] });
    }
    const entry = statsMap.get(ann.category_id)!;
    entry.count++;
    const area = ann.area || (ann.bbox[2] * ann.bbox[3]);
    entry.areas.push(area);
    const ar = ann.bbox[3] > 0 ? ann.bbox[2] / ann.bbox[3] : 1;
    entry.aspectRatios.push(ar);
  });

  const total = dataset.annotations.length || 1;
  const summaries: CategorySummary[] = [];

  dataset.categories.forEach((cat) => {
    const stat = statsMap.get(cat.id) || { count: 0, areas: [], aspectRatios: [] };
    const avgArea = stat.areas.length ? stat.areas.reduce((a, b) => a + b, 0) / stat.areas.length : 0;
    const avgAspectRatio = stat.aspectRatios.length ? stat.aspectRatios.reduce((a, b) => a + b, 0) / stat.aspectRatios.length : 0;
    const minArea = stat.areas.length ? Math.min(...stat.areas) : 0;
    const maxArea = stat.areas.length ? Math.max(...stat.areas) : 0;

    summaries.push({
      category: cat.name,
      categoryId: cat.id,
      count: stat.count,
      percentage: (stat.count / total) * 100,
      avgArea: Math.round(avgArea),
      avgAspectRatio: Number(avgAspectRatio.toFixed(2)),
      minArea: Math.round(minArea),
      maxArea: Math.round(maxArea),
    });
  });

  return summaries.sort((a, b) => b.count - a.count);
}

/**
 * High-fidelity Marine Science Survey sample dataset built to mimic Plum Image Tools test cases.
 */
export function createMarineSurveyDataset(): COCODataset {
  const categories = [
    { id: 1, name: "Benthic Coral", supercategory: "coral_reef" },
    { id: 2, name: "Sea Urchin", supercategory: "echinoderm" },
    { id: 3, name: "Reef Fish", supercategory: "vertebrate" },
    { id: 4, name: "Giant Kelp", supercategory: "algae" },
    { id: 5, name: "Crustacean", supercategory: "arthropod" },
  ];

  const images = [
    { id: 101, width: 1920, height: 1080, file_name: "survey_station_01_frame_0042.png", date_captured: "2026-03-12" },
    { id: 102, width: 1920, height: 1080, file_name: "survey_station_01_frame_0088.png", date_captured: "2026-03-12" },
    { id: 103, width: 3840, height: 2160, file_name: "survey_transect_04_4k_001.png", date_captured: "2026-03-14" },
    { id: 104, width: 1920, height: 1080, file_name: "survey_transect_04_frame_0150.png", date_captured: "2026-03-14" },
    { id: 105, width: 2560, height: 1440, file_name: "benthic_dropcam_quadrat_09.png", date_captured: "2026-03-15" },
  ];

  const annotations: COCOAnnotation[] = [
    // Coral colonies
    { id: 1, image_id: 101, category_id: 1, category_name: "Benthic Coral", bbox: [220, 180, 480, 360], area: 172800 },
    { id: 2, image_id: 101, category_id: 1, category_name: "Benthic Coral", bbox: [750, 400, 340, 290], area: 98600 },
    { id: 3, image_id: 101, category_id: 2, category_name: "Sea Urchin", bbox: [410, 290, 85, 80], area: 6800 }, // Nested inside Coral (1)
    { id: 4, image_id: 101, category_id: 3, category_name: "Reef Fish", bbox: [820, 210, 160, 95], area: 15200 },
    { id: 5, image_id: 101, category_id: 4, category_name: "Giant Kelp", bbox: [120, 50, 240, 920], area: 220800 },
    
    // Station 2
    { id: 6, image_id: 102, category_id: 3, category_name: "Reef Fish", bbox: [300, 310, 180, 110], area: 19800 },
    { id: 7, image_id: 102, category_id: 3, category_name: "Reef Fish", bbox: [360, 340, 190, 115], area: 21850 }, // Overlaps Fish (6)
    { id: 8, image_id: 102, category_id: 5, category_name: "Crustacean", bbox: [1150, 680, 120, 90], area: 10800 },
    { id: 9, image_id: 102, category_id: 1, category_name: "Benthic Coral", bbox: [900, 510, 620, 440], area: 272800 },
    
    // 4K Quadrat
    { id: 10, image_id: 103, category_id: 1, category_name: "Benthic Coral", bbox: [500, 400, 960, 720], area: 691200 },
    { id: 11, image_id: 103, category_id: 2, category_name: "Sea Urchin", bbox: [650, 520, 140, 130], area: 18200 }, // Nested inside (10)
    { id: 12, image_id: 103, category_id: 2, category_name: "Sea Urchin", bbox: [1800, 1200, 190, 180], area: 34200 },
    { id: 13, image_id: 103, category_id: 4, category_name: "Giant Kelp", bbox: [2200, 100, 600, 1800], area: 1080000 },
    { id: 14, image_id: 103, category_id: 5, category_name: "Crustacean", bbox: [1400, 1500, 210, 160], area: 33600 },
    
    // Station 4
    { id: 15, image_id: 104, category_id: 3, category_name: "Reef Fish", bbox: [450, 200, 150, 80], area: 12000 },
    { id: 16, image_id: 104, category_id: 3, category_name: "Reef Fish", bbox: [620, 240, 175, 95], area: 16625 },
    { id: 17, image_id: 104, category_id: 3, category_name: "Reef Fish", bbox: [780, 190, 140, 75], area: 10500 },
    { id: 18, image_id: 104, category_id: 2, category_name: "Sea Urchin", bbox: [920, 810, 95, 90], area: 8550 },
    { id: 19, image_id: 104, category_id: 1, category_name: "Benthic Coral", bbox: [300, 600, 520, 380], area: 197600 },
    
    // Dropcam 09
    { id: 20, image_id: 105, category_id: 4, category_name: "Giant Kelp", bbox: [400, 100, 320, 1200], area: 384000 },
    { id: 21, image_id: 105, category_id: 1, category_name: "Benthic Coral", bbox: [1200, 300, 680, 540], area: 367200 },
    { id: 22, image_id: 105, category_id: 5, category_name: "Crustacean", bbox: [1420, 480, 130, 110], area: 14300 }, // Nested inside Coral (21)
    { id: 23, image_id: 105, category_id: 2, category_name: "Sea Urchin", bbox: [850, 920, 110, 105], area: 11550 },
  ];

  return {
    info: {
      description: "Plum Marine Science Survey - Underwater Benthic Quadrat Dataset",
      version: "1.2.0",
      year: 2026,
      contributor: "Plum Vision Marine Ecology Lab",
      date_created: "2026-03-15",
    },
    images,
    annotations,
    categories,
  };
}

/**
 * Drone Aerial Survey dataset with multi-scale targets.
 */
export function createDroneSurveyDataset(): COCODataset {
  const categories = [
    { id: 1, name: "Turbine Base", supercategory: "infrastructure" },
    { id: 2, name: "Service Vessel", supercategory: "maritime" },
    { id: 3, name: "Buoy Marker", supercategory: "navigation" },
    { id: 4, name: "Marine Wildlife", supercategory: "fauna" },
  ];

  const images = [
    { id: 201, width: 3840, height: 2160, file_name: "offshore_wind_turbine_cluster_01.jpg" },
    { id: 202, width: 3840, height: 2160, file_name: "coastal_transit_vessel_track_02.jpg" },
  ];

  const annotations: COCOAnnotation[] = [
    { id: 1, image_id: 201, category_id: 1, category_name: "Turbine Base", bbox: [800, 600, 450, 450], area: 202500 },
    { id: 2, image_id: 201, category_id: 1, category_name: "Turbine Base", bbox: [2100, 750, 420, 420], area: 176400 },
    { id: 3, image_id: 201, category_id: 2, category_name: "Service Vessel", bbox: [950, 720, 160, 90], area: 14400 },
    { id: 4, image_id: 201, category_id: 3, category_name: "Buoy Marker", bbox: [1600, 1100, 45, 45], area: 2025 },
    { id: 5, image_id: 202, category_id: 2, category_name: "Service Vessel", bbox: [1400, 900, 320, 140], area: 44800 },
    { id: 6, image_id: 202, category_id: 4, category_name: "Marine Wildlife", bbox: [1800, 1200, 110, 60], area: 6600 },
    { id: 7, image_id: 202, category_id: 4, category_name: "Marine Wildlife", bbox: [1840, 1210, 95, 55], area: 5225 }, // Overlapping wildlife
  ];

  return {
    info: {
      description: "Plum Drone Aerial Offshore Inspection Dataset",
      version: "2.0.0",
      year: 2026,
    },
    images,
    annotations,
    categories,
  };
}
