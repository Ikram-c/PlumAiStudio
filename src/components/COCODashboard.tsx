import React, { useState, useMemo } from 'react';
import { COCODataset } from '../types';
import { extractCategorySummary } from '../lib/cocoTools';
import { generateDatasetSummaryPDF } from '../lib/pdfExport';
import {
  BarChart3,
  Download,
  Upload,
  Search,
  ArrowUpDown,
  FileSpreadsheet,
  FileJson,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DashboardResearchSection } from './DashboardResearchSection';

interface COCODashboardProps {
  dataset: COCODataset;
  onUploadDataset: (dataset: COCODataset) => void;
  onNavigateToResearch?: () => void;
}

type SortField = 'category' | 'count' | 'percentage' | 'avgArea' | 'avgAspectRatio' | 'minArea' | 'maxArea';

export const COCODashboard: React.FC<COCODashboardProps> = ({
  dataset,
  onUploadDataset,
  onNavigateToResearch,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeChart, setActiveChart] = useState<'overview' | 'area' | 'aspect_ratio' | 'scatter' | 'per_image'>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [pdfExported, setPdfExported] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const rawSummaries = useMemo(() => extractCategorySummary(dataset), [dataset]);
  const categories = useMemo(() => ['All', ...dataset.categories.map((c) => c.name)], [dataset]);

  // Sort and search summaries
  const summaries = useMemo(() => {
    let result = rawSummaries;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.category.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [rawSummaries, searchQuery, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filter annotations based on category
  const filteredAnnotations = useMemo(() => {
    if (selectedCategory === 'All') return dataset.annotations;
    const cat = dataset.categories.find((c) => c.name === selectedCategory);
    return cat ? dataset.annotations.filter((a) => a.category_id === cat.id) : dataset.annotations;
  }, [dataset, selectedCategory]);

  // Histograms
  const areaBins = useMemo(() => {
    const areas = filteredAnnotations.map((a) => a.area || a.bbox[2] * a.bbox[3]).filter((a) => a > 0);
    if (!areas.length) return [];
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    const numBins = 15;
    const binSize = (max - min) / numBins || 1;
    const bins = Array.from({ length: numBins }, (_, i) => ({
      label: `${Math.round(min + i * binSize).toLocaleString()}`,
      count: 0,
    }));
    areas.forEach((val) => {
      const idx = Math.min(numBins - 1, Math.floor((val - min) / binSize));
      bins[idx].count++;
    });
    return bins;
  }, [filteredAnnotations]);

  const aspectRatioBins = useMemo(() => {
    const ratios = filteredAnnotations
      .map((a) => (a.bbox[3] > 0 ? a.bbox[2] / a.bbox[3] : 0))
      .filter((r) => r > 0);
    if (!ratios.length) return [];
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    const numBins = 12;
    const binSize = (max - min) / numBins || 0.1;
    const bins = Array.from({ length: numBins }, (_, i) => ({
      label: (min + i * binSize).toFixed(2),
      count: 0,
    }));
    ratios.forEach((val) => {
      const idx = Math.min(numBins - 1, Math.floor((val - min) / binSize));
      bins[idx].count++;
    });
    return bins;
  }, [filteredAnnotations]);

  const annotationsPerImage = useMemo(() => {
    const countsMap = new Map<number, number>();
    filteredAnnotations.forEach((a) => {
      countsMap.set(a.image_id, (countsMap.get(a.image_id) || 0) + 1);
    });
    const counts = Array.from(countsMap.values());
    if (!counts.length) return [];
    const maxCount = Math.max(...counts);
    const bins = Array.from({ length: Math.min(10, maxCount) }, (_, i) => ({
      label: `${i + 1}`,
      count: counts.filter((c) => c === i + 1).length,
    }));
    return bins;
  }, [filteredAnnotations]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.images && json.annotations && json.categories) {
          onUploadDataset(json);
        } else {
          setUploadError('Invalid COCO JSON: expected images, annotations, and categories keys.');
        }
      } catch {
        setUploadError('Failed to parse JSON file. Please verify the file is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const exportSummaryCsv = () => {
    const headers = 'category,count,percentage,avg_area,avg_aspect_ratio,min_area,max_area\n';
    const rows = rawSummaries
      .map(
        (s) =>
          `"${s.category}",${s.count},${s.percentage.toFixed(2)},${s.avgArea},${s.avgAspectRatio},${s.minArea},${s.maxArea}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coco_category_summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFullCocoJson = () => {
    const jsonStr = JSON.stringify(dataset, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dataset_coco.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    generateDatasetSummaryPDF({
      dataset,
      summaries: rawSummaries,
      selectedCategory,
      areaBins,
      aspectRatioBins,
      annotationsPerImage,
    });
    setPdfExported(true);
    setTimeout(() => setPdfExported(false), 3000);
  };

  const totalAnnotations = dataset.annotations.length;
  const totalImages = dataset.images.length;
  const totalCategories = dataset.categories.length;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">COCO Annotation Dashboard</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/60">
              Interactive Analytics
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Interactive analytics for bounding box distributions, aspect ratios, and spatial properties.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload JSON</span>
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={exportSummaryCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Summary</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
            title="Download PDF report with dataset statistics and category distribution charts"
          >
            {pdfExported ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PDF Downloaded</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF Report</span>
              </>
            )}
          </button>

          <button
            onClick={exportFullCocoJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Export COCO JSON</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-center justify-between gap-3 bg-rose-950/60 border border-rose-800/70 text-rose-200 px-4 py-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-300 hover:text-white font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400">Total Annotations</span>
          <p className="text-2xl font-bold text-white mt-1">{totalAnnotations}</p>
          <span className="text-[11px] text-violet-400 font-mono mt-1 block">
            {(totalAnnotations / (totalImages || 1)).toFixed(1)} per image avg
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400">Dataset Images</span>
          <p className="text-2xl font-bold text-white mt-1">{totalImages}</p>
          <span className="text-[11px] text-slate-500 font-mono mt-1 block">Full spatial coverage</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400">Active Categories</span>
          <p className="text-2xl font-bold text-white mt-1">{totalCategories}</p>
          <span className="text-[11px] text-emerald-400 font-mono mt-1 block">All registered in schema</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs font-medium text-slate-400">Avg Bounding Box Area</span>
          <p className="text-2xl font-bold text-white mt-1">
            {rawSummaries.length
              ? Math.round(rawSummaries.reduce((acc, s) => acc + s.avgArea * s.count, 0) / (totalAnnotations || 1)).toLocaleString()
              : 0}
            <span className="text-xs font-normal text-slate-400 ml-1">px²</span>
          </p>
          <span className="text-[11px] text-cyan-400 font-mono mt-1 block">Across all classes</span>
        </div>
      </div>

      {/* Main Chart Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveChart('overview')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeChart === 'overview' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Category Counts
            </button>
            <button
              onClick={() => setActiveChart('area')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeChart === 'area' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Area Distribution
            </button>
            <button
              onClick={() => setActiveChart('aspect_ratio')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeChart === 'aspect_ratio' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aspect Ratio
            </button>
            <button
              onClick={() => setActiveChart('scatter')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeChart === 'scatter' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Area vs Aspect Ratio
            </button>
            <button
              onClick={() => setActiveChart('per_image')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeChart === 'per_image' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Per Image
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Category Filter:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart Render Area */}
        <div className="mt-6 min-h-[340px] flex flex-col justify-center">
          {activeChart === 'overview' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Annotation Count by Category
                </span>
                <span className="text-xs text-slate-500">Sorted by frequency</span>
              </div>
              <div className="space-y-3">
                {rawSummaries.map((cat, i) => {
                  const maxCount = rawSummaries[0]?.count || 1;
                  const barWidth = `${Math.max(4, (cat.count / maxCount) * 100)}%`;
                  return (
                    <div key={cat.categoryId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-200">{cat.category}</span>
                        <span className="font-mono text-slate-400">
                          {cat.count} ({cat.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-6 w-full bg-slate-950 rounded-lg overflow-hidden flex items-center p-0.5 border border-slate-800/80">
                        <div
                          style={{ width: barWidth }}
                          className={`h-full rounded-md transition-all duration-500 ${
                            i % 4 === 0
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-500'
                              : i % 4 === 1
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
                              : i % 4 === 2
                              ? 'bg-gradient-to-r from-amber-600 to-orange-500'
                              : 'bg-gradient-to-r from-cyan-600 to-blue-500'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeChart === 'area' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {selectedCategory} - Area Distribution (px²)
                </span>
                <span className="text-xs text-slate-500">{areaBins.length} bins</span>
              </div>
              <div className="h-64 flex items-end gap-2 pt-6">
                {areaBins.map((bin, i) => {
                  const maxBin = Math.max(...areaBins.map((b) => b.count), 1);
                  const heightPct = Math.max(8, (bin.count / maxBin) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-[10px] text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10 pointer-events-none">
                        {bin.count} annotations
                      </div>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-gradient-to-t from-violet-700 to-violet-400 rounded-t-md hover:brightness-125 transition-all"
                      />
                      <span className="text-[10px] text-slate-500 truncate w-full text-center">
                        {bin.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeChart === 'aspect_ratio' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {selectedCategory} - Aspect Ratio Distribution (Width / Height)
                </span>
                <span className="text-xs text-slate-500">&gt; 1.0 is landscape, &lt; 1.0 is portrait</span>
              </div>
              <div className="h-64 flex items-end gap-2 pt-6">
                {aspectRatioBins.map((bin, i) => {
                  const maxBin = Math.max(...aspectRatioBins.map((b) => b.count), 1);
                  const heightPct = Math.max(8, (bin.count / maxBin) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-[10px] text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10 pointer-events-none">
                        {bin.count} annotations
                      </div>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md hover:brightness-125 transition-all"
                      />
                      <span className="text-[10px] text-slate-500 truncate w-full text-center">
                        {bin.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeChart === 'scatter' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {selectedCategory} - Area vs Aspect Ratio Scatter Plot
                </span>
                <span className="text-xs text-slate-500">{filteredAnnotations.length} points plotted</span>
              </div>
              <div className="h-64 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden p-4">
                <svg className="w-full h-full overflow-visible">
                  {filteredAnnotations.map((ann, i) => {
                    const area = ann.area || ann.bbox[2] * ann.bbox[3];
                    const ar = ann.bbox[3] > 0 ? ann.bbox[2] / ann.bbox[3] : 1;
                    const xPct = Math.min(95, Math.max(5, (ar / 4.0) * 100));
                    const maxArea = 800000;
                    const yPct = Math.min(95, Math.max(5, 100 - (area / maxArea) * 100));
                    return (
                      <circle
                        key={ann.id || i}
                        cx={`${xPct}%`}
                        cy={`${yPct}%`}
                        r={4.5}
                        fill="#a78bfa"
                        fillOpacity={0.7}
                        stroke="#7c3aed"
                        strokeWidth={1.5}
                        className="hover:r-6 cursor-pointer transition-all"
                      >
                        <title>{`ID: ${ann.id}\nCategory: ${ann.category_name || ann.category_id}\nArea: ${Math.round(area)}px²\nAR: ${ar.toFixed(2)}`}</title>
                      </circle>
                    );
                  })}
                </svg>
                <div className="absolute bottom-2 right-4 text-[10px] text-slate-500 font-mono">
                  X: Aspect Ratio → | Y: Bounding Box Area ↑
                </div>
              </div>
            </div>
          )}

          {activeChart === 'per_image' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Annotations Frequency per Image
                </span>
                <span className="text-xs text-slate-500">Cluster density histogram</span>
              </div>
              <div className="h-64 flex items-end gap-3 pt-6">
                {annotationsPerImage.map((bin, i) => {
                  const maxBin = Math.max(...annotationsPerImage.map((b) => b.count), 1);
                  const heightPct = Math.max(8, (bin.count / maxBin) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-[10px] text-white px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10 pointer-events-none">
                        {bin.count} images
                      </div>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-gradient-to-t from-cyan-600 to-blue-400 rounded-t-md hover:brightness-125 transition-all"
                      />
                      <span className="text-[10px] text-slate-400 truncate w-full text-center">
                        {bin.label} anns
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google Search Grounded CV Research & Industry News */}
      <DashboardResearchSection
        onOpenFullHub={onNavigateToResearch}
        datasetCategoryCount={dataset.categories.length}
      />

      {/* Category Summary Data Table with Search & Interactive Column Sorting */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-violet-400" />
            <h2 className="text-base font-bold text-white">Category Summary Metrics</h2>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider select-none">
              <tr>
                <th onClick={() => handleSort('category')} className="py-3 px-4 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('count')} className="py-3 px-4 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Count</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('percentage')} className="py-3 px-4 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Share (%)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('avgArea')} className="py-3 px-4 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Avg Area (px²)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('avgAspectRatio')} className="py-3 px-4 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Avg Aspect Ratio</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('minArea')} className="py-3 px-4 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Min Area</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('maxArea')} className="py-3 px-4 cursor-pointer hover:text-white">
                  <div className="flex items-center gap-1">
                    <span>Max Area</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {summaries.map((row) => (
                <tr key={row.categoryId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-white">{row.category}</td>
                  <td className="py-3 px-4 text-violet-300 font-semibold">{row.count}</td>
                  <td className="py-3 px-4">{row.percentage.toFixed(1)}%</td>
                  <td className="py-3 px-4">{row.avgArea.toLocaleString()}</td>
                  <td className="py-3 px-4">{row.avgAspectRatio}</td>
                  <td className="py-3 px-4 text-slate-400">{row.minArea.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-400">{row.maxArea.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
