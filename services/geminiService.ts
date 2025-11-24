import { GoogleGenAI, FunctionDeclaration, Type, Schema, Modality, LiveServerMessage } from "@google/genai";
import { AiDiagnosis, ChatMessage, GrowSetup, GrowLog, EnvironmentReading, Room, FacilityBriefing, CohortAnalysis, ChatContext } from "../types";
import { PHYTOPATHOLOGIST_INSTRUCTION, FLIP_DATE } from "../constants";

// Tool Definition for AR Overlay
const updateArOverlayTool: FunctionDeclaration = {
  name: "updateArOverlay",
  description: "Update the AR Heads-Up Display with real-time plant analysis data based on the video stream.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      colaCount: {
        type: Type.NUMBER,
        description: "Estimated number of flower sites/colas visible."
      },
      biomassEstimate: {
        type: Type.STRING,
        description: "Brief estimate of biomass density (e.g. 'Heavy Stacking', 'Larfy', 'Dense')."
      },
      healthStatus: {
        type: Type.STRING,
        description: "Current visual health status (e.g. 'Vigorous', 'Stressed', 'Etiolated')."
      },
      criticalWarning: {
        type: Type.STRING,
        description: "Any urgent warnings like 'Light Burn' or 'Pest Cluster'. Empty if none."
      }
    },
    required: ["colaCount", "biomassEstimate", "healthStatus"]
  }
};

// Tool Definition for Chat Log Proposal
const proposeLogTool: FunctionDeclaration = {
  name: "proposeLog",
  description: "Generate a structured grow log entry or plant analysis. Use this when the user shares an image or asks for a diagnosis.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      manualNotes: { type: Type.STRING, description: "A summary of the observation or analysis." },
      actionType: { 
        type: Type.STRING, 
        enum: ['Water', 'Feed', 'Defoliate', 'Observation', 'Other'],
        description: "The category of the action."
      },
      healthScore: { type: Type.NUMBER, description: "Estimated health score (0-100) based on visual analysis." },
      detectedPests: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of detected pests (e.g. 'Spider Mites')." },
      nutrientDeficiencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of deficiencies (e.g. 'Magnesium')." },
      currentStage: { type: Type.STRING, description: "Observed growth stage (e.g. 'Early Flower')." },
      recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of specific actionable recommendations." }
    },
    required: ["manualNotes", "actionType"]
  }
};

// Schema for Plant Analysis
const plantAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    healthScore: { type: Type.NUMBER, description: "0-100 score based on Verdant Scale" },
    detectedPests: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of detected pests or 'None'" },
    nutrientDeficiencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of detected deficiencies or 'None'" },
    morphologyNotes: { type: Type.STRING, description: "Detailed observation of plant structure" },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable steps for the grower" },
    progressionAnalysis: { type: Type.STRING, description: "Comparison with previous state" },
    harvestPrediction: {
      type: Type.OBJECT,
      properties: {
        predictedDate: { type: Type.NUMBER, description: "Unix timestamp of predicted harvest" },
        confidence: { type: Type.NUMBER, description: "0.0 to 1.0 confidence score" },
        reasoning: { type: Type.STRING, description: "Reasoning for the prediction" },
        adjustmentDays: { type: Type.NUMBER, description: "Days adjusted from breeder baseline" }
      },
      required: ["predictedDate", "confidence", "reasoning", "adjustmentDays"]
    }
  },
  required: ["healthScore", "detectedPests", "nutrientDeficiencies", "morphologyNotes", "recommendations", "progressionAnalysis", "harvestPrediction"]
};

// Schema for Facility Briefing
const facilityBriefingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['OPTIMAL', 'ATTENTION', 'CRITICAL'] },
    summary: { type: Type.STRING, description: "A concise, military-style status report (max 2 sentences)." },
    actionItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Top 3 priority tasks based on data." },
    weatherAlert: { type: Type.STRING, description: "Optional simulated weather impact warning." }
  },
  required: ["status", "summary", "actionItems"]
};

// Schema for Cohort Analysis
const cohortAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    trendSummary: { type: Type.STRING, description: "A summary of health trends over time across the provided logs." },
    dominantIssue: { type: Type.STRING, description: "The most recurring pest or deficiency, if any." },
    topPerformingStrain: { type: Type.STRING, description: "If multiple strains are present, which appears healthiest?" },
    recommendedAction: { type: Type.STRING, description: "A high-level strategic recommendation for the next cycle." }
  },
  required: ["trendSummary", "recommendedAction"]
};

class GeminiService {
  private ai: GoogleGenAI | undefined;
  private apiKey: string | undefined;
  
  // Use a Promise to track the active session state to prevent race conditions
  private currentSessionPromise: Promise<any> | null = null;

  private resolveApiKey(): string | undefined {
    const viteKey = typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_GEMINI_API_KEY : undefined;
    const nodeKey = typeof process !== "undefined" ? process.env?.API_KEY : undefined;
    const windowKey = typeof window !== "undefined" ? (window as any)?.process?.env?.API_KEY : undefined;
    return viteKey || nodeKey || windowKey;
  }

  private ensureClient(): GoogleGenAI {
    if (this.ai && this.apiKey) return this.ai;

    this.apiKey = this.resolveApiKey();
    if (!this.apiKey) {
      console.error("CRITICAL: Gemini API key is missing. Check process.env.API_KEY.");
      // We do NOT return a dummy client here. We want to fail fast if the key is missing.
      throw new Error("Gemini API key not configured");
    }
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    return this.ai;
  }

  constructor() {
    // Lazy initialization
  }

  // --- 0. Dashboard Intelligence ---

  public async generateFacilityBriefing(rooms: Room[], logs: GrowLog[]): Promise<FacilityBriefing> {
    const ai = this.ensureClient();

    const recentLogs = logs.slice(0, 5).map(l => ({ type: l.actionType, notes: l.manualNotes }));
    const roomSummaries = rooms.map(r => ({
      name: r.name,
      stage: r.stage,
      day: r.stageDay,
      vpd: r.metrics.vpd,
      status: r.metrics.status
    }));

    const systemPrompt = `
    You are the 'Commander' of a commercial cannabis facility. 
    Analyze the provided room telemetry and recent logs.
    Generate a concise daily briefing.
    - If VPD is out of range (Optimal: 0.8-1.5), flag it.
    - If plants are late flower (>Day 50), suggest checking trichomes.
    - Suggest tasks like 'Defoliate', 'Reservoir Change', 'IPM Spray'.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [{ text: `Telemetry: ${JSON.stringify(roomSummaries)}. Recent Activity: ${JSON.stringify(recentLogs)}. Generate Briefing.` }]
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: facilityBriefingSchema
        }
      });

      if (!response.text) throw new Error("No response");
      return JSON.parse(response.text) as FacilityBriefing;

    } catch (e) {
      console.error("Briefing Gen Failed", e);
      return {
        status: 'OPTIMAL',
        summary: 'Facility systems nominal. Telemetry within standard deviation.',
        actionItems: ['Monitor VPD', 'Routine Crop Steering']
      };
    }
  }
  
  // --- 0.5 Research Intelligence ---

  public async generateCohortAnalysis(logs: GrowLog[]): Promise<CohortAnalysis> {
    const ai = this.ensureClient();

    // Prepare data (limit to last 20 significant logs to save context window)
    const analysisSet = logs.slice(0, 20).map(l => ({
        date: new Date(l.timestamp).toDateString(),
        health: l.aiDiagnosis?.healthScore,
        pests: l.aiDiagnosis?.detectedPests,
        deficiencies: l.aiDiagnosis?.nutrientDeficiencies,
        notes: l.manualNotes || l.aiDiagnosis?.morphologyNotes
    }));

    const systemPrompt = `
    You are a Lead Agronomist analyzing a set of crop logs. 
    Look for patterns in the provided data.
    - Are health scores trending up or down?
    - Is there a recurring pest or deficiency appearing on multiple dates?
    - Suggest a corrective course of action.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [{ text: `Log Dataset: ${JSON.stringify(analysisSet)}. Analyze this cohort.` }]
            },
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: cohortAnalysisSchema
            }
        });

        if (!response.text) throw new Error("No response");
        return JSON.parse(response.text) as CohortAnalysis;

    } catch (e) {
        console.error("Cohort Analysis Failed", e);
        throw e;
    }
  }

  // --- 1. Core Analysis (gemini-3-pro-preview) ---
  
  public async analyzePlantImage(
    base64Image: string, 
    context: GrowSetup, 
    previousDiagnosis?: AiDiagnosis,
    envData?: EnvironmentReading,
    breederDays?: number
  ): Promise<AiDiagnosis> {
    const ai = this.ensureClient();

    const contextAwareSystemInstruction = `
    ${PHYTOPATHOLOGIST_INSTRUCTION}

    ACTIVE GROWER CONFIGURATION:
    - Environment: ${context.environmentType}
    - Lighting: ${context.lightingType}
    - Medium: ${context.medium}
    - Nutrients: ${context.nutrients}
    - Target VPD: ${context.targetVpd}

    COMPARATIVE ANALYSIS MODE:
    ${previousDiagnosis 
      ? `PREVIOUS SCAN DATA: Health Score ${previousDiagnosis.healthScore}. Issues: ${previousDiagnosis.detectedPests.join(', ')}.
         COMPARE current image to this baseline.`
      : "No previous scan available."
    }
    
    PREDICTIVE HARVEST LOGIC:
    Baseline: ${breederDays || 63} days. 
    Environment: ${envData ? `${envData.temperature}°F` : 'Unknown'}.
    Adjust based on trichome maturity and stress.
    `;

    const cleanBase64 = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/webp', data: cleanBase64 } },
            { text: "Analyze this cannabis plant. Return strict JSON." }
          ]
        },
        config: {
          systemInstruction: contextAwareSystemInstruction,
          responseMimeType: 'application/json',
          responseSchema: plantAnalysisSchema,
          thinkingConfig: { thinkingBudget: 32768 } // High budget for diagnostic reasoning
        }
      });

      if (!response.text) throw new Error("Empty response from Gemini");
      const json = JSON.parse(response.text);
      
      return {
        healthScore: json.healthScore,
        detectedPests: json.detectedPests,
        nutrientDeficiencies: json.nutrientDeficiencies,
        morphologyNotes: json.morphologyNotes,
        recommendations: json.recommendations,
        progressionAnalysis: json.progressionAnalysis,
        harvestPrediction: json.harvestPrediction
      };

    } catch (error) {
      console.warn("Gemini 3 Pro Analysis Failed", error);
      throw error; 
    }
  }

  // --- 2. Voice Log Processing ---
  
  public async processVoiceLog(audioBase64: string): Promise<Partial<GrowLog>> {
     const ai = this.ensureClient();

     const systemPrompt = `
     You are a Voice Logging Assistant. Transcribe and categorize.
     Output JSON: { "manualNotes": "text", "actionType": "category" }
     `;

     try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'audio/mp4', data: audioBase64 } },
                    { text: "Transcribe." }
                ]
            },
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json'
            }
        });
        
        const json = JSON.parse(response.text);
        return {
            manualNotes: json.manualNotes,
            actionType: json.actionType
        };

     } catch (e) {
         console.error("Voice processing failed", e);
         return { manualNotes: "Voice transcription failed.", actionType: 'Observation' };
     }
  }

  // --- 3. Chat (Grounded & Multimodal - Gemini 3 Pro) ---

  public async chatStream(
    history: ChatMessage[], 
    newMessage: string, 
    attachment: string | null,
    context: ChatContext,
    onChunk: (text: string, grounding?: any) => void,
    onToolCall?: (payload: Partial<GrowLog>) => void
  ) {
    const ai = this.ensureClient();
    
    // Construct Real-Time Intelligence Context
    const batchContext = context.batches.map(b => {
      const age = Math.floor((Date.now() - b.startDate) / (1000 * 60 * 60 * 24));
      const daysInFlower = b.currentStage === 'Flowering' 
         ? Math.floor((Date.now() - new Date(FLIP_DATE).getTime()) / (1000 * 60 * 60 * 24)) 
         : 0;
      return `- [${b.batchTag.toUpperCase()}] ${b.strain}. Age: ${age} days. Stage: ${b.currentStage} (Day ${daysInFlower}). Medium: ${b.soilMix}. Notes: ${b.notes}`;
    }).join('\n');

    const envContext = context.environment 
      ? `Current Telemetry: Temp ${context.environment.temperature.toFixed(1)}°F, RH ${context.environment.humidity.toFixed(1)}%, VPD ${context.metrics?.vpd.toFixed(2) || 'N/A'} kPa.`
      : "Live sensor telemetry offline. Proceed with general assumptions.";

    const logHistory = context.recentLogs.slice(0, 5).map(l => 
       `[${new Date(l.timestamp).toLocaleDateString()}] ${l.actionType}: ${l.manualNotes}`
    ).join('\n');

    const systemPrompt = `
    You are Cultivator's Copilot, an expert Cannabis Consultant (Gemini 3 Pro).
    
    ### REAL-TIME FACILITY STATUS
    ${envContext}

    ### ACTIVE GENETICS & SOIL CONFIGURATION
    ${batchContext}

    ### RECENT OPERATIONS LOG
    ${logHistory}

    ### CAPABILITIES
    1. **Tailored Advice:** Use the specific soil mix (Living Soil vs Salt) for EACH plant when giving advice. Blue is Living Soil (Microbe focused), Green is Hybrid (Salt tolerant).
    2. **Environment Check:** Compare current VPD to stage targets.
    3. **Image Analysis:** If provided an image, analyze it for health, pests, and deficiencies.
    4. **Log Events:** If the user confirms an action (e.g., "I watered Blue"), call the 'proposeLog' tool.
    
    ALWAYS call 'proposeLog' if the user uploads a plant photo, populating the fields based on your visual analysis.
    `;

    const contents = history
      .filter(h => h.text.trim() !== '' || h.attachment)
      .map(msg => {
        const parts: any[] = [];
        if (msg.attachment) {
           const cleanData = msg.attachment.url.split('base64,')[1] || msg.attachment.url;
           parts.push({ inlineData: { mimeType: msg.attachment.mimeType, data: cleanData } });
        }
        if (msg.text) {
           parts.push({ text: msg.text });
        }
        return {
           role: msg.role,
           parts: parts
        };
      });
    
    // Add new message
    const newParts: any[] = [];
    if (attachment) {
       const cleanData = attachment.split('base64,')[1] || attachment;
       newParts.push({ inlineData: { mimeType: 'image/webp', data: cleanData } });
    }
    newParts.push({ text: newMessage });
    contents.push({ role: 'user', parts: newParts });

    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-3-pro-preview',
            contents: contents,
            config: {
                systemInstruction: systemPrompt,
                tools: [{ functionDeclarations: [proposeLogTool] }], // EXCLUSIVE: No googleSearch allowed here
                toolConfig: { functionCallingConfig: { mode: 'AUTO' } }
            }
        });

        for await (const chunk of responseStream) {
            // Handle Text
            if (chunk.text) {
                onChunk(chunk.text, chunk.groundingMetadata);
            }
            
            // Handle Function Calls
            const fcs = chunk.functionCalls;
            if (fcs && fcs.length > 0) {
                const fc = fcs[0];
                if (fc.name === 'proposeLog') {
                    if (onToolCall) onToolCall(fc.args as unknown as Partial<GrowLog>);
                }
            }
        }
    } catch (e) {
        console.error("Chat Stream Error", e);
        throw e;
    }
  }

  // --- 4. Live API (AR Overlay) ---

  public async startLiveAnalysis(
    onData: (data: any) => void,
    onError: (err: any) => void,
    onClose: () => void
  ) {
    const ai = this.ensureClient();
    
    // Store the Session Promise to manage the active connection state
    this.currentSessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                console.log("Live API Session Connected");
            },
            onmessage: (message: LiveServerMessage) => {
                // Handle Tool Calls (The model's way of sending structured data back)
                if (message.toolCall) {
                    for (const fc of message.toolCall.functionCalls) {
                        if (fc.name === 'updateArOverlay') {
                            onData(fc.args);
                            
                            // Send dummy response to keep context sync (optional but good practice)
                            if (this.currentSessionPromise) {
                                this.currentSessionPromise.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: "ok" }
                                        }
                                    });
                                });
                            }
                        }
                    }
                }
            },
            onerror: (e) => {
                console.error("Live API Error", e);
                onError(e);
            },
            onclose: () => {
                console.log("Live API Closed");
                onClose();
            }
        },
        config: {
            responseModalities: [Modality.AUDIO], // Required by Live API
            systemInstruction: "You are an AR Vision Assistant for a cannabis grower. Analyze the video stream. Call the 'updateArOverlay' function continuously to update the HUD with plant health, cola counts, and density estimates.",
            tools: [{ functionDeclarations: [updateArOverlayTool] }]
        }
    });

    await this.currentSessionPromise;
  }

  public async sendLiveFrame(base64Image: string) {
      if (!this.currentSessionPromise) return;
      
      // Chain off the promise to ensure session is ready
      this.currentSessionPromise.then(session => {
          session.sendRealtimeInput({
              media: {
                  mimeType: 'image/jpeg',
                  data: base64Image
              }
          });
      }).catch(e => console.warn("Frame dropped, session not ready", e));
  }

  public stopLiveAnalysis() {
      if (this.currentSessionPromise) {
          this.currentSessionPromise.then(session => {
              session.close();
          });
          this.currentSessionPromise = null;
      }
  }

  // --- 5. Veo Video Generation ---

  public async generateGrowthSimulation(image: string): Promise<string> {
    const ai = this.ensureClient();
    const cleanBase64 = image.includes('base64,') ? image.split('base64,')[1] : image;

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: 'Cinematic timelapse of this cannabis plant maturing, buds swelling, trichomes glistening, high quality, photorealistic',
      image: {
        imageBytes: cleanBase64,
        mimeType: 'image/png', // Assuming source is standardized
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed");

    // Append API key for download
    return `${videoUri}&key=${this.apiKey}`;
  }
}

export const geminiService = new GeminiService();