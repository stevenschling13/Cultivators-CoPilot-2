
import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type, Part, Content } from "@google/genai";
import { 
  Room, 
  GrowLog, 
  FacilityBriefing, 
  PlantBatch, 
  ScheduleItem, 
  ChatMessage, 
  ChatContext, 
  GroundingMetadata,
  EnvironmentalTargets,
  StrainInfo,
  CohortAnalysis,
  LogProposal
} from '../../types';
import { safeParseAIResponse } from './utils';
import { 
  FacilityBriefingSchema, 
  ScheduleListSchema, 
  EnvironmentalTargetsSchema, 
  StrainInfoSchema, 
  CohortAnalysisSchema 
} from '../../system/schema';

export class GeminiText {
  constructor(private ai: GoogleGenAI) {}

  public async chatStream(
    history: ChatMessage[], 
    newMessage: string, 
    imageContext: string | null,
    contextData: ChatContext,
    onChunk: (text: string, grounding?: GroundingMetadata) => void,
    onToolCall?: (name: string, args: Record<string, any>) => Promise<void>
  ): Promise<void> {
    
    const systemPrompt = `
      You are the Cultivator's Copilot (Gemini 3 Pro).
      Context:
      Setup: ${JSON.stringify(contextData.setup)}
      Environment: ${JSON.stringify(contextData.environment)}
      Metrics: ${JSON.stringify(contextData.metrics)}
      Batches: ${JSON.stringify(contextData.batches.map(b => ({ id: b.id, strain: b.strain, stage: b.currentStage })))}
      Recent Logs: ${JSON.stringify(contextData.recentLogs.map(l => ({ date: new Date(l.timestamp).toLocaleDateString(), action: l.actionType, note: l.manualNotes })))}
    `;

    // 1. Sanitize and Construct History for SDK
    const validHistory: Content[] = [];
    let lastRole = 'model'; // We expect the first message in history (if any) to be User. 
                            // Initializing as 'model' ensures the first check expects 'user'.

    for (const msg of history) {
       // Strict Alternation Check: Prevent [User, User] or [Model, Model]
       if (msg.role === lastRole) {
           // Auto-heal: Insert placeholder if we have consecutive roles
           const placeholderRole = msg.role === 'user' ? 'model' : 'user';
           validHistory.push({ role: placeholderRole, parts: [{ text: "..." }] });
       }

       const parts: Part[] = [];
       
       if (msg.text && msg.text.trim()) {
           parts.push({ text: msg.text });
       } else if (msg.toolCallPayload) {
           parts.push({ text: `[System: Tool '${msg.toolCallPayload.actionType}' was proposed.]` });
       } else {
           parts.push({ text: "..." });
       }

       validHistory.push({ role: msg.role, parts });
       lastRole = msg.role;
    }

    // Ensure history ends with Model before we append our new User message
    if (lastRole === 'user') {
        validHistory.push({ role: 'model', parts: [{ text: "..." }] });
    }

    // 2. Define Tools
    const proposeLogTool: FunctionDeclaration = {
        name: "proposeLog",
        description: "Propose a new log entry.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                actionType: { type: Type.STRING, enum: ["Water", "Feed", "Defoliate", "Pest Control", "Training", "Observation"] },
                manualNotes: { type: Type.STRING },
                healthScore: { type: Type.NUMBER },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["actionType", "manualNotes"]
        }
    };

    const openCameraTool: FunctionDeclaration = {
        name: "openCamera",
        description: "Open camera for diagnosis.",
        parameters: { type: Type.OBJECT, properties: {} }
    };

    // 3. Initialize Chat Session
    const chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      history: validHistory,
      config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: [proposeLogTool, openCameraTool] }],
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 0 } // Disable thinking for fast chat latency
      }
    });

    // 4. Prepare New Message Parts
    const newParts: Part[] = [];
    if (imageContext) {
        const base64 = imageContext.split(',')[1] || imageContext;
        newParts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
    }
    
    // Only add text part if it has content, or if it's the only part (to avoid empty message)
    if (newMessage && newMessage.trim()) {
        newParts.push({ text: newMessage });
    } else if (newParts.length === 0) {
        newParts.push({ text: "..." });
    }

    // 5. Send & Stream
    // SDK expects 'message' property, not 'parts' or 'contents' for sendMessageStream
    const resultStream = await chat.sendMessageStream({ message: newParts });

    for await (const chunk of resultStream) {
        const c = chunk as GenerateContentResponse;
        if (c.candidates?.[0]?.content?.parts) {
            for (const part of c.candidates[0].content.parts) {
                if (part.functionCall && onToolCall) {
                    await onToolCall(part.functionCall.name, part.functionCall.args as Record<string, any>);
                }
                if (part.text) {
                    onChunk(part.text, c.candidates[0].groundingMetadata);
                }
            }
        }
    }
  }

  // --- Agentic Generators ---

  public async generateFacilityBriefing(rooms: Room[], logs: GrowLog[]): Promise<FacilityBriefing> {
      const prompt = `
        Generate Facility Briefing in JSON.
        Context:
        Rooms: ${JSON.stringify(rooms)}
        Recent Logs: ${JSON.stringify(logs.slice(0,3))}
      `;

      const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { 
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      status: { type: Type.STRING, enum: ['OPTIMAL', 'ATTENTION', 'CRITICAL'] },
                      summary: { type: Type.STRING },
                      actionItems: { 
                          type: Type.ARRAY, 
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  task: { type: Type.STRING },
                                  dueDate: { type: Type.STRING },
                                  priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                              }
                          }
                      },
                      weatherAlert: { type: Type.STRING }
                  }
              }
          }
      });
      
      return safeParseAIResponse(response.text, FacilityBriefingSchema, 'generateFacilityBriefing');
  }

  public async generateForwardSchedule(batch: PlantBatch, logs: GrowLog[]): Promise<ScheduleItem[]> {
      const prompt = `
        Create a forward schedule (Next 7 days).
        Context: Batch ${JSON.stringify(batch)}, Logs ${JSON.stringify(logs.slice(0, 5))}
      `;

      const response = await this.ai.models.generateContent({
          model: 'gemini-3-pro-preview', 
          contents: prompt,
          config: { 
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingBudget: 2048 },
              responseSchema: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          task: { type: Type.STRING },
                          dueDate: { type: Type.STRING },
                          priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                          reasoning: { type: Type.STRING }
                      }
                  }
              }
          }
      });
      
      return safeParseAIResponse(response.text, ScheduleListSchema, 'generateForwardSchedule');
  }

  public async calibrateEnvironment(strain: string, stage: string, day: number): Promise<EnvironmentalTargets> {
      const prompt = `Recommend targets for ${strain}, Stage ${stage}, Day ${day}.`;
      const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { 
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      temp: { type: Type.STRING },
                      rh: { type: Type.STRING },
                      vpd: { type: Type.STRING },
                      reasoning: { type: Type.STRING }
                  }
              }
          }
      });
      return safeParseAIResponse(response.text, EnvironmentalTargetsSchema, 'calibrateEnvironment');
  }

  public async getStrainInfo(strainName: string): Promise<StrainInfo> {
      const prompt = `Provide Strain Info for "${strainName}".`;
      const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { 
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      breeder: { type: Type.STRING },
                      lineage: { type: Type.STRING },
                      floweringTimeDays: { type: Type.NUMBER },
                      stretchPotential: { type: Type.STRING },
                      terpeneProfile: { type: Type.STRING },
                      feedingRecommendation: { type: Type.STRING }
                  }
              }
          }
      });
      return safeParseAIResponse(response.text, StrainInfoSchema, 'getStrainInfo');
  }

  public async generateCohortAnalysis(logs: GrowLog[]): Promise<CohortAnalysis> {
      const prompt = `Analyze logs: ${JSON.stringify(logs.slice(0, 10))}`;
      const response = await this.ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: { 
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingBudget: 1024 },
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      trendSummary: { type: Type.STRING },
                      topPerformingStrain: { type: Type.STRING },
                      recommendedAction: { type: Type.STRING }
                  }
              }
          }
      });
      return safeParseAIResponse(response.text, CohortAnalysisSchema, 'generateCohortAnalysis');
  }

  public async askResearchAnalyst(logs: GrowLog[], query: string): Promise<string> {
      const prompt = `Role: Cannabis Data Analyst. Context: ${JSON.stringify(logs.slice(0, 10))}. Query: ${query}`;
      const response = await this.ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: {
              thinkingConfig: { thinkingBudget: 1024 }
          }
      });
      return response.text || "No analysis generated.";
  }
}
