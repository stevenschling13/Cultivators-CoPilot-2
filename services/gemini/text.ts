
import { GeminiNetwork } from './network';
import { GenerateContentBody, GeminiResponse, Part, Tool, Content } from './types';
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
  CohortAnalysis
} from '../../types';

export class GeminiText {
  constructor(private network: GeminiNetwork) {}

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

    const contents: Content[] = [];
    
    // Add History
    history.forEach(msg => {
       const parts: Part[] = [];
       if (msg.text) parts.push({ text: msg.text });
       if (parts.length > 0) {
           contents.push({ role: msg.role, parts });
       }
    });

    // Add New Message
    const newParts: Part[] = [];
    if (imageContext) {
        newParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageContext.split(',')[1] || imageContext } });
    }
    newParts.push({ text: newMessage });
    contents.push({ role: 'user', parts: newParts });

    const tools: Tool[] = [{
      functionDeclarations: [
        {
          name: "proposeLog",
          description: "Propose a new log entry based on user intent.",
          parameters: {
            type: "OBJECT",
            properties: {
              actionType: { type: "STRING", enum: ["Water", "Feed", "Defoliate", "Pest Control", "Training", "Observation"] },
              manualNotes: { type: "STRING" },
              healthScore: { type: "NUMBER" },
              recommendations: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["actionType", "manualNotes"]
          }
        },
        {
          name: "openCamera",
          description: "Open the camera/AR scanner for visual diagnosis.",
          parameters: { type: "OBJECT", properties: {} }
        }
      ]
    } as const];

    const body: GenerateContentBody = {
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools,
      generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
      }
    };

    const response = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
    
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.functionCall && onToolCall) {
                await onToolCall(part.functionCall.name, part.functionCall.args || {});
            }
            if (part.text) {
                onChunk(part.text, response.candidates[0].groundingMetadata);
            }
        }
    }
  }

  public async sendTextQuery(text: string): Promise<string> {
      const body: GenerateContentBody = {
          contents: [{ parts: [{ text }] }]
      };
      const response = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  // --- Agentic Generators ---

  public async generateFacilityBriefing(rooms: Room[], logs: GrowLog[]): Promise<FacilityBriefing> {
      const prompt = `
        Generate Facility Briefing in JSON.
        Schema:
        {
          "status": "OPTIMAL" | "ATTENTION" | "CRITICAL",
          "summary": "string",
          "actionItems": [
            { "task": "string", "dueDate": "string", "priority": "High" | "Medium" | "Low" }
          ],
          "weatherAlert": "string"
        }
        Context:
        Rooms: ${JSON.stringify(rooms)}
        Recent Logs: ${JSON.stringify(logs.slice(0,3))}
      `;

      const body: GenerateContentBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
      };
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? JSON.parse(text) : { status: 'ATTENTION', summary: 'Briefing Failed', actionItems: [] };
  }

  public async generateForwardSchedule(batch: PlantBatch, logs: GrowLog[]): Promise<ScheduleItem[]> {
      const prompt = `
        Create a forward schedule (Next 7 days).
        Context: Batch ${JSON.stringify(batch)}, Logs ${JSON.stringify(logs.slice(0, 5))}
        Return JSON Array: { "task": string, "dueDate": string, "priority": "High"|"Medium"|"Low", "reasoning": string }
      `;

      const body: GenerateContentBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
      };
      
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? JSON.parse(text) : [];
  }

  public async calibrateEnvironment(strain: string, stage: string, day: number): Promise<EnvironmentalTargets> {
      const prompt = `
         Recommend targets for ${strain}, Stage ${stage}, Day ${day}.
         Return JSON: { "temp": string, "rh": string, "vpd": string, "reasoning": string }
      `;
      const body: GenerateContentBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
      };
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? JSON.parse(text) : { temp: "75F", rh: "50%", vpd: "1.0", reasoning: "Default fallback" };
  }

  public async getStrainInfo(strainName: string): Promise<StrainInfo> {
      const prompt = `
         Provide Strain Info for "${strainName}".
         Return JSON: { 
            "breeder": string, "lineage": string, "floweringTimeDays": number, 
            "stretchPotential": "Low"|"Medium"|"High", "terpeneProfile": string, "feedingRecommendation": "Light"|"Medium"|"Heavy"
         }
      `;
      const body: GenerateContentBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
      };
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? JSON.parse(text) : { 
          breeder: "Unknown", lineage: "Unknown", floweringTimeDays: 60, 
          stretchPotential: "Medium", terpeneProfile: "Unknown", feedingRecommendation: "Medium" 
      };
  }

  public async generateCohortAnalysis(logs: GrowLog[]): Promise<CohortAnalysis> {
      const prompt = `
         Analyze logs: ${JSON.stringify(logs.slice(0, 10))}
         Return JSON: { "trendSummary": string, "topPerformingStrain": string, "recommendedAction": string }
      `;
      const body: GenerateContentBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
      };
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? JSON.parse(text) : { trendSummary: "Insufficient Data", topPerformingStrain: "N/A", recommendedAction: "Collect more data" };
  }

  public async askResearchAnalyst(logs: GrowLog[], query: string): Promise<string> {
      const prompt = `
         Role: Cannabis Data Analyst. Context: ${JSON.stringify(logs.slice(0, 10))}. Query: ${query}
      `;
      const body: GenerateContentBody = {
          contents: [{ parts: [{ text: prompt }] }]
      };
      const data = await this.network.callProxy<GeminiResponse>('v1beta/models/gemini-2.5-flash:generateContent', body);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
  }
}
