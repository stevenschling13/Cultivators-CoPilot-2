import React, { ReactNode } from 'react';

interface AppLayoutProps {
  children?: ReactNode;
  header?: ReactNode;
  bottomNav?: ReactNode;
}

export const AppLayout = ({ children, header, bottomNav }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-neon-green/30 flex flex-col">
      {/* Sticky Header */}
      {header && (
        <div className="sticky top-0 z-40 w-full bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 transition-all duration-200">
          <div className="pt-safe-top px-6 py-4">
            {header}
          </div>
        </div>
      )}

      {/* Main Content Scroll Area */}
      <main className="flex-1 relative w-full max-w-7xl mx-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      {bottomNav && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          {bottomNav}
        </div>
      )}
    </div>
  );
};