import React, { useState, useRef, useEffect, useMemo } from 'react';
import { COCODataset } from '../types';
import { Flame, Sliders, Palette, Info } from 'lucide-react';

interface HeatmapViewerProps {
  dataset: COCODataset;
}

type ColormapName = 'Viridis' | 'Plasma' | 'Inferno' | 'Magma' | 'Hot';

// Precomputed 256-entry Color Lookup Tables for instant pixel mapping
function generateColormapLUT(map: ColormapName): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255.0;
    let r = 0, g = 0, b = 0;

    if (map === 'Viridis') {
      r = Math.round(255 * (t < 0.5 ? 0.27 + t * 0.4 : 0.47 + (t - 0.5) * 1.06));
      g = Math.round(255 * (t < 0.5 ? 0.0 + t * 1.2 : 0.6 + (t - 0.5) * 0.8));
      b = Math.round(255 * (t < 0.5 ? 0.33 + t * 0.6 : 0.63 - (t - 0.5) * 1.2));
    } else if (map === 'Plasma') {
      r = Math.round(255 * Math.sin(t * Math.PI * 0.8 + 0.1) * 0.9 + 25);
      g = Math.round(255 * Math.pow(t, 1.8) * 0.9);
      b = Math.round(255 * (1 - t * 0.8));
    } else if (map === 'Inferno') {
      r = Math.round(255 * Math.min(1, t * 1.6));
      g = Math.round(255 * Math.max(0, (t - 0.3) * 1.4));
      b = Math.round(255 * Math.max(0, 0.4 - Math.abs(t - 0.3) * 1.2));
    } else if (map === 'Hot') {
      r = Math.round(255 * Math.min(1, t * 2.5));
      g = Math.round(255 * Math.max(0, (t - 0.35) * 1.8));
      b = Math.round(255 * Math.max(0, (t - 0.75) * 4));
    } else {
      // Magma
      r = Math.round(255 * (t < 0.5 ? t * 1.6 : 0.8 + (t - 0.5) * 0.4));
      g = Math.round(255 * Math.pow(t, 2.2));
      b = Math.round(255 * (t < 0.5 ? 0.2 + t * 0.8 : 0.6 - (t - 0.5) * 0.8));
    }

    lut[i * 3] = Math.min(255, Math.max(0, r));
    lut[i * 3 + 1] = Math.min(255, Math.max(0, g));
    lut[i * 3 + 2] = Math.min(255, Math.max(0, b));
  }
  return lut;
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({ dataset }) => {
  const [colormap, setColormap] = useState<ColormapName>('Viridis');
  const [sigma, setSigma] = useState<number>(1.0); // 0.5 (low), 1.0 (medium), 2.0 (high)
  const [visibility, setVisibility] = useState<'all' | 'heatmap_only' | 'no_boxes' | 'no_points'>('all');
  const [canvasWidth, setCanvasWidth] = useState<number>(1920);
  const [canvasHeight, setCanvasHeight] = useState<number>(1080);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; density: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Extract all bounding boxes and centers
  const boxes = useMemo(() => {
    return dataset.annotations
      .filter((a) => a.bbox && a.bbox.length === 4)
      .map((a) => {
        const [x, y, w, h] = a.bbox;
        return {
          id: a.id,
          x0: x,
          y0: y,
          x1: x + w,
          y1: y + h,
          cx: x + w / 2,
          cy: y + h / 2,
          w,
          h,
        };
      });
  }, [dataset]);

  // Determine viewport bounds from dataset images or bboxes
  useEffect(() => {
    if (dataset.images.length > 0) {
      const maxW = Math.max(...dataset.images.map((img) => img.width || 1920));
      const maxH = Math.max(...dataset.images.map((img) => img.height || 1080));
      setCanvasWidth(maxW || 1920);
      setCanvasHeight(maxH || 1080);
    }
  }, [dataset]);

  // Memoize LUT for chosen colormap
  const colormapLUT = useMemo(() => generateColormapLUT(colormap), [colormap]);

  // Render heatmap with Separable 1D Gaussian passes (O(2K) vs O(K^2))
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridW = 120;
    const gridH = 80;
    const densityGrid = new Float32Array(gridW * gridH);

    // Populate centers
    boxes.forEach((b) => {
      const gx = Math.min(gridW - 1, Math.max(0, Math.floor((b.cx / canvasWidth) * gridW)));
      const gy = Math.min(gridH - 1, Math.max(0, Math.floor((b.cy / canvasHeight) * gridH)));
      densityGrid[gy * gridW + gx] += 1.0;
    });

    // Compute 1D Gaussian kernel
    const kernelRadius = Math.max(1, Math.ceil(sigma * 4));
    const kernelSize = 2 * kernelRadius + 1;
    const kernel1D = new Float32Array(kernelSize);
    let kernelSum = 0;
    for (let i = -kernelRadius; i <= kernelRadius; i++) {
      const w = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel1D[i + kernelRadius] = w;
      kernelSum += w;
    }
    for (let i = 0; i < kernelSize; i++) {
      kernel1D[i] /= kernelSum;
    }

    // Pass 1: Horizontal 1D Gaussian Blur
    const tempH = new Float32Array(gridW * gridH);
    for (let y = 0; y < gridH; y++) {
      const rowOffset = y * gridW;
      for (let x = 0; x < gridW; x++) {
        let acc = 0;
        for (let k = -kernelRadius; k <= kernelRadius; k++) {
          const nx = Math.min(gridW - 1, Math.max(0, x + k));
          acc += densityGrid[rowOffset + nx] * kernel1D[k + kernelRadius];
        }
        tempH[rowOffset + x] = acc;
      }
    }

    // Pass 2: Vertical 1D Gaussian Blur
    const smoothed = new Float32Array(gridW * gridH);
    let maxDensity = 0;
    for (let y = 0; y < gridH; y++) {
      const rowOffset = y * gridW;
      for (let x = 0; x < gridW; x++) {
        let acc = 0;
        for (let k = -kernelRadius; k <= kernelRadius; k++) {
          const ny = Math.min(gridH - 1, Math.max(0, y + k));
          acc += tempH[ny * gridW + x] * kernel1D[k + kernelRadius];
        }
        smoothed[rowOffset + x] = acc;
        if (acc > maxDensity) maxDensity = acc;
      }
    }

    // Render smoothed density map with 256-LUT lookup
    const imgData = ctx.createImageData(gridW, gridH);
    const denom = maxDensity > 0 ? maxDensity : 1;
    const lut = colormapLUT;

    for (let i = 0; i < gridW * gridH; i++) {
      const normVal = Math.min(255, Math.max(0, Math.round((smoothed[i] / denom) * 255)));
      const lutIdx = normVal * 3;
      const pixelIdx = i * 4;

      imgData.data[pixelIdx] = lut[lutIdx];
      imgData.data[pixelIdx + 1] = lut[lutIdx + 1];
      imgData.data[pixelIdx + 2] = lut[lutIdx + 2];
      // Fade out background where density is near zero
      imgData.data[pixelIdx + 3] = normVal < 6 ? 25 : Math.min(255, Math.round(170 + normVal * 0.33));
    }

    canvas.width = 960;
    canvas.height = 540;

    // Dark canvas background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fast scale-up drawing
    const offscreen = document.createElement('canvas');
    offscreen.width = gridW;
    offscreen.height = gridH;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    }

    // Draw Bounding Boxes if enabled
    const showBoxes = visibility === 'all' || visibility === 'no_points';
    const showPoints = visibility === 'all' || visibility === 'no_boxes';

    const scaleX = canvas.width / canvasWidth;
    const scaleY = canvas.height / canvasHeight;

    if (showBoxes) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      boxes.forEach((b) => {
        ctx.strokeRect(b.x0 * scaleX, b.y0 * scaleY, b.w * scaleX, b.h * scaleY);
      });
    }

    if (showPoints) {
      boxes.forEach((b) => {
        const px = b.cx * scaleX;
        const py = b.cy * scaleY;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Grid coordinates
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < canvas.width; gx += canvas.width / 4) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, canvas.height);
      ctx.stroke();
    }
    for (let gy = 0; gy < canvas.height; gy += canvas.height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }
  }, [boxes, canvasWidth, canvasHeight, colormapLUT, sigma, visibility]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    let nearCount = 0;
    const searchRadiusSq = Math.pow(canvasWidth * 0.08, 2);
    boxes.forEach((b) => {
      const dx = b.cx - x;
      const dy = b.cy - y;
      if (dx * dx + dy * dy < searchRadiusSq) nearCount++;
    });

    setHoverInfo({
      x: Math.round(x),
      y: Math.round(y),
      density: nearCount,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">Bounding Box Density Heatmap</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                Separable 1D Kernel (Fast)
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Continuous 2D spatial density estimation of annotation centers with Gaussian kernel smoothing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Colormap Dropdown */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Palette:</span>
              <select
                value={colormap}
                onChange={(e) => setColormap(e.target.value as ColormapName)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="Viridis">Viridis</option>
                <option value="Plasma">Plasma</option>
                <option value="Inferno">Inferno</option>
                <option value="Magma">Magma</option>
                <option value="Hot">Hot</option>
              </select>
            </div>

            {/* Smoothing Controls */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 px-2 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Smoothing (σ):</span>
              </span>
              <button
                onClick={() => setSigma(0.5)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sigma === 0.5 ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Low (0.5)
              </button>
              <button
                onClick={() => setSigma(1.0)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sigma === 1.0 ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Med (1.0)
              </button>
              <button
                onClick={() => setSigma(2.0)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sigma === 2.0 ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                High (2.0)
              </button>
            </div>
          </div>
        </div>

        {/* Visibility Toggles bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Visibility Layers:</span>
            <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
              <button
                onClick={() => setVisibility('all')}
                className={`px-3 py-1 rounded-md ${
                  visibility === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Show All
              </button>
              <button
                onClick={() => setVisibility('no_boxes')}
                className={`px-3 py-1 rounded-md ${
                  visibility === 'no_boxes' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Hide Boxes Only
              </button>
              <button
                onClick={() => setVisibility('no_points')}
                className={`px-3 py-1 rounded-md ${
                  visibility === 'no_points' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Hide Points Only
              </button>
              <button
                onClick={() => setVisibility('heatmap_only')}
                className={`px-3 py-1 rounded-md ${
                  visibility === 'heatmap_only' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                }`}
              >
                Heatmap Only
              </button>
            </div>
          </div>

          <div className="text-slate-400 font-mono text-[11px]">
            {boxes.length} bounding boxes tracked across {canvasWidth}x{canvasHeight} viewport
          </div>
        </div>
      </div>

      {/* Interactive Heatmap Canvas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center">
        <div className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl">
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
            className="w-full h-full block cursor-crosshair"
          />

          {/* Coordinate Overlay */}
          {hoverInfo && (
            <div className="absolute top-4 left-4 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 pointer-events-none shadow-lg">
              <div>
                X: <span className="text-violet-300">{hoverInfo.x} px</span> | Y:{' '}
                <span className="text-violet-300">{hoverInfo.y} px</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Neighborhood Density: <span className="text-amber-400 font-bold">{hoverInfo.density}</span> instances
              </div>
            </div>
          )}

          {/* Color Scale Legend */}
          <div className="absolute bottom-4 right-4 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 text-[11px] text-slate-300 flex items-center gap-2">
            <span>Low</span>
            <div className="w-28 h-3 rounded bg-gradient-to-r from-indigo-950 via-teal-500 to-yellow-300" />
            <span>High Density</span>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-400 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Move mouse across the canvas to inspect spatial coordinates and localized bounding box cluster density.</span>
        </div>
      </div>
    </div>
  );
};
