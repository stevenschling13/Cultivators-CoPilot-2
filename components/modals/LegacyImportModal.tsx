import React, { memo, useState } from 'react';
import { Archive } from 'lucide-react';
import { dbService } from '../../services/db';
import { ImageUtils } from '../../services/imageUtils';
import { GrowLog } from '../../types';
import { Haptic } from '../../utils/haptics';

export const LegacyImportModal = memo(({ onClose, onImportComplete }: { onClose: () => void, onImportComplete: () => void }) => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    
    const total = files.length;
    const batches = await dbService.getBatches();
    const targetBatchId = batches[0]?.id || 'blue';

    for (let i = 0; i < total; i++) {
      const file = files[i];
      const date = new Date(file.lastModified);
      
      const compressed = await ImageUtils.compressImage(file);
      const thumbnail = await ImageUtils.createThumbnail(compressed);

      const log: GrowLog = {
        id: crypto.randomUUID(),
        plantBatchId: targetBatchId,
        timestamp: date.getTime(),
        thumbnailUrl: thumbnail,
        imageUrl: compressed,
        actionType: 'Observation',
        manualNotes: 'Imported from Time Capsule',
        aiDiagnosis: {
           healthScore: 85,
           detectedPests: [],
           nutrientDeficiencies: [],
           morphologyNotes: "Legacy Import",
           recommendations: [],
           progressionAnalysis: "Imported",
           harvestPrediction: { predictedDate: Date.now(), confidence: 0.5, reasoning: 'Legacy', adjustmentDays: 0 }
        }
      };
      
      await dbService.saveLog(log);
      setProgress(((i + 1) / total) * 100);
      await new Promise(r => setTimeout(r, 50));
    }
    
    setIsProcessing(false);
    onImportComplete();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-6">
       <div className="w-full max-w-md bg-[#121212] rounded-3xl p-8 border border-white/10 text-center">
          <Archive className="w-12 h-12 text-neon-blue mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Time Capsule</h2>
          <p className="text-gray-400 text-sm mb-6">Bulk import photos to retroactively build your grow timeline. Metadata will be used to auto-date entries.</p>
          
          {!isProcessing ? (
            <>
              <input 
                type="file" 
                multiple 
                accept="image/*"
                onChange={(e) => setFiles(e.target.files)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neon-blue/10 file:text-neon-blue hover:file:bg-neon-blue/20 mb-6"
              />
              <div className="flex gap-4">
                 <button onClick={() => { Haptic.tap(); onClose(); }} className="flex-1 py-3 text-white font-medium">Cancel</button>
                 <button 
                   onClick={() => { Haptic.tap(); handleImport(); }}
                   disabled={!files}
                   className="flex-1 py-3 bg-neon-blue text-black rounded-xl font-bold disabled:opacity-50"
                 >
                   Start Ingestion
                 </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
               <div className="text-neon-blue font-mono text-xl">{Math.round(progress)}%</div>
               <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-neon-blue transition-all duration-300" style={{ width: `${progress}%` }} />
               </div>
               <div className="text-gray-500 text-sm animate-pulse">Ingesting temporal data...</div>
            </div>
          )}
       </div>
    </div>
  );
});
LegacyImportModal.displayName = 'LegacyImportModal';