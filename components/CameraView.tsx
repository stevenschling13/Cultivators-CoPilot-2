

import React, { memo, useEffect, useRef, useState } from 'react';
import { X, ZoomIn, Sliders, Target, Mic, MicOff, Layers, Eye, Camera, Sparkles, Loader2, Activity, Save } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { ArOverlayData, ArPreferences, RoomMetrics } from '../types';
import { ArHud } from './ui/ArHud';
import { AudioVisualizer, VisualizerMode } from './ui/AudioVisualizer';
import { useServices } from '../contexts/ServiceContext';

interface CameraViewProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  ghostImage?: string;
  autoStartAr?: boolean;
  arPreferences: ArPreferences;
  onUpdatePreferences: (prefs: ArPreferences) => void;
  activeMetrics?: RoomMetrics | null;
  onSaveArData?: (data: ArOverlayData) => void;
}

const AR_ANALYSIS_WIDTH = 480;
const AR_FRAME_INTERVAL = 300; 

type SpectrumMode = 'normal' | 'structure' | 'stress';

export const CameraView = memo(({ onCapture, onCancel, ghostImage, autoStartAr = false, arPreferences, onUpdatePreferences, activeMetrics, onSaveArData }: CameraViewProps) => {
  const { geminiService } = useServices();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // State
  const [arMode, setArMode] = useState(false);
  const [arData, setArData] = useState<ArOverlayData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('off');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [spectrumMode, setSpectrumMode] = useState<SpectrumMode>('normal');
  const [streamReady, setStreamReady] = useState(false);
  
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const transcriptTimeoutRef = useRef<any>(null);

  const [zoom, setZoom] = useState(1);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  
  const touchStartDist = useRef<number | null>(null);
  const startZoom = useRef(1);

  const [localPrefs, setLocalPrefs] = useState<ArPreferences>(arPreferences);

  const togglePref = (key: keyof ArPreferences) => {
    Haptic.light();
    setLocalPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveSettings = () => {
    Haptic.success();
    onUpdatePreferences(localPrefs);
    setShowSettings(false);
  };

  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 2160 } },
          audio: true 
        });

        if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        mediaStreamRef.current = stream;
        setStreamReady(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.volume = 0; 
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
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const cycleSpectrum = () => {
      Haptic.tap();
      setSpectrumMode(prev => {
          if (prev === 'normal') return 'structure';
          if (prev === 'structure') return 'stress';
          return 'normal';
      });
  };

  const cycleVisualizer = () => {
      Haptic.tap();
      setVisualizerMode(prev => {
          if (prev === 'off') return 'bars';
          if (prev === 'bars') return 'wave';
          if (prev === 'wave') return 'circle';
          return 'off';
      });
  };

  const getFilterStyle = () => {
      switch(spectrumMode) {
          case 'structure': return 'grayscale(100%) contrast(150%) brightness(110%)';
          case 'stress': return 'invert(100%) hue-rotate(180deg) contrast(120%)';
          default: return 'none';
      }
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

  const stopArSession = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    geminiService.stopLiveAnalysis();
    setArMode(false);
    setArData(null);
    setTranscript(null);
  };

  const processArFrame = (timestamp: number) => {
    if (!videoRef.current || !canvasRef.current) {
        rafRef.current = requestAnimationFrame(processArFrame);
        return;
    }
    
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
  };

  const startArSession = async () => {
    setArMode(true);
    setArData({ status: "CONNECTING...", guidance: "Initializing Vision Model" });
    Haptic.light();
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    try {
      await geminiService.startLiveAnalysis(
        mediaStreamRef.current,
        (data) => setArData(data as ArOverlayData),
        (error) => {
            console.error("AR Session Runtime Error", error);
            Haptic.error();
            
            // Semantic Error Mapping
            let status = "CONNECTION LOST";
            let warning = "Stream Interrupted";
            const msg = error.message?.toLowerCase() || '';

            if (msg.includes('quota') || msg.includes('429')) {
                status = "QUOTA EXCEEDED";
                warning = "Daily Limit Reached";
            } else if (msg.includes('safety') || msg.includes('blocked')) {
                status = "SAFETY BLOCK";
                warning = "Visual Filter Triggered";
            } else if (msg.includes('permission') || msg.includes('media')) {
                status = "MEDIA ERROR";
                warning = "Camera/Mic Access Lost";
            } else if (msg.includes('auth') || msg.includes('401')) {
                status = "AUTH FAILED";
                warning = "Invalid API Key";
            }

            setArData({ 
                status, 
                criticalWarning: warning,
                guidance: "Session Terminated" 
            });
            
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            geminiService.stopLiveAnalysis();
        },
        () => {
            if (arMode) stopArSession();
        },
        (text) => {
            setTranscript(text);
            if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
            transcriptTimeoutRef.current = setTimeout(() => setTranscript(null), 4000);
        }
      );
      
      lastFrameTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(processArFrame);

    } catch (e: unknown) {
      console.error("AR Init Error", e);
      Haptic.error();
      
      let status = "INIT FAILED";
      let warning = "Startup Error";
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();

      if (msg.includes('429') || msg.includes('quota')) {
          status = "QUOTA EXCEEDED";
          warning = "Check API Limits";
      } else if (msg.includes('401') || msg.includes('key')) {
          status = "AUTH FAILED";
          warning = "Invalid API Key";
      } else if (msg.includes('permission') || msg.includes('device')) {
          status = "ACCESS DENIED";
          warning = "Check Camera Permissions";
      }

      setArData({ 
          status, 
          criticalWarning: warning,
          guidance: "Unable to Start Session"
      });
    }
  };

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

  const performDeepScan = async () => {
      if (isDeepScanning) return;
      setIsDeepScanning(true);
      Haptic.tap();
      setArData(prev => ({ ...prev, status: "DEEP SCANNING", guidance: "Hold Device Steady" }));
      setTimeout(() => {
          takePhoto(); 
          setIsDeepScanning(false);
      }, 2000);
  };

  const handleSaveSnapshot = () => {
      if (!arData || !onSaveArData) return;
      Haptic.success();
      setFlashTrigger(true);
      setTimeout(() => setFlashTrigger(false), 250);
      onSaveArData(arData);
      stopArSession();
  };

  const handleMetricSelect = (metric: string) => {
      if (!arMode) return;
      
      const prompts: Record<string, string> = {
          colaCount: "Focus on the visible colas. Are they developing normally for this stage? Estimate potential yield.",
          biomass: "Analyze the canopy density (biomass). Is it too dense? Should I defoliate?",
          health: "Provide a detailed health assessment. Look for any signs of nutrient burn or deficiency.",
          stress: "Analyze the plant stress level. Look for heat stress (tacoing), light stress, or water issues.",
          environment: "Correlate the current environment metrics with the visual state. Is the VPD appropriate?",
          warning: "Explain the critical warning. What is the immediate remediation step?",
          guidance: "Clarify the current guidance instruction."
      };

      const text = prompts[metric];
      if (text) {
          setTranscript(`Querying: ${metric.toUpperCase()}...`);
          geminiService.sendLiveTextQuery(text);
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150 ${flashTrigger ? 'opacity-100' : 'opacity-0'}`}></div>

      <div className="relative flex-1 bg-black overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover transition-all duration-300 ease-linear"
          style={{ 
              transform: `scale(${zoom})`,
              filter: getFilterStyle()
          }}
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Extracted Visualizer Component */}
        <AudioVisualizer 
            stream={streamReady ? mediaStreamRef.current : null} 
            mode={visualizerMode}
            className={`absolute bottom-0 left-0 right-0 w-full h-32 pointer-events-none z-40 transition-opacity duration-300 ${visualizerMode !== 'off' ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {ghostImage && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-screen">
             <img src={ghostImage} className="w-full h-full object-cover grayscale" alt="Ghost" />
          </div>
        )}

        {arMode && <ArHud data={arData} isScanning={true} metrics={activeMetrics} onMetricSelect={handleMetricSelect} />}

        <div className="absolute top-24 right-6 z-20 flex flex-col gap-2 items-end">
            {spectrumMode !== 'normal' && (
                <div className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-white/20 text-[10px] font-mono text-white uppercase">
                    FILTER: {spectrumMode}
                </div>
            )}
            {visualizerMode !== 'off' && (
                <div className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-neon-green/20 text-[10px] font-mono text-neon-green uppercase">
                    VIZ: {visualizerMode}
                </div>
            )}
        </div>

        {transcript && arMode && (
            <div className="absolute bottom-32 left-6 right-6 text-center animate-slide-up z-30">
                <div className="inline-block bg-black/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 text-neon-green text-sm font-mono shadow-lg">
                    > {transcript}
                </div>
            </div>
        )}
      </div>

      <div className="bg-black/80 backdrop-blur-xl p-6 pb-safe-bottom relative z-50">
        <div className="flex items-center justify-between mb-6 px-4">
           <div className="flex items-center gap-3 bg-white/10 rounded-full px-3 py-1.5 border border-white/5">
               <button onClick={() => setZoom(Math.max(1, zoom - 0.5))} className="p-1 text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-4 h-4 rotate-180" /></button>
               <span className="text-xs font-mono font-bold w-8 text-center text-white">{zoom.toFixed(1)}x</span>
               <button onClick={() => setZoom(Math.min(3, zoom + 0.5))} className="p-1 text-gray-400 hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
           </div>
           
           <div className="flex gap-2">
                <button 
                    onClick={cycleSpectrum}
                    className={`p-2.5 rounded-full border active:scale-95 transition-all ${spectrumMode !== 'normal' ? 'bg-uv-purple/20 border-uv-purple text-uv-purple' : 'bg-white/10 border-white/5 text-gray-400'}`}
                    title="Spectrum Filter"
                >
                    <Eye className="w-4 h-4" />
                </button>

                <button 
                    onClick={cycleVisualizer}
                    className={`p-2.5 rounded-full border active:scale-95 transition-all ${visualizerMode !== 'off' ? 'bg-neon-green/20 border-neon-green text-neon-green' : 'bg-white/10 border-white/5 text-gray-400'}`}
                    title="Audio Visualizer"
                >
                    <Activity className="w-4 h-4" />
                </button>

                {arMode && (
                    <button 
                        onClick={toggleMic}
                        className={`p-2.5 rounded-full border active:scale-95 transition-all ${micEnabled ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'bg-white/10 border-white/5 text-gray-400'}`}
                    >
                        {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>
                )}
           </div>

           <button 
             onClick={() => { Haptic.tap(); arMode ? stopArSession() : startArSession(); }}
             className={`px-4 py-1.5 rounded-full text-xs font-bold font-mono border transition-all shadow-lg flex items-center gap-2 ${arMode ? 'bg-neon-green text-black border-neon-green shadow-[0_0_15px_rgba(0,255,163,0.3)]' : 'bg-transparent text-white border-white/20'}`}
           >
             <Target className="w-3 h-3" />
             {arMode ? 'AR ON' : 'AR OFF'}
           </button>
        </div>

        <div className="flex items-center justify-between px-8">
          <button onClick={() => { Haptic.tap(); onCancel(); }} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95">
            <X className="w-6 h-6" />
          </button>

          <button 
            onClick={arMode ? performDeepScan : takePhoto}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative active:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.2)] group"
          >
             {isDeepScanning ? (
                <div className="w-16 h-16 bg-neon-green rounded-full flex items-center justify-center animate-pulse">
                    <Loader2 className="w-8 h-8 text-black animate-spin" />
                </div>
             ) : (
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${arMode ? 'bg-neon-blue' : 'bg-white'}`}>
                    {arMode ? <Sparkles className="w-8 h-8 text-black" /> : <Camera className="w-8 h-8 text-black" />}
                </div>
             )}
          </button>
          
          {arMode && arData && (
             <button 
                 onClick={handleSaveSnapshot} 
                 className="p-4 rounded-full bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 transition-all active:scale-95 animate-slide-in-right"
                 title="Pin Data"
             >
                 <Save className="w-6 h-6" />
             </button>
          )}

          {!arMode && (
             <button onClick={() => setShowSettings(true)} className="p-4 rounded-full bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all active:scale-95">
                <Sliders className="w-6 h-6" />
             </button>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
           <div className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-neon-green" /> HUD Layers
                 </h3>
                 <button onClick={() => setShowSettings(false)} className="p-2 bg-white/5 rounded-full">
                    <X className="w-5 h-5 text-gray-400" />
                 </button>
              </div>
              
              <div className="space-y-3 mb-6">
                  {(['showColaCount', 'showBiomass', 'showHealth'] as const).map(key => (
                      <div key={key} onClick={() => togglePref(key)} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                          <span className="text-sm text-white capitalize">{key.replace('show', '')}</span>
                          <div className={`w-10 h-6 rounded-full relative transition-colors ${localPrefs[key] ? 'bg-neon-green' : 'bg-gray-700'}`}>
                              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${localPrefs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                      </div>
                  ))}
              </div>
              <button onClick={saveSettings} className="w-full py-3 bg-neon-green text-black font-bold rounded-xl">Apply</button>
           </div>
        </div>
      )}
    </div>
  );
});
CameraView.displayName = 'CameraView';