import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { vi, afterEach } from 'vitest';

// Automatically unmount and cleanup DOM after the test is finished.
afterEach(() => {
  cleanup();
});

// --- Browser Polyfills for JSDOM ---

// 1. matchMedia (Used by Responsive Components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 2. ResizeObserver (Used by Recharts)
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 3. AudioContext (Used by AudioVisualizer & GeminiService)
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    createAnalyser: vi.fn(() => ({ 
        connect: vi.fn(),
        frequencyBinCount: 2048,
        getByteFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn()
    })),
    createGain: vi.fn(() => ({ connect: vi.fn(), gain: { value: 1 } })),
    createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
    close: vi.fn(),
    resume: vi.fn(),
    state: 'running'
  }))
});

// 4. IntersectionObserver (Used by Lazy Loaders)
const intersectionObserverMock = () => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
});
window.IntersectionObserver = vi.fn().mockImplementation(intersectionObserverMock);

// 5. Scroll APIs (Used by ChatInterface)
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();

// 6. URL Object (Used by ImageUtils & GeminiService for Blobs)
if (typeof window.URL.createObjectURL === 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
}