
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
 */
class ErrorService {
  private breadcrumbs: Breadcrumb[] = [];
  private readonly MAX_BREADCRUMBS = 20;
  private isInitialized = false;
  private notifyCallback: ((msg: string, type: 'error' | 'info') => void) | null = null;

  constructor() {
    // Singleton initialization happens in App.tsx via init()
  }

  public init(notify?: (msg: string, type: 'error' | 'info') => void) {
    if (this.isInitialized) return;
    
    this.notifyCallback = notify || null;

    // 1. Global Window Error Handler
    window.onerror = (message, source, lineno, colno, error) => {
        this.captureError(error || new Error(String(message)), {
            severity: 'CRITICAL',
            metadata: { source, lineno, colno }
        });
    };

    // 2. Unhandled Promise Rejections
    window.onunhandledrejection = (event) => {
        this.captureError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), {
            severity: 'HIGH',
            metadata: { type: 'Unhandled Rejection' }
        });
    };

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
        data: data ? JSON.parse(JSON.stringify(data)) : undefined // Detach ref
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
        Haptic.error();
    }

    // 3. Construct Error Record
    const errorRecord: AppError = {
        id,
        timestamp,
        message: error.message || 'Unknown Error',
        stack: error.stack,
        componentStack: context.componentStack,
        severity,
        breadcrumbs: [...this.breadcrumbs], // Snapshot current crumbs
        metadata: context.metadata,
        resolved: false
    };

    // 4. Persist to DB
    try {
        await dbService.logError(errorRecord);
    } catch (e) {
        console.error("ErrorService: Failed to persist error log", e);
    }

    // 5. User Notification
    if (this.notifyCallback) {
        const userMsg = severity === 'CRITICAL' 
            ? "Critical System Error. Diagnostics Saved." 
            : `Error: ${error.message.slice(0, 30)}...`;
        this.notifyCallback(userMsg, 'error');
    }
  }

  public getBreadcrumbs() {
      return this.breadcrumbs;
  }
}

export const errorService = new ErrorService();
