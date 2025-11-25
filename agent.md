
# AGENT COORDINATION PROTOCOL: CULTIVATOR'S COPILOT (v4.0 - MEMORY ENHANCED)

> **Read Me First — Mandatory Gate**: Before modifying *any* file, every agent must read this document in full and confirm alignment with the latest directives. Do not start coding until you have acknowledged `TOKEN: CULTIVATOR-V4-MEM-SYNC` in your session notes.

## 1. SYSTEM IDENTITY & MISSION
**Name:** Cultivator's Copilot  
**Role:** AI-Augmented Precision Agriculture Interface  
**Mission:** Empower cannabis cultivators with military-grade environmental intelligence, real-time phytopathology, and predictive analytics.  
**Target Hardware:** Mobile-First (iPhone 16 Pro target), Desktop-Responsive.

## 2. EVOLUTIONARY MEMORY (NEW - NOV 2025)
**The Problem:** Stateless sessions cause repeated errors.
**The Solution:** You must interact with `system/project_memory.md`.

**Protocol:**
1.  **READ FIRST:** Before planning any task, read `system/project_memory.md`. Look for "Anti-Patterns" and "Established Patterns".
2.  **WRITE LAST:** If you solve a complex bug or make a distinct architectural decision, append a concise note to `system/project_memory.md`.
3.  **DO NOT REPEAT MISTAKES:** If the memory says "Do not use X library," you must not use it.

## 3. CODING STANDARDS & MODULARITY
**Goal:** Stop rewriting 500-line files for 2-line changes.

1.  **The 300-Line Rule:** If a file exceeds 300 lines, you must propose splitting it into sub-components or utility files immediately.
2.  **Atomic Components:** UI Components should do ONE thing.
3.  **Service Isolation:** Business logic belongs in `services/`, not `components/`.

## 4. GEMINI 3 PRO UTILIZATION
**Reasoning Models:**
- When using `gemini-3-pro-preview` for complex tasks (Diagnostics, Root Cause Analysis), you **MUST** configure a `thinkingBudget`.
- Do not use `thinkingBudget` for latency-sensitive tasks (UI interactions, simple chat).

## 5. ARCHITECTURAL MANIFEST
The system operates on a decentralized, offline-first architecture powered by edge-ready technologies.

### Core Stack
- **Runtime:** React 19 (Experimental) — prefer function components, Suspense, and concurrent-safe patterns.
- **Build System:** Vite — keep imports shallow and leverage module preloading.
- **Styling:** Tailwind CSS (Utility-first, Dark Mode default) — enforce semantic tokens for the Neon Noir palette.
- **State Management:** React Hooks (Context-free where possible for performance).
- **Persistence:** IndexedDB (`idb` wrapper) for offline blob storage.
- **AI Engine:** Google Gemini API (`@google/genai`) via `GeminiService`.

### Service Layer
1.  **`GeminiService`**: Handles all LLM interactions.  
    -   *Models:* `gemini-3-pro-preview` (Cognition), `gemini-2.5-flash` (Speed), `veo-3.1-fast-generate-preview` (Simulation).  
    -   *Responsibilities:* Diagnostics, Chat, Facility Briefings, Video Generation, Live AR Overlay.  
2.  **`EnvironmentService`**: Physics engine for VPD, DLI, and Dew Point calculations.  
3.  **`HardwareService`**: IoT abstraction layer simulating BLE sensor connections.  
4.  **`DbService`**: Manages `cultivator-db` (Version 3).  

## 6. DATA CONTRACTS

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

## 7. SYNCHRONIZATION TOKEN
`TOKEN: CULTIVATOR-V4-MEM-SYNC`
Agents finding this file must acknowledge the protocol version and adhere to the specified data schemas.
