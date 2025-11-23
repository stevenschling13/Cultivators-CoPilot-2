
import React, { memo, useEffect, useRef, useState } from 'react';
import { X, Eye, Video, Sliders, Image as ImageIcon } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { Haptic } from '../utils/haptics';

interface CameraViewProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  ghostImage?: string;
}

export const CameraView = memo(({ onCapture, onCancel, ghostImage }: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.3);
  const [arMode, setArMode] = useState(false);
  const [arData, setArData] = useState<any>(null);
  const arIntervalRef = useRef<any>(null);

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
    
    return () => {
      isMounted = false;
      if (arIntervalRef.current) clearInterval(arIntervalRef.current);
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

  const startArSession = async () => {
    setArMode(true);
    setArData({ status: "CONNECTING..." });
    try {
      await geminiService.startLiveAnalysis((data) => setArData(data));
      arIntervalRef.current = setInterval(() => {
         if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (video.videoWidth === 0) return;
            canvas.width = video.videoWidth / 4; 
            canvas.height = video.videoHeight / 4;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
            geminiService.sendLiveFrame(base64);
         }
      }, 500);
    } catch (e) {
      setArMode(false);
    }
  };

  const stopArSession = () => {
    if (arIntervalRef.current) clearInterval(arIntervalRef.current);
    geminiService.stopLiveAnalysis();
    setArMode(false);
    setArData(null);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      // 1. Trigger Flash & Haptics
      setFlashTrigger(true);
      Haptic.tap();
      setTimeout(() => setFlashTrigger(false), 150);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // 2. Set canvas to full video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // 3. Zoom-Aware Crop Logic
        // Calculate the source area to crop based on zoom level
        const sWidth = video.videoWidth / zoom;
        const sHeight = video.videoHeight / zoom;
        const sx = (video.videoWidth - sWidth) / 2; // Center crop X
        const sy = (video.videoHeight - sHeight) / 2; // Center crop Y
        
        // Draw the cropped area to fill the entire canvas
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
          if (blob) {
            // Slight delay to allow flash animation to be perceived
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
         className="w-full h-full object-cover transition-transform duration-75 ease-linear will-change-transform"
         style={{ transform: `scale(${zoom})` }}
       />
       
       <button 
         onClick={onCancel}
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

       {/* Zoom Indicator (Only visible when zoomed) */}
       {zoom > 1.05 && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 z-40 animate-fade-in">
             <div className="text-neon-green font-mono text-xs font-bold">{zoom.toFixed(1)}x</div>
          </div>
       )}
       
       {arMode && arData && (
          <div className="absolute inset-0 pointer-events-none p-6 pt-16 flex flex-col justify-between z-20">
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 backdrop-blur-md border border-neon-green/30 rounded-xl p-3 animate-pulse">
                   <div className="text-[9px] text-neon-green font-mono mb-1 tracking-widest">COLA COUNT</div>
                   <div className="text-3xl font-bold text-white">{arData.colaCount || '--'}</div>
                </div>
                <div className="bg-black/40 backdrop-blur-md border border-neon-green/30 rounded-xl p-3 animate-pulse">
                   <div className="text-[9px] text-neon-green font-mono mb-1 tracking-widest">BIOMASS</div>
                   <div className="text-xl font-bold text-white">{arData.biomassEstimate || '--'}</div>
                </div>
             </div>
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-green/5 to-transparent animate-scan pointer-events-none"></div>
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
              onClick={arMode ? stopArSession : startArSession}
              className={`p-4 rounded-full backdrop-blur active:scale-90 transition-all border ${arMode ? 'bg-neon-green text-black border-neon-green shadow-[0_0_20px_rgba(0,255,163,0.5)]' : 'bg-white/10 text-white border-white/10'}`}
            >
              {arMode ? <Eye className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          </div>
       </div>
    </div>
  );
});
CameraView.displayName = 'CameraView';
