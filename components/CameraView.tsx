
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, Sliders, Scan, Target, Check, Activity, Leaf, Hash, RefreshCw, AlertCircle, Mic, MicOff } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { Haptic } from '../utils/haptics';
import { ArOverlayData, ArPreferences } from '../types';

interface CameraViewProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  ghostImage?: string;
  autoStartAr?: boolean;
  arPreferences: ArPreferences;
  onUpdatePreferences: (prefs: ArPreferences) => void;
}

const AR_ANALYSIS_WIDTH = 480;
const AR_FRAME_INTERVAL = 300; // ~3.3 FPS for better live tracking

export const CameraView = memo(({ onCapture, onCancel, ghostImage, autoStartAr = false, arPreferences, onUpdatePreferences }: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [arMode, setArMode] = useState(false);
  const [arData, setArData] = useState<ArOverlayData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);

  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const arActiveRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [flashTrigger, setFlashTrigger] = useState(false);
  
  const touchStartDist = useRef<number | null>(null);
  const startZoom = useRef(1);

  const [localPrefs, setLocalPrefs] = useState<ArPreferences>(arPreferences);

  useEffect(() => {
    setLocalPrefs(arPreferences);
  }, [arPreferences]);

  const togglePref = (key: keyof ArPreferences) => {
    Haptic.light();
    setLocalPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveSettings = () => {
    Haptic.success();
    onUpdatePreferences(localPrefs);
    setShowSettings(false);
  };

  const toggleMic = () => {
     Haptic.tap();
     const newState = !micEnabled;
     setMicEnabled(newState);
     if (mediaStreamRef.current) {
         mediaStreamRef.current.getAudioTracks().forEach(track => track.enabled = newState);
     }
  };

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

  const stopArSession = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    geminiService.stopLiveAnalysis();
    setArMode(false);
    setArData(null);
    arActiveRef.current = false;
  }, []);

  const processArFrame = useCallback((timestamp: number) => {
    if (!videoRef.current || !canvasRef.current) {
        rafRef.current = requestAnimationFrame(processArFrame);
        return;
    }
    
    // Frame Throttling
    if (timestamp - lastFrameTimeRef.current >= AR_FRAME_INTERVAL) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState === 4 && video.videoWidth > 0) {
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
  }, []);

  const startArSession = useCallback(async () => {
    setArMode(true);
    setArData({ status: "CONNECTING..." });
    Haptic.light();
    arActiveRef.current = true;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    try {
      // Pass the active media stream (with audio) to the service
      await geminiService.startLiveAnalysis(
        mediaStreamRef.current,
        (data) => setArData(data as ArOverlayData),
        (error) => {
            console.error("AR Session Error", error);
            Haptic.error();
            setArData({ status: "CONNECTION FAILED", criticalWarning: "Network Error" });
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            geminiService.stopLiveAnalysis();
        },
        () => {
            console.log("AR Session Closed Remotely");
            if (arActiveRef.current) stopArSession();
        }
      );

      lastFrameTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(processArFrame);

    } catch (e) {
      console.error("Failed to start AR", e);
      setArData({ status: "INIT FAILED" });
      Haptic.error();
    }
  }, [processArFrame, stopArSession]);

  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        // Request Audio and Video
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 2160 } },
          audio: true // Important for Live Conversation
        });

        mediaStreamRef.current = stream;

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.volume = 0; // Avoid feedback loop from local playback
        } else {
          stream.getTracks().forEach(track => track.stop());
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
      stopArSession();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [autoStartAr, startArSession, stopArSession]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setFlashTrigger(true);
      Haptic.tap();
      setTimeout(() => setFlashTrigger(false), 150);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
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

  const isErrorState = arData?.status?.includes('FAILED');

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150 ${flashTrigger ? 'opacity-100' : 'opacity-0'}`}></div>

      <div className="relative flex-1 bg-black overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-100 ease-linear"
          style={{ transform: `scale(${zoom})` }}
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {ghostImage && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-screen">
             <img src={ghostImage} className="w-full h-full object-cover grayscale" alt="Ghost" />
          </div>
        )}

        {/* AR HUD */}
        {arMode && (
          <div className="absolute inset-0 z-20 pointer-events-none p-6 pt-24">
             <div className={`border rounded-xl p-4 backdrop-blur-sm transition-colors duration-300 ${isErrorState ? 'border-alert-red/30 bg-alert-red/5' : 'border-neon-green/30 bg-neon-green/5 shadow-[0_0_20px_rgba(0,255,163,0.1)]'}`}>
                <div className="flex justify-between items-center mb-2">
                   <div className="flex items-center gap-2">
                      {isErrorState ? <AlertCircle className="w-4 h-4 text-alert-red" /> : <Scan className="w-4 h-4 text-neon-green animate-pulse" />}
                      <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isErrorState ? 'text-alert-red' : 'text-neon-green'}`}>Targeting System</span>
                   </div>
                   <div className="flex items-center gap-2">
                       {/* Mic Status Indicator */}
                       <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${micEnabled ? 'bg-neon-blue/20 text-neon-blue' : 'bg-gray-800 text-gray-500'}`}>
                          {micEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                          <span className="text-[9px] font-bold">VOX</span>
                       </div>
                       <div className={`text-[10px] font-mono ${isErrorState ? 'text-alert-red font-bold' : 'text-neon-green'}`}>{arData?.status || "SCANNING"}</div>
                   </div>
                </div>
                {arData && (
                   <div className="space-y-1">
                      {arPreferences.showColaCount && arData.colaCount !== undefined && (
                        <div className="flex justify-between text-xs font-mono text-white animate-slide-up">
                            <span>Colas:</span>
                            <span className="font-bold text-neon-green">{arData.colaCount}</span>
                        </div>
                      )}
                      {arPreferences.showBiomass && arData.biomassEstimate && (
                        <div className="flex justify-between text-xs font-mono text-white animate-slide-up">
                            <span>Density:</span>
                            <span className="font-bold">{arData.biomassEstimate}</span>
                        </div>
                      )}
                      {arPreferences.showHealth && arData.healthStatus && (
                        <div className="flex justify-between text-xs font-mono text-white animate-slide-up">
                            <span>Health:</span>
                            <span className="font-bold">{arData.healthStatus}</span>
                        </div>
                      )}
                      {arData.criticalWarning && (
                         <div className="mt-2 text-xs font-bold text-alert-red bg-alert-red/20 px-2 py-1 rounded animate-pulse">
                            WARNING: {arData.criticalWarning}
                         </div>
                      )}
                   </div>
                )}
                
                {isErrorState && (
                    <div className="mt-4 flex justify-center pointer-events-auto">
                        <button 
                          onClick={startArSession}
                          className="px-4 py-2 bg-alert-red text-white text-xs font-bold rounded-full shadow-lg active:scale-95 transition-transform flex items-center gap-2"
                        >
                          <RefreshCw className="w-3 h-3" />
                          RETRY CONNECTION
                        </button>
                    </div>
                )}
             </div>

             {!isErrorState && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-neon-green/30 rounded-lg flex items-center justify-center opacity-50">
                    <Target className="w-8 h-8 text-neon-green/50" />
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-green"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-green"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-green"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-green"></div>
                </div>
             )}
          </div>
        )}
      </div>

      {showSettings && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
           <div className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-neon-green" />
                    HUD Configuration
                 </h3>
                 <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                    <X className="w-5 h-5 text-gray-400" />
                 </button>
              </div>
              
              <div className="space-y-4 mb-8">
                 <div 
                   onClick={() => togglePref('showColaCount')}
                   className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 active:bg-white/10 transition-colors cursor-pointer"
                 >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neon-green/10">
                            <Hash className="w-4 h-4 text-neon-green" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white block">Cola Counter</span>
                          <span className="text-[10px] text-gray-500 block">Track flower sites</span>
                        </div>
                    </div>
                    <button className={`w-12 h-7 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-neon-green/50 ${localPrefs.showColaCount ? 'bg-neon-green shadow-[0_0_10px_rgba(0,255,163,0.3)]' : 'bg-gray-700'}`}>
                       <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${localPrefs.showColaCount ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                 </div>
                 
                 <div 
                   onClick={() => togglePref('showBiomass')}
                   className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 active:bg-white/10 transition-colors cursor-pointer"
                 >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neon-green/10">
                            <Leaf className="w-4 h-4 text-neon-green" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white block">Biomass Density</span>
                          <span className="text-[10px] text-gray-500 block">Structure analysis</span>
                        </div>
                    </div>
                    <button className={`w-12 h-7 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-neon-green/50 ${localPrefs.showBiomass ? 'bg-neon-green shadow-[0_0_10px_rgba(0,255,163,0.3)]' : 'bg-gray-700'}`}>
                       <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${localPrefs.showBiomass ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                 </div>

                 <div 
                   onClick={() => togglePref('showHealth')}
                   className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 active:bg-white/10 transition-colors cursor-pointer"
                 >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neon-green/10">
                            <Activity className="w-4 h-4 text-neon-green" />
                        </div>
                        <div>
                           <span className="text-sm font-medium text-white block">Health Status</span>
                           <span className="text-[10px] text-gray-500 block">Vigor & stress</span>
                        </div>
                    </div>
                    <button className={`w-12 h-7 rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-neon-green/50 ${localPrefs.showHealth ? 'bg-neon-green shadow-[0_0_10px_rgba(0,255,163,0.3)]' : 'bg-gray-700'}`}>
                       <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${localPrefs.showHealth ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                 </div>
              </div>
              
              <button 
                onClick={saveSettings}
                className="w-full py-4 bg-neon-green text-black font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:bg-neon-green/90"
              >
                <Check className="w-5 h-5" />
                Apply Changes
              </button>
           </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-xl p-6 pb-safe-bottom">
        <div className="flex items-center justify-between mb-6 px-4">
           {/* Zoom Control */}
           <div className="flex items-center gap-3 bg-white/10 rounded-full px-3 py-1.5 border border-white/5">
               <button onClick={() => setZoom(Math.max(1, zoom - 0.5))} className="p-1 text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-4 h-4 rotate-180" /></button>
               <span className="text-xs font-mono font-bold w-8 text-center text-white">{zoom.toFixed(1)}x</span>
               <button onClick={() => setZoom(Math.min(3, zoom + 0.5))} className="p-1 text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
           </div>
           
           <div className="flex gap-2">
                {/* Mic Toggle */}
                {arMode && (
                    <button 
                        onClick={toggleMic}
                        className={`p-2.5 rounded-full border active:scale-95 transition-all ${micEnabled ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'bg-white/10 border-white/5 text-gray-400'}`}
                    >
                        {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>
                )}
                {/* Settings */}
                <button 
                    onClick={() => { Haptic.tap(); setShowSettings(true); }}
                    className="p-2.5 rounded-full bg-white/10 text-gray-400 hover:text-white border border-white/5 active:scale-95 transition-transform"
                >
                    <Sliders className="w-4 h-4" />
                </button>
           </div>

           {/* AR Toggle */}
           <button 
             onClick={() => { Haptic.tap(); arMode ? stopArSession() : startArSession(); }}
             className={`px-4 py-1.5 rounded-full text-xs font-bold font-mono border transition-all shadow-lg ${arMode ? 'bg-neon-green text-black border-neon-green shadow-[0_0_15px_rgba(0,255,163,0.3)]' : 'bg-transparent text-white border-white/20'}`}
           >
             {arMode ? 'AR ACTIVE' : 'AR OFF'}
           </button>
        </div>

        <div className="flex items-center justify-between px-8">
          <button onClick={() => { Haptic.tap(); onCancel(); }} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
            <X className="w-6 h-6" />
          </button>

          <button 
            onClick={takePhoto}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative active:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
             <div className="w-16 h-16 bg-white rounded-full"></div>
          </button>
          
          <button onClick={() => {}} className="p-4 rounded-full bg-transparent text-transparent pointer-events-none">
             <X className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
});
CameraView.displayName = 'CameraView';
