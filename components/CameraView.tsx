
import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import { X, ZoomIn, Sliders, Activity, Save, AlertCircle, Eye } from 'lucide-react';
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

// Engineering Constants for Motion Gating
const AR_ANALYSIS_WIDTH = 512;
const AR_FRAME_INTERVAL = 1500; // ms between AI calls
const MOTION_CHECK_INTERVAL = 100; // ms throttle for motion detection (10fps) - Optimization
const MOTION_SAMPLE_SIZE = 32; // 32x32 pixel grid for ultra-fast diffing
const STABILITY_THRESHOLD = 75; // 0-100 score required to trigger lock (100=still)
const LOCK_DURATION_MS = 300; // Time required to hold stable before firing

type SpectrumMode = 'normal' | 'structure' | 'stress';

export const CameraView = memo(({ onCapture, onCancel, ghostImage, autoStartAr = false, arPreferences, onUpdatePreferences, activeMetrics, onSaveArData }: CameraViewProps) => {
  const { geminiService } = useServices();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // --- Motion Engine Refs ---
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null); // High quality for AI
  const motionCanvasRef = useRef<HTMLCanvasElement>(null);   // Low quality for Diffing
  const previousFrameData = useRef<Uint8ClampedArray | null>(null);
  const lastStableTime = useRef<number>(0);
  const lastAiCallTime = useRef<number>(0);
  const lastMotionCheckTime = useRef<number>(0);
  const isProcessingAi = useRef<boolean>(false);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // State
  const [arMode, setArMode] = useState(false);
  const [arData, setArData] = useState<ArOverlayData>({
      status: "INITIALIZING",
      stability: 0,
      confidence: 0,
      isScanning: false
  });
  
  const [micEnabled, setMicEnabled] = useState(true);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('off');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [spectrumMode, setSpectrumMode] = useState<SpectrumMode>('normal');
  const [streamReady, setStreamReady] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const rafRef = useRef<number | null>(null);
  const transcriptTimeoutRef = useRef<any>(null);

  const [zoom, setZoom] = useState(1);
  const [flashTrigger, setFlashTrigger] = useState(false);
  const touchStartDist = useRef<number | null>(null);
  const startZoom = useRef(1);

  // --- Camera Initialization ---
  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      setPermissionError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (isMounted) setPermissionError("Camera API unavailable. Secure context required.");
          return;
      }

      const handleSuccess = (stream: MediaStream) => {
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
      };

      try {
        // Attempt 1: High Spec (4K ideal)
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true 
        });
        handleSuccess(stream);
      } catch (err) {
        try {
            // Attempt 2: Fallback
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' },
                audio: false 
            });
            if (isMounted) setMicEnabled(false);
            handleSuccess(stream);
        } catch (finalErr: any) {
            if (isMounted) setPermissionError("Camera access denied.");
        }
      }
    };

    startCamera();
    if (autoStartAr) setTimeout(() => startArSession(), 800);

    return () => {
      isMounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      geminiService.stopLiveAnalysis();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const stopArSession = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    geminiService.stopLiveAnalysis();
    setArMode(false);
    setArData(prev => ({ ...prev, status: "OFFLINE", isScanning: false }));
    setTranscript(null);
  }, [geminiService]);

  /**
   * SMART VISION PIPELINE
   * 1. Downsample frame to 32x32
   * 2. Calculate Pixel Diff (Luminosity)
   * 3. Determine Stability Score (0-100)
   * 4. Gate AI Requests based on Lock Status
   */
  const processFrame = useCallback((timestamp: number) => {
    // Safety check: ensure component is still mounted and video is ready
    if (!videoRef.current || !arMode || videoRef.current.paused || videoRef.current.ended) return;
    
    const video = videoRef.current;
    
    // --- PHASE 1: MOTION DETECTION (Engine) ---
    // Optimization: Throttle motion checks to 10fps to save battery
    let stabilityScore = arData.stability; // Keep prev score if throttled
    
    if (timestamp - lastMotionCheckTime.current > MOTION_CHECK_INTERVAL) {
        lastMotionCheckTime.current = timestamp;
        
        if (video.readyState === 4) {
            // Init Motion Canvas on fly if needed
            if (!motionCanvasRef.current) {
                const mc = document.createElement('canvas');
                mc.width = MOTION_SAMPLE_SIZE;
                mc.height = MOTION_SAMPLE_SIZE;
                motionCanvasRef.current = mc;
            }
            
            const motionCtx = motionCanvasRef.current.getContext('2d', { willReadFrequently: true, alpha: false });
            if (motionCtx) {
                motionCtx.drawImage(video, 0, 0, MOTION_SAMPLE_SIZE, MOTION_SAMPLE_SIZE);
                const frameData = motionCtx.getImageData(0, 0, MOTION_SAMPLE_SIZE, MOTION_SAMPLE_SIZE).data;
                
                if (previousFrameData.current) {
                    let totalDiff = 0;
                    const pixelCount = MOTION_SAMPLE_SIZE * MOTION_SAMPLE_SIZE;
                    
                    // Compare Luminosity (0.299*R + 0.587*G + 0.114*B)
                    for (let i = 0; i < pixelCount; i++) {
                        const offset = i * 4;
                        const r = frameData[offset];
                        const g = frameData[offset + 1];
                        const b = frameData[offset + 2];
                        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

                        const pr = previousFrameData.current[offset];
                        const pg = previousFrameData.current[offset + 1];
                        const pb = previousFrameData.current[offset + 2];
                        const prevLuma = 0.299 * pr + 0.587 * pg + 0.114 * pb;

                        totalDiff += Math.abs(luma - prevLuma);
                    }
                    
                    const avgDiff = totalDiff / pixelCount;
                    
                    // Sensitivity Tuning:
                    // avgDiff 0 = 100 stability
                    // avgDiff 25 (significant movement) = ~0 stability
                    stabilityScore = Math.max(0, Math.min(100, 100 - (avgDiff * 4)));
                    
                    // Reset Lock Timer if unstable
                    if (stabilityScore < STABILITY_THRESHOLD) {
                        lastStableTime.current = timestamp; 
                    }
                }
                previousFrameData.current = frameData;
            }
        }
    }

    // --- PHASE 2: STATE MACHINE ---
    const timeStable = timestamp - lastStableTime.current;
    const isLocked = timeStable > LOCK_DURATION_MS;
    const isCoolingDown = (timestamp - lastAiCallTime.current) < AR_FRAME_INTERVAL;
    
    let status: ArOverlayData['status'] = "ACQUIRING";
    let guidance = "STABILIZE DEVICE";

    if (isLocked) {
        if (isProcessingAi.current) status = "ANALYZING";
        else if (isCoolingDown) status = "LOCKED";
        else status = "LOCKED"; // Ready to fire
        guidance = isProcessingAi.current ? "PROCESSING..." : "TARGET LOCKED";
    } else {
        status = "ACQUIRING";
        guidance = "STABILIZE DEVICE";
    }

    // Update HUD (High Frequency)
    setArData(prev => ({
        ...prev,
        stability: stabilityScore,
        status: status,
        guidance: guidance,
        isScanning: isProcessingAi.current
    }));

    // --- PHASE 3: INFERENCE TRIGGER ---
    if (isLocked && !isProcessingAi.current && !isCoolingDown) {
        isProcessingAi.current = true;
        lastAiCallTime.current = timestamp;
        
        // Capture High-Res Frame
        if (!analysisCanvasRef.current) analysisCanvasRef.current = document.createElement('canvas');
        const canvas = analysisCanvasRef.current;
        canvas.width = AR_ANALYSIS_WIDTH;
        const scale = AR_ANALYSIS_WIDTH / video.videoWidth;
        canvas.height = video.videoHeight * scale;
        
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Async Conversion to avoid thread blocking
            canvas.toBlob((blob) => {
                if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                            const base64 = reader.result.split(',')[1];
                            geminiService.sendLiveFrame(base64);
                            Haptic.light();
                            
                            // Failsafe timeout to unlock if AI hangs
                            setTimeout(() => { isProcessingAi.current = false; }, 8000);
                        }
                    };
                    reader.readAsDataURL(blob);
                } else {
                    isProcessingAi.current = false;
                }
            }, 'image/jpeg', 0.7);
        }
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [arMode, geminiService, arData.stability]);

  const startArSession = async () => {
    if (permissionError) return;
    setArMode(true);
    setArData(prev => ({ ...prev, status: "INITIALIZING", stability: 0 }));
    Haptic.light();
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    try {
      await geminiService.startLiveAnalysis(
        mediaStreamRef.current,
        (data) => {
            // Merge AI inference with local high-freq state
            setArData(prev => ({
                ...prev,
                ...data, // Overwrite count, biomass, warnings
                stability: prev.stability, // Keep local stability
                status: prev.status === 'ACQUIRING' ? 'ACQUIRING' : 'LOCKED',
                isScanning: false
            }));
            isProcessingAi.current = false; // Unlock for next frame
            Haptic.success(); // Tactile confirm
        },
        (error) => {
            console.error("AR Runtime Error", error);
            setArData(prev => ({ ...prev, status: "WARNING", criticalWarning: "CONNECTION LOST" }));
            isProcessingAi.current = false;
        },
        () => { if (arMode) stopArSession(); },
        (text) => {
            setTranscript(text);
            if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
            transcriptTimeoutRef.current = setTimeout(() => setTranscript(null), 4000);
        }
      );
      
      lastStableTime.current = performance.now();
      rafRef.current = requestAnimationFrame(processFrame);

    } catch (e) {
      console.error("AR Init Error", e);
      stopArSession();
    }
  };

  // --- Interaction Handlers ---

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        touchStartDist.current = d;
        startZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const ratio = d / touchStartDist.current;
        setZoom(Math.min(Math.max(startZoom.current * ratio, 1), 3));
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      setFlashTrigger(true);
      Haptic.tap();
      setTimeout(() => setFlashTrigger(false), 150);

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Handle zoom crop
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

  if (permissionError) {
      return (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-alert-red/10 rounded-full flex items-center justify-center mb-6 border border-alert-red/20">
                  <AlertCircle className="w-10 h-10 text-alert-red" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Sensor Access Denied</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">{permissionError}</p>
              <button onClick={onCancel} className="px-8 py-3 bg-white text-black font-bold rounded-full active:scale-95 transition-transform">Return to Dashboard</button>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in touch-none" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150 ${flashTrigger ? 'opacity-100' : 'opacity-0'}`}></div>

      <div className="relative flex-1 bg-black overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-linear"
          style={{ 
              transform: `scale(${zoom})`,
              // Use Global SVG Filter for Chlorophyll isolation
              filter: spectrumMode === 'structure' ? 'grayscale(100%) contrast(150%) brightness(110%)' : 
                      spectrumMode === 'stress' ? 'url(#chlorophyll)' : 'none'
          }}
        />
        
        {/* Audio Visualizer (Background Layer) */}
        <AudioVisualizer 
            stream={streamReady ? mediaStreamRef.current : null} 
            mode={visualizerMode}
            className={`absolute bottom-0 left-0 right-0 w-full h-32 pointer-events-none z-10 transition-opacity duration-300 ${visualizerMode !== 'off' ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {/* Avionics HUD (Foreground Layer) */}
        {arMode && <ArHud data={arData} isScanning={arData.isScanning} metrics={activeMetrics} />}

        {/* Ghost Overlay */}
        {ghostImage && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30 mix-blend-screen">
             <img src={ghostImage} className="w-full h-full object-cover grayscale" alt="Ghost" />
          </div>
        )}

        {/* Spectrum Filter Indicator */}
        <div className="absolute top-24 right-6 z-20 flex flex-col gap-2 items-end pointer-events-none">
            {spectrumMode !== 'normal' && (
                <div className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-white/20 text-[10px] font-mono text-white uppercase shadow-lg">
                    FILTER: {spectrumMode}
                </div>
            )}
        </div>

        {/* Live Transcript Subtitles */}
        {transcript && arMode && (
            <div className="absolute bottom-32 left-6 right-6 text-center animate-slide-up z-30 pointer-events-none">
                <div className="inline-block bg-black/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 text-neon-green text-sm font-mono shadow-lg">
                    {transcript}
                </div>
            </div>
        )}
      </div>

      {/* Operator Controls */}
      <div className="bg-black/80 backdrop-blur-xl p-6 pb-safe-bottom relative z-50">
        <div className="flex items-center justify-between mb-6 px-4">
           <div className="flex items-center gap-3 bg-white/10 rounded-full px-3 py-1.5 border border-white/5">
               <button onClick={() => setZoom(Math.max(1, zoom - 0.5))} className="p-1"><ZoomIn className="w-4 h-4 text-white" /></button>
               <span className="text-xs font-mono text-neon-green font-bold">{zoom.toFixed(1)}x</span>
               <button onClick={() => setZoom(Math.min(3, zoom + 0.5))} className="p-1"><ZoomIn className="w-4 h-4 text-white" /></button>
           </div>

           <div className="flex gap-4">
               <button onClick={() => setSpectrumMode(prev => prev === 'normal' ? 'structure' : prev === 'structure' ? 'stress' : 'normal')} className={`p-3 rounded-full border active:scale-90 transition-all ${spectrumMode !== 'normal' ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                   <Eye className="w-5 h-5" />
               </button>
               <button onClick={() => setVisualizerMode(prev => prev === 'off' ? 'wave' : 'off')} className={`p-3 rounded-full border active:scale-90 transition-all ${visualizerMode !== 'off' ? 'bg-uv-purple/20 border-uv-purple text-uv-purple' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                   <Activity className="w-5 h-5" />
               </button>
           </div>
        </div>

        <div className="flex justify-between items-center">
           <button onClick={onCancel} className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20 active:scale-90 transition-transform">
              <X className="w-6 h-6" />
           </button>

           <button 
              onClick={arMode ? takePhoto : startArSession}
              className={`
                 w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all active:scale-95 relative
                 ${arMode ? 'border-neon-green bg-neon-green/10' : 'border-white bg-white/10'}
              `}
           >
              <div className={`w-16 h-16 rounded-full transition-all duration-300 ${arMode ? 'bg-neon-green scale-90' : 'bg-white'}`}></div>
              {arMode && <div className="absolute -inset-4 border border-neon-green rounded-full animate-ping opacity-50"></div>}
           </button>

           <button 
              onClick={() => arMode ? onSaveArData?.(arData) : null}
              disabled={!arMode || arData.status === 'INITIALIZING'}
              className={`p-4 rounded-full border active:scale-90 transition-all ${arMode ? 'bg-neon-green text-black border-neon-green shadow-[0_0_20px_rgba(0,255,163,0.4)]' : 'bg-white/5 border-white/10 text-gray-600'}`}
           >
              {arMode ? <Save className="w-6 h-6" /> : <Sliders className="w-6 h-6" />}
           </button>
        </div>
      </div>
    </div>
  );
});
CameraView.displayName = 'CameraView';
