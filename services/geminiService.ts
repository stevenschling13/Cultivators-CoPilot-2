
import { GoogleGenAI } from "@google/genai";
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
  private ai: GoogleGenAI;
  private vision: GeminiVision;
  private audio: GeminiAudio;
  private text: GeminiText;
  
  // Circuit Breaker State
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly COOL_DOWN_MS = 60000; // 1 minute pause after 5 failures

  constructor() {
    // Initialize SDK directly with Environment Variable
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    this.vision = new GeminiVision(this.ai);
    this.audio = new GeminiAudio(this.ai);
    this.text = new GeminiText(this.ai);
  }

  /**
   * Advanced: Retries an async operation with exponential backoff.
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>, 
    retries = 3, 
    delay = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      
      const isRetryable = (error as Error).message.includes('503') || 
                          (error as Error).message.includes('429');
      
      if (!isRetryable) throw error;

      await new Promise(res => setTimeout(res, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  /**
   * Wraps API calls with Circuit Breaker and Retry logic.
   */
  private async withErrorHandling<T>(fn: () => Promise<T>, context: string): Promise<T> {
    // 1. Check Circuit Breaker
    const now = Date.now();
    if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
        if (now - this.lastFailureTime < this.COOL_DOWN_MS) {
            const timeLeft = Math.ceil((this.COOL_DOWN_MS - (now - this.lastFailureTime)) / 1000);
            throw new Error(`AI System Cooldown: ${timeLeft}s remaining.`);
        } else {
            // Reset after cooldown
            this.consecutiveFailures = 0;
        }
    }

    try {
      // 2. Attempt with Retry
      const result = await this.retryWithBackoff(fn);
      
      // Success resets failure count
      this.consecutiveFailures = 0;
      return result;

    } catch (error) {
      // 3. Update Circuit Breaker
      this.consecutiveFailures++;
      this.lastFailureTime = Date.now();

      const originalMsg = error instanceof Error ? error.message : String(error);
      let friendlyMsg = originalMsg;

      if (originalMsg.includes('429') || originalMsg.toLowerCase().includes('quota')) {
        friendlyMsg = "Daily AI Quota Exceeded. Please try again later.";
      } else if (originalMsg.includes('401') || originalMsg.toLowerCase().includes('key')) {
        friendlyMsg = "Authentication Failed. Check API Key.";
      } else if (originalMsg.includes('503')) {
        friendlyMsg = "AI Service Busy. Retrying...";
      }

      const uiError = new Error(friendlyMsg);
      errorService.captureError(uiError, {
        severity: 'HIGH',
        metadata: {
          context,
          originalError: originalMsg,
          failures: this.consecutiveFailures
        }
      });
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
    // Delegate to vision module which now handles Live API connection
    return this.vision.startLiveAnalysis(videoStream, onOverlayUpdate, onError, onClose, onTranscript);
  }

  public sendLiveFrame(base64Image: string): void {
    this.vision.sendLiveFrame(base64Image);
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
    return this.withErrorHandling(
        () => this.text.chatStream(history, newMessage, imageContext, contextData, onChunk, onToolCall),
        'chatStream'
    );
  }

  // --- Specialized Generators ---

  public async generateFacilityBriefing(rooms: Room[], logs: GrowLog[]): Promise<FacilityBriefing> {
    return this.withErrorHandling(
        () => this.text.generateFacilityBriefing(rooms, logs),
        'generateFacilityBriefing'
    );
  }

  public async analyzePlantImage(base64Image: string): Promise<AiDiagnosis> {
    return this.withErrorHandling(
        () => this.vision.analyzePlantImage(base64Image),
        'analyzePlantImage'
    );
  }

  // --- Veo ---

  public async generateGrowthSimulation(startImage: string): Promise<string> {
    return this.withErrorHandling(
        () => this.vision.generateGrowthSimulation(startImage),
        'generateGrowthSimulation'
    );
  }

  // --- TTS ---

  public async generateAudioBriefing(text: string): Promise<ArrayBuffer> {
    return this.withErrorHandling(
        () => this.audio.generateAudioBriefing(text),
        'generateAudioBriefing'
    );
  }

  // --- Agentic Planning ---

  public async generateForwardSchedule(batch: PlantBatch, logs: GrowLog[]): Promise<ScheduleItem[]> {
    return this.withErrorHandling(
        () => this.text.generateForwardSchedule(batch, logs),
        'generateForwardSchedule'
    );
  }

  public async processVoiceCommand(audioBlob: Blob): Promise<VoiceCommandResponse> {
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
    return this.withErrorHandling(
        () => this.text.getStrainInfo(strainName),
        'getStrainInfo'
    );
  }

  public async generateCohortAnalysis(logs: GrowLog[]): Promise<CohortAnalysis> {
    return this.withErrorHandling(
        () => this.text.generateCohortAnalysis(logs),
        'generateCohortAnalysis'
    );
  }

  public async askResearchAnalyst(logs: GrowLog[], query: string): Promise<string> {
    return this.withErrorHandling(
        () => this.text.askResearchAnalyst(logs, query),
        'askResearchAnalyst'
    );
  }
}

export const geminiService = new GeminiService();
