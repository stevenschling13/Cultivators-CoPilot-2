

export enum VpdZone {
  DANGER = 'Danger',
  TRANSPIRATION = 'Transpiration (Healthy)',
  LEECHING = 'Leeching',
  PROPAGATION = 'Propagation',
  VEGETATIVE = 'Vegetative',
  FLOWERING = 'Flowering'
}

export enum GrowStage {
  CLONE = 'Clone',
  VEG = 'Vegetative',
  FLOWER = 'Flowering',
  DRYING = 'Drying',
  CURING = 'Curing'
}

// 2025 Modernization: Union types for stricter AI categorization
export type PestType = 'Spider Mites' | 'Thrips' | 'Aphids' | 'Fungus Gnats' | 'Russet Mites' | 'Leaf Miners' | 'Unknown' | string;
export type DeficiencyType = 'Nitrogen' | 'Calcium' | 'Magnesium' | 'Phosphorus' | 'Potassium' | 'Iron' | 'Unknown' | string;

export interface EnvironmentReading {
  temperature: number;
  humidity: number;
  ppfd: number;
  co2: number;
  timestamp: number; // Unix
}

export interface CalculatedMetrics {
  vpd: number;
  dli: number;
  vpdStatus: VpdZone;
}

export interface PlantBatch {
  id: string;
  batchTag: string;
  strain: string;
  breeder?: string;
  soilMix: string;
  startDate: number;
  currentStage: GrowStage | string;
  notes?: string;
  projectedHarvestDate?: number; // Unix timestamp for AI prediction
  breederHarvestDays?: number;
  isActive: boolean;
}

// AI Generated Strain Info
export interface StrainInfo {
  breeder: string;
  floweringTimeDays: number;
  lineage: string;
  terpeneProfile: string;
  stretchPotential: 'Low' | 'Medium' | 'High';
  feedingRecommendation: string;
}

// --- COMMAND CENTER TYPES ---

export type AlertLevel = 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

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

export interface FacilityBriefing {
  status: 'OPTIMAL' | 'ATTENTION' | 'CRITICAL';
  summary: string;
  actionItems: string[];
  weatherAlert?: string;
  timestamp?: number; // Track when this briefing was generated
}

// ----------------------------

export interface HarvestPrediction {
  predictedDate: number;
  confidence: number;
  reasoning: string; // e.g. "Trichomes 10% Amber, accelerating ripening"
  adjustmentDays: number; // e.g. +5 or -2
}

export interface AiDiagnosis {
  healthScore: number;
  detectedPests: PestType[];
  nutrientDeficiencies: DeficiencyType[];
  morphologyNotes: string;
  recommendations: string[];
  progressionAnalysis?: string;
  harvestPrediction?: HarvestPrediction;
  confidenceScore?: number;
}

export interface GrowLog {
  id: string;
  plantBatchId: string;
  timestamp: number;
  // Performance: Store a thumbnail for list views, full res only on detail
  thumbnailUrl?: string; 
  imageUrl?: string; 
  videoUrl?: string;
  videoAnalysis?: string;
  aiDiagnosis?: AiDiagnosis;
  manualNotes?: string;
  voiceNoteTranscript?: string;
  actionType?: 'Water' | 'Feed' | 'Defoliate' | 'Observation' | 'Other' | 'Pest Control' | 'Training' | 'Flush' | string;
}

// --- RESEARCH TYPES ---

export interface CohortAnalysis {
  trendSummary: string;
  dominantIssue?: string;
  topPerformingStrain?: string;
  recommendedAction: string;
}

// --- ERROR HANDLING TYPES ---

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Breadcrumb {
  timestamp: number;
  category: 'ui' | 'nav' | 'api' | 'system';
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

// --- AR & GROUNDING TYPES ---

export interface ArOverlayData {
  status?: string;
  colaCount?: number;
  biomassEstimate?: string;
  healthStatus?: string;
  criticalWarning?: string;
  stressLevel?: number; // 0-100, new for Gauge
  guidance?: string; // "Move Closer", "Hold Steady"
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

// ----------------------

export interface LogProposal {
  manualNotes: string;
  actionType: string;
  healthScore?: number;
  detectedPests?: string[];
  nutrientDeficiencies?: string[];
  currentStage?: string;
  recommendations?: string[];
}

// --- VOICE AGENT TYPES ---

export type VoiceIntent = 'NAVIGATE' | 'LOG' | 'QUERY' | 'UNKNOWN';

export interface VoiceCommandResponse {
  intent: VoiceIntent;
  targetView?: 'dashboard' | 'camera' | 'settings' | 'chat' | 'research';
  logProposal?: LogProposal;
  queryText?: string;
  transcription: string;
}

// --- AI CONFIGURATION TYPES ---

export interface EnvironmentalTargets {
  temp: string;
  rh: string;
  vpd: string;
  ppfd: string;
  reasoning: string; // "High leaf temp offset recommended due to LED intensity"
}

export interface ScheduleItem {
  task: string;
  dueDate: string; // Relative like "In 2 days" or specific date
  priority: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

// ----------------------

export interface ChatAttachment {
  type: 'image' | 'file';
  url: string; // Base64 or URL
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isThinking?: boolean;
  groundingUrls?: { uri: string; title: string }[];
  attachment?: ChatAttachment;
  toolCallPayload?: LogProposal; // Data returned by a tool call for UI rendering
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
  leafTempOffset: number; // New: Offset in Fahrenheit (e.g., -2 for LED)
  vpdNotifications?: boolean;
  lastConnectedDeviceId?: string;
  arPreferences?: ArPreferences;
  integrations?: {
    acInfinity?: boolean;
    trolMaster?: boolean;
  };
}

export interface ChatContext {
  setup: GrowSetup;
  environment?: EnvironmentReading;
  batches: PlantBatch[];
  recentLogs: GrowLog[];
  metrics?: CalculatedMetrics;
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface SensorDevice {
  id: string;
  name: string;
  type: 'Govee' | 'SensorPush' | 'Pulse' | 'AC Infinity' | 'Generic';
  connectionType: 'BLE' | 'WiFi' | 'Cloud';
  isConnected: boolean;
  batteryLevel: number;
  lastReading?: EnvironmentReading;
}

export interface ToastMsg {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}