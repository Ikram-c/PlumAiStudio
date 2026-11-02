import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TabId } from './Navbar';
import {
  Keyboard,
  X,
  Search,
  CornerDownLeft,
  ArrowLeft,
  ArrowRight,
  Database,
  Command,
  CheckCircle2,
  BarChart3,
  BookOpen,
  Wand2,
  Flame,
  Shapes,
  Scissors,
  Sparkles,
  SlidersHorizontal,
  Layers,
  Video,
} from 'lucide-react';

export interface ShortcutDefinition {
  id: string;
  keys: string[];
  altKeys?: string[];
  label: string;
  description: string;
  category: 'Navigation' | 'Workflow' | 'Dataset';
  tabId?: TabId;
  action: () => void;
  icon?: React.ReactNode;
}

interface ShortcutManagerProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onSelectDatasetPreset: (preset: 'marine' | 'drone') => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const TAB_SHORTCUT_METADATA: {
  id: TabId;
  keyNum: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'dashboard',
    keyNum: '1',
    label: 'COCO Stats Dashboard',
    description: 'Dataset overview, category histograms, scatter plots, and search-grounded research',
    icon: <BarChart3 className="w-4 h-4 text-violet-400" />,
  },
  {
    id: 'research',
    keyNum: '2',
    label: 'Research & News',
    description: 'Google Search grounded computer vision papers, benchmarks, and industry news',
    icon: <BookOpen className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'ai-studio',
    keyNum: '3',
    label: 'AI Image Studio',
    description: 'Prompt-based synthetic survey frame generation and lens/exposure editing',
    icon: <Wand2 className="w-4 h-4 text-purple-400" />,
  },
  {
    id: 'heatmap',
    keyNum: '4',
    label: 'BBox Heatmap',
    description: '2D spatial bounding box center density heatmap with Gaussian smoothing',
    icon: <Flame className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'geometry',
    keyNum: '5',
    label: 'GJK 2D Geometry',
    description: 'Nesterov-accelerated 2D Gilbert-Johnson-Keerthi collision & distance solver',
    icon: <Shapes className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'coco-tools',
    keyNum: '6',
    label: 'Overlap & Slicing',
    description: 'Bentley-Ottmann sweep-line overlap, nested bbox detection, and Bloom filter',
    icon: <Scissors className="w-4 h-4 text-rose-400" />,
  },
  {
    id: 'quality',
    keyNum: '7',
    label: 'Image Quality',
    description: 'Luminance histogram exposure analysis and FFT/Sobel spatial frequency profiling',
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'ca-correction',
    keyNum: '8',
    label: 'CA Correction',
    description: 'Lateral chromatic aberration defringing via guided-filter manifolds',
    icon: <SlidersHorizontal className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'optimizer',
    keyNum: '9',
    label: 'Detection Optimizer',
    description: 'K-means anchor box clustering, augmentation policies, and class weights',
    icon: <Layers className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'video-zarr',
    keyNum: '0',
    label: 'Video to Zarr',
    description: 'OME-Zarr NGFF chunked frame extraction and cloud storage estimator',
    icon: <Video className="w-4 h-4 text-fuchsia-400" />,
  },
];

export const ShortcutManager: React.FC<ShortcutManagerProps> = ({
  activeTab,
  setActiveTab,
  onSelectDatasetPreset,
  isOpen,
  setIsOpen,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [shortcutsEnabled, setShortcutsEnabled] = useState<boolean>(true);
  const [lastTriggeredToast, setLastTriggeredToast] = useState<{
    combo: string;
    label: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const triggerFeedback = (combo: string, label: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setLastTriggeredToast({ combo, label });
    toastTimeoutRef.current = window.setTimeout(() => {
      setLastTriggeredToast(null);
    }, 2200);
  };

  const tabOrder = useMemo(() => TAB_SHORTCUT_METADATA.map((t) => t.id), []);

  const cycleTab = (direction: -1 | 1, comboLabel: string) => {
    const idx = tabOrder.indexOf(activeTab);
    const nextIdx = (idx + direction + tabOrder.length) % tabOrder.length;
    const nextTab = TAB_SHORTCUT_METADATA[nextIdx];
    setActiveTab(nextTab.id);
    triggerFeedback(comboLabel, nextTab.label);
  };

  const shortcuts: ShortcutDefinition[] = useMemo(() => {
    const navShortcuts: ShortcutDefinition[] = TAB_SHORTCUT_METADATA.map((meta) => ({
      id: `nav-${meta.id}`,
      keys: ['Ctrl', meta.keyNum],
      altKeys: ['Alt', meta.keyNum],
      label: `Go to ${meta.label}`,
      description: meta.description,
      category: 'Navigation',
      tabId: meta.id,
      icon: meta.icon,
      action: () => {
        setActiveTab(meta.id);
        triggerFeedback(`Ctrl+${meta.keyNum}`, meta.label);
      },
    }));

    const workflowShortcuts: ShortcutDefinition[] = [
      {
        id: 'cycle-prev',
        keys: ['Ctrl', '['],
        altKeys: ['Alt', '←'],
        label: 'Previous Tab',
        description: 'Cycle backward to the previous tool in the workspace',
        category: 'Workflow',
        icon: <ArrowLeft className="w-4 h-4 text-slate-400" />,
        action: () => cycleTab(-1, 'Ctrl+['),
      },
      {
        id: 'cycle-next',
        keys: ['Ctrl', ']'],
        altKeys: ['Alt', '→'],
        label: 'Next Tab',
        description: 'Cycle forward to the next tool in the workspace',
        category: 'Workflow',
        icon: <ArrowRight className="w-4 h-4 text-slate-400" />,
        action: () => cycleTab(1, 'Ctrl+]'),
      },
      {
        id: 'open-palette',
        keys: ['Ctrl', 'K'],
        altKeys: ['?'],
        label: 'Toggle Shortcut Manager & Quick Jump',
        description: 'Open or close this keyboard shortcut reference and command palette',
        category: 'Workflow',
        icon: <Command className="w-4 h-4 text-violet-400" />,
        action: () => setIsOpen((prev) => !prev),
      },
      {
        id: 'preset-marine',
        keys: ['Ctrl', 'Shift', 'M'],
        label: 'Load Marine Science Dataset Preset',
        description: 'Switch active COCO dataset to Underwater Benthic Coral Reef survey',
        category: 'Dataset',
        icon: <Database className="w-4 h-4 text-cyan-400" />,
        action: () => {
          onSelectDatasetPreset('marine');
          triggerFeedback('Ctrl+Shift+M', 'Marine Science Dataset');
        },
      },
      {
        id: 'preset-drone',
        keys: ['Ctrl', 'Shift', 'D'],
        label: 'Load Drone Aerial Dataset Preset',
        description: 'Switch active COCO dataset to Offshore Drone Inspection survey',
        category: 'Dataset',
        icon: <Database className="w-4 h-4 text-amber-400" />,
        action: () => {
          onSelectDatasetPreset('drone');
          triggerFeedback('Ctrl+Shift+D', 'Drone Aerial Dataset');
        },
      },
    ];

    return [...navShortcuts, ...workflowShortcuts];
  }, [activeTab, setActiveTab, onSelectDatasetPreset, setIsOpen, tabOrder]);

  const filteredShortcuts = useMemo(() => {
    if (!filterQuery.trim()) return shortcuts;
    const q = filterQuery.toLowerCase();
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keys.join('+').toLowerCase().includes(q)
    );
  }, [shortcuts, filterQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterQuery, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 30);
    } else {
      setFilterQuery('');
    }
  }, [isOpen]);

  // Global keydown listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Always allow Ctrl+K or Cmd+K to toggle palette
      if (hasCtrlOrMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Handle modal navigation when open
      if (isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsOpen(false);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            filteredShortcuts.length > 0 ? (prev + 1) % filteredShortcuts.length : 0
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            filteredShortcuts.length > 0
              ? (prev - 1 + filteredShortcuts.length) % filteredShortcuts.length
              : 0
          );
          return;
        }
        if (e.key === 'Enter' && filteredShortcuts[selectedIndex]) {
          e.preventDefault();
          const chosen = filteredShortcuts[selectedIndex];
          setIsOpen(false);
          chosen.action();
          return;
        }
      }

      if (!shortcutsEnabled) return;

      // Allow '?' when not typing in an input field
      if (!isEditable && e.key === '?' && !hasCtrlOrMeta && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Tab switching: Ctrl+1..0 or Alt+1..0
      if ((hasCtrlOrMeta || e.altKey) && !e.shiftKey) {
        // Support both e.key ('1'..'9','0') and e.code ('Digit1'..'Digit0')
        let digit: string | null = null;
        if (/^[0-9]$/.test(e.key)) {
          digit = e.key;
        } else if (e.code.startsWith('Digit')) {
          digit = e.code.replace('Digit', '');
        }

        if (digit !== null) {
          const foundMeta = TAB_SHORTCUT_METADATA.find((m) => m.keyNum === digit);
          if (foundMeta) {
            e.preventDefault();
            setActiveTab(foundMeta.id);
            setIsOpen(false);
            const prefix = hasCtrlOrMeta ? 'Ctrl' : 'Alt';
            triggerFeedback(`${prefix}+${digit}`, foundMeta.label);
            return;
          }
        }

        // Cycle tabs with Ctrl+[ / Ctrl+]
        if (hasCtrlOrMeta && e.key === '[') {
          e.preventDefault();
          cycleTab(-1, 'Ctrl+[');
          return;
        }
        if (hasCtrlOrMeta && e.key === ']') {
          e.preventDefault();
          cycleTab(1, 'Ctrl+]');
          return;
        }
      }

      // Dataset presets: Ctrl+Shift+M / Ctrl+Shift+D
      if (hasCtrlOrMeta && e.shiftKey) {
        const lower = e.key.toLowerCase();
        if (lower === 'm') {
          e.preventDefault();
          onSelectDatasetPreset('marine');
          triggerFeedback('Ctrl+Shift+M', 'Marine Science Dataset');
          return;
        }
        if (lower === 'd') {
          e.preventDefault();
          onSelectDatasetPreset('drone');
          triggerFeedback('Ctrl+Shift+D', 'Drone Aerial Dataset');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    shortcutsEnabled,
    filteredShortcuts,
    selectedIndex,
    activeTab,
    setActiveTab,
    onSelectDatasetPreset,
    setIsOpen,
  ]);

  return (
    <>
      {/* Non-intrusive Bottom-Right HUD Toast when a shortcut fires */}
      {lastTriggeredToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-violet-500/40 text-xs text-slate-100 shadow-xl backdrop-blur-md pointer-events-none">
          <Keyboard className="w-3.5 h-3.5 text-violet-400" />
          <kbd className="px-1.5 py-0.5 rounded bg-violet-950/90 text-violet-300 border border-violet-700/60 font-mono text-[10px]">
            {lastTriggeredToast.combo}
          </kbd>
          <span className="text-slate-400">→</span>
          <span className="font-semibold text-white">{lastTriggeredToast.label}</span>
        </div>
      )}

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Search / Command Header */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
              <Search className="w-4 h-4 text-violet-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Type a command or search shortcuts (e.g. 'Research', 'Ctrl+2', 'Geometry')..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-sans"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShortcutsEnabled((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-colors cursor-pointer flex items-center gap-1 ${
                    shortcutsEnabled
                      ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Enable or pause global hotkeys"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{shortcutsEnabled ? 'Hotkeys Active' : 'Hotkeys Paused'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Shortcut List */}
            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-5">
              {(['Navigation', 'Workflow', 'Dataset'] as const).map((category) => {
                const group = filteredShortcuts.filter((s) => s.category === category);
                if (group.length === 0) return null;

                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                        {category === 'Navigation'
                          ? 'Direct Tab Navigation (Ctrl+1..0 or Alt+1..0)'
                          : category === 'Workflow'
                          ? 'Workspace Cycling & Palette'
                          : 'Dataset Quick Switchers'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {group.map((item) => {
                        const globalIdx = filteredShortcuts.findIndex((s) => s.id === item.id);
                        const isSelected = globalIdx === selectedIndex;
                        const isCurrentTab = item.tabId && item.tabId === activeTab;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            onClick={() => {
                              setIsOpen(false);
                              item.action();
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer border ${
                              isSelected
                                ? 'bg-violet-600/15 border-violet-500/50 text-white'
                                : 'bg-slate-950/50 border-slate-800/60 text-slate-300 hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                                {item.icon || <Keyboard className="w-4 h-4 text-slate-400" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white truncate">
                                    {item.label}
                                  </span>
                                  {isCurrentTab && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-violet-950 text-violet-300 border border-violet-700/60">
                                      Active Tab
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1">
                                {item.keys.map((k, idx) => (
                                  <React.Fragment key={idx}>
                                    <kbd className="px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-200 shadow-inner">
                                      {k}
                                    </kbd>
                                    {idx < item.keys.length - 1 && (
                                      <span className="text-[10px] text-slate-500">+</span>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>

                              {item.altKeys && (
                                <div className="hidden sm:flex items-center gap-1 text-slate-500">
                                  <span className="text-[10px] mx-0.5">or</span>
                                  {item.altKeys.map((k, idx) => (
                                    <React.Fragment key={idx}>
                                      <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                                        {k}
                                      </kbd>
                                      {idx < item.altKeys!.length - 1 && (
                                        <span className="text-[10px] text-slate-600">+</span>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredShortcuts.length === 0 && (
                <div className="py-10 text-center text-xs text-slate-500">
                  No shortcuts match "{filterQuery}".
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300">
                    ↑↓
                  </kbd>
                  <span>Navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300">
                    <CornerDownLeft className="w-2.5 h-2.5 inline" /> Enter
                  </kbd>
                  <span>Execute</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300">
                    Esc
                  </kbd>
                  <span>Close</span>
                </span>
              </div>

              <div className="font-mono text-[10px] text-slate-500">
                Tip: Use <span className="text-violet-300">Ctrl+1..0</span> or{' '}
                <span className="text-violet-300">Alt+1..0</span> anytime to switch tabs
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
