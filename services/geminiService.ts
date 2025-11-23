import { GoogleGenAI, FunctionDeclaration, Type, Schema, Modality } from "@google/genai";
import { AiDiagnosis, ChatMessage, GrowSetup, GrowLog, EnvironmentReading } from "../types";
import { PHYTOPATHOLOGIST_INSTRUCTION } from "../constants";

// Tool Definition for AR Overlay
const updateArOverlayTool: FunctionDeclaration = {
  name: "updateArOverlay",
  description: "Update the AR Heads-Up Display with real-time plant analysis data.",
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

class GeminiService {
  public ai: GoogleGenAI;
  private apiKey: string | undefined;
  private liveSession: any = null;

  private getSafeApiKey(): string | undefined {
    try {
      // Prioritize existing process.env.API_KEY if available (injected by environment)
      if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  constructor() {
    this.apiKey = this.getSafeApiKey();

    // Safeguard: Initialize safely to prevent module crash.
    // We do NOT retry with a second 'new GoogleGenAI' call if the first fails, 
    // as that causes a recursive crash if the library itself has issues.
    try {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey || "dummy_key_for_init" });
    } catch (e) {
      console.error("Failed to initialize GoogleGenAI client:", e);
      // We accept that this.ai might be malformed if initialization failed.
      // Casting to any to avoid typescript errors during this critical failure state.
      this.ai = {} as any; 
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
    if (!this.apiKey) throw new Error("API Key missing");

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
      const response = await this.ai.models.generateContent({
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
          responseSchema: plantAnalysisSchema
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

  // --- 2. Voice Log Processing (Upgraded to Gemini 3 Pro) ---
  
  public async processVoiceLog(audioBase64: string): Promise<Partial<GrowLog>> {
     if (!this.apiKey) throw new Error("API Key missing");

     const systemPrompt = `
     You are a Voice Logging Assistant. Transcribe and categorize.
     Output JSON: { "manualNotes": "text", "actionType": "category" }
     `;

     try {
        const response = await this.ai.models.generateContent({
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
    options: { context: GrowSetup },
    onChunk: (text: string, grounding?: any) => void,
    onToolCall?: (payload: Partial<GrowLog>) => void
  ) {
    if (!this.apiKey) throw new Error("API Key missing");
    const modelName = 'gemini-3-pro-preview'; 
    
    const systemPrompt = `You are Cultivator's Copilot, an expert Cannabis Consultant powered by Gemini 3 Pro.
    Context: ${JSON.stringify(options.context)}.
    Date: ${new Date().toDateString()}.
    
    CAPABILITIES:
    1. Analyze images of plants for health, stage, and deficiencies.
    2. Answer cultivation questions using Google Search grounding when necessary.
    3. If the user shares an update or an image that constitutes a grow event, call the 'proposeLog' tool to create a record.
    4. ALWAYS call 'proposeLog' if the user uploads a plant photo, populating the healthScore, pests, deficiencies, and recommendations fields based on your visual analysis.
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
    
    const newParts: any[] = [];
    if (attachment) {
       const cleanData = attachment.split('base64,')[1] || attachment;
       newParts.push({ inlineData: { mimeType: 'image/webp', data: cleanData } });
       newParts.push({ text: newMessage || "Analyze this plant image in detail for health, pests, and stage." }); 
    } else {
       newParts.push({ text: newMessage });
    }

    const chat = this.ai.chats.create({
      model: modelName,
      config: { 
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }, { functionDeclarations: [proposeLogTool] }]
      },
      history: contents
    });

    try {
        const result = await chat.sendMessageStream({ 
            parts: newParts 
        } as any); 

        for await (const chunk of result) {
            if (chunk.text) {
                const grounding = chunk.candidates?.[0]?.groundingMetadata;
                onChunk(chunk.text, grounding);
            }
            
            const toolCalls = chunk.candidates?.[0]?.content?.parts?.filter(p => p.functionCall);
            if (toolCalls && toolCalls.length > 0) {
                for (const tc of toolCalls) {
                     if (tc.functionCall && tc.functionCall.name === 'proposeLog' && onToolCall) {
                         const args = tc.functionCall.args as any;
                         
                         const diagnosis: Partial<AiDiagnosis> = args.healthScore ? {
                             healthScore: args.healthScore,
                             detectedPests: args.detectedPests || [],
                             nutrientDeficiencies: args.nutrientDeficiencies || [],
                             recommendations: args.recommendations || [],
                             morphologyNotes: args.manualNotes
                         } : {};

                         onToolCall({
                             manualNotes: args.manualNotes,
                             actionType: args.actionType,
                             aiDiagnosis: Object.keys(diagnosis).length > 0 ? diagnosis as AiDiagnosis : undefined
                         });
                     }
                }
            }
        }
    } catch (e) {
        console.error("Chat Stream Error", e);
        throw e;
    }
  }

  // --- 4. Live AR Analysis ---

  public async startLiveAnalysis(
    onArUpdate: (data: any) => void,
    onError?: (err: any) => void,
    onClose?: () => void
  ): Promise<void> {
    if (!this.apiKey) throw new Error("API Key missing");

    try {
        this.liveSession = await this.ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => console.log("AR Session Connected"),
            onmessage: (msg: any) => {
              if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                  if (fc.name === 'updateArOverlay') {
                    onArUpdate(fc.args);
                    if (this.liveSession) {
                        this.liveSession.sendToolResponse({
                          functionResponses: {
                            id: fc.id,
                            name: fc.name,
                            response: { result: "OK" }
                          }
                        });
                    }
                  }
                }
              }
            },
            onclose: (e) => {
                console.log("AR Session Closed", e);
                if (onClose) onClose();
            },
            onerror: (e) => {
                console.error("AR Error", e);
                if (onError) onError(e);
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            tools: [{ functionDeclarations: [updateArOverlayTool] }],
            systemInstruction: "You are an advanced botanical analysis AI for Cannabis cultivation. Continuously analyze the video stream. Identify the plant's health status, estimate biomass density, count visible colas/bud sites, and detect any critical issues (pests, light burn, drooping). You MUST call the `updateArOverlay` function frequently (every few seconds) to update the user's HUD. Do not speak unless asked, rely on the overlay tool."
          }
        });
    } catch (e) {
        console.error("Failed to connect AR session", e);
        if (onError) onError(e);
    }
  }

  public sendLiveFrame(base64: string) {
    if (this.liveSession) {
      this.liveSession.sendRealtimeInput({
        media: {
           mimeType: 'image/jpeg',
           data: base64
        }
      });
    }
  }

  public stopLiveAnalysis() {
    if (this.liveSession) {
      this.liveSession.close();
      this.liveSession = null;
    }
  }

  // --- 5. Veo Video Generation ---
  public async generateGrowthSimulation(image: string): Promise<string> {
    const safeKey = this.getSafeApiKey();
    if (!safeKey) throw new Error("API Key missing");

    const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
    if (!hasKey) {
        await (window as any).aistudio?.openSelectKey();
        const hasKeyAfter = await (window as any).aistudio?.hasSelectedApiKey();
        if(!hasKeyAfter) throw new Error("Paid API Key required for Veo simulation.");
    }
    
    // Re-fetch key in case it was just set by openSelectKey
    // Note: getSafeApiKey retrieves from process.env, which should be updated by the environment
    const refreshedKey = this.getSafeApiKey();
    const veoAi = new GoogleGenAI({ apiKey: refreshedKey || "missing_key" });
    
    let operation = await veoAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: 'Cinematic time-lapse of this cannabis plant flowering and maturing, trichomes turning amber, buds swelling, ultra realistic, 4k',
      image: {
        imageBytes: image.includes('base64,') ? image.split('base64,')[1] : image,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await veoAi.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed");

    // Use the correctly retrieved key
    const response = await fetch(`${downloadLink}&key=${refreshedKey}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
}

export const geminiService = new GeminiService();