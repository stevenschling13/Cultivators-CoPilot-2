
import React, { useState, useRef, useEffect, memo } from 'react';
import { Mic, X, Activity, Radio } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { Haptic } from '../../utils/haptics';
import { VoiceCommandResponse } from '../../types';

interface VoiceCommandModalProps {
  onClose: () => void;
  onCommandProcessed: (cmd: VoiceCommandResponse) => void;
}

export const VoiceCommandModal = memo(({ onClose, onCommandProcessed }: VoiceCommandModalProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    startRecording();
    return () => stopRecording();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Visualizer Setup
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      drawVisualizer();

    } catch (e) {
      console.error("Mic Access Failed", e);
      onClose();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); // Chrome/Android standard
        await processAudio(blob);
      };
    }
    setIsRecording(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const processAudio = async (blob: Blob) => {
      setIsProcessing(true);
      Haptic.light();
      try {
          // In a real implementation, we might convert webm to wav here if the API is strict, 
          // but Gemini often accepts webm audio containers directly in the payload.
          const response = await geminiService.processVoiceCommand(blob);
          setTranscript(response.transcription);
          setTimeout(() => {
              Haptic.success();
              onCommandProcessed(response);
          }, 800);
      } catch (e) {
          console.error(e);
          setTranscript("Processing failed. Please try again.");
          setTimeout(onClose, 2000);
      }
  };

  const drawVisualizer = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const draw = () => {
          animationFrameRef.current = requestAnimationFrame(draw);
          analyserRef.current!.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barWidth = (canvas.width / bufferLength) * 2.5;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
              const barHeight = dataArray[i] / 2;
              ctx.fillStyle = `rgb(0, 255, 163)`; // Neon Green
              ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
              x += barWidth + 1;
          }
      };
      draw();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in touch-none">
       <button onClick={onClose} className="absolute top-8 right-8 p-4 bg-white/5 rounded-full text-white hover:bg-white/10">
          <X className="w-6 h-6" />
       </button>

       <div className="w-full max-w-sm flex flex-col items-center gap-8 px-6">
          <div className="text-center space-y-2">
             <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Field Agent</h2>
             <p className="text-neon-green font-mono text-xs uppercase tracking-widest">
                {isProcessing ? "Analyzing Intent..." : isRecording ? "Listening..." : "Ready"}
             </p>
          </div>

          <div className="relative">
             <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${isRecording ? 'border-neon-green bg-neon-green/10 shadow-[0_0_50px_rgba(0,255,163,0.4)]' : 'border-gray-700 bg-gray-900'}`}>
                {isProcessing ? (
                    <Activity className="w-12 h-12 text-neon-green animate-pulse" />
                ) : (
                    <Mic className={`w-12 h-12 ${isRecording ? 'text-neon-green' : 'text-gray-500'}`} />
                )}
             </div>
             {isRecording && (
                <div className="absolute inset-0 rounded-full border-2 border-neon-green opacity-50 animate-ping"></div>
             )}
          </div>

          <div className="h-16 w-full flex items-center justify-center">
             {isRecording ? (
                 <canvas ref={canvasRef} width={300} height={60} className="w-full h-full" />
             ) : transcript ? (
                 <div className="text-center text-white font-medium text-lg leading-tight animate-slide-up">
                    "{transcript}"
                 </div>
             ) : (
                 <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Radio className="w-4 h-4" />
                    <span>Say "Log Water", "Go to Lab", etc.</span>
                 </div>
             )}
          </div>

          {isRecording && (
              <button 
                onClick={stopRecording}
                className="px-8 py-3 bg-white text-black font-bold rounded-full active:scale-95 transition-transform"
              >
                 Stop & Process
              </button>
          )}
       </div>
    </div>
  );
});
VoiceCommandModal.displayName = 'VoiceCommandModal';
