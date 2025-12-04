
export type AlertLevel = 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

export enum GrowStage {
  CLONE = 'Clone',
  VEG = 'Vegetative',
  FLOWER = 'Flowering',
  DRYING = 'Drying',
  CURING = 'Curing'
}

export enum VpdZone {
  DANGER = 'DANGER',
  LEECHING = 'LEECHING', // Low VPD, low transpiration
  TRANSPIRATION = 'TRANSPIRATION' // Optimal
}

export interface ArPreferences {
  showColaCount: boolean;
  showBiomass: boolean;
  showHealth: boolean;
}

export interface GrowSetup {
  environmentType: string;
  lightingType: string;
  medium: string;
  nutrients: string;
  targetVpd: string;
  leafTempOffset: number;
  vpdNotifications: boolean;
  integrations?: {
    acInfinity?: boolean;
    trolMaster?: boolean;
  };
  arPreferences: ArPreferences;
}

export interface RoomMetrics {
  temp: number;
  rh: number;
  vpd: number;
  co2: number;
  lastUpdated: number;
  status: AlertLevel;
  history: number[]; // For sparkline (e.g. last 24h VPD)
}

export interface Room {
  id: string;
  name: string;
  stage: GrowStage;
  stageDay: number;
  activeBatchId?: string;
  sensorId?: string; // Maps to hardwareService deviceId
  metrics: RoomMetrics;
}

export interface BriefingAction {
  task: string;
  dueDate?: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface FacilityBriefing {
  status: 'OPTIMAL' | 'ATTENTION' | 'CRITICAL';
  summary: string;
  actionItems: BriefingAction[];
  weatherAlert?: string;
  timestamp?: number; // Track when this briefing was generated
}

export interface HarvestPrediction {
  predictedDate: number;
  confidence: number;
  reasoning: string;
  adjustmentDays: number;
}

export interface AiDiagnosis {
  healthScore: number;
  detectedPests: string[];
  nutrientDeficiencies: string[];
  morphologyNotes: string;
  recommendations: string[];
  progressionAnalysis: string;
  confidenceScore?: number;
  harvestPrediction?: HarvestPrediction;
}

export interface WateringData {
  volumeLiters: number;
  phInput: number;
  ecInput: number;
  phRunoff?: number;
  ecRunoff?: number;
  recipeName?: string;
  additives?: string[];
}

export interface GrowLog {
  id: string;
  plantBatchId: string;
  timestamp: number;
  actionType: string;
  manualNotes?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  aiDiagnosis?: AiDiagnosis;
  wateringData?: WateringData;
}

export interface PlantBatch {
  id: string;
  batchTag: string;
  strain: string;
  breeder?: string;
  soilMix: string;
  startDate: number;
  currentStage: string | GrowStage; 
  notes: string;
  projectedHarvestDate: number;
  breederHarvestDays?: number;
  isActive: boolean;
}

export interface EnvironmentReading {
  temperature: number; // Fahrenheit
  humidity: number;
  ppfd: number;
  co2: number;
  timestamp: number;
}

export interface CalculatedMetrics {
  vpd: number;
  dli: number;
  vpdStatus: VpdZone;
}

/**
 * AR Overlay Data Contract v2.1
 * Enhanced with engineering metrics for the Smart Vision Pipeline.
 */
export interface ArOverlayData {
  status: 'INITIALIZING' | 'ACQUIRING' | 'LOCKED' | 'ANALYZING' | 'WARNING' | 'OFFLINE';
  guidance?: string;
  criticalWarning?: string;
  colaCount?: number;
  biomassEstimate?: string;
  healthStatus?: string;
  stressLevel?: number;
  
  // Engineering Metrics (Smart Vision)
  stability: number; // 0-100 (100 = perfectly still)
  confidence: number; // 0-100 (AI certainty)
  isScanning: boolean; // True if AI request is inflight
}

export interface ChatAttachment {
  type: 'image';
  url: string;
  mimeType: string;
}

export interface LogProposal {
  actionType: string;
  manualNotes: string;
  healthScore?: number;
  detectedPests?: string[];
  nutrientDeficiencies?: string[];
  recommendations?: string[];
  wateringData?: WateringData;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  attachment?: ChatAttachment;
  isThinking?: boolean;
  toolCallPayload?: LogProposal;
  groundingUrls?: { uri: string; title?: string }[];
}

export interface GroundingMetadata {
  groundingChunks?: { web?: { uri: string; title?: string } }[];
}

export interface ChatContext {
  setup: GrowSetup;
  environment?: EnvironmentReading;
  metrics?: CalculatedMetrics;
  batches: PlantBatch[];
  recentLogs: GrowLog[];
}

export interface ScheduleItem {
  task: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

export interface VoiceCommandResponse {
  intent: 'NAVIGATE' | 'LOG' | 'QUERY';
  targetView?: string;
  logProposal?: LogProposal;
  queryText?: string;
  transcription: string;
}

export interface EnvironmentalTargets {
  temp: string;
  rh: string;
  vpd: string;
  reasoning: string;
}

export interface StrainInfo {
  breeder: string;
  lineage: string;
  floweringTimeDays: number;
  stretchPotential: string;
  terpeneProfile: string;
  feedingRecommendation: string;
}

export interface CohortAnalysis {
  trendSummary: string;
  topPerformingStrain?: string;
  recommendedAction: string;
}

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Breadcrumb {
  timestamp: number;
  category: 'ui' | 'network' | 'system' | 'navigation';
  message: string;
  data?: any;
}

export interface AppError {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  componentStack?: string;
  severity: ErrorSeverity;
  breadcrumbs: Breadcrumb[];
  metadata?: any;
  resolved: boolean;
}

export interface SensorDevice {
  id: string;
  name: string;
  type: string;
  connectionType: 'BLE' | 'WiFi';
  isConnected: boolean;
  batteryLevel: number;
  lastReading?: EnvironmentReading;
}

export interface ToastMsg {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
