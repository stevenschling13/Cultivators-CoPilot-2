import React, { useState, useRef } from 'react';
import { X, Lock, Download, Upload, FileJson, AlertCircle } from 'lucide-react';
import { Haptic } from '../../utils/haptics';

interface BackupModalProps {
  mode: 'backup' | 'restore';
  onClose: () => void;
  onConfirm: (password: string, file?: File) => Promise<boolean>;
}

export const BackupModal = ({ mode, onClose, onConfirm }: BackupModalProps) => {
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    setError('');
    if (!password) {
        setError('Password is required.');
        Haptic.error();
        return;
    }
    if (mode === 'restore' && !file) {
        setError('Backup file is required.');
        Haptic.error();
        return;
    }

    setLoading(true);
    try {
      const success = await onConfirm(password, file || undefined);
      if (success) {
        Haptic.success();
        onClose();
      } else {
        setError(mode === 'restore' ? 'Decryption failed. Incorrect password or corrupt file.' : 'Backup creation failed.');
        Haptic.error();
      }
    } catch (e) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-3xl p-6 animate-slide-up shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            {mode === 'backup' ? <Download className="w-5 h-5 text-neon-green" /> : <Upload className="w-5 h-5 text-neon-blue" />}
            {mode === 'backup' ? 'Encrypted Backup' : 'Restore Data'}
          </h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 active:scale-95 transition-transform">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          <p className="text-sm text-gray-400 leading-relaxed">
            {mode === 'backup' 
              ? "Create a secure, encrypted archive of your batches, logs, and settings. You must remember this password to restore." 
              : "Restore your data from a .ccbak file. WARNING: This will overwrite all current app data."}
          </p>

          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase font-mono tracking-wider flex items-center gap-2">
              <Lock className="w-3 h-3" /> Encryption Password
            </label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/50 transition-all placeholder-gray-600"
              placeholder="Enter password..."
              autoFocus
            />
          </div>

          {mode === 'restore' && (
            <div 
              onClick={() => { Haptic.tap(); fileInputRef.current?.click(); }}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                  file ? 'border-neon-green/30 bg-neon-green/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".ccbak" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <FileJson className={`w-8 h-8 ${file ? 'text-neon-green' : 'text-gray-600'}`} />
              <div className="text-center">
                  <div className={`text-xs font-bold ${file ? 'text-neon-green' : 'text-gray-300'}`}>
                    {file ? file.name : "Select Backup File"}
                  </div>
                  {!file && <div className="text-[10px] text-gray-500 font-mono mt-1">TAP TO BROWSE</div>}
              </div>
            </div>
          )}

          {error && (
             <div className="flex items-center gap-2 text-alert-red bg-alert-red/10 p-3 rounded-lg border border-alert-red/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{error}</span>
             </div>
          )}

          <button
            onClick={() => { Haptic.tap(); handleSubmit(); }}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-black transition-all active:scale-95 ${
              mode === 'backup' 
                 ? 'bg-neon-green hover:bg-neon-green/90 shadow-[0_0_20px_rgba(0,255,163,0.3)]' 
                 : 'bg-neon-blue hover:bg-neon-blue/90 shadow-[0_0_20px_rgba(0,212,255,0.3)]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    Processing...
                </span>
            ) : (
                mode === 'backup' ? 'Download Archive' : 'Restore Database'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};