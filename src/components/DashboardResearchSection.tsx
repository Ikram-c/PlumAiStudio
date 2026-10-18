import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  Search,
  Globe,
  ExternalLink,
  BookOpen,
  Sparkles,
  RefreshCw,
  Bookmark,
  Check,
  TrendingUp,
  ArrowRight,
  HelpCircle,
  FileText,
} from 'lucide-react';

export interface GroundingSource {
  title: string;
  url: string;
}

export interface ResearchSearchResult {
  success: boolean;
  query: string;
  summary: string;
  searchQueries: string[];
  sources: GroundingSource[];
  grounded: boolean;
}

interface DashboardResearchSectionProps {
  onOpenFullHub?: () => void;
  datasetCategoryCount?: number;
}

export const DashboardResearchSection: React.FC<DashboardResearchSectionProps> = ({
  onOpenFullHub,
  datasetCategoryCount,
}) => {
  const [queryInput, setQueryInput] = useState<string>(
    'latest computer vision research papers object detection COCO benchmarks'
  );
  const [activeQuery, setActiveQuery] = useState<string>(
    'latest computer vision research papers object detection COCO benchmarks'
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ResearchSearchResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const fetchResearch = async (searchQuery: string) => {
    setLoading(true);
    setActiveQuery(searchQuery);
    try {
      const res = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data: ResearchSearchResult = await res.json();
      setResult(data);
    } catch (err) {
      console.error('Failed to fetch research papers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResearch(activeQuery);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) {
      fetchResearch(queryInput.trim());
    }
  };

  const handleChipClick = (chipQuery: string) => {
    setQueryInput(chipQuery);
    fetchResearch(chipQuery);
  };

  const handleSaveToFirestore = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in with Google to save research digests to Cloud Firestore.');
      return;
    }
    if (!result) return;

    try {
      const recordId = `rec_research_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'analysisRecords', recordId);
      await setDoc(docRef, {
        id: recordId,
        userId: user.uid,
        type: 'research',
        title: `CV Research: ${result.query.slice(0, 60)}`,
        summary: result.summary.slice(0, 800),
        sources: result.sources.slice(0, 5),
        createdAt: new Date().toISOString(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/analysisRecords`);
    }
  };

  const topicPresets = [
    {
      label: 'COCO Detection SOTA',
      query: 'latest computer vision research papers object detection COCO benchmarks',
    },
    {
      label: 'Dense & Nested Instances',
      query: 'computer vision papers detecting dense overlapping nested objects anchor strategies',
    },
    {
      label: 'Marine & Turbid Imagery',
      query: 'underwater computer vision image restoration turbidity chromatic aberration guided filter',
    },
    {
      label: 'GJK Collision Solvers',
      query: 'GJK algorithm Nesterov accelerated collision detection convex hull geometry',
    },
    {
      label: 'OME-Zarr Cloud Extraction',
      query: 'OME-Zarr NGFF video frame extraction chunking bioimaging cloud storage',
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Computer Vision Research & Industry News
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 flex items-center gap-1">
              <Globe className="w-2.5 h-2.5 text-indigo-400" />
              <span>Google Search Grounded</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grounded live using Google Search to fetch recent arXiv papers, CVPR/ICCV benchmarks, and domain advances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={handleSaveToFirestore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              title="Save this search digest to your Cloud Firestore profile"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved to Firestore</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Bookmark Digest</span>
                </>
              )}
            </button>
          )}

          {onOpenFullHub && (
            <button
              onClick={onOpenFullHub}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer shadow-sm shadow-indigo-600/20"
            >
              <span>Full Research Hub</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search recent computer vision research, papers, datasets or benchmarks..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Grounding...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ground Search</span>
            </>
          )}
        </button>
      </form>

      {/* Preset Topic Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-500 text-[11px] font-medium mr-1">Suggested Topics:</span>
        {topicPresets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleChipClick(preset.query)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
              activeQuery === preset.query
                ? 'bg-indigo-950/80 border-indigo-700/80 text-indigo-300 font-medium'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Synthesized Digest */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Synthesized Research Summary
              </h3>
            </div>
            {result?.grounded ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                Live Google Grounded
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Synthesized Feed
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
              <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
              <span>Grounding query with Google Search and reading research papers...</span>
            </div>
          ) : result ? (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans max-h-96 overflow-y-auto pr-1">
              {result.summary.split('\n\n').map((paragraph, pIdx) => {
                if (paragraph.startsWith('### ') || paragraph.startsWith('#### ') || paragraph.startsWith('1. ') || paragraph.startsWith('2. ') || paragraph.startsWith('3. ') || paragraph.startsWith('4. ')) {
                  return (
                    <h4 key={pIdx} className="text-xs font-bold text-indigo-300 pt-2 border-b border-slate-800/60 pb-1">
                      {paragraph.replace(/^#+\s*/, '')}
                    </h4>
                  );
                }
                return (
                  <p key={pIdx} className="text-slate-300 leading-normal">
                    {paragraph}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              No research data loaded. Pick a topic or search above.
            </div>
          )}
        </div>

        {/* Grounded Sources & Citations */}
        <div className="space-y-4">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Globe className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Google Grounded Sources ({result?.sources?.length || 0})
              </h3>
            </div>

            {result?.sources && result.sources.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {result.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-800/80 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {src.title}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0 mt-0.5" />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono truncate block mt-1">
                      {src.url.replace(/^https?:\/\//, '').split('/')[0]}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-900 rounded-lg text-center text-[11px] text-slate-500">
                Sources will appear here after search execution.
              </div>
            )}
          </div>

          {/* Web Queries Triggered */}
          {result?.searchQueries && result.searchQueries.length > 0 && (
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">
                Google Search Queries Executed:
              </span>
              <div className="flex flex-wrap gap-1">
                {result.searchQueries.map((q, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-indigo-300"
                  >
                    "{q}"
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
