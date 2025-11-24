import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Haptic } from '../utils/haptics';
import { errorService } from '../services/errorService';

interface ErrorBoundaryProps { 
  children?: ReactNode;
}

interface ErrorBoundaryState { 
  hasError: boolean; 
  error: Error | null;
}

export class SystemErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declare props to satisfy strict TypeScript checks
  declare props: Readonly<ErrorBoundaryProps>;

  public state: ErrorBoundaryState = { 
    hasError: false, 
    error: null 
  };
  
  // Removed redundant constructor to rely on React.Component initialization
  
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Delegate to the flight recorder service
    errorService.captureError(error, {
        severity: 'CRITICAL',
        componentStack: errorInfo.componentStack,
        metadata: { source: 'React Error Boundary' }
    });
  }
  
  private handleReset = () => {
    try { Haptic.tap(); } catch(e) {}
    // In a real advanced system, we might try to reset specific state stores.
    // For now, a reload is the safest recovery.
    window.location.reload();
  };
  
  public render() {
    if (this.state.hasError) {
      return (
        <div 
          role="alert" 
          className="flex flex-col items-center justify-center h-screen bg-black text-white p-6 text-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-fade-in"
        >
          <div className="w-24 h-24 bg-alert-red/10 rounded-full flex items-center justify-center mb-6 animate-pulse ring-1 ring-alert-red/30">
             <AlertTriangle className="w-12 h-12 text-alert-red" aria-hidden="true" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2 font-mono tracking-tight text-white">SYSTEM FAILURE</h2>
          
          <div className="bg-[#111] border border-white/10 rounded-lg p-3 max-w-sm w-full mb-6 text-left">
             <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Error Diagnostic</div>
             <p className="text-alert-red font-mono text-xs break-words">
               {this.state.error?.message || "Unknown Runtime Exception"}
             </p>
          </div>

          <p className="text-gray-400 mb-8 text-sm max-w-xs mx-auto leading-relaxed">
            The flight recorder has logged this incident. Protocol reset required to restore functionality.
          </p>
          
          <button 
            onClick={this.handleReset}
            className="px-8 py-3 bg-white text-black font-bold rounded-full active:scale-95 transition-transform hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            REBOOT SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children || null;
  }
}