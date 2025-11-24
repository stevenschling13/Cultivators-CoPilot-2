import React, { memo, useEffect, useRef, useState } from 'react';
import { X, Eye, Video, Sliders, Image as ImageIcon, Scan, Target, Zap, ZapOff, ZoomIn } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { Haptic } from '../utils/haptics';

interface CameraViewProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  ghostImage?: string;
  autoStartAr?: boolean;
}

const AR_ANALYSIS_WIDTH = 480;
const AR_FRAME_INTERVAL = 500;

export const CameraView = memo(({ onCapture, onCancel, ghostImage, autoStartAr = false }: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [arMode, setArMode] = useState(false);
  const [arData, setArData] = useState<any>(null);
  
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const [zoom, setZoom] = useState(1);
  const [flashTrigger, setFlashTrigger] = useState(false);
  
  // Pinch zoom state
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
    
    if (autoStartAr) {
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
        const ratio = d / touchStartDist.current;
        const newZoom = Math.min(Math.max(startZoom.current * ratio, 1), 3);
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
    
    if (timestamp - lastFrameTimeRef.current >= AR_FRAME_INTERVAL) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.videoWidth > 0) {
            const scale = AR_ANALYSIS_WIDTH / video.videoWidth;
            canvas.width = AR_ANALYSIS_WIDTH;
            canvas.height = video.videoHeight * scale;
            
            const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                geminiService.sendLiveFrame(base64);
            }
        }
        lastFrameTimeRef.current = timestamp;
    }

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
        // Calculate the center crop rectangle based on zoom level
        const sWidth = video.videoWidth / zoom;
        const sHeight = video.videoHeight / zoom;
        const sx = (video.videoWidth - sWidth) / 2;
        const sy = (video.videoHeight - sHeight) / 2;

        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(file);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      {/* Flash Overlay */}
      <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150 ${flashTrigger ? 'opacity-100' : 'opacity-0'}`}></div>

      <div className="relative flex-1 bg-black overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-100 ease-linear"
          style={{ transform: `scale(${zoom})` }} // Visual feedback for zoom
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Ghost Image Overlay */}
        {ghostImage && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-screen">
             <img src={ghostImage} className="w-full h-full object-cover grayscale" alt="Ghost" />
          </div>
        )}

        {/* AR HUD */}
        {arMode && (
          <div className="absolute inset-0 z-20 pointer-events-none p-6 pt-24">
             <div className="border border-neon-green/30 bg-neon-green/5 rounded-xl p-4 backdrop-blur-sm animate-pulse shadow-[0_0_20px_rgba(0,255,163,0.1)]">
                <div className="flex justify-between items-center mb-2">
                   <div className="flex items-center gap-2">
                      <Scan className="w-4 h-4 text-neon-green" />
                      <span className="text-xs font-mono font-bold text-neon-green uppercase tracking-wider">Targeting System</span>
                   </div>
                   <div className="text-[10px] text-neon-green font-mono">{arData?.status || "SCANNING"}</div>
                </div>
                {arData && arData.colaCount !== undefined && (
                   <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono text-white">
                         <span>Colas:</span>
                         <span className="font-bold text-neon-green">{arData.colaCount}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono text-white">
                         <span>Density:</span>
                         <span className="font-bold">{arData.biomassEstimate}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono text-white">
                         <span>Health:</span>
                         <span className="font-bold">{arData.healthStatus}</span>
                      </div>
                      {arData.criticalWarning && (
                         <div className="mt-2 text-xs font-bold text-alert-red bg-alert-red/20 px-2 py-1 rounded animate-pulse">
                            WARNING: {arData.criticalWarning}
                         </div>
                      )}
                   </div>
                )}
             </div>
             {/* Reticle */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-neon-green/30 rounded-lg flex items-center justify-center opacity-50">
                 <Target className="w-8 h-8 text-neon-green/50" />
                 <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-green"></div>
                 <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-green"></div>
                 <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-green"></div>
                 <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-green"></div>
             </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-xl p-6 pb-safe-bottom">
        <div className="flex items-center justify-between mb-6 px-4">
           {/* Zoom Control */}
           <div className="flex items-center gap-3 bg-white/10 rounded-full px-3 py-1.5">
               <button onClick={() => setZoom(Math.max(1, zoom - 0.5))} className="p-1"><ZoomIn className="w-4 h-4 text-gray-400 rotate-180" /></button>
               <span className="text-xs font-mono font-bold w-8 text-center">{zoom.toFixed(1)}x</span>
               <button onClick={() => setZoom(Math.min(3, zoom + 0.5))} className="p-1"><ZoomIn className="w-4 h-4 text-white" /></button>
           </div>

           {/* AR Toggle */}
           <button 
             onClick={() => { Haptic.tap(); arMode ? stopArSession() : startArSession(); }}
             className={`px-4 py-1.5 rounded-full text-xs font-bold font-mono border transition-all ${arMode ? 'bg-neon-green text-black border-neon-green' : 'bg-transparent text-white border-white/20'}`}
           >
             {arMode ? 'AR ACTIVE' : 'AR OFF'}
           </button>
        </div>

        <div className="flex items-center justify-between px-8">
          <button onClick={() => { Haptic.tap(); onCancel(); }} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
            <X className="w-6 h-6" />
          </button>

          <button 
            onClick={takePhoto}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative active:scale-95 transition-transform"
          >
             <div className="w-16 h-16 bg-white rounded-full"></div>
          </button>
          
          <button onClick={() => {}} className="p-4 rounded-full bg-transparent text-transparent pointer-events-none">
             {/* Spacer */}
             <X className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
});
CameraView.displayName = 'CameraView';