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
  Cpu,
  Layers,
  Database,
} from 'lucide-react';

interface GroundingSource {
  title: string;
  url: string;
}

interface ResearchSearchResult {
  success: boolean;
  query: string;
  summary: string;
  searchQueries: string[];
  sources: GroundingSource[];
  grounded: boolean;
}

export const ResearchHub: React.FC = () => {
  const [queryInput, setQueryInput] = useState<string>(
    'latest computer vision research papers object detection COCO benchmarks'
  );
  const [activeQuery, setActiveQuery] = useState<string>(
    'latest computer vision research papers object detection COCO benchmarks'
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ResearchSearchResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [authWarning, setAuthWarning] = useState<string | null>(null);

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
      setAuthWarning('Sign in with Google above to bookmark digests to Cloud Firestore.');
      setTimeout(() => setAuthWarning(null), 4000);
      return;
    }
    if (!result) return;

    try {
      const recordId = `rec_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'analysisRecords', recordId);
      await setDoc(docRef, {
        id: recordId,
        userId: user.uid,
        type: 'research',
        title: `Research: ${result.query.slice(0, 50)}`,
        summary: result.summary.slice(0, 500),
        createdAt: new Date().toISOString(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/analysisRecords`);
    }
  };

  const queryChips = [
    { label: 'COCO Object Detection SOTA', query: 'latest computer vision research papers object detection COCO benchmarks' },
    { label: 'Underwater Marine Imaging', query: 'underwater benthic computer vision restoration turbidity chromatic aberration' },
    { label: 'GJK 2D/3D Collision Solvers', query: 'GJK algorithm Nesterov accelerated collision detection convex hull geometry' },
    { label: 'OME-Zarr Cloud Video Pipelines', query: 'OME-Zarr NGFF video frame extraction chunking bioimaging cloud storage' },
    { label: 'Real-Time Edge Detection', query: 'real-time edge object detection embedded vision transformer papers 2026' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">Computer Vision Research & Industry News</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60 flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" />
                <span>Google Search Grounding</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Fetch, ground, and synthesize recent arXiv preprints, CVPR/ICCV proceedings, and industry breakthroughs.
            </p>
          </div>

          {result && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveToFirestore}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
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
            </div>
          )}
        </div>

        {authWarning && (
          <div className="mt-3 px-3.5 py-2 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-200 text-xs">
            {authWarning}
          </div>
        )}

        {/* Search Bar & Query Chips */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search computer vision topics, papers, or benchmarks..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Ground Search</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Query Chips */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="text-slate-500 text-[11px] py-1 font-medium mr-1">Trending:</span>
            {queryChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(chip.query)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                  activeQuery === chip.query
                    ? 'bg-indigo-950/80 border-indigo-700/80 text-indigo-300 font-medium'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Research Paper Digest */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Synthesized Research Digest</h3>
            </div>
            {result?.grounded ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                Live Google Grounded
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/60">
                Curated Peer-Reviewed Index
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <span>Querying Google Search and synthesizing computer vision papers...</span>
            </div>
          ) : result ? (
            <div className="prose prose-invert prose-xs max-w-none space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              {result.summary.split('\n\n').map((paragraph, pIdx) => {
                if (paragraph.startsWith('### ') || paragraph.startsWith('#### ')) {
                  return (
                    <h4 key={pIdx} className="text-sm font-bold text-indigo-300 pt-2 border-b border-slate-800/60 pb-1">
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
            <div className="py-12 text-center text-slate-500 text-xs">
              No research data loaded. Enter a query or pick a topic above.
            </div>
          )}
        </div>

        {/* Grounding Citations & Sources */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Globe className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Grounding Sources & Citations</h3>
            </div>

            {result?.sources && result.sources.length > 0 ? (
              <div className="space-y-2.5">
                {result.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900/80 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {src.title}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 mt-0.5" />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono truncate block mt-1">
                      {src.url.replace(/^https?:\/\//, '').split('/')[0]}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                Grounding sources will appear here after search execution.
              </div>
            )}
          </div>

          {/* Web Queries Executed by Google Search Grounding */}
          {result?.searchQueries && result.searchQueries.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
              <span className="text-xs font-bold text-white block">Google Search Grounding Queries:</span>
              <div className="flex flex-wrap gap-1.5">
                {result.searchQueries.map((q, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-300"
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
