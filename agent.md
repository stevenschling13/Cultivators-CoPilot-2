# AGENT COORDINATION PROTOCOL: CULTIVATOR'S COPILOT

## 1. SYSTEM IDENTITY & MISSION
**Name:** Cultivator's Copilot
**Role:** AI-Augmented Precision Agriculture Interface
**Mission:** Empower cannabis cultivators with military-grade environmental intelligence, real-time phytopathology, and predictive analytics.
**Target Hardware:** Mobile-First (iPhone 16 Pro target), Desktop-Responsive.

## 2. ARCHITECTURAL MANIFEST
The system operates on a decentralized, offline-first architecture powered by edge-ready technologies.

### Core Stack
- **Runtime:** React 19 (Experimental)
- **Build System:** Vite
- **Styling:** Tailwind CSS (Utility-first, Dark Mode default)
- **State Management:** React Hooks (Context-free where possible for performance)
- **Persistence:** IndexedDB (`idb` wrapper) for offline blob storage.
- **AI Engine:** Google Gemini API (`@google/genai`) via `GeminiService`.

### Service Layer
1.  **`GeminiService`**: Handles all LLM interactions.
    -   *Models:* `gemini-3-pro-preview` (Cognition), `gemini-2.5-flash` (Speed), `veo-3.1-fast-generate-preview` (Simulation).
    -   *Responsibilities:* Diagnostics, Chat, Facility Briefings, Video Generation, Live AR Overlay.
2.  **`EnvironmentService`**: Physics engine for VPD, DLI, and Dew Point calculations.
3.  **`HardwareService`**: IoT abstraction layer simulating BLE sensor connections (Govee/SensorPush protocols).
4.  **`DbService`**: Manages `cultivator-db` (Version 3) for Logs, Batches, and Settings.
5.  **`BackupService`**: Zero-Knowledge encryption (AES-GCM) for data sovereignty.

## 3. AI PERSONA & DIRECTIVES
All agents interacting with this codebase must adhere to the following persona definition:

**The "Phytopathologist" Persona**
-   **Tone:** Professional, Clinical, Concise, Authoritative.
-   **Domain Expertise:** Cannabis Agronomy, Plant Physiology, Controlled Environment Agriculture (CEA).
-   **Protocol:**
    1.  Always analyze context (Stage: Veg vs Flower) before recommending nutrients.
    2.  Prioritize VPD (Vapor Pressure Deficit) over simple temp/humidity.
    3.  Reference specific pests (Spider Mites, Thrips) and deficiencies (Cal-Mag, N-P-K) with high specificity.
    4.  Use "The Verdant Scale" (0-100) for health quantification.

## 4. DATA CONTRACTS

### `PlantBatch`
The fundamental unit of tracking.
```typescript
interface PlantBatch {
  id: string;
  strain: string;
  startDate: number; // Unix
  currentStage: 'Clone' | 'Vegetative' | 'Flowering' | 'Curing';
  soilMix: string; // Critical for nutrient advice
}
```

### `GrowLog`
The immutable record of truth.
```typescript
interface GrowLog {
  id: string;
  timestamp: number;
  actionType: 'Water' | 'Feed' | 'Defoliate' | 'Observation';
  aiDiagnosis?: AiDiagnosis; // The brain of the operation
  imageUrl?: string; // Base64 WebP (Optimized)
}
```

## 5. OPERATIONAL WORKFLOWS

### A. The "Morning Rounds" (Briefing)
1.  Fetch all room telemetry via `HardwareService`.
2.  Aggregate recent `GrowLogs`.
3.  `GeminiService.generateFacilityBriefing` -> Returns `FacilityBriefing` JSON.
4.  Display on Dashboard Bento Grid.

### B. The "Field Scout" (Diagnostics)
1.  User captures image via `CameraView`.
2.  `ImageUtils` processes to WebP (Main + Thumbnail).
3.  `GeminiService.analyzePlantImage` -> Returns `AiDiagnosis` JSON.
4.  Overlay results on `AnalysisResultModal`.
5.  User commits to Log.

### C. The "Neural Link" (Chat)
1.  User queries `ChatInterface`.
2.  System builds context:
    -   Active Batches
    -   Live Sensor Data (Temp/RH/VPD)
    -   Recent Log History
3.  Stream `gemini-3-pro-preview` response.
4.  If actionable, Agent calls `proposeLog` tool to structure data.

## 6. DEVELOPMENT RULES
1.  **No `src/` Prefix:** The project root is the source. Imports are relative.
2.  **Strict Types:** No `any` unless interacting with raw hardware buffers.
3.  **Performance:** Use `memo`, `useCallback`, and `OffscreenCanvas` for image processing.
4.  **Aesthetics:** "Neon Noir" palette. `#00ffa3` (Neon Green) for nominal, `#ff0055` (Alert Red) for critical. Glassmorphism layers required.

## 7. SYNCHRONIZATION TOKEN
`TOKEN: CULTIVATOR-ALPHA-V3-SYNC-ACK`
Agents finding this file must acknowledge the protocol version and adhere to the specified data schemas.