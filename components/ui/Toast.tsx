
import React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export interface ToastMsg {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const ToastContainer = ({ toasts, removeToast }: { toasts: ToastMsg[], removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-safe-top left-0 right-0 z-[200] pointer-events-none flex flex-col items-center gap-2 p-4 pt-2">
      {toasts.map(t => (
        <div 
          key={t.id}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl shadow-2xl border animate-slide-down
            ${t.type === 'success' ? 'bg-neon-green/10 border-neon-green/20 text-neon-green' : 
              t.type === 'error' ? 'bg-alert-red/10 border-alert-red/20 text-alert-red' : 
              'bg-white/10 border-white/10 text-white'}
          `}
          onClick={() => removeToast(t.id)}
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {t.type === 'error' && <XCircle className="w-5 h-5" />}
          {t.type === 'info' && <Info className="w-5 h-5" />}
          <span className="text-sm font-medium font-sans">{t.message}</span>
        </div>
      ))}
    </div>
  );
};
