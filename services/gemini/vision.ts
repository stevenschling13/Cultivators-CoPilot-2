
import { GeminiNetwork } from './network';
import { GenerateContentBody, GeminiResponse, LiveSession } from './types';
import { AiDiagnosis, ArOverlayData } from '../../types';

export class GeminiVision {
  private liveSession: LiveSession | null = null;
  
  constructor(private network: GeminiNetwork) {}

  public async startLiveAnalysis(
    videoStream: MediaStream | null,
    onOverlayUpdate: (data: ArOverlayData) => void,
    onError: (err: Error) => void,
    onClose: () => void,
    onTranscript: (text: string) => void
  ): Promise<void> {
    // In a real implementation, this would connect to a WebSocket proxy.
    if (videoStream) {
      console.warn('Live analysis requested but proxy is unavailable. Stream will not be processed.');
    }
    // Touch callbacks to satisfy interface expectations
    onOverlayUpdate({
      status: 'offline',
      guidance: 'Live API requires Backend WebSocket Proxy. Running in Text/Image Mode.',
      criticalWarning: 'AR overlay unavailable in this environment'
    });
    onTranscript('Live API requires Backend WebSocket Proxy. Running in Text/Image Mode.');
    onClose();
    onError(new Error("Live API requires Backend WebSocket Proxy. Running in Text/Image Mode."));
  }

  public sendLiveFrame(base64Image: string): void {
     console.warn('Live frame streaming not available without proxy.', { length: base64Image?.length });
  }

  public sendLiveTextQuery(text: string): void {
     console.warn('Live text streaming not available without proxy.', { preview: text.slice(0, 20) });
  }

  public stopLiveAnalysis(): void {
    if (this.liveSession) {
        this.liveSession = null;
    }
  }

  public async analyzePlantImage(base64Image: string): Promise<AiDiagnosis> {
      const base64 = base64Image.split(',')[1] || base64Image;
      const body: GenerateContentBody = {
          contents: [{
              parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: base64 } },
                  { text: "Analyze pathology. Return JSON: healthScore, detectedPests[], nutrientDeficiencies[], morphologyNotes, recommendations[], progressionAnalysis." }
              ]
          }],
          generationConfig: { responseMimeType: 'application/json' }
      };
      
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      return text ? JSON.parse(text) : {
          healthScore: 0,
          detectedPests: [],
          nutrientDeficiencies: [],
          morphologyNotes: "Analysis Failed",
          recommendations: [],
          progressionAnalysis: "N/A"
      } as AiDiagnosis;
  }

  public async generateGrowthSimulation(startImage: string): Promise<string> {
      const base64 = startImage.split(',')[1] || startImage;
      const body = {
          image: { imageBytes: base64, mimeType: 'image/jpeg' },
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
      };

      const op = await this.network.callProxy<{name: string}>(
          'v1beta/models/veo-3.1-fast-generate-preview:generateVideos', 
          body
      );

      let done = false;
      let videoUri = '';
      const pollStart = Date.now();

      while (!done) {
          if (Date.now() - pollStart > 120000) throw new Error("Video generation timeout");
          await new Promise(r => setTimeout(r, 5000));
          
          const status = await this.network.callProxy<{done?: boolean, response?: any, error?: any}>(
              `v1beta/${op.name}`, 
              undefined, 
              'GET'
          );

          if (status.error) throw new Error(status.error.message || "Video generation error");
          
          if (status.done) {
              done = true;
              videoUri = status.response?.generatedVideos?.[0]?.video?.uri;
          }
      }

      if (!videoUri) throw new Error("No video URI in response");
      return this.network.downloadSecurely(videoUri);
  }
}
