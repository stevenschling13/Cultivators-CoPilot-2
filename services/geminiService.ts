import { GoogleGenAI, FunctionDeclaration, Type, Schema, Modality, LiveServerMessage, Session, Part } from "@google/genai";
import { AiDiagnosis, ChatMessage, GrowLog, FacilityBriefing, CohortAnalysis, ChatContext, ArOverlayData, Room } from "../types";
import { PHYTOPATHOLOGIST_INSTRUCTION } from "../constants";

// --- Tool Definitions ---

const updateArOverlayTool: FunctionDeclaration = {
  name: "updateArOverlay",
  description: "Update the AR Heads-Up Display with real-time plant analysis. CALL THIS FREQUENTLY (every 2-3s) when looking at plants.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      colaCount: { type: Type.NUMBER, description: "Count of visible flowering sites." },
      biomassEstimate: { type: Type.STRING, description: "Density: 'Sparse', 'Developing', 'Dense', 'Stacked'." },
      healthStatus: { type: Type.STRING, description: "Status: 'Vigorous', 'Nominal', 'Stressed', 'Critical'." },
      criticalWarning: { type: Type.STRING, description: "Short urgent alert (e.g., 'Mite Webbing', 'Light Burn')." }
    },
    required: ["colaCount", "biomassEstimate", "healthStatus"]
  }
};

const proposeLogTool: FunctionDeclaration = {
  name: "proposeLog",
  description: "Generate a structured grow log entry.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      manualNotes: { type: Type.STRING },
      actionType: { type: Type.STRING, enum: ['Water', 'Feed', 'Defoliate', 'Observation', 'Other'] },
      healthScore: { type: Type.NUMBER },
      detectedPests: { type: Type.ARRAY, items: { type: Type.STRING } },
      nutrientDeficiencies: { type: Type.ARRAY, items: { type: Type.STRING } },
      recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["manualNotes", "actionType"]
  }
};

// --- Schemas ---

const facilityBriefingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['OPTIMAL', 'ATTENTION', 'CRITICAL'] },
    summary: { type: Type.STRING },
    actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
    weatherAlert: { type: Type.STRING }
  },
  required: ["status", "summary", "actionItems"]
};

const cohortAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    trendSummary: { type: Type.STRING },
    dominantIssue: { type: Type.STRING },
    topPerformingStrain: { type: Type.STRING },
    recommendedAction: { type: Type.STRING }
  },
  required: ["trendSummary", "recommendedAction"]
};

const aiDiagnosisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    healthScore: { type: Type.NUMBER },
    detectedPests: { type: Type.ARRAY, items: { type: Type.STRING } },
    nutrientDeficiencies: { type: Type.ARRAY, items: { type: Type.STRING } },
    morphologyNotes: { type: Type.STRING },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    progressionAnalysis: { type: Type.STRING },
    harvestPrediction: {
       type: Type.OBJECT,
       properties: {
          predictedDate: { type: Type.NUMBER },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
          adjustmentDays: { type: Type.NUMBER }
       }
    },
    confidenceScore: { type: Type.NUMBER }
  },
  required: ["healthScore", "detectedPests", "nutrientDeficiencies", "morphologyNotes", "recommendations"]
};

// --- Audio Utils ---

function floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

class GeminiService {
  private ai: GoogleGenAI;
  private liveSession: Session | null = null;
  
  // Audio State
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioQueue: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  private parseDataUri(input: string): { mimeType: string; data: string } {
    const match = input.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match) return { mimeType: match[1], data: match[2] };
    return { mimeType: 'image/jpeg', data: input };
  }

  private handleApiError(e: any): never {
    let msg = "AI Service Unavailable";
    if (e.message) {
        if (e.message.includes('429')) msg = "Daily API Limit Reached";
        else if (e.message.includes('401')) msg = "Invalid API Key";
        else if (e.message.includes('503')) msg = "Gemini Overloaded";
        else if (e.message.includes('SAFETY')) msg = "Safety Block Triggered";
        else if (e.message.includes('INVALID_ARGUMENT')) msg = "Invalid Data Format";
        else msg = e.message;
    }
    const err = new Error(msg);
    (err as any).originalError = e;
    throw err;
  }

  // --- Live AR Analysis (Audio + Video) ---

  public async startLiveAnalysis(
    mediaStream: MediaStream | null,
    onData: (data: ArOverlayData) => void,
    onError: (err: Error) => void,
    onClose: () => void,
    onTranscript?: (text: string, isUser: boolean) => void
  ) {
    if (this.liveSession) return;

    try {
      // 1. Initialize Audio Contexts
      // Input: 16kHz for Gemini (Standard for Speech Models)
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // Output: 24kHz for Gemini Playback (Higher fidelity for TTS)
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // 2. Connect to Live API
      this.liveSession = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            // Enable transcription to show subtitles in AR view
            inputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" }, 
            outputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
            tools: [{ functionDeclarations: [updateArOverlayTool] }],
            systemInstruction: `
              You are the Cultivator's Copilot (AR Mode).
              
              CORE DIRECTIVES:
              1. **VISUAL ANALYSIS**: Continuously scan the video feed. Use 'updateArOverlay' frequently (every 2-3s) to report stats.
              2. **PROACTIVE SPEECH**: Do not just wait for questions. If you see something interesting (e.g., "Good internodal spacing", "Possible deficiency on lower leaves"), SPEAK UP.
              3. **CONVERSATIONAL**: You are in a voice call with the grower. Keep responses concise (under 2 sentences) unless asked to elaborate.
              4. **PERSONA**: Expert Phytopathologist. Professional, sharp, helpful. Use metric units where appropriate but default to user settings.
            `
        },
        callbacks: {
            onopen: async () => {
                console.log("Live Session Connected");
                onData({ status: "SYSTEM ONLINE" });
                
                // Start Audio Streaming if microphone is available
                if (mediaStream && this.inputAudioContext) {
                    await this.startAudioStreaming(mediaStream);
                }
            },
            onmessage: async (msg: LiveServerMessage) => {
                // A. Handle Audio Output
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData && this.outputAudioContext) {
                    const audioBytes = base64ToUint8Array(audioData);
                    await this.playAudioChunk(audioBytes);
                }

                // B. Handle Transcriptions (Subtitles)
                if (onTranscript) {
                    if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
                         // Some models send text in parts along with audio, rare in audio-only mode but possible
                         onTranscript(msg.serverContent.modelTurn.parts[0].text, false);
                    }
                    // Handle explicit transcription fields
                    if ((msg.serverContent as any)?.outputTranscription?.text) {
                        onTranscript((msg.serverContent as any).outputTranscription.text, false);
                    }
                    if ((msg.serverContent as any)?.inputTranscription?.text) {
                        onTranscript((msg.serverContent as any).inputTranscription.text, true);
                    }
                }

                // C. Handle Tool Calls (AR Updates)
                if (msg.toolCall) {
                    const call = msg.toolCall.functionCalls.find(fc => fc.name === 'updateArOverlay');
                    if (call) {
                         const args = call.args as unknown as ArOverlayData;
                         // Inject status to keep UI informed
                         onData({ ...args, status: "ANALYZING..." });
                         
                         this.liveSession?.sendToolResponse({
                            functionResponses: {
                                name: call.name,
                                id: call.id,
                                response: { result: "Overlay Updated" }
                            }
                         });
                    }
                }
            },
            onclose: (e) => {
                console.log("Live Session Closed", e);
                this.cleanupAudio();
                this.liveSession = null;
                onClose();
            },
            onerror: (e) => {
                console.error("Live Session Error", e);
                onError(new Error("Connection Error"));
            }
        }
      });

    } catch (e) {
      this.handleApiError(e);
    }
  }

  private async startAudioStreaming(stream: MediaStream) {
      if (!this.inputAudioContext || !this.liveSession) return;

      // Ensure context is running (fixes Safari/Chrome autoplay blocks)
      if (this.inputAudioContext.state === 'suspended') {
          await this.inputAudioContext.resume();
      }
      
      this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(stream);
      this.audioProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
      
      this.audioProcessor.onaudioprocess = (e) => {
          if (!this.liveSession) return;
          
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32 to Int16 PCM
          const pcm16 = floatTo16BitPCM(inputData);
          
          // Send to Gemini
          // Note: arrayBufferToBase64 helper needed because creating a Blob URL is async/complex here
          const base64 = arrayBufferToBase64(pcm16.buffer);
          
          this.liveSession.sendRealtimeInput({
              media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64
              }
          });
      };

      this.mediaStreamSource.connect(this.audioProcessor);
      this.audioProcessor.connect(this.inputAudioContext.destination);
  }

  private async playAudioChunk(pcmData: Uint8Array) {
      if (!this.outputAudioContext) return;

      // Convert PCM Int16 back to Float32
      const int16 = new Int16Array(pcmData.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
      }

      const buffer = this.outputAudioContext.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioContext.destination);

      // Audio Queueing Logic to prevent gaps
      const now = this.outputAudioContext.currentTime;
      // If nextPlayTime is in the past, reset it to now (handling network jitters)
      const startTime = Math.max(now, this.nextPlayTime);
      
      source.start(startTime);
      this.nextPlayTime = startTime + buffer.duration;
      
      this.audioQueue.push(source);
      
      // Cleanup finished sources
      source.onended = () => {
          const index = this.audioQueue.indexOf(source);
          if (index > -1) this.audioQueue.splice(index, 1);
      };
  }

  private cleanupAudio() {
      this.mediaStreamSource?.disconnect();
      this.audioProcessor?.disconnect();
      this.inputAudioContext?.close();
      this.outputAudioContext?.close();
      this.audioQueue.forEach(s => {
          try { s.stop(); } catch(e) {}
      });
      this.audioQueue = [];
      this.mediaStreamSource = null;
      this.audioProcessor = null;
      this.inputAudioContext = null;
      this.outputAudioContext = null;
      this.nextPlayTime = 0;
  }

  public stopLiveAnalysis() {
    this.cleanupAudio();
    if (this.liveSession) {
        this.liveSession.close();
        this.liveSession = null;
    }
  }

  public sendLiveFrame(base64Image: string) {
    if (this.liveSession) {
        this.liveSession.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64Image
            }
        });
    }
  }

  // --- Other Methods (Standard) ---

  public async generateFacilityBriefing(rooms: Room[], logs: GrowLog[]): Promise<FacilityBriefing> {
    try {
      const modelId = 'gemini-2.5-flash';
      const prompt = `
        Current Date: ${new Date().toLocaleDateString()}
        Analyze the following grow facility state and generate a briefing.
        Rooms: ${JSON.stringify(rooms.map(r => ({ name: r.name, stage: r.stage, metrics: r.metrics })))}
        Recent Logs: ${JSON.stringify(logs.slice(0, 5).map(l => ({ action: l.actionType, notes: l.manualNotes })))}
      `;

      const response = await this.ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: facilityBriefingSchema,
            systemInstruction: "You are the facility commander. Provide a crisp status report."
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text) as FacilityBriefing;
        data.timestamp = Date.now();
        return data;
      }
      throw new Error("Empty response");
    } catch (e) {
      console.error("Briefing Generation Failed", e);
      throw e;
    }
  }

  public async chatStream(
    history: ChatMessage[],
    newMessage: string,
    imageContext: string | null,
    context: ChatContext,
    onChunk: (text: string, grounding?: any) => void,
    onToolCall: (payload: any) => void
  ) {
    const modelId = 'gemini-3-pro-preview';
    const systemPrompt = `
      ${PHYTOPATHOLOGIST_INSTRUCTION}
      CONTEXT: ${JSON.stringify(context)}
    `;

    const chatHistory = history
      .filter(h => h.role !== 'model' || !h.isThinking)
      .map(h => {
         const parts: Part[] = [];
         if (h.attachment) {
             const { mimeType, data } = this.parseDataUri(h.attachment.url);
             parts.push({ inlineData: { mimeType, data } });
         }
         if (h.text) parts.push({ text: h.text });
         return { role: h.role, parts };
      });

    const chat = this.ai.chats.create({
        model: modelId,
        config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: [proposeLogTool] }, { googleSearch: {} }] 
        },
        history: chatHistory.slice(0, -1)
    });
    
    const msgParts: Part[] = [{ text: newMessage }];
    if (imageContext) {
        const { mimeType, data } = this.parseDataUri(imageContext);
        msgParts.unshift({ inlineData: { mimeType, data } });
    }

    try {
        const streamResult = await chat.sendMessageStream({ message: msgParts });
        for await (const chunk of streamResult) {
            const candidate = chunk.candidates?.[0];
            const candidateParts = candidate?.content?.parts ?? [];
            const streamText = chunk.text || candidateParts.map(part => part.text).filter(Boolean).join("");

            if (streamText) onChunk(streamText, candidate?.groundingMetadata);

            candidateParts.forEach(part => {
                if (part.functionCall?.name === 'proposeLog') {
                    onToolCall(part.functionCall.args);
                }
            });
        }
    } catch (e) {
        this.handleApiError(e);
    }
  }

  public async generateGrowthSimulation(imageBase64: string): Promise<string> {
    const modelId = 'veo-3.1-fast-generate-preview';
    const { mimeType, data } = this.parseDataUri(imageBase64);

    try {
        let operation = await this.ai.models.generateVideos({
            model: modelId,
            image: { imageBytes: data, mimeType },
            prompt: 'Simulate this canopy for the next 10 days; emphasize node stacking, color shift, and stress cues.'
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            operation = await this.ai.operations.getVideosOperation({ operation });
        }

        const video = operation.response?.generatedVideos?.[0]?.video;
        if (video?.uri) return video.uri;
        if (video?.videoBytes) {
            return `data:${video.mimeType || 'video/mp4'};base64,${video.videoBytes}`;
        }

        throw new Error('No simulation returned');
    } catch (e) {
        this.handleApiError(e);
    }
  }

  public async generateCohortAnalysis(logs: GrowLog[]): Promise<CohortAnalysis> {
    try {
       const modelId = 'gemini-3-pro-preview';
       const prompt = `Analyze logs for trends: ${JSON.stringify(logs.map(l => ({ date: l.timestamp, note: l.manualNotes })))}`;

       const response = await this.ai.models.generateContent({
          model: modelId,
          contents: prompt,
          config: {
             responseMimeType: 'application/json',
             responseSchema: cohortAnalysisSchema,
             systemInstruction: "You are a lead researcher. output raw json."
          }
       });

       if (response.text) return JSON.parse(response.text) as CohortAnalysis;
       throw new Error("No analysis generated");
    } catch (e) {
       this.handleApiError(e);
    }
  }

  public async analyzePlantImage(imageBase64: string): Promise<AiDiagnosis> {
    const modelId = 'gemini-2.5-flash';
    try {
        const { mimeType, data } = this.parseDataUri(imageBase64);
        const response = await this.ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: "Analyze this plant. Provide health score, pests, deficiencies, and recommendations." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: aiDiagnosisSchema,
                systemInstruction: PHYTOPATHOLOGIST_INSTRUCTION
            }
        });
        
        if (response.text) return JSON.parse(response.text) as AiDiagnosis;
        throw new Error("Empty response");
    } catch (e) {
        this.handleApiError(e);
    }
  }
}

export const geminiService = new GeminiService();