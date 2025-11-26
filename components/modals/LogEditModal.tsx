import React, { useState } from 'react';
import { X, Calendar, FileText, Activity, Edit3 } from 'lucide-react';
import { GrowLog } from '../../types';
import { Haptic } from '../../utils/haptics';

interface LogEditModalProps {
  log: GrowLog;
  onSave: (updatedLog: GrowLog) => void;
  onClose: () => void;
}

const PREDEFINED_ACTIONS = ['Observation', 'Water', 'Feed', 'Defoliate', 'Pest Control', 'Training', 'Flush'];

export const LogEditModal = ({ log, onSave, onClose }: LogEditModalProps) => {
  const [manualNotes, setManualNotes] = useState(log.manualNotes || '');
  const [actionType, setActionType] = useState<string>(log.actionType || 'Observation');
  const [timestamp, setTimestamp] = useState(() => {
    // Format timestamp for datetime-local input (YYYY-MM-DDTHH:mm)
    const date = new Date(log.timestamp);
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);
  });

  const isCustomAction = !PREDEFINED_ACTIONS.includes(actionType);

  const handleSave = () => {
    const updatedLog: GrowLog = {
      ...log,
      manualNotes,
      actionType: actionType || 'Observation', // Fallback if empty
      timestamp: new Date(timestamp).getTime()
    };
    Haptic.success();
    onSave(updatedLog);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] w-full max-w-md rounded-3xl border border-white/10 overflow-hidden animate-slide-up shadow-2xl">
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Edit Entry</h3>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Action Type */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">
              <Activity className="w-3 h-3" /> Action Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PREDEFINED_ACTIONS.map(type => (
                <button
                  key={type}
                  onClick={() => { Haptic.tap(); setActionType(type); }}
                  className={`
                    px-3 py-2 rounded-xl text-xs font-medium transition-all border
                    ${actionType === type 
                      ? 'bg-neon-green/20 border-neon-green text-neon-green' 
                      : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}
                  `}
                >
                  {type}
                </button>
              ))}
              <button
                  onClick={() => { 
                    Haptic.tap(); 
                    if (!isCustomAction) setActionType(''); // Clear specific type to switch to custom mode
                  }}
                  className={`
                    px-3 py-2 rounded-xl text-xs font-medium transition-all border flex items-center justify-center gap-2
                    ${isCustomAction
                      ? 'bg-neon-green/20 border-neon-green text-neon-green' 
                      : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}
                  `}
                >
                  <Edit3 className="w-3 h-3" />
                  {isCustomAction && actionType && actionType !== 'Other' ? 'Custom' : 'Other'}
                </button>
            </div>
            
            {/* Custom Action Input */}
            {isCustomAction && (
              <div className="animate-slide-down pt-1">
                 <input
                    type="text"
                    value={actionType === 'Other' ? '' : actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    placeholder="Type custom action (e.g. Transplant)..."
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/50 placeholder-gray-600"
                    autoFocus
                 />
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Timestamp
            </label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/50"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">
              <FileText className="w-3 h-3" /> Notes
            </label>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm min-h-[100px] focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/50"
              placeholder="Enter observations..."
            />
          </div>
        </div>

        <div className="p-4 bg-white/5 border-t border-white/5 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-gray-400 font-medium hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 py-3 bg-neon-green text-black font-bold rounded-xl active:scale-95 transition-transform"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};