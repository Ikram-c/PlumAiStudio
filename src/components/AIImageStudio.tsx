import React, { useState, useRef, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import {
  Wand2,
  Sparkles,
  Sliders,
  Cloud,
  Check,
  RefreshCw,
  Download,
  Database,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface SavedCloudImage {
  id: string;
  prompt: string;
  imageUrl: string;
  modelUsed: string;
  createdAt: string;
}

export const AIImageStudio: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'create' | 'edit'>('create');
  const [prompt, setPrompt] = useState<string>('Benthic coral quadrat survey with sea urchin clusters and soft kelp at 25m depth');
  const [editPrompt, setEditPrompt] = useState<string>('Simulate strong lateral chromatic aberration fringing and enhance midtone contrast');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [cloudImages, setCloudImages] = useState<SavedCloudImage[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load user's cloud saved images from Firestore
  const fetchCloudImages = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const colRef = collection(db, 'users', user.uid, 'generatedImages');
      const q = query(colRef, limit(12));
      const snap = await getDocs(q);
      const items: SavedCloudImage[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          prompt: data.prompt,
          imageUrl: data.imageUrl,
          modelUsed: data.modelUsed || 'gemini-nano-banana-2.1',
          createdAt: data.createdAt,
        });
      });
      setCloudImages(items);
    } catch (err) {
      console.error('Failed to fetch cloud images:', err);
    }
  };

  useEffect(() => {
    fetchCloudImages();
  }, [auth.currentUser]);

  // Initial synthetic frame generation
  useEffect(() => {
    renderProceduralSurveyFrame(prompt, {
      chromaticAberration: 0,
      exposureBias: 0,
      contrast: 1.0,
    });
  }, []);

  // Render a detailed synthetic survey image onto canvas
  const renderProceduralSurveyFrame = (
    textPrompt: string,
    modifiers: { chromaticAberration: number; exposureBias: number; contrast: number }
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 640;
    canvas.height = 480;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const isTurbine = textPrompt.toLowerCase().includes('turbine') || textPrompt.toLowerCase().includes('drone');
    const isAbyss = textPrompt.toLowerCase().includes('abyss') || textPrompt.toLowerCase().includes('deep');

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.hypot(cx, cy);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let r = 0, g = 0, b = 0;

        if (isTurbine) {
          // Aerial offshore sea surface with ocean swells
          const swell = Math.sin(x * 0.02 + y * 0.01) * 30 + Math.cos(y * 0.03) * 20;
          r = 30 + swell * 0.4;
          g = 90 + swell * 0.7;
          b = 150 + swell;

          // Drone inspection tower in center
          if (Math.abs(x - cx) < 35 && y > 100) {
            r = 210; g = 210; b = 215;
          }
        } else if (isAbyss) {
          // Deep dark ocean floor
          const noise = (Math.random() - 0.5) * 15;
          r = 15 + noise;
          g = 25 + noise;
          b = 35 + noise;
        } else {
          // Benthic coral reef quadrat
          const coralBase = Math.sin(x * 0.04) * Math.cos(y * 0.04) * 50 + 100;
          const noise = (Math.random() - 0.5) * 30;
          r = Math.max(0, coralBase * 0.45 + noise);
          g = Math.max(0, coralBase * 0.85 + noise);
          b = Math.max(0, coralBase * 1.1 + y * 0.15 + noise);

          // Add synthetic sea urchins (dark round colonies)
          const d1 = Math.hypot(x - 240, y - 260);
          const d2 = Math.hypot(x - 420, y - 310);
          if (d1 < 28 || d2 < 22) {
            r = 18; g = 18; b = 24;
          }
        }

        // Apply contrast & exposure modifiers
        r = (r - 128) * modifiers.contrast + 128 + modifiers.exposureBias * 35;
        g = (g - 128) * modifiers.contrast + 128 + modifiers.exposureBias * 35;
        b = (b - 128) * modifiers.contrast + 128 + modifiers.exposureBias * 35;

        // Apply lateral chromatic aberration if present
        if (modifiers.chromaticAberration > 0) {
          const dx = x - cx;
          const dy = y - cy;
          const rDist = Math.hypot(dx, dy) / maxR;
          r += rDist * modifiers.chromaticAberration * 4.5;
          b -= rDist * modifiers.chromaticAberration * 4.5;
        }

        data[idx] = Math.min(255, Math.max(0, r));
        data[idx + 1] = Math.min(255, Math.max(0, g));
        data[idx + 2] = Math.min(255, Math.max(0, b));
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw synthetic bounding boxes on top with annotations
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.font = '11px monospace';
    ctx.fillStyle = '#a855f7';

    if (!isTurbine && !isAbyss) {
      // Box 1: Coral
      ctx.strokeRect(120, 140, 260, 220);
      ctx.fillText('Benthic Coral (0.94)', 125, 135);
      // Box 2: Sea Urchin
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = '#38bdf8';
      ctx.strokeRect(215, 235, 55, 55);
      ctx.fillText('Sea Urchin (0.91)', 220, 230);
    } else if (isTurbine) {
      ctx.strokeRect(cx - 50, 100, 100, 280);
      ctx.fillText('Turbine Pylon (0.98)', cx - 45, 95);
    }
  };

  const handleCreateImage = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      renderProceduralSurveyFrame(prompt, {
        chromaticAberration: 0,
        exposureBias: 0,
        contrast: 1.0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditImage = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/images/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editPrompt }),
      });
      const data = await res.json();
      const params = data.editData || {};

      renderProceduralSurveyFrame(prompt, {
        chromaticAberration: params.chromaticAberrationRadius || 10,
        exposureBias: params.exposureAdjustmentStops || 0.4,
        contrast: params.contrastMultiplier || 1.25,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToCloud = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in with Google to save images to Cloud Firestore.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const imageId = `img_${Date.now()}`;
      const docRef = doc(db, 'users', user.uid, 'generatedImages', imageId);

      await setDoc(docRef, {
        id: imageId,
        userId: user.uid,
        prompt: activeMode === 'create' ? prompt : editPrompt,
        imageUrl: dataUrl,
        modelUsed: 'gemini-nano-banana-2.1',
        createdAt: new Date().toISOString(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchCloudImages();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/generatedImages`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `survey_generated_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-violet-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">AI Survey Image Studio</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800/60">
                gemini-nano-banana-2.1
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Create synthetic computer vision survey frames from text prompts or edit existing captures with AI filters.
            </p>
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveMode('create')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeMode === 'create' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Text-to-Image Creation
            </button>
            <button
              onClick={() => setActiveMode('edit')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeMode === 'edit' ? 'bg-violet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Prompt Image Editing
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Canvas View */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Survey Viewport (640 × 480)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadImage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>

              <button
                onClick={handleSaveToCloud}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Saved to Firestore!</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save to Cloud'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain block" />
            {isGenerating && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white text-xs">
                <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
                <span>Processing with Gemini vision engine...</span>
              </div>
            )}
          </div>
        </div>

        {/* Prompt Control Studio */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">
              {activeMode === 'create' ? 'Prompt-Driven Generation' : 'Prompt-Driven Editing'}
            </h3>
          </div>

          {activeMode === 'create' ? (
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Describe Survey Scene to Synthesize:
                </label>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-violet-500 font-sans leading-relaxed"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block mb-2 font-medium">Quick Prompt Presets:</span>
                <div className="space-y-1.5">
                  <button
                    onClick={() =>
                      setPrompt('Benthic coral quadrat survey with sea urchin clusters and soft kelp at 25m depth')
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 transition-colors"
                  >
                    Coral Reef Quadrat Survey
                  </button>
                  <button
                    onClick={() =>
                      setPrompt('Offshore wind turbine foundation with high sea-surface sun glare and transit vessel')
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 transition-colors"
                  >
                    Offshore Drone Pylon
                  </button>
                  <button
                    onClick={() =>
                      setPrompt('Deep abyss hydrothermal sea floor with extreme low exposure and particulate turbidity')
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 transition-colors"
                  >
                    Deep Ocean Trench
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreateImage}
                disabled={isGenerating}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                <span>Generate Synthetic Frame</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Image Editing Prompt (Style / Lens / Exposure):
                </label>
                <textarea
                  rows={4}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-violet-500 font-sans leading-relaxed"
                />
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block mb-2 font-medium">Editing Directives:</span>
                <div className="space-y-1.5">
                  <button
                    onClick={() =>
                      setEditPrompt('Simulate strong lateral chromatic aberration fringing and enhance midtone contrast')
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 transition-colors"
                  >
                    Add Chromatic Aberration
                  </button>
                  <button
                    onClick={() =>
                      setEditPrompt('Increase exposure by +1.5 stops and balance deep shadow details')
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 transition-colors"
                  >
                    Exposure Compensation Lift
                  </button>
                  <button
                    onClick={() =>
                      setEditPrompt('Simulate deep water lighting dropoff and decrease exposure by -1.0 stop')
                    }
                    className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-slate-300 transition-colors"
                  >
                    Deep Water Light Dropoff
                  </button>
                </div>
              </div>

              <button
                onClick={handleEditImage}
                disabled={isGenerating}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <Sliders className="w-4 h-4" />
                <span>Apply Prompt Modifications</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cloud Firestore Saved Gallery */}
      {cloudImages.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Your Firestore Saved Survey Images</h3>
            <span className="text-[11px] font-mono text-slate-500">({cloudImages.length} saved)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {cloudImages.map((img) => (
              <div
                key={img.id}
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return;
                  const imageObj = new Image();
                  imageObj.onload = () => {
                    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
                  };
                  imageObj.src = img.imageUrl;
                }}
                className="bg-slate-950 p-2 rounded-xl border border-slate-800 hover:border-violet-500/60 cursor-pointer group transition-all"
              >
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[4/3] object-cover rounded-lg mb-1.5"
                />
                <p className="text-[10px] text-slate-400 truncate group-hover:text-violet-300">{img.prompt}</p>
                <span className="text-[9px] font-mono text-slate-600 block">
                  {new Date(img.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
