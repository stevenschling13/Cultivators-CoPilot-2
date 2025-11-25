

import React, { useEffect, useRef } from 'react';

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

export const AudioVisualizer = ({ stream, mode, className }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (mode === 'off' || !stream) {
      // Cleanup if off
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      ctx?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
      return;
    }

    const initAudio = () => {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 2048;
      }

      // Prevent multiple connections
      if (sourceRef.current) {
         sourceRef.current.disconnect();
      }

      sourceRef.current = ctx.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
    };

    initAudio();

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      // Handle Resize
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
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
        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if(i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.stroke();
      } else if (mode === 'circle') {
        analyserRef.current.getByteFrequencyData(dataArray);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.4;
        
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        canvasCtx.stroke();

        const usefulBinCount = 120;
        const angleStep = (2 * Math.PI) / usefulBinCount;

        for(let i = 0; i < usefulBinCount; i++) {
             const value = dataArray[i * 4];
             const barHeight = (value / 255) * (canvas.height * 0.3);
             const angle = i * angleStep;
             const xStart = centerX + Math.cos(angle) * radius;
             const yStart = centerY + Math.sin(angle) * radius;
             const xEnd = centerX + Math.cos(angle) * (radius + barHeight);
             const yEnd = centerY + Math.sin(angle) * (radius + barHeight);

             canvasCtx.beginPath();
             canvasCtx.moveTo(xStart, yStart);
             canvasCtx.lineTo(xEnd, yEnd);
             canvasCtx.strokeStyle = `hsl(${(i / usefulBinCount) * 360}, 100%, 50%)`;
             canvasCtx.lineWidth = 2;
             canvasCtx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, stream]);

  return <canvas ref={canvasRef} className={className} />;
};