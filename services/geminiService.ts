
import { GoogleGenAI } from "@google/genai";
import { AiDiagnosis, ChatMessage, GrowLog, FacilityBriefing, CohortAnalysis, ChatContext, ArOverlayData, Room, StrainInfo, VoiceCommandResponse, EnvironmentalTargets, ScheduleItem, PlantBatch } from "../types";
import { PHYTOPATHOLOGIST_INSTRUCTION, VOICE_COMMAND_INSTRUCTION } from "../constants";

// --- Local Type Definitions ---

const Type = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
  NULL: 'NULL'
} as const;

const Modality = {
  AUDIO: 'AUDIO',
  TEXT: 'TEXT',
  IMAGE: 'IMAGE'
} as const;

// --- Tool Definitions ---

const updateArOverlayTool = {
  name: "updateArOverlay",
  description: "Update the AR Heads-Up Display with real-time plant analysis. CALL THIS FREQUENTLY (every 2-3s) when looking at plants.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      colaCount: { type: Type.NUMBER, description: "Count of visible flowering sites." },
      biomassEstimate: { type: Type.STRING, description: "Density: 'Sparse', 'Developing', 'Dense', 'Stacked'." },
      healthStatus: { type: Type.STRING, description: "Status: 'Vigorous', 'Nominal', 'Stressed', 'Critical'." },
      criticalWarning: { type: Type.STRING, description: "Short urgent alert (e.g., 'Mite Webbing', 'Light Burn')." },
      stressLevel: { type: Type.NUMBER, description: "Visual stress level 0-100. 0 is healthy, 100 is dead/dying." },
      guidance: { type: Type.STRING, description: "Short instruction to user: 'Move Closer', 'Hold Steady', 'Scan Lower Leaves'." }
    },
    required: ["colaCount", "biomassEstimate", "healthStatus"]
  }
};

const proposeLogTool = {
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

const openCameraTool = {
  name: "openCamera",
  description: "Opens the device camera/scanner. Call this when the user wants to show you the plant or asks for a diagnosis.",
  parameters: { type: Type.OBJECT, properties: {}, required: [] }
};

// --- Schemas ---

const facilityBriefingSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['OPTIMAL', 'ATTENTION', 'CRITICAL'] },
    summary: { type: Type.STRING },
    actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
    weatherAlert: { type: Type.STRING }
  },
  required: ["status", "summary", "actionItems"]
};

const cohortAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    trendSummary: { type: Type.STRING },
    dominantIssue: { type: Type.STRING },
    topPerformingStrain: { type: Type.STRING },
    recommendedAction: { type: Type.STRING }
  },
  required: ["trendSummary", "recommendedAction"]
};

const aiDiagnosisSchema = {
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

const strainInfoSchema = {
  type: Type.OBJECT,
  properties: {
    breeder: { type: Type.STRING },
    floweringTimeDays: { type: Type.NUMBER },
    lineage: { type: Type.STRING },
    terpeneProfile: { type: Type.STRING },
    stretchPotential: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
    feedingRecommendation: { type: Type.STRING }
  },
  required: ["breeder", "floweringTimeDays", "lineage", "terpeneProfile", "stretchPotential", "feedingRecommendation"]
};

const environmentalTargetsSchema = {
  type: Type.OBJECT,
  properties: {
    temp: { type: Type.STRING },
    rh: { type: Type.STRING },
    vpd: { type: Type.STRING },
    ppfd: { type: Type.STRING },
    reasoning: { type: Type.STRING }
  },
  required: ["temp", "rh", "vpd", "ppfd", "reasoning"]
};

const forwardScheduleSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      task: { type: Type.STRING },
      dueDate: { type: Type.STRING },
      priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
      reasoning: { type: Type.STRING }
    },
    required: ["task", "dueDate", "priority", "reasoning"]
  }
};

const voiceCommandSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ['NAVIGATE', 'LOG', 'QUERY', 'UNKNOWN'] },
    targetView: { type: Type.STRING, enum: ['dashboard', 'camera', 'settings', 'chat', 'research'] },
    logProposal: {
        type: Type.OBJECT,
        properties: {
            actionType: { type: Type.STRING },
            manualNotes: { type: Type.STRING }
        }
    },
    queryText: { type: Type.STRING },
    transcription: { type: Type.STRING }
  },
  required: ["intent", "transcription"]
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
  private sessionPromise: Promise<any> | null = null;
  private liveSession: any | null = null;
  
  // Audio State
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioQueue: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;

  constructor() {
    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY || '' : '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Cleans raw AI output to remove markdown code blocks, ensuring valid JSON parsing.
   */
  private cleanJson(text: string): string {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('```')) {
      clean = clean.substring(3);
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.length - 3);
    }
    return clean.trim();
  }

  private parseDataUri(input: string): { mimeType: string; data: string } {
    const match = input.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match) return { mimeType: match[1], data: match[2] };
    return { mimeType: 'image/jpeg', data: input };
  }

  private handleApiError(e: unknown): never {
    let msg = "AI Service Unavailable";
    if (e instanceof Error) {
        if (e.message.includes('429')) msg = "Daily API Limit Reached";
        else if (e.message.includes('401')) msg = "Invalid API Key";
        else if (e.message.includes('503')) msg = "Gemini Overloaded";
        else if (e.message.includes('SAFETY')) msg = "Safety Block Triggered";
        else if (e.message.includes('INVALID_ARGUMENT')) msg = "Invalid Data Format";
        else msg = e.message;
    } else if (typeof e === 'string') {
        msg = e;
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
    if (this.sessionPromise) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
      this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });

      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            },
            tools: [{ functionDeclarations: [updateArOverlayTool] }],
            systemInstruction: `
              You are the Cultivator's Copilot (AR Mode).
              CONTINUOUS ANALYSIS: Scan video feed every 2s. Use 'updateArOverlay'.
              PERSONA: Expert Phytopathologist. Concise, professional.
              GUIDANCE: actively direct the user with 'guidance' field (e.g. 'Zoom in on yellow leaf').
            `
        },
        callbacks: {
            onopen: async () => {
                onData({ status: "SYSTEM ONLINE" });
                if (mediaStream && this.inputAudioContext) {
                    await this.startAudioStreaming(mediaStream);
                }
            },
            onmessage: async (msg: any) => {
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData && this.outputAudioContext) {
                    const audioBytes = base64ToUint8Array(audioData);
                    await this.playAudioChunk(audioBytes);
                }

                if (onTranscript) {
                    if (msg.serverContent?.modelTurn?.parts?.[0]?.text) {
                         onTranscript(msg.serverContent.modelTurn.parts[0].text, false);
                    }
                }

                if (msg.toolCall) {
                    const call = msg.toolCall.functionCalls.find((fc: any) => fc.name === 'updateArOverlay');
                    if (call) {
                         const args = call.args as unknown as ArOverlayData;
                         onData({ ...args, status: "ANALYZING..." });
                         this.sessionPromise?.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    name: call.name,
                                    id: call.id,
                                    response: { result: "Overlay Updated" }
                                }
                            });
                         });
                    }
                }
            },
            onclose: (e) => {
                this.cleanupAudio();
                this.sessionPromise = null;
                this.liveSession = null;
                onClose();
            },
            onerror: (e) => {
                console.error("Live Session Error", e);
                onError(new Error("Connection Error"));
            }
        }
      });

      this.liveSession = await this.sessionPromise;

    } catch (e) {
      this.handleApiError(e);
    }
  }

  private async startAudioStreaming(stream: MediaStream) {
      if (!this.inputAudioContext) return;
      if (this.inputAudioContext.state === 'suspended') {
          await this.inputAudioContext.resume();
      }
      
      this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(stream);
      this.audioProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
      
      this.audioProcessor.onaudioprocess = (e) => {
          if (!this.sessionPromise) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcm16.buffer);
          
          this.sessionPromise.then(session => {
              session.sendRealtimeInput({
                  media: { mimeType: 'audio/pcm;rate=16000', data: base64 }
              });
          });
      };

      this.mediaStreamSource.connect(this.audioProcessor);
      this.audioProcessor.connect(this.inputAudioContext.destination);
  }

  private async playAudioChunk(pcmData: Uint8Array) {
      if (!this.outputAudioContext) return;
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

      const now = this.outputAudioContext.currentTime;
      const startTime = Math.max(now, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + buffer.duration;
      this.audioQueue.push(source);
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
      this.audioQueue.forEach(s => { try { s.stop(); } catch(e) {} });
      this.audioQueue = [];
      this.mediaStreamSource = null;
      this.audioProcessor = null;
      this.inputAudioContext = null;
      this.outputAudioContext = null;
      this.nextPlayTime = 0;
  }

  public stopLiveAnalysis() {
    this.cleanupAudio();
    if (this.sessionPromise) {
        this.sessionPromise.then(s => s.close());
        this.sessionPromise = null;
        this.liveSession = null;
    }
  }

  public sendLiveFrame(base64Image: string) {
    if (this.sessionPromise) {
        this.sessionPromise.then(session => {
            session.sendRealtimeInput({
                media: { mimeType: 'image/jpeg', data: base64Image }
            });
        });
    }
  }

  /**
   * Send a text query to the active live session.
   * Useful for interacting with the AR context (e.g., "Explain this metric").
   */
  public sendLiveTextQuery(text: string) {
    if (this.sessionPromise) {
        this.sessionPromise.then(session => {
            // Live API Text Injection: Send as ClientContent part
            session.send({
                clientContent: {
                    turns: [{
                        role: 'user',
                        parts: [{ text: text }]
                    }],
                    turnComplete: true
                }
            });
        });
    }
  }

  // --- Generation Methods ---

  public async getStrainInfo(strainName: string): Promise<StrainInfo> {
    const modelId = 'gemini-3-pro-preview';
    const prompt = `Provide agronomic data for Cannabis strain: "${strainName}". 
    Return a raw JSON object based on breeder data and community consensus.`;

    try {
        const response = await this.ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: strainInfoSchema,
                systemInstruction: "You are an expert cannabis geneticist.",
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });

        if (response.text) return JSON.parse(this.cleanJson(response.text)) as StrainInfo;
        throw new Error("No data returned");
    } catch (e) {
        this.handleApiError(e);
        throw e;
    }
  }

  // Smart Environmental Calibration (Agentic)
  public async calibrateEnvironment(strain: string, stage: string, stageDay: number): Promise<EnvironmentalTargets> {
    const modelId = 'gemini-3-pro-preview';
    const prompt = `Calculate optimal environmental targets for Strain: "${strain}" at Stage: "${stage}" (Day ${stageDay}).
    Consider genetic lineage (Indica/Sativa dominance) and stage requirements.`;

    try {
        const response = await this.ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: environmentalTargetsSchema,
                systemInstruction: "You are a master grower tuning a controlled environment agriculture (CEA) facility.",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        if (response.text) return JSON.parse(this.cleanJson(response.text)) as EnvironmentalTargets;
        throw new Error("Calibration failed");
    } catch (e) {
        this.handleApiError(e);
        throw e;
    }
  }

  // Predictive Scheduling (Agentic)
  public async generateForwardSchedule(batch: PlantBatch, recentLogs: GrowLog[]): Promise<ScheduleItem[]> {
    const modelId = 'gemini-3-pro-preview';
    const context = `
      Batch: ${batch.strain} (${batch.currentStage}).
      Start Date: ${new Date(batch.startDate).toLocaleDateString()}.
      Last 3 Logs: ${JSON.stringify(recentLogs.slice(0, 3).map(l => ({ date: new Date(l.timestamp).toLocaleDateString(), action: l.actionType })))}
    `;
    const prompt = `Predict the next 3 critical cultivation tasks for this batch based on its timeline and history.`;

    try {
      const response = await this.ai.models.generateContent({
        model: modelId,
        contents: `${context}\n${prompt}`,
        config: {
           responseMimeType: 'application/json',
           responseSchema: forwardScheduleSchema,
           systemInstruction: "You are a cultivation manager planning the weekly schedule.",
           thinkingConfig: { thinkingBudget: 2048 }
        }
      });
      if (response.text) return JSON.parse(this.cleanJson(response.text)) as ScheduleItem[];
      return [];
    } catch (e) {
       this.handleApiError(e);
       return [];
    }
  }

  public async generateFacilityBriefing(rooms: Room[], logs: GrowLog[]): Promise<FacilityBriefing> {
    try {
      const modelId = 'gemini-3-pro-preview';
      const prompt = `
        Current Date: ${new Date().toLocaleDateString()}
        Analyze facility state based on environment metrics and recent logs.
        Identify correlations between VPD trends and logged observations.
        
        Rooms: ${JSON.stringify(rooms.map(r => ({ name: r.name, stage: r.stage, metrics: r.metrics })))}
        Logs: ${JSON.stringify(logs.slice(0, 5).map(l => ({ action: l.actionType, notes: l.manualNotes })))}
      `;

      const response = await this.ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: facilityBriefingSchema,
            systemInstruction: "You are the facility commander. Provide a crisp, strategic status report.",
            thinkingConfig: { thinkingBudget: 2048 }
        }
      });

      if (response.text) {
        const data = JSON.parse(this.cleanJson(response.text)) as FacilityBriefing;
        data.timestamp = Date.now();
        return data;
      }
      throw new Error("Empty response");
    } catch (e) {
      this.handleApiError(e);
      throw e;
    }
  }

  public async chatStream(
    history: ChatMessage[],
    newMessage: string,
    imageContext: string | null,
    context: ChatContext,
    onChunk: (text: string, grounding?: any) => void,
    onToolCall: (name: string, payload: any) => void
  ) {
    const modelId = 'gemini-3-pro-preview';
    const systemPrompt = `
      ${PHYTOPATHOLOGIST_INSTRUCTION}
      CONTEXT: ${JSON.stringify(context)}
    `;

    const chatHistory = history
      .filter(h => h.role !== 'model' || !h.isThinking)
      .map(h => {
         const parts: any[] = [];
         if (h.attachment) {
             const { mimeType, data } = this.parseDataUri(h.attachment.url);
             parts.push({ inlineData: { mimeType, data } });
         }
         if (h.text) parts.push({ text: h.text });
         return { role: h.role, parts: parts };
      });

    const thinkingBudget = 4096; 

    const chat = this.ai.chats.create({
        model: modelId,
        config: {
            systemInstruction: systemPrompt,
            thinkingConfig: { thinkingBudget }, 
            tools: [
              { functionDeclarations: [proposeLogTool, openCameraTool] }, 
              { googleSearch: {} }
            ] 
        },
        history: chatHistory.slice(0, -1)
    });
    
    const msgParts: any[] = [{ text: newMessage }];
    if (imageContext) {
        const { mimeType, data } = this.parseDataUri(imageContext);
        msgParts.unshift({ inlineData: { mimeType, data } });
    }

    try {
        const streamResult = await chat.sendMessageStream({ message: msgParts });
        for await (const chunk of streamResult) {
            if (chunk.text) onChunk(chunk.text, chunk.candidates?.[0]?.groundingMetadata);
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                const call = chunk.functionCalls[0];
                onToolCall(call.name, call.args);
            }
        }
    } catch (e) {
        this.handleApiError(e);
    }
  }

  public async analyzePlantImage(imageBase64: string): Promise<AiDiagnosis> {
    const modelId = 'gemini-3-pro-preview'; 
    try {
        const { mimeType, data } = this.parseDataUri(imageBase64);
        const response = await this.ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: "Analyze this plant. Perform a differential diagnosis. Rule out potential lookalikes before confirming pests or deficiencies. Prioritize environmental stress if morphology suggests it." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: aiDiagnosisSchema,
                systemInstruction: PHYTOPATHOLOGIST_INSTRUCTION,
                thinkingConfig: { thinkingBudget: 4096 } // Deep reasoning to avoid false positives
            }
        });
        
        if (response.text) return JSON.parse(this.cleanJson(response.text)) as AiDiagnosis;
        throw new Error("Empty response");
    } catch (e) {
        this.handleApiError(e);
        throw e;
    }
  }

  // --- Cohort/Research ---

  public async generateCohortAnalysis(logs: GrowLog[], userQuery?: string): Promise<CohortAnalysis> {
    try {
       const modelId = 'gemini-3-pro-preview';
       const prompt = userQuery 
         ? `User Query: "${userQuery}". Analyze these logs to answer the user's specific question: ${JSON.stringify(logs.map(l => ({ date: l.timestamp, note: l.manualNotes })))}`
         : `Analyze logs for trends: ${JSON.stringify(logs.map(l => ({ date: l.timestamp, note: l.manualNotes })))}`;

       const response = await this.ai.models.generateContent({
          model: modelId,
          contents: prompt,
          config: {
             responseMimeType: 'application/json',
             responseSchema: cohortAnalysisSchema,
             systemInstruction: "You are a lead researcher. output raw json.",
             thinkingConfig: { thinkingBudget: 4096 }
          }
       });

       if (response.text) return JSON.parse(this.cleanJson(response.text)) as CohortAnalysis;
       throw new Error("No analysis generated");
    } catch (e) {
       this.handleApiError(e);
       throw e;
    }
  }

  // --- Deep Research Analyst (Conversational) ---
  public async askResearchAnalyst(logs: GrowLog[], question: string): Promise<string> {
    const modelId = 'gemini-3-pro-preview';
    try {
      // Compress logs for token efficiency
      const dataSet = logs.map(l => ({ 
        d: new Date(l.timestamp).toLocaleDateString(), 
        t: l.actionType, 
        n: l.manualNotes, 
        s: l.aiDiagnosis?.healthScore 
      }));

      const response = await this.ai.models.generateContent({
        model: modelId,
        contents: `DataSet: ${JSON.stringify(dataSet)}. Question: ${question}`,
        config: {
          systemInstruction: "You are a Data Analyst for a cannabis facility. Analyze the provided JSON dataset to answer the user's question. Be precise, cite specific dates, and identify correlations. Use markdown formatting.",
          thinkingConfig: { thinkingBudget: 4096 }
        }
      });
      return response.text || "Analysis failed.";
    } catch (e) {
      this.handleApiError(e);
      throw e;
    }
  }

  // --- VEO Video Generation (Simulate Growth) ---
  public async generateGrowthSimulation(imageBase64: string): Promise<string> {
    const modelId = 'veo-3.1-fast-generate-preview';
    const { mimeType, data } = this.parseDataUri(imageBase64);

    try {
      let operation = await this.ai.models.generateVideos({
        model: modelId,
        prompt: 'Time lapse of a cannabis plant maturing over 14 days, vigorous growth, high quality, 4k, photorealistic.',
        image: {
          imageBytes: data,
          mimeType: mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '1:1'
        }
      });

      // Polling Loop for Veo Operation
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        operation = await this.ai.operations.getVideosOperation({ operation: operation });
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error("Video generation failed to return a URI.");
      
      return videoUri;
    } catch (e) {
      this.handleApiError(e);
      throw e;
    }
  }

  // --- Text-to-Speech (Briefing) ---
  public async generateAudioBriefing(text: string): Promise<ArrayBuffer> {
    try {
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, 
                    },
                },
            },
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) throw new Error("No audio data returned");

        // Convert Base64 to ArrayBuffer for playback
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;

    } catch (e) {
        this.handleApiError(e);
        throw e;
    }
  }

  // --- Voice Command Processing ---
  public async processVoiceCommand(audioBlob: Blob): Promise<VoiceCommandResponse> {
      try {
          const modelId = 'gemini-2.5-flash'; // Fast model for commands
          const reader = new FileReader();
          
          const base64Audio = await new Promise<string>((resolve) => {
              reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  resolve(base64);
              };
              reader.readAsDataURL(audioBlob);
          });

          const response = await this.ai.models.generateContent({
              model: modelId,
              contents: {
                  parts: [
                      { inlineData: { mimeType: 'audio/wav', data: base64Audio } }, // Assuming Blob is wav/webm depending on recorder
                      { text: "Process this voice command." }
                  ]
              },
              config: {
                  responseMimeType: 'application/json',
                  responseSchema: voiceCommandSchema,
                  systemInstruction: VOICE_COMMAND_INSTRUCTION
              }
          });

          if (response.text) return JSON.parse(this.cleanJson(response.text)) as VoiceCommandResponse;
          throw new Error("Voice processing failed");
      } catch (e) {
          this.handleApiError(e);
          throw e;
      }
  }
}

export const geminiService = new GeminiService();
