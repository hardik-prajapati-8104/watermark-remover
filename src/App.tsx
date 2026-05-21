import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Download, Zap, Shield, Trash2, X, Plus, Sparkles, RefreshCw, Files, Play, FileJson, BookOpen, HelpCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { cn } from './lib/utils';
import { detectWatermarks, aiRemoveWatermarks } from './services/geminiService';
import { AppState, ProcessedImage, BoxSelection } from './types';
import Documentation from './components/Documentation';

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [activeTab, setActiveTab] = useState<'remover' | 'docs'>('remover');
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacementPreview, setReplacementPreview] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState(3);
  const [isRescanning, setIsRescanning] = useState(false);
  const processingRef = useRef(false);

  const selectedImage = images.find(img => img.id === selectedId) || null;

  const performDetection = async (id: string, base64: string, mimeType: string, currentSensitivity: number) => {
    try {
      const detection = await detectWatermarks(base64, mimeType, currentSensitivity);
      
      const selections: BoxSelection[] = detection.watermarks.map((box, i) => ({
        ...box,
        selected: true,
        id: `box-${i}-${Date.now()}`
      }));

      setImages(prev => prev.map(img => 
        img.id === id ? { ...img, detectedBoxes: selections, status: 'pending' } : img
      ));
    } catch (err) {
      console.error(err);
      setImages(prev => prev.map(img => 
        img.id === id ? { ...img, status: 'error' } : img
      ));
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    setState('detecting');
    setError(null);

    const newImages: ProcessedImage[] = [];

    for (const file of acceptedFiles) {
      const reader = new FileReader();
      const promise = new Promise<void>((resolve) => {
        reader.onload = async () => {
          const id = Math.random().toString(36).substr(2, 9);
          const imageData: ProcessedImage = {
            id,
            originalUrl: reader.result as string,
            processedUrl: '',
            name: file.name,
            size: file.size,
            type: file.type,
            detectedBoxes: [],
            status: 'processing'
          };
          
          setImages(prev => [...prev, imageData]);
          newImages.push(imageData);
          
          const base64 = (reader.result as string).split(',')[1];
          await performDetection(id, base64, file.type, sensitivity);
          resolve();
        };
      });
      reader.readAsDataURL(file);
      await promise;
    }

    if (newImages.length === 1) {
      setSelectedId(newImages[0].id);
      setState('refining');
    } else {
      setState('batch_processing');
    }
  }, [sensitivity]);

  const handleRescan = async () => {
    if (!selectedImage || isRescanning) return;
    setIsRescanning(true);
    const base64 = selectedImage.originalUrl.split(',')[1];
    await performDetection(selectedImage.id, base64, selectedImage.type, sensitivity);
    setIsRescanning(false);
  };

  const onLogoDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReplacementPreview(reader.result as string);
      setImages(prev => prev.map(img => 
        img.id === selectedId ? { ...img, replacementLogoUrl: reader.result as string } : img
      ));
    };
    reader.readAsDataURL(file);
  }, [selectedId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    disabled: state !== 'idle' && state !== 'error'
  });

  const { getRootProps: getLogoProps, getInputProps: getLogoInput, isDragActive: isLogoActive } = useDropzone({
    onDrop: onLogoDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const toggleBox = (id: string) => {
    setImages(prev => prev.map(img => {
      if (img.id !== selectedId) return img;
      return {
        ...img,
        detectedBoxes: img.detectedBoxes.map(box => 
          box.id === id ? { ...box, selected: !box.selected } : box
        )
      };
    }));
  };

  const processImage = async (img: ProcessedImage) => {
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'processing' } : i));
    setError(null);
    
    try {
      const selectedBoxes = img.detectedBoxes.filter(b => b.selected);
      let processed: string | null = null;

      if (img.replacementLogoUrl) {
        processed = await replaceWithLogo(img.originalUrl, img.replacementLogoUrl, selectedBoxes);
      } else {
        const base64 = img.originalUrl.split(',')[1];
        const aiProcessed = await aiRemoveWatermarks(base64, img.type, selectedBoxes);
        if (aiProcessed) {
          if (selectedBoxes.length > 0) {
            processed = await reconstructFullHD(img.originalUrl, aiProcessed, selectedBoxes);
          } else {
            processed = aiProcessed;
          }
        }
      }

      if (processed) {
        setImages(prev => prev.map(i => i.id === img.id ? { ...i, processedUrl: processed, status: 'completed' } : i));
        return true;
      }
      throw new Error(selectedBoxes.length === 0 ? "Please select at least one area to remove" : "The AI was unable to generate a clean version. This might be due to complex textures.");
    } catch (err: any) {
      console.error("Image processing error:", err);
      let errorMessage = "Processing failed";
      
      if (err?.message?.includes("404")) {
        errorMessage = "AI model is currently unavailable in your region. Please try again later.";
      } else if (err?.message?.includes("429")) {
        errorMessage = "Service is overloaded. Retrying sequentially...";
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error' } : i));
      if (state !== 'batch_processing') {
        setError(errorMessage);
      }
      return false;
    }
  };

  const handleProcess = async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      if (state === 'refining' && selectedImage) {
        setState('removing');
        await processImage(selectedImage);
        setState('completed');
      } else if (state === 'batch_processing') {
        const pending = images.filter(img => img.status === 'pending' || img.status === 'processing');
        // Process sequentially to strictly respect rate limits
        for (const img of pending) {
          await processImage(img);
        }
      }
    } finally {
      processingRef.current = false;
    }
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    const completed = images.filter(img => img.status === 'completed' && img.processedUrl);
    
    if (!completed.length) return;

    for (const img of completed) {
      const base64 = img.processedUrl.split(',')[1];
      zip.file(`processed-${img.name}`, base64, { base64: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `watermark-remover-${Date.now()}.zip`;
    link.click();
  };

  const downloadImage = (img: ProcessedImage = selectedImage!) => {
    if (!img?.processedUrl) return;
    const link = document.createElement('a');
    link.href = img.processedUrl;
    link.download = `processed-${img.name}`;
    link.click();
  };

  const replaceWithLogo = (originalUrl: string, logoUrl: string, boxes: BoxSelection[]): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const logo = new Image();
      let loaded = 0;
      const onLoaded = () => {
        loaded++;
        if (loaded === 2) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject("Canvas failure");
          ctx.drawImage(img, 0, 0);
          boxes.forEach(box => {
            const x = (box.xmin / 1000) * img.width;
            const y = (box.ymin / 1000) * img.height;
            const w = ((box.xmax - box.xmin) / 1000) * img.width;
            const h = ((box.ymax - box.ymin) / 1000) * img.height;
            ctx.drawImage(logo, x, y, w, h);
          });
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.onload = onLoaded;
      logo.onload = onLoaded;
      img.onerror = reject;
      logo.onerror = reject;
      img.src = originalUrl;
      logo.src = logoUrl;
    });
  };

  const reconstructFullHD = (originalUrl: string, processedUrl: string, boxes: BoxSelection[]): Promise<string> => {
    return new Promise((resolve) => {
      const origImg = new Image();
      const procImg = new Image();
      let loaded = 0;
      
      const onLoaded = () => {
        loaded++;
        if (loaded === 2) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = origImg.width;
            canvas.height = origImg.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(processedUrl);
              return;
            }
            
            // Draw original high-res image
            ctx.drawImage(origImg, 0, 0);
            
            // Localized patch drawing
            boxes.forEach(box => {
              const xminPct = Math.max(0, box.xmin / 1000);
              const yminPct = Math.max(0, box.ymin / 1000);
              const xmaxPct = Math.min(1, box.xmax / 1000);
              const ymaxPct = Math.min(1, box.ymax / 1000);
              const wPct = xmaxPct - xminPct;
              const hPct = ymaxPct - yminPct;
              
              if (wPct <= 0 || hPct <= 0) return;
              
              // We add a tiny padding (3px in processed scale) to seamlessly overlap cut edges
              const padX = Math.min(0.01, 3 / procImg.width);
              const padY = Math.min(0.01, 3 / procImg.height);
              
              const cropXmin = Math.max(0, xminPct - padX);
              const cropYmin = Math.max(0, yminPct - padY);
              const cropXmax = Math.min(1, xmaxPct + padX);
              const cropYmax = Math.min(1, ymaxPct + padY);
              const cropW = cropXmax - cropXmin;
              const cropH = cropYmax - cropYmin;
              
              const sx = cropXmin * procImg.width;
              const sy = cropYmin * procImg.height;
              const sw = cropW * procImg.width;
              const sh = cropH * procImg.height;
              
              const dx = cropXmin * origImg.width;
              const dy = cropYmin * origImg.height;
              const dw = cropW * origImg.width;
              const dh = cropH * origImg.height;
              
              ctx.drawImage(procImg, sx, sy, sw, sh, dx, dy, dw, dh);
            });
            
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } catch (e) {
            console.error("Fidelity blending error, falling back to raw output:", e);
            resolve(processedUrl);
          }
        }
      };
      
      origImg.onload = onLoaded;
      procImg.onload = onLoaded;
      
      origImg.onerror = () => {
        console.error("Failed to load original image dimensions, using processed resolution");
        resolve(processedUrl);
      };
      procImg.onerror = () => {
        console.error("Failed to load processed image, using processed resolution");
        resolve(processedUrl);
      };
      
      origImg.src = originalUrl;
      procImg.src = processedUrl;
    });
  };

  const reset = () => {
    setState('idle');
    setImages([]);
    setSelectedId(null);
    setError(null);
    setReplacementPreview(null);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-50 selection:text-blue-700">
      {/* Header Navigation */}
      <nav className="fixed top-0 w-full h-20 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center relative">
            <div className="w-4 h-4 border-2 border-white rounded-sm relative">
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 border border-white"></div>
            </div>
          </div>
          <span className="font-bold text-xl tracking-tight">WatermarkRemover<span className="text-blue-600">.io</span></span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium">
          <button 
            onClick={() => setActiveTab('remover')}
            className={cn(
              "transition-all font-semibold py-1 border-b-2",
              activeTab === 'remover' ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-slate-900"
            )}
          >
            Remover
          </button>
          <button 
            onClick={() => setActiveTab('docs')}
            className={cn(
              "transition-all font-semibold py-1 border-b-2",
              activeTab === 'docs' ? "text-blue-600 border-blue-600" : "text-slate-500 border-transparent hover:text-slate-900"
            )}
          >
            How it Works
          </button>
          <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors py-1 font-semibold">API</a>
          <a href="#" className="text-slate-500 hover:text-slate-900 transition-colors py-1 font-semibold">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab(activeTab === 'docs' ? 'remover' : 'docs')}
            className="md:hidden p-2 text-slate-500 hover:text-slate-700 transition-colors"
            title="Toggle Guide"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button className="px-5 py-2.5 rounded-full border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-all">
            Sign In
          </button>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
        {activeTab === 'docs' ? (
          <Documentation onBackToRemover={() => setActiveTab('remover')} />
        ) : (
          <>
            <div className="grid md:grid-cols-12 gap-12 items-center mb-24">
          {/* Left: Copy and Upload */}
          <div className="md:col-span-12 lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-bold tracking-tight leading-tight"
              >
                Remove watermarks <br/><span className="text-blue-600">in seconds.</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-slate-500 max-w-md"
              >
                Designed to be simple, our AI-powered interface enables anyone to clear watermarks automatically. No technical knowledge required.
              </motion.p>
            </div>

            {/* Upload Area */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {state === 'idle' || state === 'error' ? (
                  <motion.div
                    key="dropzone"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <div
                      {...getRootProps()}
                      className={cn(
                        "w-full h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center space-y-4 transition-all duration-300 cursor-pointer p-8 text-center group",
                        isDragActive ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-slate-100/50"
                      )}
                    >
                      <input {...getInputProps()} />
                      <div className="w-12 h-12 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">Drag and drop image</p>
                        <p className="text-slate-400 text-sm">or click to browse from device</p>
                      </div>

                      {/* Sensitivity Slider */}
              <div className="w-full max-w-xs space-y-3 px-4 py-3 bg-white/50 rounded-2xl backdrop-blur-sm border border-slate-100 group-hover:border-blue-100 transition-colors shadow-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>AI Precision Mode</span>
                  <span className="text-blue-600">Level {sensitivity}</span>
                </div>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    value={sensitivity} 
                    onChange={(e) => setSensitivity(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div className="flex justify-between text-[8px] font-bold text-slate-300">
                  <span>FASTER</span>
                  <span>MORE ACCURATE</span>
                </div>
              </div>
            </div>
            
            {/* Bulk Badge */}
            <div className="mt-6 flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 w-full lg:w-fit">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <Files className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900">Bulk Image Removal</p>
                <p className="text-[10px] text-blue-600/80 font-medium whitespace-nowrap">Upload up to 50 images for batch processing</p>
              </div>
            </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100"
                      >
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                      </motion.div>
                    )}
                  </motion.div>
                ) : state === 'refining' && selectedImage ? (
                  <motion.div
                    key="refining"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden p-6">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold">Refine Selections</h3>
                          <p className="text-slate-500 text-sm">Select the areas you want to remove or replace.</p>
                        </div>
                        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sensitivity</div>
                          <div className="flex items-center gap-3">
                            <input 
                              type="range" 
                              min="1" 
                              max="5" 
                              value={sensitivity} 
                              onChange={(e) => setSensitivity(parseInt(e.target.value))}
                              className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <button 
                              onClick={handleRescan}
                              disabled={isRescanning}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isRescanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              RE-SCAN
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 mb-6">
                        <img src={selectedImage.originalUrl} className="w-full h-full object-contain" />
                        {selectedImage.detectedBoxes.map(box => (
                          <button
                            key={box.id}
                            onClick={() => toggleBox(box.id)}
                            className={cn(
                              "absolute border-2 transition-all cursor-pointer",
                              box.selected ? "border-blue-500 bg-blue-500/20 ring-4 ring-blue-500/10" : "border-slate-400 bg-black/10"
                            )}
                            style={{
                              top: `${box.ymin / 10}%`,
                              left: `${box.xmin / 10}%`,
                              width: `${(box.xmax - box.xmin) / 10}%`,
                              height: `${(box.ymax - box.ymin) / 10}%`,
                            }}
                          >
                            <span className={cn(
                              "absolute -top-6 left-0 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                              box.selected ? "bg-blue-500 text-white" : "bg-slate-400 text-white"
                            )}>
                              {box.selected ? 'Selected' : 'Ignored'}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Logo Replacement Upload */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-bold text-sm">Replace Logo (Optional)</h4>
                            <p className="text-xs text-slate-400">Upload a logo to overlay on selected areas</p>
                          </div>
                          {replacementPreview && (
                            <button 
                              onClick={() => setReplacementPreview(null)}
                              className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {replacementPreview ? (
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white rounded-xl border border-slate-200 p-2 overflow-hidden">
                              <img src={replacementPreview} className="w-full h-full object-contain" />
                            </div>
                            <span className="text-sm font-medium text-slate-600">Logo ready for replacement</span>
                          </div>
                        ) : (
                          <div 
                            {...getLogoProps()} 
                            className={cn(
                              "border-2 border-dashed rounded-xl py-6 flex flex-col items-center justify-center cursor-pointer transition-all",
                              isLogoActive ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                            )}
                          >
                            <input {...getLogoInput()} />
                            <Plus className="w-6 h-6 text-slate-300 mb-2" />
                            <p className="text-xs font-semibold text-slate-400">Click to upload brand logo</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={reset}
                          className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleProcess}
                          disabled={!selectedImage.detectedBoxes.some(b => b.selected)}
                          className="flex-[2] py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-black/10"
                        >
                          <Sparkles className="w-5 h-5 text-blue-400 fill-blue-400" />
                          {selectedImage.replacementLogoUrl ? 'Apply Logo Replacement' : 'Remove Watermarks'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : state === 'batch_processing' ? (
                  <motion.div
                    key="batch"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-2xl font-bold">Batch Processing</h3>
                          <p className="text-slate-500 text-sm">{images.length} images in queue</p>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={reset}
                            className="px-6 py-3 border border-slate-200 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all"
                          >
                            <Trash2 className="w-4 h-4 text-slate-400" />
                            Clear All
                          </button>
                          <button 
                            onClick={handleProcess}
                            disabled={images.every(img => img.status === 'completed')}
                            className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                          >
                            <Play className="w-4 h-4" />
                            Process All
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {images.map((img) => (
                          <div 
                            key={img.id}
                            className={cn(
                              "group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all p-2",
                              img.status === 'completed' ? "border-green-100 bg-green-50" : 
                              img.status === 'processing' ? "border-blue-100 bg-blue-50" : 
                              "border-slate-100 bg-slate-50"
                            )}
                          >
                            {img.processedUrl || img.originalUrl ? (
                              <img 
                                src={img.processedUrl || img.originalUrl} 
                                className={cn(
                                  "w-full h-full object-cover rounded-xl transition-opacity",
                                  img.status === 'processing' && "opacity-50"
                                )} 
                                alt={img.name}
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-200 animate-pulse rounded-xl" />
                            )}
                            
                            <div className="absolute inset-x-2 bottom-2 flex justify-between items-center bg-white/90 backdrop-blur-sm p-2 rounded-lg translate-y-full group-hover:translate-y-0 transition-transform shadow-sm">
                              <span className="text-[10px] font-bold truncate max-w-[60px]">{img.name}</span>
                              <div className="flex gap-1">
                                {img.status === 'completed' && (
                                  <button onClick={() => downloadImage(img)} className="p-1 hover:text-blue-600">
                                    <Download className="w-3 h-3" />
                                  </button>
                                )}
                                {img.status === 'error' && (
                                  <button onClick={() => processImage(img)} className="p-1 text-red-500 hover:text-red-700">
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => { setSelectedId(img.id); setState('refining'); }}
                                  className="p-1 hover:text-blue-600"
                                >
                                  <RefreshCw className={cn("w-3 h-3", img.status === 'error' && "text-slate-400")} />
                                </button>
                              </div>
                            </div>

                            {img.status === 'processing' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                              </div>
                            )}

                            {img.status === 'completed' && (
                              <div className="absolute top-2 right-2 p-1 bg-green-500 rounded-full text-white shadow-sm">
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {images.some(img => img.status === 'completed') && (
                        <div className="mt-8 pt-8 border-t border-slate-50 flex justify-end">
                          <button 
                            onClick={downloadAllAsZip}
                            className="bg-black text-white px-8 py-4 rounded-3xl font-bold flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-black/10 active:scale-[0.98]"
                          >
                            <Files className="w-5 h-5 text-blue-400" />
                            Download All (ZIP)
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : state === 'completed' && selectedImage ? (
                  <motion.div
                    key="completed"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                      <div className="p-6 bg-slate-50/50 flex items-center justify-between border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-sm font-semibold">Image processed successfully</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setState('batch_processing')}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 mr-4"
                          >
                            Back to Batch
                          </button>
                          <button onClick={reset} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Result</span>
                          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center relative">
                            {selectedImage.processedUrl ? (
                              <img src={selectedImage.processedUrl} alt="Processed" className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                              </div>
                            )}
                            
                            {selectedImage.status === 'error' && (
                              <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center p-8 text-center">
                                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                                <h4 className="font-bold text-red-900 mb-2">Processing Failed</h4>
                                <p className="text-red-600 text-sm mb-6">{error || "Something went wrong locally or with the AI service."}</p>
                                <button 
                                  onClick={() => processImage(selectedImage)}
                                  className="px-6 py-3 bg-red-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Try Again
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col justify-end items-center gap-4">
                          <button 
                            onClick={() => downloadImage()}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                          >
                            <Download className="w-5 h-5" />
                            Download
                          </button>
                          <button 
                            onClick={reset}
                            className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                          >
                            Upload New Batch
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-64 bg-slate-50 border-2 border-slate-100 rounded-3xl flex flex-col items-center justify-center space-y-6 p-8 text-center"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-lg">
                        {state === 'uploading' ? 'Uploading...' : 
                         state === 'detecting' ? 'Searching for watermarks...' : 
                         'Clearing image...'}
                      </p>
                      <p className="text-slate-400 text-sm italic">This may take a moment</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Preview / Comparison Simulation */}
          <div className="hidden lg:col-span-6 lg:flex justify-end">
            <div className="w-[400px] bg-white rounded-[40px] shadow-2xl shadow-blue-900/10 border border-slate-100 overflow-hidden relative group">
              <div className="relative h-[480px] w-full bg-slate-200">
                {/* Simulated Photo */}
                <div 
                  className="absolute inset-0 bg-cover bg-center" 
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=800')" }}
                />
                
                {/* Watermark Overlay (Before) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                  <div className="grid grid-cols-2 gap-x-12 gap-y-16 -rotate-12">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i} className="text-2xl font-bold text-white uppercase tracking-tighter mix-blend-overlay">Watermark</span>
                    ))}
                  </div>
                </div>

                {/* AI Cleaned Overlay (After) */}
                <motion.div 
                  initial={{ width: "50%" }}
                  whileHover={{ width: "10%" }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="absolute left-0 top-0 bottom-0 bg-cover bg-center border-r-4 border-white shadow-[8px_0_15px_rgba(0,0,0,0.1)] z-10 overflow-hidden"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=800')" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                    <div className="grid grid-cols-2 gap-x-12 gap-y-16 -rotate-12 translate-x-20">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} className="text-2xl font-bold text-white uppercase tracking-tighter">Watermark</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
                
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-blue-600 shadow-sm border border-slate-100 z-20">
                  AI CLEANED
                </div>
                
                {/* Slider Mockup */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center z-30">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-3 bg-slate-300 rounded-full" />
                    <div className="w-1 h-3 bg-slate-300 rounded-full" />
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-2 bg-white">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accuracy Result</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Complex Stamp Removal</span>
                  <span className="text-sm text-green-500 font-bold">99.8% Quality</span>
                </div>
              </div>
            </div>
          </div>
        </div>

            {/* Features Bottom Bar */}
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: "Simple & Fast",
              description: "Designed for simplicity. No complex editing skills needed. Remove watermarks in just a matter of seconds."
            },
            {
              icon: Files,
              title: "Bulk Removal",
              description: "Batch processing is available for a flawless experience. Process multiple images simultaneously with one click."
            },
            {
              icon: Shield,
              title: "AI Precision",
              description: "Our professional AI reconstruction preserves the original image texture and details seamlessly."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
          </>
        )}
      </main>

      {/* Footer / Stats Bar */}
      <footer className="h-16 px-6 md:px-12 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 tracking-widest uppercase bg-white">
        <div className="hidden sm:flex gap-12">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            <span>Server Status: Optimal</span>
          </div>
          <span>Total Images: 1.2M+</span>
        </div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
          <a href="#" className="hover:text-blue-600 transition-colors font-bold text-slate-900 border-b-2 border-blue-600">Contact</a>
        </div>
      </footer>
    </div>
  );
}
