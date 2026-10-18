# Plum Image Tools (Web Monorepo)

A modern React application rewriting the **Plum Image Tools** monorepo (`vision-toolkit`, `video_zarr`, `analyze_image_quality`). Built for marine science imaging pipelines, COCO dataset work, geometric collision verification, image quality assessment, and cloud-friendly video-to-Zarr workflows.

## Features & Modules

### 1. COCO Dataset Analysis & Interactive Dashboard
- **Plotly-inspired interactive analytics** for COCO object detection datasets.
- **Category breakdown**: Frequency distributions, percentages, and area ranking.
- **Histograms**: Bounding box area distribution and aspect ratio (width / height) distributions with configurable bins.
- **Scatter Plot**: Bounding box area versus aspect ratio mapping.
- **Summary Metrics**: Category summary table with counts, percentages, average area, min/max areas, and average aspect ratios.
- **Data Export & Import**: Export category summaries to CSV, or upload custom COCO JSON datasets.

### 2. Bounding Box Density Heatmap Visualizer
- **Continuous 2D spatial density estimation** of bounding box centers using 2D histogram bins with Gaussian kernel smoothing.
- **Smoothing controls**: Low (σ=0.5), Medium (σ=1.0), and High (σ=2.0).
- **Perceptual Colormaps**: Viridis, Plasma, Inferno, Magma, and Hot.
- **Layer Toggles**: Show All, Hide Points & Boxes, Hide Boxes Only, and Hide Points Only.
- **Interactive Inspection**: Real-time crosshair reporting image coordinates and local neighborhood cluster density.

### 3. GJK 2D Collision & Distance Engine
- **Nesterov-Accelerated GJK Algorithm**: Convex collision detection with momentum convergence `(i + 1)/(i + 3)`.
- **Support Functions**: Polygon, 2D Box, Circle, and Ellipse.
- **Interactive Minkowski Support Canvas**: Real-time distance, collision detection, and simplex diagnostics.
- **Ground-Truth Test Fixtures**:
  - *Self-Intersecting Eight*: Non-simple polygon boundary fixture.
  - *Separated Shapes*: Seed-controlled rotated rectangle, right triangle, and regular hexagon.

### 4. COCO Overlap & Nesting Tools
- **Coverage-Depth Sweep-Line Algorithm**: Detects nested and overlapping bounding boxes ("bowl of eggs" scenario).
- **Transitive Overlap Grouping**: Identifies connected clusters of overlapping annotations.
- **Pruning**: Automatically resolves overlapping clusters by retaining the maximum-area annotation.
- **Sweep-Line Self-Intersection Validator**: Detects bowtie and figure-8 invalid polygon coordinates.
- **Bloom Filter ID Collision Handler**: Double-hashing MurmurHash3 simulation for safe dataset merging.
- **Resolution Splitter**: Partitions multi-camera datasets by image resolution.

### 5. Image Quality & Frequency Profiler
- **Exposure Diagnostics**: Rec.709 luminance calculations, dynamic range (1% to 99% percentile range utilization), highlights/shadows clipping detection.
- **Compensation Advice**: Automatic camera exposure compensation stop calculations (e.g. +1.0 or -2.0 stops).
- **2D Spatial Frequency Analysis**: Power spectrum analysis, low/mid/high frequency energy ratios, radial energy decay curve, directional energy distribution, and dominant gradient angle.

### 6. Chromatic Aberration Correction
- **Guided-Filter Manifolds**: Lateral color fringing suppression using the green channel or luminance as a geometric anchor.
- **Interactive Split View**: Real-time before/after slider comparing raw dispersion with corrected manifolds.
- **Adjustable Parameters**: Radius, strength, guide channel (Green, Luminance, Red, Blue), and safety blend margin.

### 7. Detection Optimizer & Anchor Recommendations
- **K-Means Anchor Box Generator**: Suggests optimal aspect ratios and bounding box sizes tailored to dataset distributions.
- **Augmentation Policy Generator**: Recommends spatial flips, scale jitter, and mosaic strategies based on feature variance.
- **Loss Weighting Guidance**: Detects class imbalances and advises effective-sample weights or focal loss parameters.

### 8. Video to OME-Zarr Pipeline Configurator
- **Storage & Chunking Calculator**: Computes uncompressed vs. blosc-zstd compressed storage requirements, chunks count, and multi-part store partitions.
- **Live YAML Generator**: Outputs valid `config.yaml` for `video-zarr` CLI extraction pipelines.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Build production bundle
npm run build
```
