import React, { useState, useRef, useEffect } from 'react';
import { analyzeImageExposure, analyzeSpatialFrequency } from '../lib/quality';
import { ExposureAnalysis, SpatialFrequencyAnalysis } from '../types';
import { Sparkles, Upload, Activity, Sliders, CheckCircle2 } from 'lucide-react';

export const QualityProfiler: React.FC = () => {
  const [selectedSample, setSelectedSample] = useState<'benthic' | 'overexposed' | 'underexposed' | 'texture'>('benthic');
  const [exposureData, setExposureData] = useState<ExposureAnalysis | null>(null);
  const [frequencyData, setFrequencyData] = useState<SpatialFrequencyAnalysis | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate synthetic test frames
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 320;
    canvas.height = 240;

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;

        if (selectedSample === 'benthic') {
          // Benthic underwater image with greenish/cyan hue and coral features
          const baseGreen = 110 + Math.sin(x * 0.05) * 30 + Math.cos(y * 0.05) * 20;
          const noise = (Math.random() - 0.5) * 25;
          data[idx] = Math.min(255, Math.max(0, 45 + noise)); // Red
          data[idx + 1] = Math.min(255, Math.max(0, baseGreen + noise)); // Green
          data[idx + 2] = Math.min(255, Math.max(0, 140 + noise + y * 0.2)); // Blue
          data[idx + 3] = 255;
        } else if (selectedSample === 'overexposed') {
          const dist = Math.hypot(x - canvas.width / 2, y - canvas.height / 2);
          const flash = Math.max(0, 255 - dist * 1.2);
          data[idx] = Math.min(255, 210 + flash);
          data[idx + 1] = Math.min(255, 215 + flash);
          data[idx + 2] = Math.min(255, 220 + flash);
          data[idx + 3] = 255;
        } else if (selectedSample === 'underexposed') {
          const r = 15 + Math.random() * 12;
          const g = 25 + Math.random() * 15;
          const b = 35 + Math.random() * 20;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else {
          // High frequency coral texture
          const pat = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 80 + 128;
          data[idx] = pat + 20;
          data[idx + 1] = pat;
          data[idx + 2] = pat - 30;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Run algorithms
    const exp = analyzeImageExposure(imgData);
    const freq = analyzeSpatialFrequency(imgData);
    setExposureData(exp);
    setFrequencyData(freq);
  }, [selectedSample]);

  const processImageFile = (file: File) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(img, 0, 0, 320, 240);
      const imgData = ctx.getImageData(0, 0, 320, 240);
      setExposureData(analyzeImageExposure(imgData));
      setFrequencyData(analyzeSpatialFrequency(imgData));
    };
    img.src = URL.createObjectURL(file);
  };

  const handleCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">Image Quality & Frequency Profiler</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800/60">
                Drag & Drop Ready
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Exposure analyzer (ISO/dynamic range/clipping) and 2D spatial frequency energy distribution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setSelectedSample('benthic')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  selectedSample === 'benthic' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Benthic Coral
              </button>
              <button
                onClick={() => setSelectedSample('overexposed')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  selectedSample === 'overexposed' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Overexposed
              </button>
              <button
                onClick={() => setSelectedSample('underexposed')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  selectedSample === 'underexposed' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Deep Abyss
              </button>
              <button
                onClick={() => setSelectedSample('texture')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  selectedSample === 'texture' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                High Texture
              </button>
            </div>

            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 inline-flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image</span>
              <input type="file" accept="image/*" onChange={handleCustomImage} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualizer & Histograms */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Frame Buffer (Drag & Drop Any Image)
            </span>
            {exposureData && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                  exposureData.overallQuality === 'Excellent'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : exposureData.overallQuality === 'Good'
                    ? 'bg-blue-950 text-blue-300 border border-blue-700'
                    : 'bg-amber-950 text-amber-300 border border-amber-700'
                }`}
              >
                Quality: {exposureData.overallQuality}
              </span>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            className={`aspect-[4/3] w-full rounded-xl overflow-hidden border transition-all bg-slate-950 flex items-center justify-center relative ${
              isDraggingOver ? 'border-teal-400 ring-2 ring-teal-500/30' : 'border-slate-800'
            }`}
          >
            <canvas ref={canvasRef} className="w-full h-full object-cover block" />
            {isDraggingOver && (
              <div className="absolute inset-0 bg-teal-950/80 backdrop-blur-sm flex items-center justify-center text-teal-200 text-xs font-medium">
                Drop image here to analyze
              </div>
            )}
          </div>

          {/* Luminance Histogram */}
          {exposureData && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Luminance Histogram (256 bins)</span>
                <span>Peak: {exposureData.histogramPeak}</span>
              </div>
              <div className="h-20 bg-slate-950 rounded-lg p-2 flex items-end gap-[1px] border border-slate-800">
                {exposureData.histogramData
                  .filter((_, idx) => idx % 4 === 0)
                  .map((val, idx) => {
                    const maxCount = Math.max(...exposureData.histogramData, 1);
                    const h = Math.max(2, (val / maxCount) * 100);
                    return (
                      <div
                        key={idx}
                        style={{ height: `${h}%` }}
                        className="flex-1 bg-gradient-to-t from-teal-700 to-teal-400 rounded-t-[1px]"
                      />
                    );
                  })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>0 (Shadows)</span>
                <span>128 (Midtones)</span>
                <span>255 (Highlights)</span>
              </div>
            </div>
          )}
        </div>

        {/* Exposure Diagnostics */}
        {exposureData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Exposure Metrics & Stops</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Mean Luminance</span>
                <span className="font-mono text-white">{exposureData.avgLuminance} / 255</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Tonal Distribution</span>
                <span className="font-mono capitalize text-teal-300">{exposureData.tonalDistribution}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Dynamic Range (99p)</span>
                <span className="font-mono text-white">
                  {exposureData.dynamicRange99p} ({exposureData.rangeUtilizationPercent}%)
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Overexposed Pixels (&ge;240)</span>
                <span className="font-mono text-rose-400">
                  {exposureData.overexposurePercentage}% {exposureData.isOverexposed ? '(Issue)' : ''}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Underexposed Pixels (&le;15)</span>
                <span className="font-mono text-amber-400">
                  {exposureData.underexposurePercentage}% {exposureData.isUnderexposed ? '(Issue)' : ''}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Exposure Compensation:</span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      exposureData.exposureCompensationStops === 0
                        ? 'text-emerald-400'
                        : exposureData.exposureCompensationStops > 0
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {exposureData.exposureCompensationStops > 0 ? '+' : ''}
                    {exposureData.exposureCompensationStops} Stops
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed">
                  {exposureData.recommendations.map((rec, i) => (
                    <p key={i}>• {rec}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spatial Frequency Analysis */}
        {frequencyData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">2D FFT & Spatial Frequency</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Low Frequency Ratio</span>
                  <span className="font-mono text-white">{(frequencyData.lowFreqEnergyRatio * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="bg-teal-500 h-full" style={{ width: `${frequencyData.lowFreqEnergyRatio * 100}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Mid Frequency Ratio</span>
                  <span className="font-mono text-white">{(frequencyData.midFreqEnergyRatio * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: `${frequencyData.midFreqEnergyRatio * 100}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>High Frequency Ratio (Fine Texture / Edges)</span>
                  <span className="font-mono text-white">{(frequencyData.highFreqEnergyRatio * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full" style={{ width: `${frequencyData.highFreqEnergyRatio * 100}%` }} />
                </div>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60 pt-2">
                <span className="text-slate-400">Dominant Gradient Angle</span>
                <span className="font-mono text-indigo-300">{frequencyData.dominantDirection}°</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Frequency Centroid</span>
                <span className="font-mono text-indigo-300">{frequencyData.frequencyCentroid}</span>
              </div>

              {/* Radial Energy Profile mini-chart */}
              <div className="pt-2">
                <span className="text-[11px] text-slate-400 block mb-1">Radial Energy Decay Profile</span>
                <div className="h-16 bg-slate-950 rounded-lg p-2 flex items-end gap-1 border border-slate-800">
                  {frequencyData.radialProfile.map((val, idx) => {
                    const maxVal = Math.max(...frequencyData.radialProfile, 0.001);
                    const h = Math.max(4, (val / maxVal) * 100);
                    return (
                      <div
                        key={idx}
                        style={{ height: `${h}%` }}
                        className="flex-1 bg-indigo-500/80 rounded-t-[1px]"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
