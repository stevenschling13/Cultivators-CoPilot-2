# AGENT COORDINATION PROTOCOL: CULTIVATOR'S COPILOT (ALPHA-OPTIMIZED)

> **Read Me First — Mandatory Gate**: Before modifying *any* file, every agent must read this document in full and confirm alignment with the latest directives. Do not start coding until you have acknowledged `TOKEN: CULTIVATOR-ALPHA-V3-SYNC-ACK` in your session notes.

## 1. SYSTEM IDENTITY & MISSION
**Name:** Cultivator's Copilot  
**Role:** AI-Augmented Precision Agriculture Interface  
**Mission:** Empower cannabis cultivators with military-grade environmental intelligence, real-time phytopathology, and predictive analytics.  
**Target Hardware:** Mobile-First (iPhone 16 Pro target), Desktop-Responsive.

## 2. ARCHITECTURAL MANIFEST
The system operates on a decentralized, offline-first architecture powered by edge-ready technologies.

### Core Stack
- **Runtime:** React 19 (Experimental) — prefer function components, Suspense, and concurrent-safe patterns.
- **Build System:** Vite — keep imports shallow and leverage module preloading.
- **Styling:** Tailwind CSS (Utility-first, Dark Mode default) — enforce semantic tokens for the Neon Noir palette.
- **State Management:** React Hooks (Context-free where possible for performance) — memoize selectors and derive state lazily.
- **Persistence:** IndexedDB (`idb` wrapper) for offline blob storage — guard all storage calls with feature detection.
- **AI Engine:** Google Gemini API (`@google/genai`) via `GeminiService` — default to streaming responses with backpressure-aware handlers.

### Service Layer
1.  **`GeminiService`**: Handles all LLM interactions.  
    -   *Models:* `gemini-3-pro-preview` (Cognition), `gemini-2.5-flash` (Speed), `veo-3.1-fast-generate-preview` (Simulation).  
    -   *Responsibilities:* Diagnostics, Chat, Facility Briefings, Video Generation, Live AR Overlay.  
    -   *Quality Bar:* Input validation on every call, structured tool calls, and deterministic tests for prompt builders.
2.  **`EnvironmentService`**: Physics engine for VPD, DLI, and Dew Point calculations.  
3.  **`HardwareService`**: IoT abstraction layer simulating BLE sensor connections (Govee/SensorPush protocols) with retry + exponential backoff.  
4.  **`DbService`**: Manages `cultivator-db` (Version 3) for Logs, Batches, and Settings — migrations must be idempotent and reversible.  
5.  **`BackupService`**: Zero-Knowledge encryption (AES-GCM) for data sovereignty — enforce crypto parameter validation.

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

**Communication Cadence**
- Keep responses under 280 words unless delivering structured output.
- Surface uncertainties explicitly and recommend next measurements.
- When proposing actions, include sensor references and expected Verdant Scale delta.

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

> **Schema Discipline:** Treat these interfaces as source-of-truth contracts. Update them before feature work, version with `metadata.json`, and document migrations in commit messages.

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

> **Observability Hook:** Any change to logging shapes must include telemetry for create/update latency and validation errors.

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

### D. Release Discipline
1.  Add/update automated tests for new behaviors (Vitest/React Testing Library preferred).
2.  Run `npm test` and `npm run lint` locally before commit; fix or note flakiness with issue references.
3.  Bench key components (`Profiler`/`useMemo`) when performance-sensitive.
4.  Capture before/after screenshots for UI changes when feasible.

## 6. DEVELOPMENT RULES
1.  **No `src/` Prefix:** The project root is the source. Imports are relative.
2.  **Strict Types:** No `any` unless interacting with raw hardware buffers. Prefer `satisfies` and discriminated unions.
3.  **Performance:** Use `memo`, `useCallback`, and `OffscreenCanvas` for image processing. Avoid inline functions in hot render paths.
4.  **Aesthetics:** "Neon Noir" palette. `#00ffa3` (Neon Green) for nominal, `#ff0055` (Alert Red) for critical. Glassmorphism layers required.
5.  **Security:** Sanitize all user inputs, enforce CSP-friendly patterns, and avoid eval-like APIs.
6.  **Git Hygiene:** Small, atomic commits with descriptive messages; include rationale for schema or API shifts.
7.  **Dependency Governance:** Prefer audited, actively maintained packages; pin versions in `package-lock`/`pnpm-lock` equivalents when introduced.

## 7. SYNCHRONIZATION TOKEN
`TOKEN: CULTIVATOR-ALPHA-V3-SYNC-ACK`
Agents finding this file must acknowledge the protocol version and adhere to the specified data schemas.

## 8. EXECUTION CHECKLIST (RUN BEFORE COMMIT)
- [ ] Confirm you reread this file and noted the sync token in your log.
- [ ] Validate types and lint: `npm run lint`.
- [ ] Run targeted/unit tests or `npm test` when applicable.
- [ ] Ensure new behaviors are observable (logs/metrics) and documented inline.
- [ ] Update screenshots or visuals when UI changes are present.
- [ ] Summarize the change and tests in the PR body with citations where required.
