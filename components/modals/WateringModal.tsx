
import React, { useState, memo } from 'react';
import { X, Droplet, Beaker, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { WateringData, LogProposal } from '../../types';
import { Haptic } from '../../utils/haptics';
import { NeonButton } from '../ui/Primitives';

interface WateringModalProps {
  onClose: () => void;
  onSave: (data: LogProposal) => void;
  batchTag?: string;
}

const PRESET_RECIPES = [
  { name: 'Veg A', ph: 6.2, ec: 1.8, additives: ['CalMag', 'Silica'] },
  { name: 'Bloom P-K', ph: 6.4, ec: 2.4, additives: ['Big Bud', 'Bud Candy'] },
  { name: 'Flush', ph: 6.0, ec: 0.2, additives: ['Flawless Finish'] },
  { name: 'Tea', ph: 6.5, ec: 1.2, additives: ['Microbes'] }
];

export const WateringModal = memo(({ onClose, onSave, batchTag = "Batch" }: WateringModalProps) => {
  const [phInput, setPhInput] = useState(6.2);
  const [ecInput, setEcInput] = useState(1.8);
  const [volume, setVolume] = useState(2.0);
  const [phRunoff, setPhRunoff] = useState<string>('');
  const [ecRunoff, setEcRunoff] = useState<string>('');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('');
  
  const handleSave = () => {
    Haptic.success();
    
    let notes = `Logged ${volume}L Feed. Input: pH ${phInput} / EC ${ecInput}.`;
    if (selectedRecipe) notes += ` Recipe: ${selectedRecipe}.`;
    if (phRunoff && ecRunoff) {
        notes += ` Runoff: pH ${phRunoff} / EC ${ecRunoff}.`;
        const runoffEcNum = parseFloat(ecRunoff);
        if (runoffEcNum > ecInput + 0.5) {
            notes += ` WARNING: SALT BUILDUP DETECTED (+${(runoffEcNum - ecInput).toFixed(2)} EC).`;
        }
    }

    const wateringData: WateringData = {
        volumeLiters: volume,
        phInput,
        ecInput,
        phRunoff: phRunoff ? parseFloat(phRunoff) : undefined,
        ecRunoff: ecRunoff ? parseFloat(ecRunoff) : undefined,
        recipeName: selectedRecipe || 'Custom'
    };

    onSave({
        actionType: selectedRecipe === 'Flush' ? 'Flush' : 'Feed',
        manualNotes: notes,
        wateringData
    });
    onClose();
  };

  const applyRecipe = (recipe: typeof PRESET_RECIPES[0]) => {
      Haptic.tap();
      setPhInput(recipe.ph);
      setEcInput(recipe.ec);
      setSelectedRecipe(recipe.name);
  };

  const deltaEc = ecRunoff ? parseFloat(ecRunoff) - ecInput : 0;
  const isSaltBuildup = deltaEc > 0.5;

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 animate-slide-up">
       <div className="w-full max-w-md bg-[#121212] sm:rounded-3xl rounded-t-3xl border-t sm:border border-white/10 overflow-hidden shadow-2xl pb-safe-bottom">
          
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#151515]">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center border border-neon-blue/20">
                    <Beaker className="w-5 h-5 text-neon-blue" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white leading-none">Hydro Cockpit</h2>
                    <div className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-wider">Log Feed • {batchTag}</div>
                </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
             </button>
          </div>

          <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
             
             {/* Presets */}
             <div className="grid grid-cols-4 gap-2">
                 {PRESET_RECIPES.map(r => (
                     <button 
                        key={r.name}
                        onClick={() => applyRecipe(r)}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${selectedRecipe === r.name ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' : 'bg-[#1a1a1a] border-white/5 text-gray-500 hover:bg-white/5'}`}
                     >
                         {r.name}
                     </button>
                 ))}
             </div>

             {/* Input Sliders */}
             <div className="space-y-6">
                 <div>
                     <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">pH Input</label>
                         <span className="text-neon-blue font-mono font-bold text-xl">{phInput.toFixed(1)}</span>
                     </div>
                     <input 
                        type="range" min="5.0" max="7.0" step="0.1" 
                        value={phInput} onChange={(e) => setPhInput(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-neon-blue"
                     />
                     <div className="flex justify-between text-[9px] text-gray-600 font-mono mt-1">
                         <span>5.0 (Acid)</span>
                         <span>7.0 (Base)</span>
                     </div>
                 </div>

                 <div>
                     <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">EC (mS/cm)</label>
                         <span className="text-neon-green font-mono font-bold text-xl">{ecInput.toFixed(1)}</span>
                     </div>
                     <input 
                        type="range" min="0.0" max="4.0" step="0.1" 
                        value={ecInput} onChange={(e) => setEcInput(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-neon-green"
                     />
                     <div className="flex justify-between text-[9px] text-gray-600 font-mono mt-1">
                         <span>0.0 (RO)</span>
                         <span>4.0 (Burn)</span>
                     </div>
                 </div>

                 <div>
                     <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Volume (Liters)</label>
                         <div className="flex items-center gap-3">
                             <button onClick={() => setVolume(Math.max(0.5, volume - 0.5))} className="w-8 h-8 rounded-full bg-white/5 text-white flex items-center justify-center font-bold">-</button>
                             <span className="text-white font-mono font-bold text-xl w-12 text-center">{volume.toFixed(1)}</span>
                             <button onClick={() => setVolume(volume + 0.5)} className="w-8 h-8 rounded-full bg-white/5 text-white flex items-center justify-center font-bold">+</button>
                         </div>
                     </div>
                 </div>
             </div>

             {/* Runoff Analytics */}
             <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-white/5">
                 <div className="flex items-center gap-2 mb-4">
                     <Droplet className="w-4 h-4 text-gray-500" />
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Runoff Analysis (Optional)</h3>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="text-[10px] text-gray-500 uppercase block mb-1">pH Out</label>
                         <input 
                            type="number" step="0.1" placeholder="--"
                            value={phRunoff} onChange={(e) => setPhRunoff(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-center focus:border-neon-blue focus:outline-none"
                         />
                     </div>
                     <div>
                         <label className="text-[10px] text-gray-500 uppercase block mb-1">EC Out</label>
                         <input 
                            type="number" step="0.1" placeholder="--"
                            value={ecRunoff} onChange={(e) => setEcRunoff(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-center focus:border-neon-green focus:outline-none"
                         />
                     </div>
                 </div>

                 {/* Smart Warning */}
                 {isSaltBuildup && (
                     <div className="mt-4 p-3 bg-alert-red/10 border border-alert-red/20 rounded-xl flex items-start gap-3 animate-fade-in">
                         <AlertTriangle className="w-5 h-5 text-alert-red shrink-0" />
                         <div>
                             <div className="text-xs font-bold text-alert-red uppercase">Salt Buildup Detected</div>
                             <p className="text-[10px] text-gray-400 mt-1">Runoff EC is +{deltaEc.toFixed(1)} higher than input. Consider flushing next cycle.</p>
                         </div>
                     </div>
                 )}
             </div>
          </div>

          <div className="p-6 bg-[#151515] border-t border-white/5">
              <NeonButton 
                 variant="primary" 
                 size="lg" 
                 onClick={handleSave} 
                 className="w-full"
                 icon={CheckCircle2}
              >
                  Log Fertigation Event
              </NeonButton>
          </div>
       </div>
    </div>
  );
});
WateringModal.displayName = 'WateringModal';
