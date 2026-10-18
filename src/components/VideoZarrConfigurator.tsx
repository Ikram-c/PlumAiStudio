import React, { useState, useMemo } from 'react';
import {
  generateDefaultVideoZarrConfig,
  formatConfigToYaml,
  calculateStorageEstimation,
  VideoZarrConfig,
} from '../lib/videoZarr';
import { Video, Copy, Download, HardDrive, Cpu, Check, FileCode, Layers } from 'lucide-react';

export const VideoZarrConfigurator: React.FC = () => {
  const [config, setConfig] = useState<VideoZarrConfig>(generateDefaultVideoZarrConfig());
  const [videoDuration, setVideoDuration] = useState<number>(300); // 5 min video
  const [videoFps, setVideoFps] = useState<number>(30);
  const [copied, setCopied] = useState<boolean>(false);

  const estimation = useMemo(() => {
    return calculateStorageEstimation(videoDuration, videoFps, 1920, 1080, config);
  }, [videoDuration, videoFps, config]);

  const yamlOutput = useMemo(() => {
    return formatConfigToYaml(config);
  }, [config]);

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlOutput], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video_zarr_config.yaml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">Video to OME-Zarr Pipeline Configurator</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Cloud-friendly chunking, OME-NGFF v0.4 part splitting, and blosc-zstd bitshuffle compression planner.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy YAML'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download YAML</span>
            </button>
          </div>
        </div>
      </div>

      {/* Storage & Chunking KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400">Sampled Output Frames</span>
          <p className="text-2xl font-bold text-white mt-1">{estimation.extractedFrames.toLocaleString()}</p>
          <span className="text-[11px] text-slate-500 font-mono mt-1 block">
            Every {config.every} frames (stride)
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400">Raw Uncompressed Size</span>
          <p className="text-2xl font-bold text-slate-300 mt-1">{estimation.uncompressedMB.toLocaleString()} MB</p>
          <span className="text-[11px] text-slate-500 font-mono mt-1 block">{estimation.cropDimensions} resolution</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-indigo-400">Est. OME-Zarr Store Size</span>
          <p className="text-2xl font-bold text-indigo-300 mt-1">{estimation.estimatedZarrMB.toLocaleString()} MB</p>
          <span className="text-[11px] text-emerald-400 font-mono mt-1 block">
            ~65% reduction ({config.compressor})
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400">Zarr Store Parts / Chunks</span>
          <p className="text-2xl font-bold text-white mt-1">
            {estimation.numParts} <span className="text-xs font-normal text-slate-400">part(s)</span>
          </p>
          <span className="text-[11px] text-slate-500 font-mono mt-1 block">
            {estimation.chunksCount} chunks ({config.chunkFrames} frames/chunk)
          </span>
        </div>
      </div>

      {/* Config Form & YAML Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Extraction & Chunk Parameters</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Source Video Stride (every Nth frame):</label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.every}
                onChange={(e) => setConfig({ ...config, every: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Color Space:</label>
              <select
                value={config.colourSpace}
                onChange={(e) => setConfig({ ...config, colourSpace: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              >
                <option value="BGR">BGR (Default cv2)</option>
                <option value="RGB">RGB</option>
                <option value="GRAYSCALE">GRAYSCALE (Single Channel)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Zarr Chunk Frames:</label>
              <input
                type="number"
                min="16"
                max="256"
                step="16"
                value={config.chunkFrames}
                onChange={(e) => setConfig({ ...config, chunkFrames: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Compressor Engine:</label>
              <select
                value={config.compressor}
                onChange={(e) => setConfig({ ...config, compressor: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              >
                <option value="blosc-zstd">blosc-zstd (Recommended)</option>
                <option value="blosc-lz4">blosc-lz4</option>
                <option value="zlib">zlib</option>
                <option value="gzip">gzip</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Max Part Size (MB, 0=Single):</label>
              <input
                type="number"
                min="0"
                max="2000"
                step="50"
                value={config.maxFileSizeMb}
                onChange={(e) => setConfig({ ...config, maxFileSizeMb: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Sample Temporal Window (s):</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Offset"
                  value={config.sampleOffsetSeconds || 0}
                  onChange={(e) => setConfig({ ...config, sampleOffsetSeconds: Number(e.target.value) })}
                  className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white font-mono"
                />
                <input
                  type="number"
                  placeholder="Duration"
                  value={config.sampleDurationSeconds || 0}
                  onChange={(e) => setConfig({ ...config, sampleDurationSeconds: Number(e.target.value) })}
                  className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Spatial Crop Region */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2">Spatial Crop Coordinates [x0, y0, x1, y1]:</span>
            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              <input
                type="number"
                placeholder="X0"
                value={config.cropX0 || 0}
                onChange={(e) => setConfig({ ...config, cropX0: Number(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white"
              />
              <input
                type="number"
                placeholder="Y0"
                value={config.cropY0 || 0}
                onChange={(e) => setConfig({ ...config, cropY0: Number(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white"
              />
              <input
                type="number"
                placeholder="X1"
                value={config.cropX1 || 1920}
                onChange={(e) => setConfig({ ...config, cropX1: Number(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white"
              />
              <input
                type="number"
                placeholder="Y1"
                value={config.cropY1 || 1080}
                onChange={(e) => setConfig({ ...config, cropY1: Number(e.target.value) })}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white"
              />
            </div>
          </div>
        </div>

        {/* Live YAML Output */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Generated config.yaml</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">OME-NGFF v0.4 Compatible</span>
            </div>

            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[360px]">
              {yamlOutput}
            </pre>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            CLI Entry Point: <code className="text-violet-300 font-mono">video-zarr config.yaml --mode auto</code>
          </div>
        </div>
      </div>
    </div>
  );
};
