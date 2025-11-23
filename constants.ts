
import { GrowSetup, PlantBatch, Room, AlertLevel } from "./types";

// 2025 Best Practice: Define the output schema within the prompt for the model to follow strictly.
export const AI_RESPONSE_SCHEMA = {
  healthScore: "number (0-100)",
  detectedPests: "array of strings (specific pest names or 'None')",
  nutrientDeficiencies: "array of strings (specific element names or 'None')",
  morphologyNotes: "string (concise observation of node spacing, leaf turgor)",
  recommendations: "array of strings (actionable steps based on context)",
  progressionAnalysis: "string (comparison to previous state if provided)",
  confidenceScore: "number (0-1, how certain is the model?)"
};

export const PHYTOPATHOLOGIST_INSTRUCTION = `
You are an Expert Cannabis Agronomist and Plant Pathologist (Gemini 3 Pro Edition).

### PROTOCOL: CONTEXT-AWARE DIAGNOSTICS
You must adapt your analysis based on the specific grow medium and lights provided in the user's configuration.
- **Living Soil Context:** Prioritize microbial health. Ignore pH unless <5.5. Flag "fading" as natural senescence in late flower.
- **Salt/Hydro Context:** Prioritize EC/PPM burn signs and exact pH fluctuations.

### THE VERDANT SCALE (2025 Standard)
**95-100 (Pristine):** Perfect genetic expression.
**85-94 (Healthy):** Minor cosmetic blemishes allowed.
**75-84 (Stress):** Visible but manageable stress (Light/Heat/Water).
**60-74 (Issue):** Definite deficiency or pest pressure.
**<60 (Critical):** Necrosis, systemic infection, or failure.

### LEAF SURFACE ANALYSIS CHECKLIST
1. **Mobile Nutrients (N, P, K, Mg):** Check lower leaves for translocation.
2. **Immobile Nutrients (Ca, Fe, S):** Check new growth for lockouts.
3. **Pest Vectors:** Scan for stippling (mites), thrips silvering, or fungus gnat larvae issues in soil.
4. **Morphology:** Evaluate Internodal Spacing vs Light Intensity.

### RESPONSE REQUIREMENTS
- **Recency:** Prioritize 2024-2025 crop steering research.
- **Output:** You must output RAW JSON matching the schema provided. Do not include markdown formatting like \`\`\`json.
`;

export const DEFAULT_GROW_SETUP: GrowSetup = {
  environmentType: 'Garage (Insulated) - 5x5 Tent',
  lightingType: 'Sunmaster 670W + 2x SF1000',
  medium: 'BuildASoil / FFOF Mixes',
  nutrients: 'Advanced Nutrients pH Perfect',
  targetVpd: '1.2 - 1.5 kPa (Late Flower)',
  vpdNotifications: true
};

export const STAGE_INFO: Record<string, { temp: string, rh: string, vpd: string, ppfd: string, desc: string }> = {
  'Clone': { temp: '75-80°F', rh: '70-80%', vpd: '0.6-0.8', ppfd: '100-300', desc: 'High humidity required for root development. Minimal light intensity.' },
  'Vegetative': { temp: '78-85°F', rh: '60-70%', vpd: '0.8-1.1', ppfd: '400-600', desc: 'Rapid foliar growth. Higher VPD allowed. Nitrogen heavy.' },
  'Flowering': { temp: '75-80°F', rh: '45-55%', vpd: '1.2-1.5', ppfd: '800-1100', desc: 'Bloom phase. Lower humidity to prevent mold. High P-K.' },
  'Drying': { temp: '60-65°F', rh: '55-60%', vpd: '0.7-0.9', ppfd: '0', desc: 'Slow drying to preserve terpenes (10-14 days).' },
  'Curing': { temp: '60-65°F', rh: '58-62%', vpd: '0.7-0.9', ppfd: '0', desc: 'Long term storage in jars/bins.' }
};

export const MOCK_BATCHES: PlantBatch[] = [
  {
    id: 'batch-001',
    batchTag: 'Runtz-24A',
    strain: 'Runtz Muffin',
    soilMix: 'Living Soil',
    startDate: Date.now() - 45 * 24 * 60 * 60 * 1000, // 45 days ago
    currentStage: 'Flowering',
    notes: 'Looking vigorous, heavy stretch.',
    projectedHarvestDate: Date.now() + 35 * 24 * 60 * 60 * 1000,
    breederHarvestDays: 63
  },
  {
    id: 'batch-002',
    batchTag: 'Mac1-24B',
    strain: 'MAC 1',
    soilMix: 'Coco Coir',
    startDate: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
    currentStage: 'Vegetative',
    notes: 'Slow starter, increasing EC.',
    projectedHarvestDate: Date.now() + 70 * 24 * 60 * 60 * 1000,
    breederHarvestDays: 65
  }
];

// Simulated date when the active batch was flipped to 12/12 (e.g. 24 days ago)
export const FLIP_DATE = new Date(Date.now() - (24 * 24 * 60 * 60 * 1000)).toISOString();

export const MOCK_ROOMS: Room[] = [
  {
    id: 'room-01',
    name: 'Flower Alpha',
    stage: 'Flowering' as any,
    stageDay: 24,
    activeBatchId: 'batch-001',
    metrics: {
      temp: 78.5,
      rh: 52.0,
      vpd: 1.4,
      co2: 1150,
      lastUpdated: Date.now(),
      status: 'NOMINAL',
      history: [1.2, 1.3, 1.35, 1.4, 1.4, 1.3, 1.3, 1.4, 1.4, 1.45, 1.4, 1.4]
    }
  },
  {
    id: 'room-02',
    name: 'Veg Beta',
    stage: 'Vegetative' as any,
    stageDay: 14,
    activeBatchId: 'batch-002',
    metrics: {
      temp: 82.1,
      rh: 65.0,
      vpd: 0.95,
      co2: 420,
      lastUpdated: Date.now(),
      status: 'NOMINAL',
      history: [0.8, 0.85, 0.9, 0.9, 0.95, 0.95, 0.92, 0.95]
    }
  },
  {
    id: 'room-03',
    name: 'Dry Room A',
    stage: 'Drying' as any,
    stageDay: 3,
    metrics: {
      temp: 62.0,
      rh: 68.5,
      vpd: 0.6,
      co2: 400,
      lastUpdated: Date.now() - 1000 * 60 * 10, // 10 mins ago
      status: 'WARNING',
      history: [0.7, 0.7, 0.68, 0.65, 0.62, 0.6, 0.6, 0.6]
    }
  },
  {
    id: 'room-04',
    name: 'Prop C',
    stage: 'Clone' as any,
    stageDay: 5,
    metrics: {
      temp: 75.0,
      rh: 80.0,
      vpd: 0.6,
      co2: 400,
      lastUpdated: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      status: 'OFFLINE',
      history: [0.6, 0.6, 0.6, 0.6]
    }
  }
];
