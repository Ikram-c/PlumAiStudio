export interface COCOImage {
  id: number;
  width: number;
  height: number;
  file_name: string;
  license?: number;
  date_captured?: string;
}

export interface COCOCategory {
  id: number;
  name: string;
  supercategory?: string;
}

export interface COCOAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  category_name?: string;
  bbox: [number, number, number, number]; // [x, y, width, height]
  area: number;
  segmentation?: number[][];
  iscrowd?: 0 | 1;
  score?: number;
  [key: string]: any;
}

export interface COCODataset {
  info?: {
    description?: string;
    version?: string;
    year?: number;
    contributor?: string;
    date_created?: string;
  };
  images: COCOImage[];
  annotations: COCOAnnotation[];
  categories: COCOCategory[];
}

export interface CategorySummary {
  category: string;
  categoryId: number;
  count: number;
  percentage: number;
  avgArea: number;
  avgAspectRatio: number;
  minArea: number;
  maxArea: number;
}

export interface OverlapResult {
  overlapGroups: number[][];
  nestedIndices: number[];
  overlapInvalid: number[];
  allInvalid: number[];
  validAnnotations: COCOAnnotation[];
}

export interface ExposureAnalysis {
  avgLuminance: number;
  medianLuminance: number;
  stdLuminance: number;
  minLuminance: number;
  maxLuminance: number;
  luminanceRange: number;
  overexposedPixels: number;
  overexposurePercentage: number;
  isOverexposed: boolean;
  underexposedPixels: number;
  underexposurePercentage: number;
  isUnderexposed: boolean;
  hasExposureIssues: boolean;
  shadowsPercentage: number;
  midtonesPercentage: number;
  highlightsPercentage: number;
  histogramCenter: number;
  histogramEntropy: number;
  histogramPeak: number;
  tonalDistribution: 'shadows-heavy' | 'highlights-heavy' | 'balanced';
  dynamicRangeFull: number;
  dynamicRange99p: number;
  dynamicRange95p: number;
  rangeUtilizationPercent: number;
  hasGoodDynamicRange: boolean;
  exposureCompensationStops: number;
  recommendations: string[];
  overallQuality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  histogramData: number[];
}

export interface SpatialFrequencyAnalysis {
  lowFreqEnergyRatio: number;
  midFreqEnergyRatio: number;
  highFreqEnergyRatio: number;
  directionalEnergy: number[];
  dominantDirection: number;
  frequencyCentroid: number;
  radialProfile: number[];
  magnitudeThumbnail?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface GJKResult {
  intersecting: boolean;
  distance: number;
  iterations: number;
  simplex: Point2D[];
  supportPointA?: Point2D;
  supportPointB?: Point2D;
}

export interface AnchorBoxRec {
  width: number;
  height: number;
  area: number;
  aspectRatio: number;
}

export interface DetectionOptimizerOutput {
  anchorBoxes: AnchorBoxRec[];
  augmentations: string[];
  classWeights: string[];
  clusters: {
    clusterId: number;
    count: number;
    dominantCategory: string;
    avgWidth: number;
    avgHeight: number;
  }[];
}
