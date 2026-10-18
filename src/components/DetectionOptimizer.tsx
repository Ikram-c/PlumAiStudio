import React, { useState, useMemo } from 'react';
import { COCODataset } from '../types';
import { runDetectionOptimizer } from '../lib/clusteringOptimizer';
import { Layers, Crosshair, Sparkles, Scale, FileText, Check } from 'lucide-react';

interface DetectionOptimizerProps {
  dataset: COCODataset;
}

export const DetectionOptimizer: React.FC<DetectionOptimizerProps> = ({ dataset }) => {
  const [numAnchors, setNumAnchors] = useState<number>(5);

  const optimization = useMemo(() => {
    return runDetectionOptimizer(dataset, numAnchors);
  }, [dataset, numAnchors]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">Detection Optimizer & Anchor Recommendations</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              K-means anchor box clustering, autoencoder geometric profiling, and dataset-tailored augmentation recommendations.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">Anchor Boxes:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[3, 5, 7, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumAnchors(n)}
                  className={`px-2.5 py-1 rounded-md ${
                    numAnchors === n ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recommended Anchor Boxes */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Recommended Anchor Boxes (Width x Height)</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Sorted by bbox area</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {optimization.anchorBoxes.map((box, i) => (
              <div
                key={i}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 relative overflow-hidden group hover:border-indigo-500/50 transition-all"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-300">Anchor #{i + 1}</span>
                  <span className="font-mono text-slate-500 text-[11px]">AR: {box.aspectRatio}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-bold font-mono text-white">
                    {box.width} × {box.height}
                  </span>
                  <span className="text-xs text-slate-500">px</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  Area: {box.area.toLocaleString()} px²
                </div>

                {/* Aspect ratio preview mini box */}
                <div className="mt-3 h-10 w-full bg-slate-900 rounded flex items-center justify-center p-1 border border-slate-800">
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(15, (box.width / 500) * 100))}%`,
                      height: `${Math.min(100, Math.max(15, (box.height / 500) * 100))}%`,
                    }}
                    className="border border-indigo-400/80 bg-indigo-500/20 rounded-[2px]"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Cluster Profiling Table */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              K-Means Cluster Profiling & Dominant Classes
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-500 border-b border-slate-800 font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Cluster ID</th>
                    <th className="py-2.5 px-3">Members Count</th>
                    <th className="py-2.5 px-3">Dominant Category</th>
                    <th className="py-2.5 px-3">Centroid W x H</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {optimization.clusters.map((c) => (
                    <tr key={c.clusterId} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-indigo-400">Cluster {c.clusterId}</td>
                      <td className="py-2.5 px-3">{c.count} annotations</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">{c.dominantCategory}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {c.avgWidth} × {c.avgHeight} px
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Training Recommendations Card */}
        <div className="space-y-6">
          {/* Augmentations Advice */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Augmentation Policies</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              {optimization.augmentations.map((aug, i) => (
                <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{aug}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Loss Weighting & Class Imbalance */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Scale className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Loss Weighting Advice</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              {optimization.classWeights.map((weight, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 leading-relaxed">
                  {weight}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
