import React, { useMemo, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, CartesianGrid, Brush, ReferenceLine
} from 'recharts';
import { 
  Beaker, Microscope, TrendingUp, AlertTriangle, 
  Search, Filter, ChevronRight, X, ShieldAlert, Sprout, CheckCircle2, FileText, Sparkles, Bug
} from 'lucide-react';
import { GrowLog, PlantBatch, CohortAnalysis } from '../types';
import { geminiService } from '../services/geminiService';
import { Haptic } from '../utils/haptics';
import { BentoCard } from './ui/Primitives';

interface ResearchViewProps {
  logs: GrowLog[];
  batches: PlantBatch[];
  currentBatchId?: string;
}

// --- Custom Tooltip ---
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F0F0F]/95 border border-white/10 p-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50 min-w-[140px]">
        <p className="text-[10px] text-gray-400 font-mono mb-2 uppercase tracking-wide border-b border-white/10 pb-1">{label}</p>
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex flex-col mb-1.5">
             <div className="flex items-center justify-between gap-4 text-xs font-mono" style={{ color: p.color }}>
                <div className="flex items-center gap-2">
                   <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: p.color }}></span>
                   <span className="font-medium opacity-90">{p.name}</span>
                </div>
                <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
             </div>
             {p.payload?.avgConfidence !== undefined && (
                 <div className="flex justify-end mt-1">
                    <span className={`text-[9px] px-1.5 py-px rounded font-mono border flex items-center gap-1 ${p.payload.avgConfidence >= 0.85 ? 'bg-neon-green/10 text-neon-green border-neon-green/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                        <Sparkles className="w-2 h-2" />
                        AI CONF: {(p.payload.avgConfidence * 100).toFixed(0)}%
                    </span>
                 </div>
             )}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Custom Axis Tick for Pathology Badges ---
const PathologyAxisTick = ({ x, y, payload, data }: any) => {
    if (!payload || !payload.value) return null;
    const { value } = payload;
    const stat = data.find((d: any) => d.name === value);
    const conf = stat?.avgConfidence;
    
    // Determine color based on confidence threshold
    const isHighConf = conf >= 0.85;
    const badgeColor = isHighConf ? '#00ffa3' : '#eab308';
    const badgeBg = isHighConf ? 'rgba(0, 255, 163, 0.08)' : 'rgba(234, 179, 8, 0.08)';

    return (
        <g transform={`translate(${x},${y})`}>
            {/* Label Name */}
            <text 
                x={-12} 
                y={conf !== undefined ? -5 : 4} 
                textAnchor="end" 
                fill="#9ca3af" 
                fontSize={10} 
                fontWeight={600} 
                style={{ textTransform: 'uppercase', letterSpacing: '0.02em' }}
            >
                {value}
            </text>
            
            {/* Confidence Badge */}
            {conf !== undefined && (
                <g>
                   <rect x={-58} y={2} width={46} height={12} rx={3} fill={badgeBg} />
                   <text x={-35} y={11} textAnchor="middle" fill={badgeColor} fontSize={8} fontWeight="bold" fontFamily="monospace">
                      {(conf * 100).toFixed(0)}% CONF
                   </text>
                </g>
            )}
        </g>
    );
}

// --- Specimen Analysis Panel (The "Lab Report") ---
const LogAnalysisPanel = ({ log, onClose }: { log: GrowLog, onClose: () => void }) => {
  const diagnosis = log.aiDiagnosis;

  if (!diagnosis) {
    return (
      <div className="bg-[#121212] rounded-[32px] p-8 border border-white/10 animate-slide-up relative text-center">
        <button onClick={() => { Haptic.tap(); onClose(); }} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
           <Beaker className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-white font-bold text-lg">No Biological Metadata</h3>
        <p className="text-gray-400 text-sm mt-2 max-w-xs mx-auto">This entry lacks AI diagnostic data. Upload a photo to generate a full phytopathology report.</p>
      </div>
    );
  }

  const isHealthy = diagnosis.healthScore >= 85;
  const healthColor = isHealthy ? 'text-neon-green' : diagnosis.healthScore >= 70 ? 'text-yellow-500' : 'text-alert-red';
  const borderColor = isHealthy ? 'border-neon-green/30' : 'border-white/10';

  return (
    <div className={`bg-[#0A0A0A] rounded-[32px] border ${borderColor} overflow-hidden animate-slide-up shadow-2xl relative`}>
       {/* Hero Section */}
       <div className="relative h-64 w-full group">
          {log.imageUrl ? (
            <img src={log.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Specimen" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#111]"><Microscope className="w-12 h-12 text-gray-700" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent"></div>
          
          <button onClick={() => { Haptic.tap(); onClose(); }} className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-white/10 z-20 active:scale-90 transition-all">
             <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-0 left-0 p-6 w-full">
             <div className="flex justify-between items-end">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                         {log.actionType}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono uppercase">{new Date(log.timestamp).toLocaleDateString()}</span>
                   </div>
                   <h2 className="text-2xl font-black text-white tracking-tight">Specimen Report</h2>
                </div>
                <div className="text-right">
                   <div className={`text-4xl font-black ${healthColor} tracking-tighter`}>{diagnosis.healthScore}</div>
                   <div className="text-[9px] text-gray-500 uppercase font-mono tracking-widest">Verdant Score</div>
                </div>
             </div>
          </div>
       </div>

       {/* Detailed Metrics */}
       <div className="p-6 space-y-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
             <h3 className="text-[10px] font-mono text-neon-blue uppercase tracking-widest mb-2 flex items-center gap-2">
               <FileText className="w-3 h-3" /> Morphology Observations
             </h3>
             <p className="text-sm text-gray-300 leading-relaxed font-sans">{diagnosis.morphologyNotes}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <BentoCard className="p-4 !rounded-2xl !bg-[#111]">
                <div className="flex items-center gap-2 mb-3">
                   <ShieldAlert className="w-4 h-4 text-alert-red" />
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vectors</span>
                </div>
                {diagnosis.detectedPests.length > 0 ? (
                   <div className="flex flex-wrap gap-1">
                      {diagnosis.detectedPests.map((p,i) => <span key={i} className="text-xs font-bold text-alert-red bg-alert-red/10 px-2 py-1 rounded">{p}</span>)}
                   </div>
                ) : <div className="text-xs text-gray-600 font-mono">None Detected</div>}
             </BentoCard>

             <BentoCard className="p-4 !rounded-2xl !bg-[#111]">
                <div className="flex items-center gap-2 mb-3">
                   <AlertTriangle className="w-4 h-4 text-yellow-500" />
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nutrients</span>
                </div>
                {diagnosis.nutrientDeficiencies.length > 0 ? (
                   <div className="flex flex-wrap gap-1">
                      {diagnosis.nutrientDeficiencies.map((d,i) => <span key={i} className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">{d}</span>)}
                   </div>
                ) : <div className="text-xs text-gray-600 font-mono">Balanced Profile</div>}
             </BentoCard>
          </div>
          
          {diagnosis.recommendations?.length > 0 && (
             <div>
                <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Sprout className="w-3 h-3" /> Remediation Protocol
                </h3>
                <div className="space-y-2">
                   {diagnosis.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3 items-start bg-[#111] p-3 rounded-xl border border-white/5">
                         <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0 mt-0.5" />
                         <span className="text-xs text-gray-300">{rec}</span>
                      </div>
                   ))}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

// --- Main Research Component ---

export const ResearchView = ({ logs, batches, currentBatchId }: ResearchViewProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'pathology' | 'explorer'>('overview');
  const [selectedBatchId, setSelectedBatchId] = useState<string>(currentBatchId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<GrowLog | null>(null);
  
  // AI Analyst State
  const [cohortAnalysis, setCohortAnalysis] = useState<CohortAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Data Processing ---

  const batchLogs = useMemo(() => {
    return logs
      .filter(l => selectedBatchId ? l.plantBatchId === selectedBatchId : true)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, selectedBatchId]);

  const healthData = useMemo(() => {
    const rawData = [...batchLogs]
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter(l => l.aiDiagnosis?.healthScore)
      .map((l, i) => ({
        date: new Date(l.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        health: l.aiDiagnosis?.healthScore || 0,
        id: l.id,
        index: i
      }));

    if (rawData.length < 2) return rawData;

    // Linear Regression Trendline
    const n = rawData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    rawData.forEach(pt => {
        sumX += pt.index;
        sumY += pt.health;
        sumXY += pt.index * pt.health;
        sumXX += pt.index * pt.index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return rawData.map(pt => ({
        ...pt,
        trend: Number((slope * pt.index + intercept).toFixed(1))
    }));
  }, [batchLogs]);

  const pathologyStats = useMemo(() => {
    const pestStats: Record<string, { count: number, totalConf: number, samples: number }> = {};
    const defStats: Record<string, { count: number, totalConf: number, samples: number }> = {};
    
    batchLogs.forEach(l => {
      const diag = l.aiDiagnosis;
      if (!diag) return;
      
      const conf = diag.confidenceScore; 

      diag.detectedPests.forEach(p => {
        if (p !== 'None') {
            if (!pestStats[p]) pestStats[p] = { count: 0, totalConf: 0, samples: 0 };
            pestStats[p].count++;
            if (conf !== undefined) {
                pestStats[p].totalConf += conf;
                pestStats[p].samples++;
            }
        }
      });

      diag.nutrientDeficiencies.forEach(d => {
        if (d !== 'None') {
            if (!defStats[d]) defStats[d] = { count: 0, totalConf: 0, samples: 0 };
            defStats[d].count++;
            if (conf !== undefined) {
                defStats[d].totalConf += conf;
                defStats[d].samples++;
            }
        }
      });
    });

    return {
      pests: Object.entries(pestStats).map(([name, stats]) => ({ 
          name, 
          count: stats.count, 
          avgConfidence: stats.samples > 0 ? stats.totalConf / stats.samples : undefined 
      })).sort((a, b) => b.count - a.count),
      deficiencies: Object.entries(defStats).map(([name, stats]) => ({ 
          name, 
          count: stats.count, 
          avgConfidence: stats.samples > 0 ? stats.totalConf / stats.samples : undefined 
      })).sort((a, b) => b.count - a.count)
    };
  }, [batchLogs]);

  const strainPerformance = useMemo(() => {
    return batches.map(b => {
       const bLogs = logs.filter(l => l.plantBatchId === b.id && l.aiDiagnosis);
       if (bLogs.length === 0) return null;
       const avg = bLogs.reduce((sum, l) => sum + (l.aiDiagnosis?.healthScore || 0), 0) / bLogs.length;
       return { name: b.strain, avg: Math.round(avg), count: bLogs.length };
    }).filter((item): item is { name: string; avg: number; count: number } => item !== null).sort((a,b) => b.avg - a.avg);
  }, [batches, logs]);

  const filteredLogs = useMemo(() => {
     return batchLogs.filter(l => 
        !searchTerm || 
        l.manualNotes?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.aiDiagnosis?.detectedPests.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()))
     );
  }, [batchLogs, searchTerm]);

  // --- Actions ---

  const runCohortAnalysis = async () => {
    if (batchLogs.length === 0) return;
    setIsAnalyzing(true);
    setCohortAnalysis(null);
    Haptic.tap();
    try {
        const result = await geminiService.generateCohortAnalysis(batchLogs);
        setCohortAnalysis(result);
        Haptic.success();
    } catch (e) {
        console.error(e);
        Haptic.error();
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleBarClick = (data: any) => {
    if (data && data.name) {
      setSearchTerm(data.name);
      setActiveTab('explorer');
      Haptic.tap();
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#050505] pb-32 animate-fade-in no-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="p-5 flex justify-between items-center">
            <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                   Research Lab <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-mono tracking-wide">BETA</span>
                </h1>
                <p className="text-[10px] text-gray-500 font-mono mt-1 tracking-widest uppercase">
                   Advanced Phytopathology & Analytics
                </p>
            </div>
            
            {/* AI Analyst Button */}
            <button 
               onClick={runCohortAnalysis}
               disabled={isAnalyzing || batchLogs.length === 0}
               className={`
                 relative px-4 py-2 rounded-full border flex items-center gap-2 transition-all active:scale-95
                 ${isAnalyzing 
                    ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue' 
                    : cohortAnalysis 
                        ? 'bg-neon-green/10 border-neon-green/30 text-neon-green hover:bg-neon-green/20' 
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}
               `}
            >
               {isAnalyzing ? (
                 <div className="w-4 h-4 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
               ) : (
                 <Sparkles className="w-4 h-4" />
               )}
               <span className="text-xs font-bold">{cohortAnalysis ? 'Update Analysis' : 'Analyze Trends'}</span>
            </button>
        </div>

        {/* AI Insight Card (Collapsible) */}
        {cohortAnalysis && (
            <div className="px-5 pb-5 animate-slide-down">
                <BentoCard className="p-5 !bg-gradient-to-br !from-[#111] !to-[#0A0A0A] !border-neon-blue/20">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-neon-blue/10 rounded-full shrink-0 mt-1">
                            <Microscope className="w-5 h-5 text-neon-blue" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-neon-blue uppercase tracking-widest mb-1">Cohort Intelligence</h3>
                            <p className="text-sm text-gray-200 leading-relaxed mb-3 font-medium">
                                {cohortAnalysis.trendSummary}
                            </p>
                            <div className="space-y-2">
                                {cohortAnalysis.dominantIssue && (
                                    <div className="flex items-center gap-2 text-xs text-alert-red bg-alert-red/5 px-3 py-2 rounded-lg border border-alert-red/10">
                                        <AlertTriangle className="w-3 h-3" />
                                        Dominant Issue: <span className="font-bold">{cohortAnalysis.dominantIssue}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-neon-green bg-neon-green/5 px-3 py-2 rounded-lg border border-neon-green/10">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Recommendation: <span className="font-bold">{cohortAnalysis.recommendedAction}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </BentoCard>
            </div>
        )}
        
        {/* Tabs */}
        <div className="flex px-5 gap-6 border-b border-white/5 overflow-x-auto no-scrollbar">
            {['overview', 'pathology', 'explorer'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => { Haptic.tap(); setActiveTab(tab as any); setSelectedLog(null); }}
                    className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap ${activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    {tab}
                    {activeTab === tab && <div className={`absolute bottom-0 left-0 right-0 h-0.5 shadow-[0_0_10px_currentColor] ${tab === 'overview' ? 'bg-neon-green text-neon-green' : tab === 'pathology' ? 'bg-uv-purple text-uv-purple' : 'bg-neon-blue text-neon-blue'}`}></div>}
                </button>
            ))}
        </div>
      </div>

      <div className="p-5 space-y-6">
        
        {/* === TAB: OVERVIEW === */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-slide-up">
            
            {/* Batch Chips */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
               <button 
                 onClick={() => { Haptic.tap(); setSelectedBatchId(''); }} 
                 className={`px-4 py-2 rounded-full border text-xs font-bold whitespace-nowrap transition-all ${!selectedBatchId ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-gray-500'}`}
               >
                 All Batches
               </button>
               {batches.map(b => (
                 <button
                   key={b.id}
                   onClick={() => { Haptic.tap(); setSelectedBatchId(b.id); }}
                   className={`
                     px-4 py-2 rounded-full border text-xs font-bold whitespace-nowrap transition-all
                     ${selectedBatchId === b.id 
                       ? 'bg-neon-green/10 border-neon-green text-neon-green' 
                       : 'bg-transparent border-white/10 text-gray-500'}
                   `}
                 >
                   {b.batchTag}
                 </button>
               ))}
            </div>

            {/* Health Velocity Chart */}
            <BentoCard title="Health Velocity" className="!bg-[#0F0F0F] !border-white/5">
               <div className="h-72 w-full mt-2 pr-2">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={healthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                              <linearGradient id="gradHealth" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#00ffa3" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#00ffa3" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis dataKey="date" tick={{fontSize: 9, fill: '#555'}} axisLine={false} tickLine={false} minTickGap={30} />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} cursor={{stroke: '#fff', strokeWidth: 1, strokeDasharray: "4 4"}} />
                          <ReferenceLine y={85} stroke="#00ffa3" strokeDasharray="3 3" strokeOpacity={0.3} label={{ value: 'OPTIMAL', fill: '#00ffa3', fontSize: 9, position: 'insideRight' }} />
                          <ReferenceLine y={60} stroke="#ff0055" strokeDasharray="3 3" strokeOpacity={0.3} label={{ value: 'CRITICAL', fill: '#ff0055', fontSize: 9, position: 'insideRight' }} />
                          <Area type="monotone" name="Health Score" dataKey="health" stroke="#00ffa3" strokeWidth={2} fill="url(#gradHealth)" animationDuration={1500} />
                          <Line type="monotone" name="Trend" dataKey="trend" stroke="#ffffff" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 4" dot={false} activeDot={false} />
                          <Brush dataKey="date" height={20} stroke="#333" fill="#111" tickFormatter={() => ''} travellerWidth={10} />
                      </AreaChart>
                  </ResponsiveContainer>
               </div>
            </BentoCard>

            {/* Strain Leaderboard */}
            <div className="grid grid-cols-1 gap-3">
               <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest px-1">Genetic Performance</h3>
               {strainPerformance.map((s: any, i: number) => (
                   <div key={i} className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                       <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-mono font-bold text-gray-500 text-xs">
                               {i + 1}
                           </div>
                           <div>
                               <div className="text-sm font-bold text-white">{s?.name}</div>
                               <div className="text-[10px] text-gray-500">{s?.count} logs analyzed</div>
                           </div>
                       </div>
                       <div className="text-right">
                           <div className={`text-xl font-black ${s?.avg >= 85 ? 'text-neon-green' : 'text-yellow-500'}`}>{s?.avg}</div>
                           <div className="text-[9px] text-gray-600 uppercase">Avg Score</div>
                       </div>
                   </div>
               ))}
            </div>
          </div>
        )}

        {/* === TAB: PATHOLOGY === */}
        {activeTab === 'pathology' && (
           <div className="space-y-4 animate-slide-up">
              <BentoCard title="Vector Analysis" className="!bg-[#0F0F0F] p-4">
                 <div className="h-64 mt-2">
                    {pathologyStats.pests.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={pathologyStats.pests} 
                              layout="vertical" 
                              margin={{ left: 0, right: 10, bottom: 5 }}
                            >
                                <XAxis type="number" hide />
                                <YAxis 
                                   dataKey="name" 
                                   type="category" 
                                   width={130} 
                                   axisLine={false} 
                                   tickLine={false} 
                                   tick={(props) => <PathologyAxisTick {...props} data={pathologyStats.pests} />}
                                />
                                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                                <Brush dataKey="name" height={20} stroke="#333" fill="#111" tickFormatter={() => ''} travellerWidth={10} />
                                <Bar 
                                  dataKey="count" 
                                  fill="#ff0055" 
                                  radius={[0, 4, 4, 0]} 
                                  barSize={12} 
                                  animationDuration={1000} 
                                  activeBar={{ fill: '#ff3377', stroke: '#fff', strokeWidth: 1 }}
                                  cursor="pointer"
                                  onClick={handleBarClick}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center text-gray-600 font-mono text-xs">NO VECTORS DETECTED</div>}
                 </div>
              </BentoCard>

              <BentoCard title="Nutrient Lockouts" className="!bg-[#0F0F0F] p-4">
                 <div className="h-64 mt-2">
                    {pathologyStats.deficiencies.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={pathologyStats.deficiencies} 
                              layout="vertical" 
                              margin={{ left: 0, right: 10, bottom: 5 }}
                            >
                                <XAxis type="number" hide />
                                <YAxis 
                                   dataKey="name" 
                                   type="category" 
                                   width={130} 
                                   axisLine={false} 
                                   tickLine={false}
                                   tick={(props) => <PathologyAxisTick {...props} data={pathologyStats.deficiencies} />}
                                />
                                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} content={<CustomTooltip />} />
                                <Brush dataKey="name" height={20} stroke="#333" fill="#111" tickFormatter={() => ''} travellerWidth={10} />
                                <Bar 
                                  dataKey="count" 
                                  fill="#eab308" 
                                  radius={[0, 4, 4, 0]} 
                                  barSize={12} 
                                  animationDuration={1000} 
                                  activeBar={{ fill: '#facc15', stroke: '#fff', strokeWidth: 1 }}
                                  cursor="pointer"
                                  onClick={handleBarClick}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center text-gray-600 font-mono text-xs">BALANCED PROFILE</div>}
                 </div>
              </BentoCard>
           </div>
        )}

        {/* === TAB: EXPLORER === */}
        {activeTab === 'explorer' && (
           <div className="space-y-4 animate-slide-up">
              <div className="sticky top-0 z-10">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                       type="text" 
                       placeholder="Search notes, pests, observations..." 
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="w-full bg-[#121212] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-neon-blue focus:outline-none transition-colors"
                    />
                 </div>
              </div>
              
              <div className="space-y-3">
                 {filteredLogs.map(log => (
                    <div 
                       key={log.id} 
                       onClick={() => { Haptic.tap(); setSelectedLog(log); }}
                       className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4 flex gap-4 active:scale-[0.99] transition-transform cursor-pointer hover:border-white/10"
                    >
                       <div className="w-16 h-16 bg-white/5 rounded-lg shrink-0 overflow-hidden">
                          {log.thumbnailUrl ? (
                             <img src={log.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center">
                                <FileText className="w-6 h-6 text-gray-700" />
                             </div>
                          )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                             <div className="text-xs font-bold text-white uppercase">{log.actionType}</div>
                             <div className="text-[10px] text-gray-500 font-mono">{new Date(log.timestamp).toLocaleDateString()}</div>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                             {log.manualNotes || log.aiDiagnosis?.morphologyNotes || "No notes recorded."}
                          </p>
                          {log.aiDiagnosis && (
                             <div className="mt-2 flex gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${log.aiDiagnosis.healthScore > 80 ? 'text-neon-green border-neon-green/20 bg-neon-green/10' : 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10'}`}>
                                   SCORE {log.aiDiagnosis.healthScore}
                                </span>
                                {log.aiDiagnosis.detectedPests.length > 0 && (
                                   <span className="text-[9px] px-1.5 py-0.5 rounded border text-alert-red border-alert-red/20 bg-alert-red/10 flex items-center gap-1">
                                      <Bug className="w-3 h-3" /> {log.aiDiagnosis.detectedPests.length}
                                   </span>
                                )}
                             </div>
                          )}
                       </div>
                       <ChevronRight className="w-5 h-5 text-gray-700 self-center" />
                    </div>
                 ))}
                 {filteredLogs.length === 0 && (
                    <div className="text-center py-12 text-gray-500 font-mono text-xs">NO RECORDS FOUND</div>
                 )}
              </div>
           </div>
        )}
      </div>

      {/* Log Detail Modal (Explorer Mode) */}
      {selectedLog && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6">
            <div className="w-full sm:max-w-lg h-[85vh] sm:h-auto bg-[#050505] sm:rounded-3xl rounded-t-[32px] border border-white/10 overflow-y-auto animate-slide-up shadow-2xl">
               <LogAnalysisPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
            </div>
         </div>
      )}
    </div>
  );
};