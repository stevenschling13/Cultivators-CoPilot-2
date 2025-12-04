import React, { useEffect, useRef, memo } from 'react';

// Polyfill for Safari webkitAudioContext type
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export type VisualizerMode = 'off' | 'bars' | 'wave' | 'circle';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  mode: VisualizerMode;
  className?: string;
}

export const AudioVisualizer = memo(({ stream, mode, className }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Memory Optimization: Pre-allocate data buffer to avoid GC stutter in render loop
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // 1. Audio Pipeline Lifecycle
  useEffect(() => {
    if (!stream || mode === 'off') {
       // Suspend context to save CPU if valid
       if (audioContextRef.current && audioContextRef.current.state === 'running') {
           audioContextRef.current.suspend().catch(() => {});
       }
       return;
    }

    const initAudio = async () => {
        try {
            // Fix for TypeScript access to window.webkitAudioContext
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            
            // Singleton management: Reuse existing context or create new if closed
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioContextClass();
            }
            
            const ctx = audioContextRef.current;
            
            // Resume if suspended (common browser policy block)
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            if (!analyserRef.current) {
                analyserRef.current = ctx.createAnalyser();
                analyserRef.current.fftSize = 2048;
                // Initialize buffer once matches fftSize
                dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
            }

            // Cleanup previous source to prevent multi-connection errors
            if (sourceRef.current) {
                try { sourceRef.current.disconnect(); } catch(e) { /* ignore */ }
            }

            // Security: Ensure stream is active and has audio tracks
            if (stream.active && stream.getAudioTracks().length > 0) {
                sourceRef.current = ctx.createMediaStreamSource(stream);
                sourceRef.current.connect(analyserRef.current);
            }
        } catch (e) {
            // Suppress context start errors (common on some mobile browsers if not user-gesture triggered)
            console.warn("AudioVisualizer Init:", e);
        }
    };

    initAudio();

    // Critical: Close context on unmount to prevent Hardware Limit Exception (Max 6 contexts)
    return () => {
        const ctx = audioContextRef.current;
        if (ctx && ctx.state !== 'closed') {
            // We use .close() here which is aggressive but necessary for cleaning up hardware handles on iOS
            // But we must catch potential errors if it's already closing
            try {
                // Check state before closing
                if (ctx.state !== 'closed') {
                    ctx.close().catch(() => {});
                }
            } catch (e) { /* ignore */ }
            
            audioContextRef.current = null;
            analyserRef.current = null;
            sourceRef.current = null;
        }
    };
  }, [stream]); 

  // 2. Render Loop Lifecycle
  useEffect(() => {
    if (mode === 'off' || !stream) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Clear canvas
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const startDrawing = () => {
        const draw = () => {
            if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            
            const canvas = canvasRef.current;
            const canvasCtx = canvas.getContext('2d', { alpha: true }); // Optimization hint
            if (!canvasCtx) return;

            // Handle Resize
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = dataArrayRef.current;
            
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            if (mode === 'bars') {
                analyserRef.current.getByteFrequencyData(dataArray);
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;
                const usefulBinCount = Math.floor(bufferLength * 0.7);

                for(let i = 0; i < usefulBinCount; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
                    const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                    gradient.addColorStop(0, 'rgba(0, 255, 163, 0.2)');
                    gradient.addColorStop(1, 'rgba(0, 212, 255, 0.9)');
                    canvasCtx.fillStyle = gradient;
                    canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
            } else if (mode === 'wave') {
                analyserRef.current.getByteTimeDomainData(dataArray);
                canvasCtx.lineWidth = 2;
                canvasCtx.strokeStyle = '#00ffa3';
                canvasCtx.beginPath();

                const sliceWidth = canvas.width * 1.0 / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * canvas.height / 2;

                    if (i === 0) {
                        canvasCtx.moveTo(x, y);
                    } else {
                        canvasCtx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                canvasCtx.lineTo(canvas.width, canvas.height / 2);
                canvasCtx.stroke();
            }

            rafRef.current = requestAnimationFrame(draw);
        };
        draw();
    };

    startDrawing();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, stream]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`w-full h-full ${className}`}
    />
  );
});

AudioVisualizer.displayName = 'AudioVisualizer';