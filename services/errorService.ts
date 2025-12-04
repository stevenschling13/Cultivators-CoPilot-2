
import { AppError, Breadcrumb, ErrorSeverity } from '../types';
import { dbService } from './db';
import { Haptic } from '../utils/haptics';
import { generateUUID } from '../utils/uuid';

/**
 * ErrorService: The "Black Box" Flight Recorder.
 * 
 * Responsibilities:
 * 1. Breadcrumbs: Tracks user actions leading up to an error.
 * 2. Capture: Intercepts Global Exceptions, Unhandled Rejections, and React Boundary errors.
 * 3. Persistence: Saves crash reports to IndexedDB via DbService.
 * 4. Notification: Emits events for UI toasts/alerts.
 * 5. Crash Loop Detection: Prevents infinite reloads on critical startup failures.
 */
class ErrorService {
  private breadcrumbs: Breadcrumb[] = [];
  private readonly MAX_BREADCRUMBS = 25;
  private isInitialized = false;
  private notifyCallback: ((msg: string, type: 'error' | 'info') => void) | null = null;
  
  // Crash Loop Config
  private readonly CRASH_THRESHOLD = 3;
  private readonly CRASH_WINDOW = 10000; // 10 seconds

  constructor() {
    // Singleton initialization
  }

  public init(notify?: (msg: string, type: 'error' | 'info') => void) {
    if (this.isInitialized) return;
    
    this.notifyCallback = notify || null;
    this.checkCrashLoop();

    // 1. Global Window Error Handler (EventListener is superior to onerror)
    window.addEventListener('error', (event: ErrorEvent) => {
        const msg = event.message ? String(event.message).toLowerCase() : 'unknown error';
        
        // IGNORE: Generic cross-origin script errors with no details (CORS security masking)
        // These provide 0 value, spam logs, and are usually transient CDN glitches.
        if (msg === 'script error.' || msg.includes('resizeobserver loop')) {
            // Already handled by head script, but double checking here
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        const errorObj = event.error || new Error(event.message);
        this.captureError(errorObj, {
            severity: 'CRITICAL',
            metadata: { 
                source: event.filename, 
                lineno: event.lineno, 
                colno: event.colno 
            }
        });
    });

    // 2. Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const reasonMsg = event.reason ? String(event.reason).toLowerCase() : '';
        
        // Filter known noise
        if (reasonMsg.includes('resizeobserver') || reasonMsg === 'script error.') {
            event.preventDefault();
            return;
        }

        // Handle string rejections (bad practice but possible)
        const error = event.reason instanceof Error 
            ? event.reason 
            : new Error(typeof event.reason === 'string' ? event.reason : 'Unhandled Promise Rejection');

        this.captureError(error, {
            severity: 'HIGH',
            metadata: { type: 'Unhandled Rejection' }
        });
    });

    // 3. Track Initial Load
    this.addBreadcrumb('system', 'System Initialized');
    this.isInitialized = true;
    console.log("ErrorService: Flight Recorder Active");
  }

  /**
   * Records a user action or system event.
   * Kept in-memory to provide context when an error occurs.
   */
  public addBreadcrumb(category: Breadcrumb['category'], message: string, data?: any) {
    const crumb: Breadcrumb = {
        timestamp: Date.now(),
        category,
        message,
        data: this.safeDeepClone(data) // Detach ref safely to prevent mutation
    };

    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > this.MAX_BREADCRUMBS) {
        this.breadcrumbs.shift();
    }
  }

  /**
   * Main entry point for reporting errors.
   */
  public async captureError(error: Error, context: { 
    severity?: ErrorSeverity, 
    componentStack?: string, 
    metadata?: any 
  } = {}) {
    
    // Prevent recursion if error logging itself fails
    try {
        const severity = context.severity || 'MEDIUM';
        const timestamp = Date.now();
        const id = generateUUID();

        // 1. Console Output for Devs
        console.group(`[ErrorService] Captured ${severity} Error`);
        console.error(error);
        if (context.componentStack) console.warn("Stack:", context.componentStack);
        console.groupEnd();

        // 2. Haptic Feedback for User
        if (severity === 'CRITICAL' || severity === 'HIGH') {
            try { Haptic.error(); } catch(e) { /* Ignore haptic fail */ }
        }

        // 3. Track Critical Crashes for Loop Detection
        if (severity === 'CRITICAL') {
            this.recordCrash();
        }

        // 4. Construct Error Record
        const errorRecord: AppError = {
            id,
            timestamp,
            message: error.message || 'Unknown Error',
            stack: error.stack,
            componentStack: context.componentStack,
            severity,
            breadcrumbs: [...this.breadcrumbs], // Snapshot current crumbs
            metadata: this.safeDeepClone(context.metadata),
            resolved: false
        };

        // 5. Persist to DB
        // We use a try/catch block specifically for DB interaction to ensure we don't loop
        try {
            await dbService.logError(errorRecord);
        } catch (dbErr) {
            console.error("ErrorService: Failed to persist error log to DB", dbErr);
        }

        // 6. User Notification
        if (this.notifyCallback) {
            const userMsg = severity === 'CRITICAL' 
                ? "Critical System Error. Diagnostics Saved." 
                : `Error: ${error.message.slice(0, 40)}...`;
            
            // Debounce notification for same error
            this.notifyCallback(userMsg, 'error');
        }
    } catch (metaErr) {
        console.error("CRITICAL: ErrorService internal failure", metaErr);
    }
  }

  public getBreadcrumbs() {
      return this.breadcrumbs;
  }

  /**
   * Advanced: Safely clones objects removing circular references and non-serializable types.
   * Special handling for Error objects which JSON.stringify usually blanks out.
   */
  private safeDeepClone(obj: any): any {
      if (obj === undefined || obj === null) return null;
      if (typeof obj !== 'object') return obj;
      
      // Handle Errors explicitly so we get their properties
      if (obj instanceof Error) {
          return {
              name: obj.name,
              message: obj.message,
              stack: obj.stack,
              cause: (obj as any).cause ? this.safeDeepClone((obj as any).cause) : undefined
          };
      }
      
      try {
          // Attempt standard JSON clone first (fastest)
          return JSON.parse(JSON.stringify(obj, this.getCircularReplacer()));
      } catch (e) {
          // Fallback for really complex objects
          return String(obj); 
      }
  }

  private getCircularReplacer() {
      const seen = new WeakSet();
      return (key: string, value: any) => {
          if (typeof value === "object" && value !== null) {
              // Filter out DOM Nodes (React SyntheticEvents usually contain them)
              if (value instanceof Node || value instanceof Window) return '[DOM Node]';
              if (seen.has(value)) {
                  return "[Circular]";
              }
              seen.add(value);
          }
          return value;
      };
  }

  /**
   * Advanced: Crash Loop Detection Logic
   */
  private recordCrash() {
      try {
          const now = Date.now();
          const storage = sessionStorage.getItem('crash_timestamps');
          const crashes: number[] = storage ? JSON.parse(storage) : [];
          
          // Filter out old crashes outside the window
          const recentCrashes = crashes.filter((t: number) => now - t < this.CRASH_WINDOW);
          recentCrashes.push(now);
          
          sessionStorage.setItem('crash_timestamps', JSON.stringify(recentCrashes));
      } catch (e) {
          // Storage quota exceeded or disabled - fail silently
      }
  }

  private checkCrashLoop() {
      try {
          const storage = sessionStorage.getItem('crash_timestamps');
          if (!storage) return;
          
          const crashes: number[] = JSON.parse(storage);
          const now = Date.now();
          const recentCrashes = crashes.filter((t: number) => now - t < this.CRASH_WINDOW);

          if (recentCrashes.length >= this.CRASH_THRESHOLD) {
              console.error("ErrorService: Crash Loop Detected. Triggering Safe Mode cleanup.");
              // Clear session to break state loops
              sessionStorage.clear(); 
              this.addBreadcrumb('system', 'Crash Loop Detected - Storage Cleared');
          }
      } catch (e) {
          // Ignore
      }
  }
}

export const errorService = new ErrorService();
