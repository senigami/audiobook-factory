import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, Music, Pencil, Save, X } from 'lucide-react';
import type { Job, Status } from '../types';
import { api } from '../api';

interface ChapterCardProps {
  job?: Job;
  filename: string;
  isActive?: boolean;
  onClick?: () => void;
  onRefresh?: () => void;
  statusInfo?: {
    isXttsMp3: boolean;
    isXttsWav: boolean;
    isPiperMp3: boolean;
    isPiperWav: boolean;
  }
}

const getStatusConfig = (status: Status, statusInfo?: ChapterCardProps['statusInfo']) => {
  const config = {
    queued: { icon: Clock, color: 'var(--text-muted)', label: 'Queued' },
    running: { icon: Clock, color: 'var(--accent)', label: 'Processing' },
    done: { icon: CheckCircle2, color: 'var(--success)', label: 'Finished' },
    failed: { icon: AlertCircle, color: 'var(--error)', label: 'Failed' },
    cancelled: { icon: AlertCircle, color: 'var(--text-muted)', label: 'Cancelled' },
    wav: { icon: Music, color: 'var(--warning)', label: 'WAV Ready' },
  };

  if (status === 'queued' && statusInfo) {
      if (statusInfo.isXttsMp3 || statusInfo.isPiperMp3) return config.done;
      if (statusInfo.isXttsWav || statusInfo.isPiperWav) return config.wav;
  }

  return config[status] || config.queued;
};

export const ChapterCard: React.FC<ChapterCardProps> = ({ job, filename, isActive, onClick, onRefresh, statusInfo }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(job?.custom_title || filename);

  const status = job?.status || 'queued';
  const config = getStatusConfig(status, statusInfo);
  const Icon = config.icon;

  const handleSaveTitle = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    try {
      await api.updateTitle(filename, editedTitle);
      setIsEditing(false);
      onRefresh?.();
    } catch (err) {
      console.error('Rename failed', err);
    }
  };

  const getAudioSrc = () => {
    const stem = filename.replace('.txt', '');
    
    // 1. Prefer explicit disk check from initialData
    if (statusInfo?.isXttsMp3) return `/out/xtts/${stem}.mp3`;
    if (statusInfo?.isPiperMp3) return `/out/piper/${stem}.mp3`;
    
    // 2. If statusInfo is present and says NO MP3, believe it over stale job state
    if (statusInfo && !statusInfo.isXttsMp3 && !statusInfo.isPiperMp3) {
        return null;
    }

    // 3. Fallback to job record (needed if statusInfo is missing during partial re-renders)
    if (job?.output_mp3) {
      const prefix = job.engine === 'xtts' ? '/out/xtts/' : '/out/piper/';
      return `${prefix}${job.output_mp3}`;
    }
    return null;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, backgroundColor: 'var(--glass-hover)' }}
      className={`glass-panel ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{
        padding: '1.25rem',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: isActive ? '0 0 20px var(--accent-glow)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <form onSubmit={handleSaveTitle} style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
              <input 
                autoFocus
                value={editedTitle}
                onChange={e => setEditedTitle(e.target.value)}
                style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: '#fff', fontSize: '0.8rem', padding: '2px 4px', width: '100%' }}
              />
              <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--success)', padding: 0 }}><Save size={14} /></button>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--error)', padding: 0 }}><X size={14} /></button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <h4 style={{ 
                fontSize: '0.9rem', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                color: job?.custom_title ? 'var(--accent)' : 'inherit'
              }}>
                {job?.custom_title || filename}
              </h4>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <Icon size={14} color={config.color} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: config.color, textTransform: 'uppercase' }}>
            {config.label}
          </span>
        </div>
      </div>

      {status === 'running' && (
        <div style={{ marginTop: '0.25rem' }}>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(job?.progress || 0) * 100}%` }}
              style={{ height: '100%', background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      <footer style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {getAudioSrc() ? (
          <div onClick={e => e.stopPropagation()}>
             <audio 
              controls 
              style={{ width: '100%', height: '30px' }} 
              src={getAudioSrc()!} 
              preload="none"
              onError={(e) => (e.currentTarget.style.display = 'none')}
             />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {status === 'running' ? 'Processing...' : 
                 status === 'queued' ? 'Queued...' : 
                 (statusInfo?.isXttsWav || statusInfo?.isPiperWav) ? 'WAV ready (Needs MP3)' :
                 'Ready for processing'}
             </span>
          </div>
        )}

        {job?.warning_count ? (
          <span style={{ fontSize: '0.7rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} /> {job.warning_count} Warnings
          </span>
        ) : null}
      </footer>
    </motion.div>
  );
};
