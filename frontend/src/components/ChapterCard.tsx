import React, { useState, useEffect } from 'react';
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

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

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
  const [now, setNow] = useState(Date.now());

  const status = job?.status || 'queued';
  const config = getStatusConfig(status, statusInfo);
  const Icon = config.icon;

  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    setEditedTitle(job?.custom_title || filename);
  }, [job?.custom_title, filename]);

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

    // 1. Trust the direct job record if it just finished (handles immediate WS updates)
    if (job?.status === 'done' && job?.output_mp3) {
      const prefix = job.engine === 'xtts' ? '/out/xtts/' : '/out/piper/';
      return `${prefix}${job.output_mp3}`;
    }

    // 2. Fallback to explicit disk check from initialState (good for initial page load)
    if (statusInfo?.isXttsMp3) return `/out/xtts/${stem}.mp3`;
    if (statusInfo?.isPiperMp3) return `/out/piper/${stem}.mp3`;

    // 3. Status check for WAV (though we usually want the player for MP3)
    // If it's a WAV-only job that is done, we could show it too, but UI usually waits for MP3
    if (job?.status === 'done' && job?.output_wav && !job.make_mp3) {
      const prefix = job.engine === 'xtts' ? '/out/xtts/' : '/out/piper/';
      return `${prefix}${job.output_wav}`;
    }

    return null;
  };

  const getProgressInfo = () => {
    if (status !== 'running' || !job?.started_at || !job?.eta_seconds) {
      return { remaining: null, localProgress: job?.progress || 0 };
    }
    const elapsed = (now / 1000) - job.started_at;
    const remaining = Math.max(0, Math.floor(job.eta_seconds - elapsed));
    const timeProgress = Math.min(0.99, elapsed / job.eta_seconds);
    return {
      remaining,
      localProgress: Math.max(job.progress || 0, timeProgress)
    };
  };

  const { remaining: remainingSeconds, localProgress } = getProgressInfo();

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Progress</span>
            {remainingSeconds !== null && remainingSeconds > 0 && (
              <span style={{
                fontSize: '0.65rem',
                color: 'var(--accent)',
                fontWeight: 600,
                display: 'inline-block',
                width: '60px',
                textAlign: 'right'
              }}>
                ETA: {formatTime(remainingSeconds)}
              </span>
            )}
          </div>
          <div
            data-testid="progress-bar"
            style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}
          >
            <div
              style={{
                height: '100%',
                background: 'var(--accent)',
                width: `${Math.max(localProgress, 0.05) * 100}%`,
                transition: 'width 1s linear'
              }}
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

