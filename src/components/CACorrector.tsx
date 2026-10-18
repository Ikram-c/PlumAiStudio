import React, { useState, useRef, useEffect, useCallback } from 'react';
import { correctChromaticAberration, CACorrectionParams } from '../lib/chromaticAberration';
import { SlidersHorizontal, Layers, SplitSquareVertical, Sparkles, Download } from 'lucide-react';

export const CACorrector: React.FC = () => {
  const [radius, setRadius] = useState<number>(8);
  const [strength, setStrength] = useState<number>(0.8);
  const [guideChannel, setGuideChannel] = useState<'green' | 'luminance' | 'red' | 'blue'>('green');
  const [safety, setSafety] = useState<number>(0.1);
  const [splitPos, setSplitPos] = useState<number>(50); // percentage slider

  // Canvas references
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingSplitRef = useRef<boolean>(false);

  // Cached offscreen buffers so dragging split slider is instant (60fps)
  const cachedOrigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedCorrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize cached offscreen canvases once
  useEffect(() => {
    if (!cachedOrigCanvasRef.current) {
      cachedOrigCanvasRef.current = document.createElement('canvas');
      cachedOrigCanvasRef.current.width = 480;
      cachedOrigCanvasRef.current.height = 320;
    }
    if (!cachedCorrCanvasRef.current) {
      cachedCorrCanvasRef.current = document.createElement('canvas');
      cachedCorrCanvasRef.current.width = 480;
      cachedCorrCanvasRef.current.height = 320;
    }
  }, []);

  // Fast compositing pass (runs instantly on split slider drag)
  const renderComposite = useCallback((splitPercentage: number) => {
    const compCanvas = compositeCanvasRef.current;
    const origCanvas = cachedOrigCanvasRef.current;
    const corrCanvas = cachedCorrCanvasRef.current;
    if (!compCanvas || !origCanvas || !corrCanvas) return;

    const ctx = compCanvas.getContext('2d');
    if (!ctx) return;

    const width = compCanvas.width;
    const height = compCanvas.height;

    // Draw full original
    ctx.drawImage(origCanvas, 0, 0);

    // Clip and draw right half from corrected
    const splitX = (width * splitPercentage) / 100;
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, width - splitX, height);
    ctx.clip();
    ctx.drawImage(corrCanvas, 0, 0);
    ctx.restore();

    // Divider line & handle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, height);
    ctx.stroke();

    // Small split handle circle in middle
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(splitX, height / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, []);

  // Heavy filter computation: ONLY re-runs when filter params change, NOT when splitPos changes!
  useEffect(() => {
    const origCanvas = cachedOrigCanvasRef.current;
    const corrCanvas = cachedCorrCanvasRef.current;
    const compCanvas = compositeCanvasRef.current;
    if (!origCanvas || !corrCanvas || !compCanvas) return;

    const width = 480;
    const height = 320;
    compCanvas.width = width;
    compCanvas.height = height;

    const ctxOrig = origCanvas.getContext('2d');
    const ctxCorr = corrCanvas.getContext('2d');
    if (!ctxOrig || !ctxCorr) return;

    // Generate high-contrast test pattern with intentional lateral chromatic aberration
    const imgData = ctxOrig.createImageData(width, height);
    const data = imgData.data;

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(cx, cy);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const rDist = Math.hypot(dx, dy);

        // Radial test pattern (starburst spoke resolution chart)
        const angle = Math.atan2(dy, dx);
        const spoke = Math.sin(angle * 12) > 0 ? 220 : 35;
        const ring = Math.sin(rDist * 0.15) > 0 ? 220 : 35;
        const baseIntensity = (spoke + ring) / 2;

        // Artificial lateral chromatic aberration
        const aberrationScale = (rDist / maxR) * 6.0;
        const redIntensity = Math.min(
          255,
          Math.max(0, baseIntensity + (Math.sin((angle + 0.08) * 12) > 0 ? 120 : -50) * (aberrationScale / 4))
        );
        const greenIntensity = baseIntensity;
        const blueIntensity = Math.min(
          255,
          Math.max(0, baseIntensity + (Math.sin((angle - 0.08) * 12) > 0 ? 120 : -50) * (aberrationScale / 4))
        );

        data[idx] = redIntensity;
        data[idx + 1] = greenIntensity;
        data[idx + 2] = blueIntensity;
        data[idx + 3] = 255;
      }
    }

    ctxOrig.putImageData(imgData, 0, 0);

    // Compute guided-filter CA correction
    const correctedImgData = correctChromaticAberration(imgData, {
      radius,
      strength,
      guideChannel,
      safety,
    });
    ctxCorr.putImageData(correctedImgData, 0, 0);

    // Fast render
    renderComposite(splitPos);
  }, [radius, strength, guideChannel, safety, renderComposite]);

  // Handle splitPos change without recomputing filter
  useEffect(() => {
    renderComposite(splitPos);
  }, [splitPos, renderComposite]);

  // Pointer drag on canvas directly
  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(98, Math.max(2, Math.round((x / rect.width) * 100)));
    setSplitPos(pct);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">Chromatic Aberration Correction</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                Optimized 60 FPS
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Guided-filter manifold alignment for lateral color fringing suppression on wide-angle & drone lenses.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Guide Channel:</span>
            <select
              value={guideChannel}
              onChange={(e) => setGuideChannel(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="green">Green (Default)</option>
              <option value="luminance">Luminance (Rec.709)</option>
              <option value="red">Red</option>
              <option value="blue">Blue</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Split Comparison Canvas */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Before / After Guided-Filter Split View (Click / Drag on canvas)
            </span>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-rose-400">← Raw Fringing</span>
              <span className="text-emerald-400">Corrected Manifold →</span>
            </div>
          </div>

          <div className="relative w-full aspect-[3/2] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner group">
            <canvas
              ref={compositeCanvasRef}
              onPointerDown={(e) => {
                isDraggingSplitRef.current = true;
                handleCanvasPointer(e);
              }}
              onPointerMove={(e) => {
                if (isDraggingSplitRef.current) handleCanvasPointer(e);
              }}
              onPointerUp={() => {
                isDraggingSplitRef.current = false;
              }}
              className="w-full h-full object-cover block cursor-ew-resize"
            />

            <div className="absolute bottom-3 left-3 bg-slate-950/80 px-2 py-1 rounded text-[11px] font-mono text-rose-300 border border-rose-900/60 pointer-events-none">
              Lateral Dispersion
            </div>
            <div className="absolute bottom-3 right-3 bg-slate-950/80 px-2 py-1 rounded text-[11px] font-mono text-emerald-300 border border-emerald-900/60 pointer-events-none">
              Fringe Suppressed
            </div>
          </div>

          {/* Split Slider */}
          <div className="flex items-center gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
            <SplitSquareVertical className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Split Position:</span>
            <input
              type="range"
              min="2"
              max="98"
              value={splitPos}
              onChange={(e) => setSplitPos(Number(e.target.value))}
              className="flex-1 accent-indigo-500 cursor-pointer"
            />
            <span className="font-mono text-slate-300 w-10 text-right">{splitPos}%</span>
          </div>
        </div>

        {/* Parameter Sliders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Filter Parameters</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Filter Radius</span>
                <span className="font-mono text-indigo-400">{radius} px</span>
              </div>
              <input
                type="range"
                min="2"
                max="24"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Window size for localized guided gradient estimation.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Correction Strength</span>
                <span className="font-mono text-indigo-400">{strength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Magnitude of chromatic aberration shift vectors.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Safety Blend Margin</span>
                <span className="font-mono text-indigo-400">{safety.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.5"
                step="0.02"
                value={safety}
                onChange={(e) => setSafety(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Safety blending prevents edge blur on low-frequency regions.
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <span className="font-semibold text-white block">Pipeline Convention:</span>
              <p>• Green channel acts as geometric anchor manifold.</p>
              <p>• Red & Blue dispersion manifolds are remapped inward/outward.</p>
              <p>• Preserves 100% of underlying texture sharpness.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
