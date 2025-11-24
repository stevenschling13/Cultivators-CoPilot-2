

import { AlertLevel, GrowSetup, GrowStage, PlantBatch, Room } from "./types";

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
- **Living Soil Context (BLUE):** Prioritize microbial health. Ignore pH unless <5.5. Flag "fading" as natural senescence in late flower.
- **Salt/Hybrid Context (GREEN):** Prioritize EC/PPM burn signs, Mg deficiencies (common in FFOF mid-flower), and exact pH fluctuations.

### THE VERDANT SCALE (2025 Standard)
**95-100 (Pristine):** Perfect genetic expression.
**85-94 (Healthy):** Minor cosmetic blemishes allowed.
**75-84 (Stress):** Visible but manageable stress (Light/Heat/Water).
**60-74 (Issue):** Definite deficiency or pest pressure.
**<60 (Critical):** Necrosis, systemic infection, or failure.

### LEAF SURFACE ANALYSIS CHECKLIST
1. **Mobile Nutrients (N, P, K, Mg):** Check lower leaves for translocation (common in Green pheno).
2. **Immobile Nutrients (Ca, Fe, S):** Check new growth for lockouts.
3. **Pest Vectors:** Scan for stippling (mites), thrips silvering, or fungus gnat larvae issues in soil.
4. **Morphology:** Evaluate Internodal Spacing vs Light Intensity (Sunmaster 670W).

### RESPONSE REQUIREMENTS
- **Recency:** Prioritize 2024-2025 crop steering research.
- **Output:** You must output RAW JSON matching the schema provided. Do not include markdown formatting like \`\`\`json.
`;

export const DEFAULT_GROW_SETUP: GrowSetup = {
  environmentType: 'Insulated Garage - 5x5 Tent (Maple Plain, MN)',
  lightingType: 'Sunmaster 670W (Center) + 2x SF1000 (Sides) - ~870W Total',
  medium: 'BuildASoil UCCR (Blue) / UCCR+FFOF (Green)',
  nutrients: 'Advanced Nutrients pH Perfect + Big Bud/Bud Candy',
  targetVpd: '1.2 - 1.5 kPa',
  vpdNotifications: true,
  arPreferences: {
    showColaCount: true,
    showBiomass: true,
    showHealth: true
  }
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
    id: 'blue-pheno',
    batchTag: 'BLUE',
    strain: "The Krux × Grandpa's Cookies #6",
    soilMix: '100% BuildASoil UCCR (Living Soil)',
    startDate: new Date('2025-08-02').getTime(),
    currentStage: 'Flowering',
    notes: 'Blue Pheno. Slow start, stout/bushy structure. 8-top manifold. Dark green foliage. Showing mild N fade (expected).',
    projectedHarvestDate: new Date('2025-11-23').getTime(), // based on timeline
    breederHarvestDays: 63
  },
  {
    id: 'green-pheno',
    batchTag: 'GREEN',
    strain: "The Krux × Grandpa's Cookies #6",
    soilMix: '50% UCCR / 50% FFOF',
    startDate: new Date('2025-08-02').getTime(),
    currentStage: 'Flowering',
    notes: 'Green Pheno. Vigorous vertical growth. Needs heavier feed/Cal-Mag. Mild Mg deficiency visible mid-flower.',
    projectedHarvestDate: new Date('2025-11-23').getTime(),
    breederHarvestDays: 63
  }
];

// Flip Date: Oct 2, 2025
export const FLIP_DATE = '2025-10-02T00:00:00.000Z';

export const MOCK_ROOMS: Room[] = [
  {
    id: 'tent-blue',
    name: 'Blue Pheno (Garage Left)',
    stage: GrowStage.FLOWER,
    stageDay: Math.floor((Date.now() - new Date(FLIP_DATE).getTime()) / (1000 * 60 * 60 * 24)), 
    activeBatchId: 'blue-pheno',
    metrics: {
      temp: 71.3,
      rh: 48.9,
      vpd: 1.26,
      co2: 450,
      lastUpdated: Date.now(),
      status: 'NOMINAL',
      history: [1.1, 1.13, 1.16, 1.29, 1.26, 1.39, 1.26] // Recent weekly VPDs
    }
  },
  {
    id: 'tent-green',
    name: 'Green Pheno (Garage Right)',
    stage: GrowStage.FLOWER,
    stageDay: Math.floor((Date.now() - new Date(FLIP_DATE).getTime()) / (1000 * 60 * 60 * 24)), 
    activeBatchId: 'green-pheno',
    metrics: {
      temp: 72.1,
      rh: 50.2,
      vpd: 1.18,
      co2: 442,
      lastUpdated: Date.now(),
      status: 'NOMINAL',
      history: [1.05, 1.1, 1.15, 1.2, 1.18, 1.22, 1.18] // Slightly different microclimate
    }
  }
];
