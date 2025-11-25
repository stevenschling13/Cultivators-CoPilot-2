
import { GeminiNetwork } from './gemini/network';
import { GeminiText } from './gemini/text';
import { GeminiVision } from './gemini/vision';
import { GeminiAudio } from './gemini/audio';
import { errorService } from './errorService';
import { 
  ArOverlayData, 
  ChatMessage, 
  ChatContext, 
  GroundingMetadata, 
  FacilityBriefing, 
  Room, 
  GrowLog, 
  AiDiagnosis, 
  ScheduleItem, 
  PlantBatch, 
  VoiceCommandResponse, 
  EnvironmentalTargets, 
  StrainInfo, 
  CohortAnalysis 
} from '../types';

export class GeminiService {
  private network: GeminiNetwork;
  private vision: GeminiVision;
  private audio: GeminiAudio;
  private text: GeminiText;

  constructor() {
    this.network = new GeminiNetwork();
    this.vision = new GeminiVision(this.network);
    this.audio = new GeminiAudio(this.network);
    this.text = new GeminiText(this.network);
  }

  /**
   * Wraps API calls with robust error handling, mapping technical errors to user-friendly messages
   * and logging full details to the Flight Recorder.
   */
  private async withErrorHandling<T>(fn: () => Promise<T>, context: string): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const originalMsg = error instanceof Error ? error.message : String(error);
      let friendlyMsg = originalMsg; // Default to original if no specific match

      // Map common status codes/messages to User-Friendly Toasts
      if (originalMsg.includes('429') || originalMsg.toLowerCase().includes('quota')) {
        friendlyMsg = "Daily AI Quota Exceeded. Please try again later.";
      } else if (originalMsg.includes('401') || originalMsg.toLowerCase().includes('api key')) {
        friendlyMsg = "Authentication Failed. Please check your API Key in Settings.";
      } else if (originalMsg.includes('503') || originalMsg.includes('500') || originalMsg.toLowerCase().includes('overloaded')) {
        friendlyMsg = "AI Service Temporarily Unavailable. Retrying...";
      } else if (originalMsg.toLowerCase().includes('safety') || originalMsg.toLowerCase().includes('blocked')) {
        friendlyMsg = "Content blocked by AI Safety Filters.";
      } else if (originalMsg.toLowerCase().includes('network') || originalMsg.toLowerCase().includes('fetch')) {
        friendlyMsg = "Network Connection Failed. Check internet.";
      } else if (originalMsg.includes('Proxy')) {
        friendlyMsg = "Secure Connection to Proxy Failed.";
      }

      // Capture to Flight Recorder
      // This triggers the AppController's toast via the errorService callback
      const uiError = new Error(friendlyMsg);
      
      errorService.captureError(uiError, {
        severity: 'HIGH', // HIGH severity triggers Haptic + Toast
        metadata: {
          context,
          originalError: originalMsg,
          stack: error instanceof Error ? error.stack : undefined
        }
      });

      // Re-throw the friendly error so the caller can handle state (e.g. stop loading spinners)
      throw uiError;
    }
  }

  // --- Live API (AR Mode) ---

  public async startLiveAnalysis(
    videoStream: MediaStream | null, 
    onOverlayUpdate: (data: ArOverlayData) => void,
    onError: (err: Error) => void,
    onClose: () => void,
    onTranscript: (text: string) => void
  ): Promise<void> {
    if (videoStream !== null && !(videoStream instanceof MediaStream)) {
        throw new Error("startLiveAnalysis: videoStream must be MediaStream or null");
    }
    // We don't use withErrorHandling here because CameraView has its own specific error handling logic 
    // for the AR session initialization and we want to preserve specific error codes for its UI.
    // However, runtime errors inside the session are handled by the onError callback.
    return this.vision.startLiveAnalysis(videoStream, onOverlayUpdate, onError, onClose, onTranscript);
  }

  public sendLiveFrame(base64Image: string): void {
    try {
        if (typeof base64Image !== 'string' || !base64Image) throw new Error("sendLiveFrame: Invalid image data");
        this.vision.sendLiveFrame(base64Image);
    } catch (e) {
        // Silent fail for frame drops to avoid spamming logs
        console.warn("Frame drop", e);
    }
  }

  public sendLiveTextQuery(text: string): void {
    try {
        if (typeof text !== 'string') throw new Error("sendLiveTextQuery: Invalid text");
        if (!text.trim()) return;
        this.vision.sendLiveTextQuery(text);
    } catch (e) {
        console.error(e);
    }
  }

  public stopLiveAnalysis(): void {
    this.vision.stopLiveAnalysis();
  }

  // --- Text & Vision Chat ---

  public async chatStream(
    history: ChatMessage[], 
    newMessage: string, 
    imageContext: string | null,
    contextData: ChatContext,
    onChunk: (text: string, grounding?: GroundingMetadata) => void,
    onToolCall?: (name: string, args: Record<string, any>) => Promise<void>
  ): Promise<void> {
    // Input validation remains synchronous to fail fast on developer errors
    if (!Array.isArray(history)) throw new Error("chatStream: history must be an array");
    if (typeof newMessage !== 'string') throw new Error("chatStream: newMessage must be a string");
    if (imageContext !== null && typeof imageContext !== 'string') throw new Error("chatStream: imageContext must be string or null");
    
    return this.withErrorHandling(
        () => this.text.chatStream(history, newMessage, imageContext, contextData, onChunk, onToolCall),
        'chatStream'
    );
  }

  public async sendTextInput(text: string): Promise<string> {
    if (typeof text !== 'string' || !text.trim()) throw new Error("sendTextInput: text must be a non-empty string");
    return this.withErrorHandling(
        () => this.text.sendTextQuery(text),
        'sendTextInput'
    );
  }

  // --- Specialized Generators ---

  public async generateFacilityBriefing(rooms: Room[], logs: GrowLog[]): Promise<FacilityBriefing> {
    if (!Array.isArray(rooms)) throw new Error("generateFacilityBriefing: rooms must be an array");
    return this.withErrorHandling(
        () => this.text.generateFacilityBriefing(rooms, logs),
        'generateFacilityBriefing'
    );
  }

  public async analyzePlantImage(base64Image: string): Promise<AiDiagnosis> {
    if (typeof base64Image !== 'string' || !base64Image) throw new Error("analyzePlantImage: base64Image must be a non-empty string");
    return this.withErrorHandling(
        () => this.vision.analyzePlantImage(base64Image),
        'analyzePlantImage'
    );
  }

  // --- Veo ---

  public async generateGrowthSimulation(startImage: string): Promise<string> {
    if (typeof startImage !== 'string' || !startImage) throw new Error("generateGrowthSimulation: startImage must be a non-empty string");
    return this.withErrorHandling(
        () => this.vision.generateGrowthSimulation(startImage),
        'generateGrowthSimulation'
    );
  }

  // --- TTS ---

  public async generateAudioBriefing(text: string): Promise<ArrayBuffer> {
    if (typeof text !== 'string' || !text) throw new Error("generateAudioBriefing: text must be a non-empty string");
    return this.withErrorHandling(
        () => this.audio.generateAudioBriefing(text),
        'generateAudioBriefing'
    );
  }

  // --- Agentic Planning ---

  public async generateForwardSchedule(batch: PlantBatch, logs: GrowLog[]): Promise<ScheduleItem[]> {
    if (!batch || typeof batch !== 'object') throw new Error("generateForwardSchedule: batch must be an object");
    return this.withErrorHandling(
        () => this.text.generateForwardSchedule(batch, logs),
        'generateForwardSchedule'
    );
  }

  public async processVoiceCommand(audioBlob: Blob): Promise<VoiceCommandResponse> {
    if (!(audioBlob instanceof Blob)) throw new Error("processVoiceCommand: audioBlob must be a Blob");
    return this.withErrorHandling(
        () => this.audio.processVoiceCommand(audioBlob),
        'processVoiceCommand'
    );
  }

  public async calibrateEnvironment(strain: string, stage: string, day: number): Promise<EnvironmentalTargets> {
    return this.withErrorHandling(
        () => this.text.calibrateEnvironment(strain, stage, day),
        'calibrateEnvironment'
    );
  }

  public async getStrainInfo(strainName: string): Promise<StrainInfo> {
    if (typeof strainName !== 'string' || !strainName) throw new Error("getStrainInfo: strainName must be a non-empty string");
    return this.withErrorHandling(
        () => this.text.getStrainInfo(strainName),
        'getStrainInfo'
    );
  }

  public async generateCohortAnalysis(logs: GrowLog[]): Promise<CohortAnalysis> {
    if (!Array.isArray(logs)) throw new Error("generateCohortAnalysis: logs must be an array");
    return this.withErrorHandling(
        () => this.text.generateCohortAnalysis(logs),
        'generateCohortAnalysis'
    );
  }

  public async askResearchAnalyst(logs: GrowLog[], query: string): Promise<string> {
    if (typeof query !== 'string' || !query) throw new Error("askResearchAnalyst: query must be a non-empty string");
    return this.withErrorHandling(
        () => this.text.askResearchAnalyst(logs, query),
        'askResearchAnalyst'
    );
  }
}

export const geminiService = new GeminiService();
