
import React, { useState, useRef, memo } from 'react';
import { Trash2, FileText } from 'lucide-react';
import { GrowLog } from '../types';
import { Haptic } from '../utils/haptics';

export const SwipeableLogItem = memo(({ 
  log, 
  onDelete, 
  onClick,
  isFlipDate 
}: { 
  log: GrowLog, 
  onDelete: (id: string) => void, 
  onClick: (log: GrowLog) => void,
  isFlipDate: number 
}) => {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    if (diff < 0 && diff > -100) setOffset(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (offset < -60) {
      setOffset(-80);
    } else {
      setOffset(0);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    Haptic.tap();
    setOffset(0); // Reset visual
    onDelete(log.id);
  };

  const handleClick = () => {
    // Only trigger click if not swiped
    if (offset === 0) {
      onClick(log);
    } else {
      // If swiped open, tap closes it
      setOffset(0);
    }
  };

  return (
    <div className="relative overflow-hidden group">
      <div className="absolute right-0 top-0 bottom-0 w-[80px] flex items-center justify-center">
         <button 
           onClick={handleDelete}
           className="w-12 h-12 bg-alert-red/20 text-alert-red rounded-full flex items-center justify-center active:scale-90 transition-transform"
         >
            <Trash2 className="w-5 h-5" />
         </button>
      </div>
      <div 
        className="relative bg-black transition-transform duration-200 ease-out touch-pan-y"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
          <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-black border border-white/20 flex items-center justify-center z-10">
              <div className={`w-2 h-2 rounded-full ${log.aiDiagnosis ? 'bg-neon-green' : 'bg-gray-500'}`}></div>
          </div>
          <div className="text-[10px] text-gray-500 font-mono mb-2 ml-1">
              DAY {Math.floor((log.timestamp - isFlipDate) / (1000 * 60 * 60 * 24)) + 21} • {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
          <div className="bg-[#121212] rounded-2xl p-4 border border-white/5 flex gap-4 active:bg-white/5 transition-colors cursor-pointer">
              {log.thumbnailUrl ? (
                <img src={log.thumbnailUrl} className="w-16 h-16 rounded-xl object-cover bg-gray-800 flex-shrink-0" alt="log" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-gray-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <span className="text-white font-bold text-sm truncate pr-2">{log.actionType}</span>
                    <div className="flex gap-2 items-center">
                      {log.aiDiagnosis && (
                        <>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-neon-green/10 text-neon-green font-mono border border-neon-green/20 whitespace-nowrap">
                                SCORE {log.aiDiagnosis.healthScore}
                            </span>
                            {log.aiDiagnosis.confidenceScore !== undefined && (
                                <span className="text-[9px] text-gray-500 font-mono hidden sm:inline-block">
                                    {Math.round(log.aiDiagnosis.confidenceScore * 100)}% CONF
                                </span>
                            )}
                        </>
                      )}
                    </div>
                </div>
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                    {log.manualNotes || log.aiDiagnosis?.morphologyNotes || "No detailed notes."}
                </p>
              </div>
          </div>
      </div>
    </div>
  );
});
SwipeableLogItem.displayName = 'SwipeableLogItem';
