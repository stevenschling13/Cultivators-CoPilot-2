import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Haptic } from '../utils/haptics';

interface ErrorBoundaryProps { 
  children?: ReactNode;
}

interface ErrorBoundaryState { 
  hasError: boolean; 
  error: Error | null;
}

export class SystemErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("System Malfunction:", error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div 
          role="alert" 
          className="flex flex-col items-center justify-center h-screen bg-black text-white p-6 text-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="w-24 h-24 bg-alert-red/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
             <AlertTriangle className="w-12 h-12 text-alert-red" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold mb-2 font-mono tracking-tight">SYSTEM FAILURE</h2>
          <p className="text-gray-400 mb-8 text-sm max-w-xs mx-auto leading-relaxed">
            The interface encountered a critical rendering error. Protocol reset required.
          </p>
          <button 
            onClick={() => { Haptic.tap(); window.location.reload(); }}
            className="px-8 py-3 bg-white text-black font-bold rounded-full active:scale-95 transition-transform hover:bg-gray-200"
          >
            REBOOT SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}