import React, { useState, useMemo } from 'react';
import { COCODataset } from '../types';
import {
  analyzeOverlaps,
  isSelfIntersecting,
  AnnotationBloomFilter,
} from '../lib/cocoTools';
import {
  Scissors,
  CheckCircle2,
  AlertOctagon,
  Hash,
  Split,
  Eye,
  Filter,
  Check,
} from 'lucide-react';

interface COCOToolsPanelProps {
  dataset: COCODataset;
  onUpdateAnnotations?: (validDataset: COCODataset) => void;
}

export const COCOToolsPanel: React.FC<COCOToolsPanelProps> = ({ dataset, onUpdateAnnotations }) => {
  const [activeSubTab, setActiveSubTab] = useState<'overlap' | 'self_intersect' | 'bloom' | 'splitter'>('overlap');

  // Overlap analysis
  const overlapAnalysis = useMemo(() => {
    return analyzeOverlaps(dataset.annotations);
  }, [dataset]);

  // Polygon self-intersection test state
  const [testCoords, setTestCoords] = useState<string>(
    '10.0, 10.0, 90.0, 90.0, 90.0, 10.0, 10.0, 90.0' // Classic bowtie self-intersecting polygon
  );
  const selfIntersectResult = useMemo(() => {
    try {
      const parsed = testCoords.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
      return {
        valid: parsed.length >= 8 && parsed.length % 2 === 0,
        result: isSelfIntersecting(parsed),
        count: parsed.length / 2,
      };
    } catch {
      return { valid: false, result: false, count: 0 };
    }
  }, [testCoords]);

  // Bloom Filter Simulator state
  const [bloomCapacity, setBloomCapacity] = useState<number>(1000);
  const [bloomFpRate, setBloomFpRate] = useState<number>(0.001);
  const [testId, setTestId] = useState<string>('ann_1042');
  const [addedIds, setAddedIds] = useState<string[]>(['ann_1001', 'ann_1002', 'ann_1042', 'drone_099']);

  const bloomFilter = useMemo(() => {
    const bf = new AnnotationBloomFilter(bloomCapacity, bloomFpRate);
    addedIds.forEach((id) => bf.add(id));
    return bf;
  }, [bloomCapacity, bloomFpRate, addedIds]);

  const bloomTestResult = useMemo(() => {
    return bloomFilter.contains(testId);
  }, [bloomFilter, testId]);

  // Resolution Splitter analysis
  const resolutionGroups = useMemo(() => {
    const groups = new Map<string, number>();
    dataset.images.forEach((img) => {
      const resKey = `${img.width}x${img.height}`;
      groups.set(resKey, (groups.get(resKey) || 0) + 1);
    });
    return Array.from(groups.entries()).map(([resolution, count]) => ({
      resolution,
      count,
      percent: (count / (dataset.images.length || 1)) * 100,
    }));
  }, [dataset]);

  const handlePruneInvalid = () => {
    if (!onUpdateAnnotations) return;
    const prunedDataset: COCODataset = {
      ...dataset,
      annotations: overlapAnalysis.validAnnotations,
    };
    onUpdateAnnotations(prunedDataset);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-violet-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">COCO Dataset Tools & Overlap Resolver</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Sweep-line detection for nested bounding boxes, polygon self-intersection validation, and Bloom ID collision remapping.
            </p>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab('overlap')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'overlap' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Overlap & Nesting
            </button>
            <button
              onClick={() => setActiveSubTab('self_intersect')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'self_intersect' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Self-Intersection
            </button>
            <button
              onClick={() => setActiveSubTab('bloom')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'bloom' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bloom Collision Filter
            </button>
            <button
              onClick={() => setActiveSubTab('splitter')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'splitter' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resolution Splitter
            </button>
          </div>
        </div>
      </div>

      {/* Subtab 1: Overlap & Nesting Detection */}
      {activeSubTab === 'overlap' && (
        <div className="space-y-6">
          {/* Overlap Summary Status */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400">Total BBoxes Checked</span>
              <p className="text-2xl font-bold text-white mt-1">{dataset.annotations.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-amber-400">Overlap Groups</span>
              <p className="text-2xl font-bold text-amber-300 mt-1">{overlapAnalysis.overlapGroups.length}</p>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                {overlapAnalysis.overlapInvalid.length} duplicate/redundant
              </span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-rose-400">Nested BBoxes (Bowl of Eggs)</span>
              <p className="text-2xl font-bold text-rose-300 mt-1">{overlapAnalysis.nestedIndices.length}</p>
              <span className="text-[11px] text-slate-500 font-mono mt-1 block">Completely enclosed</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-emerald-400">Clean Valid Set</span>
              <p className="text-2xl font-bold text-emerald-300 mt-1">
                {overlapAnalysis.validAnnotations.length}
              </p>
              <span className="text-[11px] text-emerald-500 font-mono mt-1 block">
                {((overlapAnalysis.validAnnotations.length / (dataset.annotations.length || 1)) * 100).toFixed(1)}% kept
              </span>
            </div>
          </div>

          {/* Overlap Groups & Invalid Annotations Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Coverage Depth Sweep-Line Results</h3>
                <p className="text-xs text-slate-400">
                  Resolves overlapping boxes transitively and keeps the largest-area member per group.
                </p>
              </div>

              {overlapAnalysis.allInvalid.length > 0 && onUpdateAnnotations && (
                <button
                  onClick={handlePruneInvalid}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Prune Invalid Overlaps ({overlapAnalysis.allInvalid.length})</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {overlapAnalysis.overlapGroups.length === 0 && overlapAnalysis.nestedIndices.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-white">No Invalid Overlaps Detected</p>
                  <p className="text-xs mt-1">All bounding boxes satisfy mutual spatial disjointness.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overlapAnalysis.overlapGroups.map((group, gIdx) => (
                    <div key={gIdx} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-amber-300">Overlap Cluster #{gIdx + 1}</span>
                        <span className="font-mono text-slate-400">{group.length} overlapping boxes</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {group.map((idx) => {
                          const ann = dataset.annotations[idx];
                          const isInvalid = overlapAnalysis.overlapInvalid.includes(idx);
                          return (
                            <div
                              key={ann.id}
                              className={`p-2.5 rounded-lg border text-xs ${
                                isInvalid
                                  ? 'bg-red-950/20 border-red-800/40 text-red-300'
                                  : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300 font-medium'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span>ID: #{ann.id}</span>
                                <span className="text-[10px] uppercase font-mono">
                                  {isInvalid ? 'To Drop' : 'Kept (Max Area)'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">
                                Category: {ann.category_name || ann.category_id} | Area: {Math.round(ann.area || 0)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Polygon Self-Intersection Sweep-Line Tester */}
      {activeSubTab === 'self_intersect' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Polygon Sweep-Line Self-Intersection Detector</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tests polygon vertex sequences for self-intersecting segments (e.g. bowtie or figure-8 errors in manual labeling).
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <label className="text-xs font-medium text-slate-300">
              Input Flat Coordinate Array (X1, Y1, X2, Y2, ...):
            </label>
            <input
              type="text"
              value={testCoords}
              onChange={(e) => setTestCoords(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-violet-500"
            />

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-slate-500">Presets:</span>
              <button
                onClick={() => setTestCoords('10.0, 10.0, 90.0, 90.0, 90.0, 10.0, 10.0, 90.0')}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Self-Intersecting Bowtie
              </button>
              <button
                onClick={() => setTestCoords('0.0, 0.0, 3.0, 0.0, 2.0, 1.0, 0.0, 3.0, 3.0, 2.0')}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Figure Eight Fixture
              </button>
              <button
                onClick={() => setTestCoords('10.0, 10.0, 50.0, 10.0, 50.0, 50.0, 10.0, 50.0')}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Valid Convex Quadrilateral
              </button>
            </div>
          </div>

          {/* Result card */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              selfIntersectResult.result
                ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                : 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {selfIntersectResult.result ? (
                <AlertOctagon className="w-5 h-5 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
              <div>
                <span className="font-bold text-sm">
                  {selfIntersectResult.result ? 'Self-Intersection Detected' : 'Clean Simple Polygon'}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selfIntersectResult.count} vertices analyzed using sweep-line segment intersection.
                </p>
              </div>
            </div>

            <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-700">
              is_self_intersecting: {String(selfIntersectResult.result)}
            </span>
          </div>
        </div>
      )}

      {/* Subtab 3: Bloom Filter ID Collision Handler */}
      {activeSubTab === 'bloom' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Bloom Filter Dataset Merging & ID Collision Handler</h3>
            <p className="text-xs text-slate-400 mt-1">
              Uses double-hashing MurmurHash3 to probabilistically check duplicate annotation IDs before merging sub-datasets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Bloom Filter Parameters:</span>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Capacity: {bloomCapacity} keys</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="500"
                  value={bloomCapacity}
                  onChange={(e) => setBloomCapacity(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Target False Positive Rate: {bloomFpRate}</span>
                </div>
                <input
                  type="range"
                  min="0.0001"
                  max="0.05"
                  step="0.0005"
                  value={bloomFpRate}
                  onChange={(e) => setBloomFpRate(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>

              <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-400 space-y-1">
                <div>Bit Array Size (m): {bloomFilter.getMetrics().sizeBits} bits</div>
                <div>Hash Count (k): {bloomFilter.getMetrics().hashFunctions} functions</div>
                <div>Indexed Items: {bloomFilter.getMetrics().itemsCount} entries</div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Query ID Collision:</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testId}
                  onChange={(e) => setTestId(e.target.value)}
                  placeholder="e.g. ann_1042"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
                <button
                  onClick={() => {
                    if (testId && !addedIds.includes(testId)) setAddedIds([...addedIds, testId]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs text-white"
                >
                  Insert ID
                </button>
              </div>

              <div
                className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                  bloomTestResult
                    ? 'bg-amber-950/30 border-amber-800 text-amber-300'
                    : 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                }`}
              >
                <span>Collision: {bloomTestResult ? 'MATCH (Remap ID Required)' : 'UNIQUE (Safe to Insert)'}</span>
                <span className="text-[10px] text-slate-400">P(FP) ~ {bloomFpRate}</span>
              </div>

              <div className="text-xs text-slate-400">
                <span className="font-semibold block mb-1">Currently Inserted IDs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {addedIds.map((id) => (
                    <span key={id} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px]">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 4: Resolution Splitter */}
      {activeSubTab === 'splitter' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Resolution-Based Image Grouping & Slicing</h3>
            <p className="text-xs text-slate-400 mt-1">
              Partitions multi-camera drone or benthic quad imagery into resolution-isolated sub-datasets.
            </p>
          </div>

          <div className="space-y-3">
            {resolutionGroups.map((group) => (
              <div key={group.resolution} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Split className="w-4 h-4 text-violet-400" />
                  <div>
                    <span className="text-sm font-bold font-mono text-white">{group.resolution}</span>
                    <p className="text-xs text-slate-400">{group.count} images in partition</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-32 bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-violet-500 h-full rounded-full" style={{ width: `${group.percent}%` }} />
                  </div>
                  <span className="text-xs font-mono text-slate-300 w-12 text-right">
                    {group.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
