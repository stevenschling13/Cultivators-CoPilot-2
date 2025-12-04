import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp, Copy, Terminal, Shield, WifiOff } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { errorService } from '../services/errorService';
import { generateUUID } from '../utils/uuid';

interface ErrorBoundaryProps { 
  children?: ReactNode;
}

interface ErrorBoundaryState { 
  hasError: boolean; 
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  errorId: string | null;
  retryCount: number;
}

export class SystemErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { 
    hasError: false, 
    error: null, 
    errorInfo: null, 
    showDetails: false,
    errorId: null,
    retryCount: 0
  };
  
  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }
  
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 1. Safe Message Extraction
    let msg = 'unknown error';
    try {
        if (error && typeof error === 'object' && 'message' in error) {
            msg = String((error as any).message).toLowerCase();
        } else {
            msg = String(error).toLowerCase();
        }
    } catch (e) {
        msg = 'unserializable error';
    }

    // 2. Check for Benign/Transient Errors that don't need a UI block
    // "Script error" usually means a CORS issue or network blip fetching a chunk
    if (msg.includes('script error') || msg.includes('resizeobserver') || msg.includes('import') || msg.includes('loading chunk')) {
        // Auto-Retry logic for transient script/network errors
        // We allow 1 auto-retry before showing the UI
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
    
    // Delegate to the flight recorder service
    // "Script error" events are often already caught by window.onerror, 
    // but if React catches it during render, we log it here.
    if (!msg.includes('script error')) {
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
    // Attempt to recover by resetting error state
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
    // Clear session to break crash loops
    try { sessionStorage.clear(); } catch(e) {} 
    window.location.reload();
  };

  private toggleDetails = () => {
    try { Haptic.light(); } catch(e) {}
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  private copyErrorDetails = () => {
      if (!this.state.error) return;
      const text = `Incident ID: ${this.state.errorId}\nError: ${this.state.error.message}\nStack: ${this.state.error.stack}`;
      navigator.clipboard.writeText(text);
      Haptic.success();
      alert("Error details copied to clipboard");
  };
  
  public render() {
    if (this.state.hasError) {
      // Safely access error message to prevent React Error #31 (Objects are not valid as a React child)
      let errorMessage = 'Unknown Runtime Exception';
      let errorStack = '';
      
      try {
          const errorObj = this.state.error as any;
          if (errorObj?.message) {
              errorMessage = errorObj.message;
              errorStack = errorObj.stack;
          } else if (typeof errorObj === 'string') {
              errorMessage = errorObj;
          } else {
              // Fallback for objects/React Elements
              // Using safe stringify to capture the shape of the error object
              errorMessage = JSON.stringify(errorObj);
          }
      } catch (e) {
          errorMessage = "Non-serializable Error Object";
      }

      // Check for Network/Script errors
      const lowerMsg = errorMessage.toLowerCase();
      const isNetworkError = lowerMsg.includes('script error') || 
                             lowerMsg.includes('failed to fetch') || 
                             lowerMsg.includes('network request failed') ||
                             lowerMsg.includes('dynamically imported module');
      
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
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-alert-red animate-pulse"></div>
                        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Exception</span>
                    </div>
                    <p className="text-white font-mono text-sm break-words font-bold leading-relaxed">
                        {errorMessage}
                    </p>
                 </div>
                 <button onClick={this.copyErrorDetails} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white">
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