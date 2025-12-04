
import React, { ReactNode, memo } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: ReactNode;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  className?: string;
}

export const Header = memo(({ title, subtitle, leftAction, rightAction, className = "" }: HeaderProps) => {
  return (
    <div className={`flex justify-between items-end mb-6 ${className}`}>
      <div className="flex items-center gap-4">
        {leftAction}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none drop-shadow-lg font-sans">
            {title}
          </h1>
          {subtitle && (
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-1.5 flex items-center gap-2">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {rightAction}
    </div>
  );
});

Header.displayName = 'Header';
