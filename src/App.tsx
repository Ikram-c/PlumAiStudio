import React, { useState } from 'react';
import { Navbar, TabId } from './components/Navbar';
import { COCODashboard } from './components/COCODashboard';
import { HeatmapViewer } from './components/HeatmapViewer';
import { GeometryVisualizer } from './components/GeometryVisualizer';
import { COCOToolsPanel } from './components/COCOToolsPanel';
import { QualityProfiler } from './components/QualityProfiler';
import { CACorrector } from './components/CACorrector';
import { DetectionOptimizer } from './components/DetectionOptimizer';
import { VideoZarrConfigurator } from './components/VideoZarrConfigurator';
import { AIImageStudio } from './components/AIImageStudio';
import { ResearchHub } from './components/ResearchHub';
import { ShortcutManager } from './components/ShortcutManager';
import { createMarineSurveyDataset, createDroneSurveyDataset } from './lib/cocoTools';
import { COCODataset } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [datasetPreset, setDatasetPreset] = useState<'marine' | 'drone' | 'custom'>('marine');
  const [dataset, setDataset] = useState<COCODataset>(() => createMarineSurveyDataset());
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState<boolean>(false);

  const handleSelectDatasetPreset = (preset: 'marine' | 'drone') => {
    setDatasetPreset(preset);
    if (preset === 'marine') {
      setDataset(createMarineSurveyDataset());
    } else {
      setDataset(createDroneSurveyDataset());
    }
  };

  const handleUploadDataset = (uploadedDataset: COCODataset) => {
    setDatasetPreset('custom');
    setDataset(uploadedDataset);
  };

  const datasetDisplayName =
    datasetPreset === 'marine'
      ? 'Marine Science Survey'
      : datasetPreset === 'drone'
      ? 'Drone Aerial Survey'
      : dataset.info?.description || 'Custom Uploaded COCO';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-violet-600 selection:text-white">
      {/* Top Header & Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasetName={datasetDisplayName}
        onSelectDatasetPreset={handleSelectDatasetPreset}
        onOpenShortcuts={() => setIsShortcutModalOpen(true)}
      />

      {/* Global Keyboard Shortcut Manager & Quick Jump Palette */}
      <ShortcutManager
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectDatasetPreset={handleSelectDatasetPreset}
        isOpen={isShortcutModalOpen}
        setIsOpen={setIsShortcutModalOpen}
      />

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <COCODashboard
            dataset={dataset}
            onUploadDataset={handleUploadDataset}
            onNavigateToResearch={() => setActiveTab('research')}
          />
        )}

        {activeTab === 'research' && <ResearchHub />}

        {activeTab === 'ai-studio' && <AIImageStudio />}

        {activeTab === 'heatmap' && <HeatmapViewer dataset={dataset} />}

        {activeTab === 'geometry' && <GeometryVisualizer />}

        {activeTab === 'coco-tools' && (
          <COCOToolsPanel dataset={dataset} onUpdateAnnotations={setDataset} />
        )}

        {activeTab === 'quality' && <QualityProfiler />}

        {activeTab === 'ca-correction' && <CACorrector />}

        {activeTab === 'optimizer' && <DetectionOptimizer dataset={dataset} />}

        {activeTab === 'video-zarr' && <VideoZarrConfigurator />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Plum Image Tools</span>
            <span>•</span>
            <span>Computer Vision, Geospatial & Dataset Suite</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setIsShortcutModalOpen(true)}
              className="text-slate-400 hover:text-violet-300 transition-colors cursor-pointer"
            >
              Shortcuts: Ctrl+1..0 / Ctrl+K
            </button>
            <span>•</span>
            <span className="text-slate-400">Firebase Auth & Firestore Connected</span>
            <span>•</span>
            <span className="text-emerald-400">Full-Stack Express + Vite</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
