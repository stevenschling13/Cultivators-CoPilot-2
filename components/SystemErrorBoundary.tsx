import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp, Copy, Terminal, Shield, WifiOff } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { errorService } from '../services/errorService';
import { generateUUID } from '../utils/uuid';

interface ErrorBoundaryProps { 
  children?: ReactNode;
}

interface ErrorBoundaryState { 
  hasError: boolean; 
  error: unknown; // Strict type safety
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  errorId: string | null;
  retryCount: number;
}

export class SystemErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { 
    hasError: false, 
    error: null, 
    errorInfo: null, 
    showDetails: false, 
    errorId: null,
    retryCount: 0
  };
  
  public static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }
  
  public componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    // Safely extract message for analysis
    let msg = 'unknown error';
    try {
        if (typeof error === 'string') {
            msg = error;
        } else if (error && typeof error === 'object') {
            const errObj = error as Record<string, unknown>;
            if ('message' in errObj && typeof errObj.message === 'string') {
                msg = errObj.message;
            } else {
                // Try to stringify, might fail if circular or react element
                try {
                    msg = JSON.stringify(error);
                } catch (e) {
                    msg = 'Unserializable Object';
                }
            }
        } else {
            msg = String(error);
        }
    } catch (e) {
        msg = 'Unserializable Error Object';
    }
    const lowerMsg = msg.toLowerCase();

    // Check for Benign/Transient Errors
    if (lowerMsg.includes('script error') || lowerMsg.includes('resizeobserver') || lowerMsg.includes('import') || lowerMsg.includes('loading chunk')) {
        if (this.state.retryCount < 1) {
            console.log("Auto-recovering from Transient Error...", msg);
            setTimeout(() => {
                this.handleSoftReset();
            }, 100);
            return;
        }
    }

    const errorId = generateUUID();
    this.setState({ errorInfo, errorId });
    
    if (!lowerMsg.includes('script error')) {
        // Construct a safe error object for the service
        const safeError = error instanceof Error ? error : new Error(msg);
        
        errorService.captureError(safeError, {
            severity: 'CRITICAL',
            componentStack: errorInfo.componentStack,
            metadata: { 
                source: 'React Error Boundary',
                incidentId: errorId,
                rawError: typeof error === 'object' ? 'Object captured' : String(error)
            }
        });
    }
  }
  
  private handleSoftReset = () => {
    try { Haptic.tap(); } catch(e) {}
    this.setState(prev => ({ 
        hasError: false, 
        error: null, 
        errorInfo: null, 
        errorId: null,
        retryCount: prev.retryCount + 1
    }));
  };

  private handleHardReset = () => {
    try { Haptic.error(); } catch(e) {}
    try { sessionStorage.clear(); } catch(e) {} 
    window.location.reload();
  };

  private toggleDetails = () => {
    try { Haptic.light(); } catch(e) {}
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  private copyErrorDetails = () => {
      if (!this.state.error) return;
      const msg = this.getSafeErrorMessage();
      const stack = this.state.error instanceof Error ? this.state.error.stack : '';
      const text = `Incident ID: ${this.state.errorId}\nError: ${msg}\nStack: ${stack}`;
      navigator.clipboard.writeText(text);
      Haptic.success();
      alert("Error details copied to clipboard");
  };

  private getSafeErrorMessage = (): string => {
      const { error } = this.state;
      if (!error) return 'Unknown Error';
      
      try {
          if (typeof error === 'string') return error;
          if (error instanceof Error) return error.message;
          
          // Explicitly check for React Element objects which crash the renderer if returned as part of a string concat involving objects
          // or if they are the error itself.
          const errObj = error as Record<string, unknown>;
          if (typeof errObj === 'object' && errObj !== null && '$$typeof' in errObj) {
             return 'React Element Error: Objects are not valid as a React child. (Duplicate React Version Conflict likely)';
          }
          
          return JSON.stringify(error);
      } catch (e) {
          return 'Non-serializable Error';
      }
  };
  
  public render() {
    if (this.state.hasError) {
      const errorMessage = String(this.getSafeErrorMessage()); // Explicit string cast for safety
      const errorStack = this.state.error instanceof Error ? this.state.error.stack : '';
      const lowerMsg = errorMessage.toLowerCase();
      
      const isNetworkError = lowerMsg.includes('script error') || 
                             lowerMsg.includes('failed to fetch') || 
                             lowerMsg.includes('network request failed') ||
                             lowerMsg.includes('dynamically imported module') ||
                             lowerMsg.includes('import');
      
      if (isNetworkError) {
          return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center animate-fade-in safe-area-top safe-area-bottom">
                <div className="w-20 h-20 bg-[#111] rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                    <WifiOff className="w-8 h-8 text-yellow-500" />
                </div>
                <h2 className="text-xl font-bold mb-2 text-white tracking-wide">Connection Interrupted</h2>
                <p className="text-gray-400 mb-8 max-w-xs text-sm leading-relaxed font-mono">
                    A module failed to load. This is usually due to network instability or a pending update.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button 
                        onClick={this.handleSoftReset} 
                        className="px-8 py-3 bg-neon-green text-black font-bold rounded-xl active:scale-95 transition-transform shadow-[0_0_20px_rgba(0,255,163,0.3)]"
                    >
                        Retry Connection
                    </button>
                    <button 
                        onClick={this.handleHardReset} 
                        className="px-8 py-3 bg-white/10 text-white font-bold rounded-xl active:scale-95 transition-transform hover:bg-white/20"
                    >
                        Reload App
                    </button>
                </div>
             </div>
          );
      }

      return (
        <div 
          role="alert" 
          className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-fade-in"
        >
          <div className="w-24 h-24 bg-alert-red/10 rounded-full flex items-center justify-center mb-6 animate-pulse ring-1 ring-alert-red/30 shadow-[0_0_40px_rgba(255,0,85,0.2)]">
             <AlertTriangle className="w-12 h-12 text-alert-red" aria-hidden="true" />
          </div>
          
          <h2 className="text-2xl font-bold mb-1 font-mono tracking-tight text-white">SYSTEM HALT</h2>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-6">
              Incident ID: <span className="text-neon-green">{this.state.errorId?.slice(0,8) || '----'}</span>
          </p>
          
          <div className="bg-[#111] border border-white/10 rounded-2xl p-1 max-w-md w-full mb-6 text-left shadow-2xl overflow-hidden">
             <div className="bg-black/50 p-4 border-b border-white/5 flex justify-between items-start">
                 <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-alert-red animate-pulse"></div>
                        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Exception</span>
                    </div>
                    <p className="text-white font-mono text-sm break-words font-bold leading-relaxed">
                        {errorMessage}
                    </p>
                 </div>
                 <button onClick={this.copyErrorDetails} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white shrink-0">
                     <Copy className="w-4 h-4" />
                 </button>
             </div>

             <button 
               onClick={this.toggleDetails}
               className="w-full flex items-center justify-between px-4 py-3 text-[10px] text-gray-500 font-mono uppercase tracking-wider hover:bg-white/5 transition-colors"
             >
               <span className="flex items-center gap-2">
                   <Terminal className="w-3 h-3" />
                   {this.state.showDetails ? 'Hide Stack Trace' : 'View Stack Trace'}
               </span>
               {this.state.showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
             </button>

             {this.state.showDetails && (
               <div className="bg-black p-4 overflow-x-auto custom-scrollbar max-h-64 overflow-y-auto border-t border-white/10 animate-slide-down">
                   <pre className="text-[10px] text-neon-green font-mono whitespace-pre-wrap break-all leading-relaxed">
                     {errorStack}
                     {'\n\nComponent Stack:'}
                     {this.state.errorInfo?.componentStack}
                   </pre>
               </div>
             )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button 
              onClick={this.handleSoftReset}
              className="flex-1 px-6 py-4 bg-white/5 border border-white/10 text-neon-blue font-bold rounded-xl active:scale-95 transition-all hover:bg-white/10 flex items-center justify-center gap-2 group"
            >
              <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
              Attempt Recovery
            </button>
            
            <button 
              onClick={this.handleHardReset}
              className="flex-1 px-6 py-4 bg-white text-black font-bold rounded-xl active:scale-95 transition-transform hover:bg-gray-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <Shield className="w-4 h-4" />
              Safe Restart
            </button>
          </div>
        </div>
      );
    }
    return this.props.children || null;
  }
}