
# PROJECT EVOLUTIONARY MEMORY
> This file acts as the long-term memory for the AI Agent. Read this before coding.

## 🟢 ESTABLISHED PATTERNS (DO THIS)
1.  **Data Fetching:** Always use `Suspense` boundaries for async components (`CameraView`, `ChatInterface`).
2.  **Images:** Always process images via `ImageUtils` (OffscreenCanvas) before storing in IndexedDB to prevent quota limits.
3.  **State:** Use `useCallback` for all event handlers passed to children to prevent wasted re-renders.
4.  **Gemini API:** Use `process.env.GEMINI_API_KEY` injected via the build system. Never request user input for keys in UI.
5.  **Styling:** Use `safe-area-top` and `safe-area-bottom` utilities for iOS 16+ compatibility.

## 🔴 ANTI-PATTERNS (DO NOT DO THIS)
1.  **Monoliths:** Do not create components larger than 300 lines. Refactor immediately.
2.  **Raw Audio:** Do not use browser native `decodeAudioData` for Live API streams; use the custom PCM decoder in `GeminiService`.
3.  **Polling:** Do not use `setInterval` for UI updates inside `useEffect` without clearing the ID.
4.  **Types:** Do not use `any` for `GoogleGenAI` responses. Use the schemas defined in `types.ts`.

## 🧠 CURRENT ARCHITECTURAL GOALS
-   **Nov 2025:** Maximize Gemini 3 Pro "Thinking" capabilities for Phytopathology.
-   **Nov 2025:** Transition large files into atomic sub-components.
