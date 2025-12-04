
import { GoogleGenAI, Type } from "@google/genai";
import { AiDiagnosis, ArOverlayData } from '../../types';
import { safeParseAIResponse } from './utils';
import { AiDiagnosisSchema, ArOverlaySchema } from '../../system/schema';

export class GeminiVision {
  private isAnalyzing = false;
  private latestFrame: string | null = null;
  private processingPromise: Promise<void> | null = null;
  
  constructor(private ai: GoogleGenAI) {}

  public async startLiveAnalysis(
    videoStream: MediaStream | null, 
    onOverlayUpdate: (data: ArOverlayData) => void,
    onError: (err: Error) => void,
    onClose: () => void,
    onTranscript: (text: string) => void
  ): Promise<void> {
    this.isAnalyzing = true;
    this.latestFrame = null;

    // Start the analysis loop
    this.processingPromise = this.analysisLoop(onOverlayUpdate, onError);
  }

  public sendLiveFrame(base64Image: string): void {
     // Update the latest frame buffer (clobbering old frames to ensure we analyze 'now')
     this.latestFrame = base64Image;
  }

  public stopLiveAnalysis(): void {
    this.isAnalyzing = false;
    this.latestFrame = null;
  }

  private async analysisLoop(
    onUpdate: (data: ArOverlayData) => void, 
    onError: (err: Error) => void
  ) {
    while (this.isAnalyzing) {
      if (this.latestFrame) {
        try {
          const frame = this.latestFrame;
          this.latestFrame = null; // Consume frame

          const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash', // Fast model for near-real-time
            contents: {
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: frame } },
                { text: `
                  Analyze this cannabis plant frame for an AR Heads-Up Display.
                  Return JSON for HUD.
                `}
              ]
            },
            config: { 
                responseMimeType: 'application/json',
                temperature: 0.4,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        status: { type: Type.STRING, enum: ["SCANNING", "LOCKED", "WARNING"] },
                        guidance: { type: Type.STRING },
                        colaCount: { type: Type.NUMBER },
                        biomassEstimate: { type: Type.STRING, enum: ["Low", "Medium", "Heavy"] },
                        healthStatus: { type: Type.STRING, enum: ["Healthy", "Stressed", "Critical"] },
                        stressLevel: { type: Type.NUMBER },
                        criticalWarning: { type: Type.STRING }
                    }
                }
            }
          });

          if (!this.isAnalyzing) break;

          const data = safeParseAIResponse(response.text, ArOverlaySchema, 'LiveAR');
          
          try {
              onUpdate(data as ArOverlayData);
          } catch (uiError) {
              console.error("AR Overlay UI update failed", uiError);
          }

        } catch (e) {
          console.warn("AR Frame Analysis Failed", e);
          // Don't kill the loop on single frame failure, just log and continue
        }
      }

      // Throttle: Wait 1s before checking for next frame to respect rate limits and CPU
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  public async analyzePlantImage(base64Image: string): Promise<AiDiagnosis> {
      const base64 = base64Image.split(',')[1] || base64Image;
      const response = await this.ai.models.generateContent({
          model: 'gemini-3-pro-preview', // Use Pro for deep diagnosis
          contents: {
              parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                  { text: "Analyze phytopathology. Provide detailed diagnosis." }
              ]
          },
          config: { 
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      healthScore: { type: Type.NUMBER },
                      detectedPests: { type: Type.ARRAY, items: { type: Type.STRING } },
                      nutrientDeficiencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                      morphologyNotes: { type: Type.STRING },
                      recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                      progressionAnalysis: { type: Type.STRING },
                      confidenceScore: { type: Type.NUMBER }
                  },
                  required: ["healthScore", "morphologyNotes", "recommendations"]
              }
          }
      });
      
      return safeParseAIResponse(response.text, AiDiagnosisSchema, 'analyzePlantImage');
  }

  public async generateGrowthSimulation(startImage: string): Promise<string> {
      const base64 = startImage.split(',')[1] || startImage;
      
      // Veo 3.1 - Client Side SDK Call
      let operation = await this.ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          image: {
              imageBytes: base64,
              mimeType: 'image/jpeg'
          },
          config: {
              numberOfVideos: 1,
              resolution: '720p',
              aspectRatio: '9:16'
          }
      });

      // Poll for completion
      const pollStart = Date.now();
      while (!operation.done) {
          if (Date.now() - pollStart > 120000) throw new Error("Video generation timeout");
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await this.ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("No video URI generated");

      // Fetch the actual bytes using the API key
      const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!videoRes.ok) throw new Error("Failed to download video bytes");
      
      const blob = await videoRes.blob();
      
      // Convert Blob to Base64 Data URI for persistence in IndexedDB
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              if (reader.result) {
                  resolve(reader.result as string);
              } else {
                  reject(new Error("Failed to convert video blob to base64"));
              }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  }
}
