import React, { memo, useEffect, useRef, useState } from 'react';
import { X, Eye, Video, Sliders, Image as ImageIcon, Scan, Target } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { Haptic } from '../utils/haptics';

interface CameraViewProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  ghostImage?: string;
  autoStartAr?: boolean;
}

// PERFORMANCE: Cap AR analysis resolution. 
// Sending 4K frames to AI is wasteful and blocks the main thread.
// 480px width is sufficient for pest detection/biomass.
const AR_ANALYSIS_WIDTH = 480;
const AR_FRAME_INTERVAL = 500; // ms between AI frames (2 FPS)

export const CameraView = memo(({ onCapture, onCancel, ghostImage, autoStartAr = false }: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
  const [arMode, setArMode] = useState(false);
  const [arData, setArData] = useState<any>(null);
  
  // Animation Frame Reference for clean cancellation
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // New Camera Logic: Zoom & Flash
  const [zoom, setZoom] = useState(1);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const touchStartDist = useRef<number | null>(null);
  const startZoom = useRef(1);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 2160 } } 
        });
        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
        } else {
          stream?.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    };

    startCamera();
    
    // Auto-start AR if requested
    if (autoStartAr) {
        // Small delay to let camera initialize
        setTimeout(() => startArSession(), 800);
    }

    return () => {
      isMounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      geminiService.stopLiveAnalysis();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Pinch to Zoom Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
        const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartDist.current = d;
        startZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
        const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        // Calculate relative zoom change
        const ratio = d / touchStartDist.current;
        const newZoom = Math.min(Math.max(startZoom.current * ratio, 1), 3); // Clamp 1x - 3x
        setZoom(newZoom);
    }
  };

  const stopArSession = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    geminiService.stopLiveAnalysis();
    setArMode(false);
    setArData(null);
  };

  const processArFrame = (timestamp: number) => {
    if (!videoRef.current || !canvasRef.current) {
        rafRef.current = requestAnimationFrame(processArFrame);
        return;
    }
    
    // Throttling Logic
    if (timestamp - lastFrameTimeRef.current >= AR_FRAME_INTERVAL) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.videoWidth > 0) {
            // Downscale for AI Analysis
            const scale = AR_ANALYSIS_WIDTH / video.videoWidth;
            canvas.width = AR_ANALYSIS_WIDTH;
            canvas.height = video.videoHeight * scale;
            
            const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // quality 0.6 is fine for AI
                const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                geminiService.sendLiveFrame(base64);
            }
        }
        lastFrameTimeRef.current = timestamp;
    }

    // Continue loop
    rafRef.current = requestAnimationFrame(processArFrame);
  };

  const startArSession = async () => {
    setArMode(true);
    setArData({ status: "CONNECTING..." });
    try {
      await geminiService.startLiveAnalysis(
        (data) => setArData(data),
        (error) => {
            console.error("AR Session Error", error);
            Haptic.error();
            stopArSession();
        },
        () => {
            console.log("AR Session Closed Remotely");
            stopArSession();
        }
      );
      
      // Kickoff loop using rAF
      lastFrameTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(processArFrame);

    } catch (e) {
      console.error("Failed to start AR", e);
      setArMode(false);
      Haptic.error();
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setFlashTrigger(true);
      Haptic.tap();
      setTimeout(() => setFlashTrigger(false), 150);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Full Resolution Capture
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Zoom-Aware Crop Logic
        const sWidth = video.videoWidth / zoom;
        const sHeight = video.videoHeight / zoom;
        const sx = (video.videoWidth - sWidth) / 2; 
        const sy = (video.videoHeight - sHeight) / 2; 
        
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
          if (blob) {
            setTimeout(() => {
               onCapture(new File([blob], "capture.jpg", { type: "image/jpeg" }));
            }, 200);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onCapture(e.target.files[0]);
      }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
       {/* Flash Overlay */}
       <div className={`absolute inset-0 bg-white pointer-events-none z-[60] transition-opacity duration-150 ease-out ${flashTrigger ? 'opacity-100' : 'opacity-0'}`} />

       <video 
         ref={videoRef} 
         autoPlay 
         playsInline 
         muted
         className="w-full h-full object-cover transition-transform duration-75 ease-linear will-change-transform"
         style={{ transform: `scale(${zoom})` }}
       />
       
       <button 
         onClick={() => { Haptic.tap(); onCancel(); }}
         className="absolute top-6 right-6 z-50 p-3 rounded-full bg-black/40 backdrop-blur text-white border border-white/10 active:scale-90 transition-all"
         style={{ marginTop: 'env(safe-area-inset-top)' }}
       >
         <X className="w-6 h-6" />
       </button>
       
       {ghostImage && !arMode && (
         <div className="absolute inset-0 pointer-events-none flex items-center justify-center transition-opacity duration-200" style={{ opacity: ghostOpacity }}>
           <img src={ghostImage} className="w-full h-full object-cover grayscale mix-blend-screen" alt="ghost" />
         </div>
       )}

       {zoom > 1.05 && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 z-40 animate-fade-in">
             <div className="text-neon-green font-mono text-xs font-bold">{zoom.toFixed(1)}x</div>
          </div>
       )}
       
       {arMode && (
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
             {/* Reticle UI */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-neon-green/30 rounded-lg">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-green"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-green"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-green"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-green"></div>
                
                {/* Center Crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4">
                   <div className="absolute top-1/2 left-0 right-0 h-px bg-neon-green/50"></div>
                   <div className="absolute left-1/2 top-0 bottom-0 w-px bg-neon-green/50"></div>
                </div>

                {/* Scan Line */}
                <div className="absolute left-0 right-0 h-px bg-neon-green shadow-[0_0_10px_#00ffa3] animate-scan opacity-50"></div>
             </div>

             {/* Connecting Status */}
             {(!arData || arData.status === "CONNECTING...") && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-40">
                   <div className="bg-black/60 backdrop-blur-md border border-neon-green/30 rounded-full px-6 py-2 animate-pulse flex items-center gap-2">
                      <div className="w-2 h-2 bg-neon-green rounded-full animate-ping"></div>
                      <div className="text-neon-green font-mono text-xs tracking-widest">INITIALIZING NEURAL LINK...</div>
                   </div>
                </div>
             )}
             
             {/* HUD Data Overlay */}
             {arData && arData.status !== "CONNECTING..." && (
                <div className="absolute inset-0 p-6 pt-safe-top flex flex-col justify-between">
                    <div className="flex justify-between items-start pt-16">
                        <div className="bg-black/60 backdrop-blur-md border-l-2 border-neon-green p-3 rounded-r-xl animate-slide-right">
                           <div className="text-[9px] text-neon-green font-mono mb-1 tracking-widest">COLA COUNT</div>
                           <div className="text-3xl font-bold text-white font-mono">{arData.colaCount || '--'}</div>
                        </div>
                        <div className="bg-black/60 backdrop-blur-md border-r-2 border-neon-green p-3 rounded-l-xl text-right animate-slide-left">
                           <div className="text-[9px] text-neon-green font-mono mb-1 tracking-widest">HEALTH</div>
                           <div className="text-xl font-bold text-white font-mono">{arData.healthStatus || '--'}</div>
                        </div>
                    </div>

                    {arData.criticalWarning && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-32 w-64 text-center">
                             <div className="bg-alert-red/20 backdrop-blur-md border border-alert-red/50 rounded-xl p-4 animate-pulse">
                                 <div className="flex items-center justify-center gap-2 text-alert-red font-bold uppercase tracking-widest text-xs mb-1">
                                    <Target className="w-4 h-4"/> WARNING DETECTED
                                 </div>
                                 <div className="text-white font-bold">{arData.criticalWarning}</div>
                             </div>
                        </div>
                    )}
                    
                     <div className="mb-24 flex justify-center">
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 flex gap-4 animate-slide-up">
                           <div>
                              <div className="text-[9px] text-gray-400 font-mono mb-1 tracking-widest uppercase">Biomass Density</div>
                              <div className="text-lg font-bold text-white font-mono">{arData.biomassEstimate || '--'}</div>
                           </div>
                        </div>
                     </div>
                </div>
             )}
             
             {/* Background Grid Effect */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,163,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,163,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none -z-10 mask-image-gradient"></div>
          </div>
       )}
       
       <canvas ref={canvasRef} className="hidden" />

       <div className="absolute bottom-0 left-0 right-0 pb-20 pt-32 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center gap-6 z-30 safe-area-bottom pointer-events-auto">
          {ghostImage && !arMode && (
            <div className="w-64 flex flex-col gap-2 bg-black/40 p-3 rounded-xl backdrop-blur border border-white/5">
              <div className="flex justify-between text-[10px] font-mono text-neon-green">
                 <span className="flex items-center gap-1"><Sliders className="w-3 h-3"/> GHOST ALIGN</span>
                 <span>{Math.round(ghostOpacity * 100)}%</span>
              </div>
              <input 
                type="range" min="0" max="0.8" step="0.05" value={ghostOpacity} 
                onChange={(e) => setGhostOpacity(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-green"
              />
            </div>
          )}

          <div className="flex justify-center items-center gap-8">
            <button 
               onClick={() => fileInputRef.current?.click()} 
               className="p-4 rounded-full bg-white/10 backdrop-blur text-white active:scale-90 transition-all border border-white/5"
            >
               <ImageIcon className="w-6 h-6" />
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileSelect} 
               />
            </button>
            
            <button onClick={takePhoto} className="w-20 h-20 rounded-full bg-white border-4 border-gray-300/50 flex items-center justify-center active:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.2)]">
               <div className="w-16 h-16 bg-white rounded-full border border-gray-200"></div>
            </button>
            
            <button 
              onClick={() => { Haptic.tap(); arMode ? stopArSession() : startArSession(); }}
              className={`p-4 rounded-full backdrop-blur active:scale-90 transition-all border ${arMode ? 'bg-neon-green text-black border-neon-green shadow-[0_0_20px_rgba(0,255,163,0.5)]' : 'bg-white/10 text-white border-white/10'}`}
            >
              {arMode ? <Eye className="w-6 h-6" /> : <Scan className="w-6 h-6" />}
            </button>
          </div>
       </div>
    </div>
  );
});
CameraView.displayName = 'CameraView';