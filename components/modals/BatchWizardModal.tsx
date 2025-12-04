
import React, { useState, memo } from 'react';
import { X, Sprout, Sparkles, Calendar, ArrowRight, Dna } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { Haptic } from '../../utils/haptics';
import { PlantBatch, StrainInfo, GrowStage } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { dbService } from '../../services/db';

interface BatchWizardModalProps {
  onClose: () => void;
  onBatchCreated: () => void;
}

export const BatchWizardModal = memo(({ onClose, onBatchCreated }: BatchWizardModalProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [strainName, setStrainName] = useState('');
  const [strainInfo, setStrainInfo] = useState<StrainInfo | null>(null);
  const [soilMix, setSoilMix] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const handleStrainAnalysis = async () => {
    if (!strainName.trim()) return;
    setLoading(true);
    Haptic.tap();
    try {
      const info = await geminiService.getStrainInfo(strainName);
      setStrainInfo(info);
      setStep(2);
      Haptic.success();
    } catch (e) {
      console.error(e);
      Haptic.error();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!strainInfo) return;
    
    // Calculate projected harvest (Start + Veg (avg 30) + Flower)
    const start = new Date(startDate).getTime();
    const vegTime = 30 * 24 * 60 * 60 * 1000; 
    const flowerTime = strainInfo.floweringTimeDays * 24 * 60 * 60 * 1000;
    const projectedHarvest = start + vegTime + flowerTime;

    const newBatch: PlantBatch = {
      id: generateUUID(),
      batchTag: strainName.substring(0, 4).toUpperCase(),
      strain: strainName,
      breeder: strainInfo.breeder,
      soilMix: soilMix || 'Standard Mix',
      startDate: start,
      currentStage: GrowStage.VEG,
      notes: `Genetics: ${strainInfo.lineage}. Terps: ${strainInfo.terpeneProfile}. Feed: ${strainInfo.feedingRecommendation}`,
      projectedHarvestDate: projectedHarvest,
      breederHarvestDays: strainInfo.floweringTimeDays,
      isActive: true
    };

    await dbService.saveBatch(newBatch);
    Haptic.success();
    onBatchCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#121212] rounded-3xl border border-white/10 overflow-hidden animate-slide-up shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-neon-green/10 rounded-lg">
                <Sprout className="w-5 h-5 text-neon-green" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-white leading-none">New Cultivar</h2>
                <div className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-wider">AI-Assisted Setup</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
             <div className="space-y-6 animate-fade-in">
                <div>
                    <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Strain Genetics</label>
                    <input 
                      type="text" 
                      value={strainName}
                      onChange={(e) => setStrainName(e.target.value)}
                      placeholder="e.g. Gorilla Glue #4"
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/50 text-lg"
                      autoFocus
                    />
                    <p className="text-[10px] text-gray-500 mt-2">
                        Enter the strain name. Gemini 3 Pro will deduce flowering times, feeding schedules, and lineage automatically.
                    </p>
                </div>

                <div className="flex justify-end">
                    <button 
                      onClick={handleStrainAnalysis}
                      disabled={loading || !strainName.trim()}
                      className="flex items-center gap-2 px-6 py-3 bg-neon-green text-black font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:bg-neon-green/90"
                    >
                        {loading ? (
                             <span className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 animate-spin" />
                                Analyzing...
                             </span>
                        ) : (
                             <>
                                Analyze Genetics <ArrowRight className="w-4 h-4" />
                             </>
                        )}
                    </button>
                </div>
             </div>
          )}

          {step === 2 && strainInfo && (
             <div className="space-y-6 animate-slide-up">
                
                {/* AI Insights Card */}
                <div className="bg-[#0A0A0A] rounded-xl p-4 border border-neon-green/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Dna className="w-16 h-16 text-neon-green" />
                    </div>
                    <div className="space-y-3 relative z-10">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase">Breeder / Lineage</div>
                            <div className="text-sm font-bold text-white">{strainInfo.breeder} • {strainInfo.lineage}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <div className="text-[10px] text-gray-500 uppercase">Flower Time</div>
                                <div className="text-sm font-bold text-neon-green">{strainInfo.floweringTimeDays} Days</div>
                             </div>
                             <div>
                                <div className="text-[10px] text-gray-500 uppercase">Stretch</div>
                                <div className="text-sm font-bold text-yellow-500">{strainInfo.stretchPotential}</div>
                             </div>
                        </div>
                        <div className="bg-white/5 p-2 rounded text-xs text-gray-300 italic">
                            "{strainInfo.feedingRecommendation}"
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Start Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-neon-green focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 uppercase font-mono tracking-wider mb-2 block">Medium / Soil Mix</label>
                        <input 
                                type="text" 
                                value={soilMix}
                                onChange={(e) => setSoilMix(e.target.value)}
                                placeholder="e.g. Living Soil, Coco, DWC"
                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-green focus:outline-none"
                            />
                    </div>
                </div>

                <button 
                  onClick={handleCreateBatch}
                  className="w-full py-4 bg-neon-green text-black font-bold rounded-xl shadow-[0_0_20px_rgba(0,255,163,0.3)] active:scale-95 transition-transform"
                >
                    Confirm & Create Batch
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
});
BatchWizardModal.displayName = 'BatchWizardModal';
