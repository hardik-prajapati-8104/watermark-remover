import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Sparkles, Sliders, Shield, Download, 
  HelpCircle, ChevronDown, Check, Compass, Cpu, 
  Info, Files, Zap, ArrowLeft, Paintbrush, Play, Layout
} from 'lucide-react';

interface DocumentationProps {
  onBackToRemover: () => void;
}

export default function Documentation({ onBackToRemover }: DocumentationProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'advanced' | 'under-the-hood'>('guide');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [simOffset, setSimOffset] = useState<number>(50); // percentage for the live interactive simulator

  const workflowSteps = [
    {
      num: "01",
      title: "Drop and Load",
      desc: "Drag and drop one or multiple images (up to 50 images for bulk processing) directly onto the clean workspace. No account or setup required.",
      icon: Upload,
      bg: "bg-blue-50 border-blue-100 text-blue-600"
    },
    {
      num: "02",
      title: "Auto-Analyze with AI",
      desc: "Our model automatically scans the entire image canvas according to your chosen sensitivity level to locate stamps, logos, text overlays, and diagonals.",
      icon: Cpu,
      bg: "bg-purple-50 border-purple-100 text-purple-600"
    },
    {
      num: "03",
      title: "Review & Custom Overlay",
      desc: "Select or ignore individual watermark segments on the visual refinement canvas, or upload your own corporate logo to swap over the watermarked tiles.",
      icon: Sliders,
      bg: "bg-emerald-50 border-emerald-100 text-emerald-600"
    },
    {
      num: "04",
      title: "Pristine Full HD Output",
      desc: "Our local reconstruction pipeline blends the AI-inpainted fields back into the high-res original canvas so downloading retains 100% of raw image detail.",
      icon: Download,
      bg: "bg-indigo-50 border-indigo-100 text-indigo-600"
    }
  ];

  const advancedFeatures = [
    {
      title: "AI Precision Sensitivity (Level 1-5)",
      desc: "Fine-tune detection depending on watermark transparency. Lower values (1-2) are conservative and focus on solid high-contrast stamps. Higher values (4-5) detect subtle semi-transparent brush marks and full-image diagonals.",
      icon: Sliders
    },
    {
      title: "Active Logo Replacement Mode",
      desc: "Instead of blanking out a watermark, you can upload any custom brand logo. The pipeline automatically calculates exact positions, scaling boundaries, and replaces watermarked containers with your new asset.",
      icon: Paintbrush
    },
    {
      title: "Intelligent Batch Queuing",
      desc: "Premium-tier mass operations run sequentially under our engine to preserve rate limits stability, letting you verify individual image states, correct failures on the fly, and download as a single packed ZIP archive.",
      icon: Files
    }
  ];

  const technicalEngineLines = [
    { source: "Original Image (High HD/4K)", target: "Base64 Opt & Canvas Sizing" },
    { source: "Optimized Gemini Target (1024px)", target: "Smart Multi-model Watermark Detection" },
    { source: "Dynamic Bounding Boxes Map (0-1000)", target: "Localized Context Inpainting Engine" },
    { source: "Seamless Blend Restorer (Original Pixels)", target: "Full HD Masterpiece Download Output" }
  ];

  const faqs = [
    {
      q: "Does this application resize or lower the quality of my downloaded image?",
      a: "Absolutely not! Unlike cheap tools that resize your entire image to a low resolution, our system uses a custom Fidelity Blending layout. We detect and inpaint the watermark areas on an optimized scale, then map and stitch those perfect patches back onto your original high-resolution (HD, 4K, or larger) canvas. All non-watermarked portions of your photo remain completely untouched at 100% original quality."
    },
    {
      q: "How does the 'AI Precision' slider affect results?",
      a: "The Precision slider lets you control the neural networking threshold. Level 3 is ideal for standard logos. If the watermark is highly transparent or spreads across the whole background (like diagonal grid text), raising it to 4 or 5 ensures every pixel is found. For small solid corner stamps, lower sensitivity avoids unnecessary editing of surrounding details."
    },
    {
      q: "Can I replace watermarks with my own logo?",
      a: "Yes! In the visual workspace, after watermarks are highlighted, you can use the 'Replace Logo' box to drag and drop your own brand image (transparency supported PNGs work best). The system will swap the designated watermark fields with your custom graphic, maintaining strict proportions."
    },
    {
      q: "What types of files are supported and is there a size limit?",
      a: "We natively accept JPG, PNG, and WebP formats. There are no fixed resolution limits due to our local patching system, but uploading extremely large files (above 15MB) might take a few moments to render locally depending on your network bandwidth and device."
    },
    {
      q: "Why is processing done sequentially in batch mode?",
      a: "To ensure absolute system stability and dodge rate limiting. Parallel model calls are vulnerable to spikes, which can freeze your tasks. By queuing them sequentially, we guarantee every single image completes successfully, with error recovery keys enabling easy one-click retries."
    }
  ];

  return (
    <div className="space-y-16 py-4 animate-fade-in">
      {/* Top Banner and Back Link */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <button 
            onClick={onBackToRemover}
            className="group mb-3 text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Watermark Remover
          </button>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            How It Works & <span className="text-blue-600">Documentation</span>
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base max-w-2xl">
            Learn the science, settings, and techniques behind WatermarkRemover.io's ultra-advanced neural editing architecture.
          </p>
        </div>
        <button 
          onClick={onBackToRemover}
          className="px-6 py-3 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98]"
        >
          <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />
          Clear Watermark Now
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'guide', label: 'Step-by-Step Guide', icon: Compass },
          { id: 'advanced', label: 'Advanced Features', icon: Sliders },
          { id: 'under-the-hood', label: 'Processing Pipeline (Under the Hood)', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-6 text-sm font-bold border-b-2 transition-all relative ${
                activeTab === tab.id 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-slate-400 hover:text-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeDocTabLine" 
                  className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-blue-600"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === 'guide' && (
            <motion.div
              key="guide-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-12"
            >
              {/* Process steps */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {workflowSteps.map((step, idx) => {
                  const Icon = step.icon;
                  return (
                    <div 
                      key={idx} 
                      className="p-6 bg-white border border-slate-150 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <span className="font-mono text-xs font-bold text-slate-400 tracking-wider">STEP {step.num}</span>
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${step.bg}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-slate-900">{step.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quality preservation alert box */}
              <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50 flex flex-col md:flex-row gap-4 items-start">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm shrink-0">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-900">HD & 4K Resolution Fidelity Blending Engine Connected</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    By isolated patching of only the watermarked boundary tiles back into your source canvas, the final output preserves raw aspect ratio and pristine details on 100% of non-edited areas. Absolute quality preservation guaranteed.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'advanced' && (
            <motion.div
              key="advanced-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid md:grid-cols-3 gap-8"
            >
              {advancedFeatures.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div key={idx} className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm mb-6">
                        <Icon className="w-6 h-6 text-indigo-600" />
                      </div>
                      <h3 className="font-bold text-lg text-slate-950 mb-3">{feat.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed mb-6">{feat.desc}</p>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#22c55e] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Fully Activated
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeTab === 'under-the-hood' && (
            <motion.div
              key="uth-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  Local Canvas Assembly Line
                </h3>
                
                <div className="grid md:grid-cols-4 gap-4 relative">
                  {technicalEngineLines.map((line, idx) => (
                    <div key={idx} className="relative p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                      <div className="w-7 h-7 bg-blue-600 text-white font-bold text-xs rounded-full flex items-center justify-center mb-2">
                        {idx + 1}
                      </div>
                      <h4 className="font-bold text-sm text-slate-800">{line.source}</h4>
                      <p className="text-xs text-slate-400 capitalize">{line.target}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 text-slate-300 rounded-[32px] p-8 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest ml-2">Pipeline Terminal Log</span>
                  </div>
                  <span className="text-blue-400 text-[10px]">VER_3.5_PRO</span>
                </div>
                <div className="space-y-2 text-slate-400">
                  <p className="text-emerald-400">&gt; INITIALIZING WATERMAP REMOVAL PIPELINE...</p>
                  <p>&gt; loadOriginalCanvas() :: srcWidth: 3840px, srcHeight: 2160px [4K ASPECT RATIO DETECTED]</p>
                  <p>&gt; invokeDetectionEngine() :: Sensitivity Level: 3 [Standard Balanced Mode]</p>
                  <p className="text-blue-400">&gt; Running Gemini Model Detection on 800px scaled viewport...</p>
                  <p>&gt; SUCCESS :: found bounding_box [ymin: 450, xmin: 300, ymax: 550, xmax: 700]</p>
                  <p className="text-blue-400">&gt; invokeInpaintEngine() :: model: gemini-2.0-flash-image :: resolution 1024px</p>
                  <p>&gt; SUCCESS :: output image patch compiled</p>
                  <p className="text-blue-400">&gt; runHDReconstructor() :: scale_ratio: 3.75 :: mapPatchToOriginalCoords()</p>
                  <p className="text-emerald-400">&gt; PIPELINE COMPLETE :: stitched original pixels with AI inpainted patches. Original aspect ratio 100% saved.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Drag Simulator */}
      <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-[40px] border border-blue-100/50 p-8 md:p-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5 bg-blue-100/50 px-3.5 py-1.5 rounded-full w-fit">
              <Sparkles className="w-3.5 h-3.5 fill-blue-600" /> Use Experience Studio
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
              Interactive Removals <br />Zero Learning Curve.
            </h2>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed">
              Drag the visual slider to experience real-time AI image reconstruction. See how background gradients, water textures, and complex shadows are infilled perfectly.
            </p>
            
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Simulate Slider Offset</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={simOffset} 
                onChange={(e) => setSimOffset(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200/80 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>BEFORE (WATERMARKED)</span>
                <span>AFTER (AI CLEANED)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-[420px] aspect-square bg-slate-100 rounded-[32px] overflow-hidden shadow-2xl relative select-none border border-white">
              {/* Back Image (Clean After) */}
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800')" }}
              />

              {/* Front Image (Watermarked Before) */}
              <div 
                className="absolute inset-y-0 left-0 bg-cover bg-left border-r-2 border-white z-10 overflow-hidden shadow-xl"
                style={{ 
                  backgroundImage: "url('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800')",
                  width: `${simOffset}%`
                }}
              >
                {/* Watermark grid overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-40 select-none">
                  <div className="grid grid-cols-2 gap-12 -rotate-12 scale-110">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <span key={i} className="text-lg font-bold text-white uppercase tracking-tighter mix-blend-overlay">Watermark</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Slider Center Pin */}
              <div 
                className="absolute inset-y-0 w-8 -ml-4 flex items-center justify-center z-20 pointer-events-none"
                style={{ left: `${simOffset}%` }}
              >
                <div className="w-8 h-8 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5 text-blue-600 rotate-90" />
                </div>
              </div>

              <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-[9px] font-bold text-white px-2 py-1 rounded-md z-30">
                PULL SLIDER TO TEST
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQs Accordion */}
      <div className="space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <HelpCircle className="w-8 h-8 text-blue-600 mx-auto" />
          <h2 className="text-2xl md:text-3xl font-extrabold">Frequently Asked Questions</h2>
          <p className="text-slate-500 text-sm">
            Everything you need to know about photo quality support, safety thresholds, and technical limits.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx} 
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen ? "border-blue-200 shadow-lg shadow-blue-900/5" : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-900 text-sm md:text-base"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180 text-blue-500" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 pb-6 pt-1 text-slate-500 text-sm leading-relaxed border-t border-slate-50">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
