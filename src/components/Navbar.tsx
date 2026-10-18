import React from 'react';
import {
  BarChart3,
  Flame,
  Shapes,
  Scissors,
  Sparkles,
  SlidersHorizontal,
  Video,
  Layers,
  FileCode,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'heatmap'
  | 'geometry'
  | 'coco-tools'
  | 'quality'
  | 'ca-correction'
  | 'optimizer'
  | 'video-zarr';

interface NavbarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  datasetName: string;
  onSelectDatasetPreset: (preset: 'marine' | 'drone') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  datasetName,
  onSelectDatasetPreset,
}) => {
  const navItems: { id: TabId; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'COCO Stats', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'heatmap', label: 'BBox Heatmap', icon: <Flame className="w-4 h-4" /> },
    { id: 'geometry', label: 'GJK 2D Geometry', icon: <Shapes className="w-4 h-4" /> },
    { id: 'coco-tools', label: 'Overlap & Slicing', icon: <Scissors className="w-4 h-4" /> },
    { id: 'quality', label: 'Image Quality', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'ca-correction', label: 'CA Correction', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'optimizer', label: 'Detection Optimizer', icon: <Layers className="w-4 h-4" /> },
    { id: 'video-zarr', label: 'Video to Zarr', icon: <Video className="w-4 h-4" /> },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/20 text-white font-bold text-xl border border-violet-400/30">
              <span className="font-mono">P</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">Plum Image Tools</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-700/50">
                  v1.2.0 Monorepo
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Computer Vision, COCO Datasets & Spatial Tooling
              </p>
            </div>
          </div>

          {/* Dataset Switcher & Presets */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-500">Active:</span>
              <span className="font-medium text-violet-300 truncate max-w-[160px]">{datasetName}</span>
            </div>
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
              <button
                onClick={() => onSelectDatasetPreset('marine')}
                className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-700/70 transition-colors"
                title="Underwater Benthic Coral Reef Dataset"
              >
                Marine Survey
              </button>
              <button
                onClick={() => onSelectDatasetPreset('drone')}
                className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-700/70 transition-colors"
                title="Offshore Drone Inspection Dataset"
              >
                Drone Aerial
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation bar */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none border-t border-slate-800/60 pt-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
