export interface VideoZarrConfig {
  videoPaths: string;
  framesDir: string;
  colourSpace: 'GRAYSCALE' | 'BGR' | 'RGB';
  normEnabled: boolean;
  pmin: number;
  pmax: number;
  every: number;
  chunkSize: number;
  sampleOffsetSeconds?: number;
  sampleDurationSeconds?: number;
  cropX0?: number;
  cropY0?: number;
  cropX1?: number;
  cropY1?: number;
  zarrStorePath: string;
  chunkFrames: number;
  compressor: 'blosc-zstd' | 'blosc-lz4' | 'zlib' | 'gzip';
  maxFileSizeMb: number;
  zipStore: boolean;
}

export function generateDefaultVideoZarrConfig(): VideoZarrConfig {
  return {
    videoPaths: './survey_videos',
    framesDir: './frames',
    colourSpace: 'BGR',
    normEnabled: true,
    pmin: 1.0,
    pmax: 99.8,
    every: 5,
    chunkSize: 1000,
    sampleOffsetSeconds: 30.0,
    sampleDurationSeconds: 120.0,
    cropX0: 0,
    cropY0: 100,
    cropX1: 1920,
    cropY1: 980,
    zarrStorePath: './zarr_out',
    chunkFrames: 64,
    compressor: 'blosc-zstd',
    maxFileSizeMb: 500,
    zipStore: false,
  };
}

export function formatConfigToYaml(config: VideoZarrConfig): string {
  let yaml = `# Plum Video-to-OME-Zarr Pipeline Configuration
video_paths: ${config.videoPaths}
frames_dir: ${config.framesDir}
colour_space: ${config.colourSpace}
norm:
  enabled: ${config.normEnabled}
  pmin: ${config.pmin}
  pmax: ${config.pmax}
every: ${config.every}
chunk_size: ${config.chunkSize}

sample:
  offset_seconds: ${config.sampleOffsetSeconds || 0}
  duration_seconds: ${config.sampleDurationSeconds || 0}

crop:
  x0: ${config.cropX0 || 0}
  y0: ${config.cropY0 || 0}
  x1: ${config.cropX1 || 1920}
  y1: ${config.cropY1 || 1080}

zarr:
  store_path: ${config.zarrStorePath}
  chunk_frames: ${config.chunkFrames}
  compressor: ${config.compressor}
  max_file_size_mb: ${config.maxFileSizeMb}
  zip_store: ${config.zipStore}
`;
  return yaml;
}

export function calculateStorageEstimation(
  videoDurationSec: number,
  fps: number,
  width: number,
  height: number,
  config: VideoZarrConfig
) {
  const sampledSec = config.sampleDurationSeconds && config.sampleDurationSeconds > 0
    ? Math.min(videoDurationSec, config.sampleDurationSeconds)
    : videoDurationSec;

  const totalRawFrames = Math.floor(sampledSec * fps);
  const extractedFrames = Math.ceil(totalRawFrames / Math.max(1, config.every));
  
  const cropW = (config.cropX1 && config.cropX0) ? (config.cropX1 - config.cropX0) : width;
  const cropH = (config.cropY1 && config.cropY0) ? (config.cropY1 - config.cropY0) : height;
  const channels = config.colourSpace === 'GRAYSCALE' ? 1 : 3;

  const bytesPerFrame = cropW * cropH * channels;
  const uncompressedBytes = extractedFrames * bytesPerFrame;
  const uncompressedMB = uncompressedBytes / (1024 * 1024);

  // Estimation based on blosc-zstd L3 compression ratio ~ 2.5x to 3.5x for natural video
  const estimatedRatio = 0.35;
  const estimatedZarrMB = uncompressedMB * estimatedRatio;

  const numParts = config.maxFileSizeMb > 0
    ? Math.max(1, Math.ceil(estimatedZarrMB / config.maxFileSizeMb))
    : 1;

  const chunksCount = Math.ceil(extractedFrames / config.chunkFrames);

  return {
    totalRawFrames,
    extractedFrames,
    cropDimensions: `${cropW} x ${cropH}`,
    uncompressedMB: Math.round(uncompressedMB),
    estimatedZarrMB: Math.round(estimatedZarrMB),
    numParts,
    chunksCount,
  };
}
