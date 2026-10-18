import React, { useState, useMemo } from 'react';
import {
  Point2D,
  GJKResult,
} from '../types';
import {
  gjkNesterovAccelerated2D,
  polygonSupport,
  circleSupport,
  boxSupport2D,
  getSelfIntersectingEight,
  getSeparatedShapes,
} from '../lib/gjk';
import { Shapes, RefreshCw, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

export const GeometryVisualizer: React.FC = () => {
  const [activeFixture, setActiveFixture] = useState<'interactive' | 'eight' | 'separated'>('interactive');
  const [seed, setSeed] = useState<number>(101);
  const [useNesterov, setUseNesterov] = useState<boolean>(true);

  // Position of Shape A (Polygon) and Shape B (Circle / Box) in interactive mode
  const [shapeAPos, setShapeAPos] = useState<Point2D>({ x: 120, y: 150 });
  const [shapeBPos, setShapeBPos] = useState<Point2D>({ x: 280, y: 160 });
  const [shapeBType, setShapeBType] = useState<'box' | 'circle'>('box');

  // Compute GJK collision between interactive Shape A and Shape B
  const gjkResult: GJKResult = useMemo(() => {
    // Polygon A: a five-vertex convex pentagon centered at shapeAPos
    const polyA: Point2D[] = [
      { x: shapeAPos.x, y: shapeAPos.y - 45 },
      { x: shapeAPos.x + 42, y: shapeAPos.y - 15 },
      { x: shapeAPos.x + 28, y: shapeAPos.y + 40 },
      { x: shapeAPos.x - 28, y: shapeAPos.y + 40 },
      { x: shapeAPos.x - 42, y: shapeAPos.y - 15 },
    ];
    const supA = polygonSupport(polyA);

    let supB = boxSupport2D(shapeBPos, { x: 40, y: 35 });
    if (shapeBType === 'circle') {
      supB = circleSupport(shapeBPos, 38);
    }

    return gjkNesterovAccelerated2D(supA, supB, {
      useAcceleration: useNesterov,
      maxIterations: 40,
    });
  }, [shapeAPos, shapeBPos, shapeBType, useNesterov]);

  const eightFixture = useMemo(() => getSelfIntersectingEight(), []);
  const separated = useMemo(() => getSeparatedShapes(seed), [seed]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shapes className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">GJK 2D Collision & Distance Engine</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Gilbert-Johnson-Keerthi (GJK) convex collision detection with Nesterov accelerated momentum.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveFixture('interactive')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeFixture === 'interactive' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Interactive Simplex
            </button>
            <button
              onClick={() => setActiveFixture('separated')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeFixture === 'separated' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Separated Shapes
            </button>
            <button
              onClick={() => setActiveFixture('eight')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeFixture === 'eight' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Self-Intersecting Eight
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      {activeFixture === 'interactive' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas Display */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Interactive Minkowski Support Canvas
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Target Hull:</span>
                <button
                  onClick={() => setShapeBType('box')}
                  className={`px-2 py-0.5 rounded text-xs ${
                    shapeBType === 'box' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  2D Box
                </button>
                <button
                  onClick={() => setShapeBType('circle')}
                  className={`px-2 py-0.5 rounded text-xs ${
                    shapeBType === 'circle' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Circle
                </button>
              </div>
            </div>

            <div className="relative w-full h-[360px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
              {/* SVG Canvas for geometric shapes */}
              <svg className="w-full h-full">
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Distance Connector between centroids */}
                <line
                  x1={shapeAPos.x}
                  y1={shapeAPos.y}
                  x2={shapeBPos.x}
                  y2={shapeBPos.y}
                  stroke={gjkResult.intersecting ? '#ef4444' : '#10b981'}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* Shape A: Pentagon */}
                <polygon
                  points={`${shapeAPos.x},${shapeAPos.y - 45} ${shapeAPos.x + 42},${shapeAPos.y - 15} ${
                    shapeAPos.x + 28
                  },${shapeAPos.y + 40} ${shapeAPos.x - 28},${shapeAPos.y + 40} ${shapeAPos.x - 42},${shapeAPos.y - 15}`}
                  fill={gjkResult.intersecting ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.25)'}
                  stroke={gjkResult.intersecting ? '#ef4444' : '#818cf8'}
                  strokeWidth="2.5"
                />
                <circle cx={shapeAPos.x} cy={shapeAPos.y} r="3" fill="#818cf8" />
                <text x={shapeAPos.x} y={shapeAPos.y + 55} fill="#a5b4fc" fontSize="11" textAnchor="middle">
                  Shape A (Convex Poly)
                </text>

                {/* Shape B: Box or Circle */}
                {shapeBType === 'box' ? (
                  <rect
                    x={shapeBPos.x - 40}
                    y={shapeBPos.y - 35}
                    width="80"
                    height="70"
                    rx="4"
                    fill={gjkResult.intersecting ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}
                    stroke={gjkResult.intersecting ? '#ef4444' : '#34d399'}
                    strokeWidth="2.5"
                  />
                ) : (
                  <circle
                    cx={shapeBPos.x}
                    cy={shapeBPos.y}
                    r="38"
                    fill={gjkResult.intersecting ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}
                    stroke={gjkResult.intersecting ? '#ef4444' : '#34d399'}
                    strokeWidth="2.5"
                  />
                )}
                <circle cx={shapeBPos.x} cy={shapeBPos.y} r="3" fill="#34d399" />
                <text x={shapeBPos.x} y={shapeBPos.y + 55} fill="#6ee7b7" fontSize="11" textAnchor="middle">
                  Shape B ({shapeBType.toUpperCase()})
                </text>
              </svg>
            </div>

            {/* Slider controls to move shapes */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="font-medium text-slate-300">Shape A Position (X / Y):</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-slate-500 w-4">X:</span>
                  <input
                    type="range"
                    min="60"
                    max="220"
                    value={shapeAPos.x}
                    onChange={(e) => setShapeAPos((p) => ({ ...p, x: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="w-8 font-mono text-slate-400">{shapeAPos.x}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500 w-4">Y:</span>
                  <input
                    type="range"
                    min="80"
                    max="280"
                    value={shapeAPos.y}
                    onChange={(e) => setShapeAPos((p) => ({ ...p, y: Number(e.target.value) }))}
                    className="flex-1 accent-indigo-500"
                  />
                  <span className="w-8 font-mono text-slate-400">{shapeAPos.y}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="font-medium text-slate-300">Shape B Position (X / Y):</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-slate-500 w-4">X:</span>
                  <input
                    type="range"
                    min="180"
                    max="450"
                    value={shapeBPos.x}
                    onChange={(e) => setShapeBPos((p) => ({ ...p, x: Number(e.target.value) }))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-8 font-mono text-slate-400">{shapeBPos.x}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500 w-4">Y:</span>
                  <input
                    type="range"
                    min="80"
                    max="280"
                    value={shapeBPos.y}
                    onChange={(e) => setShapeBPos((p) => ({ ...p, y: Number(e.target.value) }))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-8 font-mono text-slate-400">{shapeBPos.y}</span>
                </div>
              </div>
            </div>
          </div>

          {/* GJK Telemetry Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Solver Diagnostics</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    gjkResult.intersecting
                      ? 'bg-red-950/80 text-red-300 border border-red-700/60'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                  }`}
                >
                  {gjkResult.intersecting ? 'COLLISION' : 'SEPARATED'}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Intersection Status</span>
                  <span className="font-mono font-semibold text-white">
                    {gjkResult.intersecting ? 'True (Encloses Origin)' : 'False (Disjoint)'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Euclidean Distance</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {gjkResult.distance.toFixed(3)} px
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Solver Iterations</span>
                  <span className="font-mono text-slate-200">{gjkResult.iterations} steps</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Simplex Size</span>
                  <span className="font-mono text-slate-200">{gjkResult.simplex.length} points</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-400">Nesterov Momentum</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useNesterov}
                      onChange={(e) => setUseNesterov(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
              <span className="font-medium text-slate-300 block mb-1">Minkowski Difference (A ⊖ B):</span>
              GJK computes the support mapping along direction vectors. Nesterov acceleration incorporates momentum
              step <code className="text-indigo-400 font-mono">(i+1)/(i+3)</code> to converge in 30% fewer iterations.
            </div>
          </div>
        </div>
      )}

      {/* Fixture: Separated Shapes */}
      {activeFixture === 'separated' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Separated Shapes Fixture</h3>
              <p className="text-xs text-slate-400">
                Ground-truth non-intersecting geometry (Rotated Rectangle, Right Triangle, Regular Hexagon).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">RNG Seed:</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono"
              />
              <button
                onClick={() => setSeed((s) => s + 1)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title="Randomize Seed"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="h-72 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center p-4">
            <svg viewBox="0 0 13 6" className="w-full h-full max-w-2xl">
              {/* Rectangle */}
              <polygon
                points={separated.rectangle.map((p) => `${p.x},${6 - p.y}`).join(' ')}
                fill="rgba(59, 130, 246, 0.4)"
                stroke="#60a5fa"
                strokeWidth="0.06"
              />
              <text x="2.5" y="1.2" fill="#93c5fd" fontSize="0.4" textAnchor="middle">
                Rectangle
              </text>

              {/* Triangle */}
              <polygon
                points={separated.triangle.map((p) => `${p.x},${6 - p.y}`).join(' ')}
                fill="rgba(16, 185, 129, 0.4)"
                stroke="#34d399"
                strokeWidth="0.06"
              />
              <text x="6.5" y="1.2" fill="#a7f3d0" fontSize="0.4" textAnchor="middle">
                Right Triangle
              </text>

              {/* Hexagon */}
              <polygon
                points={separated.hexagon.map((p) => `${p.x},${6 - p.y}`).join(' ')}
                fill="rgba(245, 158, 11, 0.4)"
                stroke="#fbbf24"
                strokeWidth="0.06"
              />
              <text x="10.5" y="1.2" fill="#fde68a" fontSize="0.4" textAnchor="middle">
                Hexagon
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* Fixture: Self-Intersecting Eight */}
      {activeFixture === 'eight' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Self-Intersecting Figure Eight Polygon</h3>
              <p className="text-xs text-slate-400">
                A classic non-simple polygon test fixture where boundary loops cross, violating COCO polygon validity.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 text-xs font-mono">
              Self-Intersection: TRUE
            </span>
          </div>

          <div className="h-72 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center p-4">
            <svg viewBox="-0.5 -0.5 4 4" className="w-64 h-64">
              <polygon
                points={eightFixture.points.map((p) => `${p.x},${3 - p.y}`).join(' ')}
                fill="rgba(239, 68, 68, 0.2)"
                stroke="#f87171"
                strokeWidth="0.05"
              />
              {eightFixture.points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={3 - p.y} r="0.08" fill="#ef4444" />
                  <text x={p.x + 0.12} y={3 - p.y + 0.1} fill="#fca5a5" fontSize="0.2">
                    V{idx + 1} ({p.x}, {p.y})
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
