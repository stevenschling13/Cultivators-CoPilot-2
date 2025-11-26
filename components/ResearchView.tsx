import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BrainCircuit, ChevronRight, Microscope, Sparkles, Zap, Send, Terminal } from 'lucide-react';
import { GrowLog, PlantBatch, CohortAnalysis } from '../types';
import { geminiService } from '../services/geminiService';
import { SkeletonCard } from './ui/Primitives';
import { Card } from './ui/Card';
import { LogAnalysisPanel } from './research/LogAnalysisPanel';
import { CustomTooltip } from './research/ResearchUtils';
import { Haptic } from '../utils/haptics';

interface ResearchViewProps {
  logs: GrowLog[];
  batches: PlantBatch[];
}

export const ResearchView = ({ logs, batches }: ResearchViewProps) => {
  const [analysis, setAnalysis] = useState<CohortAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<GrowLog | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  
  // Analyst Chat State
  const [query, setQuery] = useState('');
  const [analystResponse, setAnalystResponse] = useState<string | null>(null);
  const [isAnalystThinking, setIsAnalystThinking] = useState(false);

  // Filter logs based on selection
  const filteredLogs = useMemo(() => {
    if (selectedBatchId === 'all') return logs;
    return logs.filter(l => l.plantBatchId === selectedBatchId);
  }, [logs, selectedBatchId]);

  // Transform for Chart
  const diagnosticLogs = useMemo(() => {
    return filteredLogs
      .filter(l => l.aiDiagnosis)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(l => ({
        id: l.id,
        date: new Date(l.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        healthScore: l.aiDiagnosis!.healthScore,
        avgConfidence: l.aiDiagnosis!.confidenceScore || 0.85,
        rawLog: l
      }));
  }, [filteredLogs]);

  const handleGenerateReport = async () => {
      if (filteredLogs.length < 3) return;
      Haptic.tap();
      setIsAnalyzing(true);
      try {
          const result = await geminiService.generateCohortAnalysis(filteredLogs);
          setAnalysis(result);
          Haptic.success();
      } catch (e) {
          console.error(e);
          Haptic.error();
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleAskAnalyst = async () => {
      if (!query.trim() || isAnalystThinking) return;
      setIsAnalystThinking(true);
      setAnalystResponse(null);
      Haptic.tap();
      try {
          const response = await geminiService.askResearchAnalyst(filteredLogs, query);
          setAnalystResponse(response);
          Haptic.success();
      } catch (e) {
          console.error(e);
          setAnalystResponse("Analysis failed. Please try a simpler query.");
          Haptic.error();
      } finally {
          setIsAnalystThinking(false);
      }
  };

  return (
    <div className="p-4 sm:p-0 animate-fade-in pb-32 space-y-6">
      <div className="flex flex-col gap-4">
         {/* Batch Filter Scroller */}
         <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
               onClick={() => { Haptic.tap(); setSelectedBatchId('all'); setAnalysis(null); setAnalystResponse(null); }}
               className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${selectedBatchId === 'all' ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-500 border-white/10 hover:border-white/30'}`}
            >
               All Specimens
            </button>
            {batches.map(b => (
               <button
                  key={b.id}
                  onClick={() => { Haptic.tap(); setSelectedBatchId(b.id); setAnalysis(null); setAnalystResponse(null); }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${selectedBatchId === b.id ? 'bg-neon-green/20 text-neon-green border-neon-green' : 'bg-[#111] text-gray-500 border-white/10 hover:border-white/30'}`}
               >
                  {b.strain}
                  {!b.isActive && <span className="text-[8px] bg-white/10 px-1 rounded text-gray-400">ARCHIVED</span>}
               </button>
            ))}
         </div>
      </div>

      {/* Main Health Trend Chart */}
      {diagnosticLogs.length > 1 ? (
          <Card title="Bio-Health Trends" className="h-64 !bg-[#0A0A0A]">
             <div className="w-full h-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={diagnosticLogs}>
                      <defs>
                         <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ffa3" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00ffa3" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis 
                         dataKey="date" 
                         tick={{fontSize: 10, fill: '#666'}} 
                         axisLine={false} 
                         tickLine={false} 
                         interval="preserveStartEnd"
                      />
                      <YAxis 
                         domain={[50, 100]} 
                         tick={{fontSize: 10, fill: '#666'}} 
                         axisLine={false} 
                         tickLine={false}
                         width={30}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area 
                         type="monotone" 
                         dataKey="healthScore" 
                         stroke="#00ffa3" 
                         strokeWidth={2}
                         fillOpacity={1} 
                         fill="url(#colorHealth)" 
                         name="Health Score"
                      />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </Card>
      ) : (
          <div className="h-64 rounded-[24px] border border-dashed border-white/10 bg-[#0A0A0A] flex items-center justify-center text-gray-500 text-xs font-mono">
             INSUFFICIENT DATA POINTS FOR CHARTING
          </div>
      )}

      {/* Interactive Analyst */}
      <div className="space-y-4">
         <div className="flex items-center gap-2 bg-[#0A0A0A] border border-white/10 rounded-2xl p-2 focus-within:border-neon-blue/50 focus-within:shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all">
            <div className="p-2 text-gray-500">
               <Terminal className="w-4 h-4" />
            </div>
            <input 
               type="text" 
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               placeholder="Ask the Analyst (e.g., 'Compare growth rates')" 
               className="flex-1 bg-transparent border-none text-white text-sm focus:ring-0 placeholder-gray-600 font-mono"
               onKeyDown={(e) => e.key === 'Enter' && handleAskAnalyst()}
            />
            <button 
               onClick={handleAskAnalyst}
               disabled={!query.trim() || isAnalystThinking}
               className="p-2.5 bg-neon-blue text-black rounded-xl hover:bg-neon-blue/90 disabled:opacity-50 disabled:bg-gray-800 transition-colors"
            >
               {isAnalystThinking ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
         </div>

         {analystResponse && (
             <div className="bg-[#0A0A0A] border border-neon-blue/30 rounded-2xl p-5 animate-slide-up shadow-[0_0_20px_rgba(0,212,255,0.1)] relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-20">
                    <BrainCircuit className="w-16 h-16 text-neon-blue" />
                 </div>
                 <div className="flex items-center gap-2 mb-3 relative z-10">
                     <BrainCircuit className="w-4 h-4 text-neon-blue" />
                     <span className="text-[10px] font-bold text-neon-blue uppercase tracking-widest">Analyst Insight</span>
                 </div>
                 <div className="prose prose-invert prose-sm max-w-none relative z-10">
                    <p className="text-gray-300 whitespace-pre-wrap font-mono text-xs leading-relaxed">{analystResponse}</p>
                 </div>
             </div>
         )}
      </div>

      {/* Reports & Specimens Grid */}
      <div className="grid grid-cols-1 gap-6">
         
         {/* Reports Section */}
         <div>
             {analysis ? (
                 <div className="space-y-4 animate-slide-up">
                     <Card title="Cohort Analysis" className="!bg-[#0A0A0A] border-neon-green/30">
                        <div className="space-y-4">
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Dominant Trend</div>
                                <p className="text-sm text-white leading-relaxed font-mono">{analysis.trendSummary}</p>
                            </div>
                            {selectedBatchId === 'all' && analysis.topPerformingStrain && (
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                                    <span className="text-xs text-gray-400">Top Performer</span>
                                    <span className="text-xs font-bold text-neon-green">{analysis.topPerformingStrain}</span>
                                </div>
                            )}
                            <div>
                                 <div className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-2">
                                    <BrainCircuit className="w-3 h-3 text-neon-blue" /> Recommended Action
                                 </div>
                                 <p className="text-xs text-neon-blue bg-neon-blue/10 p-3 rounded-xl border border-neon-blue/20 font-mono">
                                    {analysis.recommendedAction}
                                 </p>
                            </div>
                        </div>
                     </Card>
                     <button 
                         onClick={() => setAnalysis(null)}
                         className="w-full py-3 bg-white/5 text-gray-500 rounded-xl text-xs font-bold hover:text-white transition-colors"
                     >
                         Dismiss Report
                     </button>
                 </div>
             ) : isAnalyzing ? (
                 <SkeletonCard />
             ) : (
                <div className="p-1 rounded-[32px] bg-gradient-to-br from-white/5 to-transparent">
                   <div className="p-6 bg-[#0A0A0A] rounded-[30px] border border-white/5 flex flex-col items-center justify-center text-center h-full">
                       <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/5">
                          <Sparkles className="w-5 h-5 text-gray-400" />
                       </div>
                       <p className="text-xs text-gray-500 font-mono mb-4 max-w-[200px]">
                           Generate a comprehensive pathology report for {filteredLogs.length} specimen logs.
                       </p>
                       <button 
                           onClick={handleGenerateReport}
                           disabled={filteredLogs.length < 3}
                           className="px-6 py-3 bg-white text-black rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                       >
                           <Zap className="w-3 h-3" />
                           FULL COHORT REPORT
                       </button>
                   </div>
                </div>
             )}
         </div>

         {/* Recent Specimens List */}
         <Card title="Recent Specimens" className="!bg-[#0A0A0A]">
            <div className="space-y-2">
                {diagnosticLogs.length === 0 && (
                    <div className="text-xs text-gray-600 font-mono italic text-center py-8 border border-dashed border-white/10 rounded-xl">
                        No logs found for this filter.
                    </div>
                )}
                {diagnosticLogs.slice().reverse().slice(0, 5).map((item, i) => (
                    <div 
                       key={item.id}
                       onClick={() => { Haptic.tap(); setSelectedLog(item.rawLog); }}
                       className="flex items-center gap-3 p-3 bg-[#111] rounded-xl border border-white/5 hover:bg-white/5 active:scale-98 transition-all cursor-pointer group"
                    >
                       {item.rawLog.thumbnailUrl ? (
                          <img src={item.rawLog.thumbnailUrl} className="w-10 h-10 rounded-lg object-cover bg-gray-800 group-hover:ring-1 ring-white/20 transition-all" alt="thumb" />
                       ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                             <Microscope className="w-5 h-5 text-gray-600" />
                          </div>
                       )}
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                             <span className="text-xs font-bold text-white truncate">{item.rawLog.actionType}</span>
                             <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${item.healthScore >= 90 ? 'text-neon-green bg-neon-green/10' : item.healthScore < 70 ? 'text-alert-red bg-alert-red/10' : 'text-yellow-500 bg-yellow-500/10'}`}>
                                SCORE {item.healthScore}
                             </span>
                          </div>
                          <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                             {item.date} <span className="w-0.5 h-0.5 bg-gray-600 rounded-full"></span> {item.rawLog.manualNotes?.slice(0, 25) || 'No notes'}...
                          </div>
                       </div>
                       <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-white transition-colors" />
                    </div>
                ))}
            </div>
         </Card>
      </div>

      {/* Analysis Modal Overlay */}
      {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
             <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <LogAnalysisPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
             </div>
          </div>
      )}
    </div>
  );
};