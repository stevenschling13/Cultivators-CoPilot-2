import { z } from 'zod';

export const HarvestPredictionSchema = z.object({
  predictedDate: z.number(),
  confidence: z.number(),
  reasoning: z.string(),
  adjustmentDays: z.number()
});

export const AiDiagnosisSchema = z.object({
  healthScore: z.number().min(0).max(100),
  detectedPests: z.array(z.string()),
  nutrientDeficiencies: z.array(z.string()),
  morphologyNotes: z.string(),
  recommendations: z.array(z.string()),
  progressionAnalysis: z.string(),
  confidenceScore: z.number().optional(),
  harvestPrediction: HarvestPredictionSchema.optional()
});

export const BriefingActionSchema = z.object({
  task: z.string(),
  dueDate: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low'])
});

export const FacilityBriefingSchema = z.object({
  status: z.enum(['OPTIMAL', 'ATTENTION', 'CRITICAL']),
  summary: z.string(),
  actionItems: z.array(BriefingActionSchema),
  weatherAlert: z.string().optional(),
  timestamp: z.number().optional()
});

export const ScheduleItemSchema = z.object({
  task: z.string(),
  dueDate: z.string(),
  priority: z.enum(['High', 'Medium', 'Low']),
  reasoning: z.string()
});

export const ScheduleListSchema = z.array(ScheduleItemSchema);

export const EnvironmentalTargetsSchema = z.object({
  temp: z.string(),
  rh: z.string(),
  vpd: z.string(),
  reasoning: z.string()
});

export const StrainInfoSchema = z.object({
  breeder: z.string(),
  lineage: z.string(),
  floweringTimeDays: z.number(),
  stretchPotential: z.string(),
  terpeneProfile: z.string(),
  feedingRecommendation: z.string()
});

export const CohortAnalysisSchema = z.object({
  trendSummary: z.string(),
  topPerformingStrain: z.string().optional(),
  recommendedAction: z.string()
});

export const VoiceCommandResponseSchema = z.object({
  intent: z.enum(['NAVIGATE', 'LOG', 'QUERY']),
  targetView: z.string().optional(),
  logProposal: z.object({
    actionType: z.string(),
    manualNotes: z.string(),
    healthScore: z.number().optional(),
    detectedPests: z.array(z.string()).optional(),
    nutrientDeficiencies: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional()
  }).optional(),
  queryText: z.string().optional(),
  transcription: z.string()
});

export const ArOverlaySchema = z.object({
  status: z.string(),
  guidance: z.string().optional(),
  criticalWarning: z.string().optional(),
  colaCount: z.number().optional(),
  biomassEstimate: z.string().optional(),
  healthStatus: z.string().optional(),
  stressLevel: z.number().optional()
});