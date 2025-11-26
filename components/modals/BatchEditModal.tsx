

import React, { useState } from 'react';
import { X, Save, Calendar, Dna } from 'lucide-react';
import { PlantBatch } from '../../types';
import { Haptic } from '../../utils/haptics';

interface BatchEditModalProps {
  batch: PlantBatch;
  onSave: (batch: PlantBatch) => void;
  onClose: () => void;
}

export const BatchEditModal = ({ batch, onSave, onClose }: BatchEditModalProps) => {
  const [strain, setStrain] = useState(batch.strain);
  const [breeder, setBreeder] = useState(batch.breeder || '');
  const [soilMix, setSoilMix] = useState(batch.soilMix);
  const [startDate, setStartDate] = useState(() => new Date(batch.startDate).toISOString().slice(0, 10));

  const handleSave = () => {
    Haptic.success();
    const startTs = new Date(startDate).getTime();
    
    // Recalculate projected harvest if start date changed
    // Preserve the original breeding days delta
    let newProjectedHarvest = batch.projectedHarvestDate;
    if (startTs !== batch.startDate && batch.breederHarvestDays) {
        // Simple logic: Start + (Veg 30d) + Flower Days
        const vegTime = 30 * 24 * 60 * 60 * 1000;
        const flowerTime = batch.breederHarvestDays * 24 * 60 * 60 * 1000;
        newProjectedHarvest = startTs + vegTime + flowerTime;
    }

    onSave({
      ...batch,
      strain,
      breeder,
      soilMix,
      startDate: startTs,
      projectedHarvestDate: newProjectedHarvest
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#121212] rounded-3xl border border-white/10 overflow-hidden animate-slide-up shadow-2xl">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Dna className="w-5 h-5 text-neon-green" /> Edit Batch Metadata
           </h3>
           <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
             <X className="w-5 h-5 text-gray-400" />
           </button>
        </div>

        <div className="p-6 space-y-6">
           <div className="space-y-4">
               <div>
                  <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Strain Name</label>
                  <input
                    type="text"
                    value={strain}
                    onChange={(e) => setStrain(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-green focus:outline-none"
                  />
               </div>
               <div>
                  <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Breeder</label>
                  <input
                    type="text"
                    value={breeder}
                    onChange={(e) => setBreeder(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-green focus:outline-none"
                    placeholder="Optional"
                  />
               </div>
               <div>
                  <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Soil Mix / Medium</label>
                  <input
                    type="text"
                    value={soilMix}
                    onChange={(e) => setSoilMix(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-green focus:outline-none"
                  />
               </div>
               <div>
                  <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-green focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-2">
                     Changing start date will adjust harvest projections automatically.
                  </p>
               </div>
           </div>

           <button 
             onClick={handleSave}
             className="w-full py-4 bg-neon-green text-black font-bold rounded-xl shadow-[0_0_20px_rgba(0,255,163,0.3)] active:scale-95 transition-transform flex items-center justify-center gap-2"
           >
              <Save className="w-5 h-5" />
              Save Changes
           </button>
        </div>
      </div>
    </div>
  );
};