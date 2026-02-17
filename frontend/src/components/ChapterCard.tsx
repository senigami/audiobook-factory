import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, Music, Pencil, Save, X, Trash2, MoreVertical, Play, Mic } from 'lucide-react';
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

  if (statusInfo) {
    if (statusInfo.isXttsMp3 || statusInfo.isPiperMp3) return config.done;
    if (statusInfo.isXttsWav || statusInfo.isPiperWav) return config.wav;
  }

  return config[status] || config.queued;
};

export const ChapterCard: React.FC<ChapterCardProps> = ({ job, filename, isActive, onClick, onRefresh, statusInfo }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(job?.custom_title || filename);
  const [now, setNow] = useState(Date.now());
  const [showMenu, setShowMenu] = useState(false);
  const [displayedRemaining, setDisplayedRemaining] = useState<number | null>(null);

  const status = job?.status || 'queued';

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [showMenu]);

  useEffect(() => {
    if (status !== 'running') {
      setNow(Date.now()); // reset if not running
      return;
    }
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
    if (statusInfo) {
      if (statusInfo.isXttsMp3) return `/out/xtts/${stem}.mp3`;
      if (statusInfo.isPiperMp3) return `/out/piper/${stem}.mp3`;
      return null;
    }
    if (job?.status === 'done' && job?.output_mp3) {
      const prefix = job.engine === 'xtts' ? '/out/xtts/' : '/out/piper/';
      return `${prefix}${job.output_mp3}`;
    }
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
    const timeProgress = Math.min(0.99, elapsed / job.eta_seconds);
    const currentProgress = Math.max(job.progress || 0, timeProgress);
    const blend = Math.min(1.0, currentProgress / 0.25);
    const estimatedRemaining = Math.max(0, job.eta_seconds - elapsed);
    const actualRemaining = (currentProgress > 0.01) ? (elapsed / currentProgress) - elapsed : estimatedRemaining;
    const refinedRemaining = (estimatedRemaining * (1 - blend)) + (actualRemaining * blend);
    return {
      remaining: Math.max(0, Math.floor(refinedRemaining)),
      localProgress: currentProgress
    };
  };

  const { remaining: calculatedRemaining, localProgress } = getProgressInfo();

  const getDisplayConfig = () => {
    const base = getStatusConfig(status, statusInfo);
    if (status === 'running' && (displayedRemaining === 0)) {
      return { ...base, label: 'Finishing...' };
    }
    return base;
  };

  const config = getDisplayConfig();
  const Icon = config.icon;

  useEffect(() => {
    if (calculatedRemaining === null) {
      setDisplayedRemaining(null);
    } else {
      if (displayedRemaining === null || Math.abs(displayedRemaining - calculatedRemaining) > 1) {
        setDisplayedRemaining(calculatedRemaining);
      } else if (displayedRemaining > 0) {
        setDisplayedRemaining(displayedRemaining - 1);
      }
    }
  }, [now, calculatedRemaining === null]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: 'var(--glass-hover)' }}
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
        zIndex: showMenu ? 50 : (isActive ? 10 : 1),
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Icon size={14} color={config.color} />
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: config.color, textTransform: 'uppercase' }}>
              {config.label}
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="btn-ghost"
              style={{ padding: '2px', color: 'var(--text-muted)' }}
              title="More options"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 1000,
                  minWidth: '150px',
                  padding: '4px',
                  marginTop: '4px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)'
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  disabled={!!(statusInfo?.isXttsMp3 || statusInfo?.isXttsWav)}
                  onClick={async () => {
                    setShowMenu(false);
                    try {
                      await api.enqueueSingle(filename, 'xtts');
                      onRefresh?.();
                    } catch (err) {
                      console.error('XTTS single enqueue failed', err);
                    }
                  }}
                  className="btn-ghost"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'flex-start',
                    opacity: (statusInfo?.isXttsMp3 || statusInfo?.isXttsWav) ? 0.5 : 1,
                    cursor: (statusInfo?.isXttsMp3 || statusInfo?.isXttsWav) ? 'not-allowed' : 'pointer'
                  }}
                  title={(statusInfo?.isXttsMp3 || statusInfo?.isXttsWav) ? "Audio already generated. Reset to re-process." : "Run XTTS on just this one chapter"}
                >
                  <Play size={12} /> Process with XTTS
                </button>
                <button
                  disabled={!!(statusInfo?.isPiperMp3 || statusInfo?.isPiperWav)}
                  onClick={async () => {
                    setShowMenu(false);
                    try {
                      await api.enqueueSingle(filename, 'piper');
                      onRefresh?.();
                    } catch (err) {
                      console.error('Piper single enqueue failed', err);
                    }
                  }}
                  className="btn-ghost"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'flex-start',
                    opacity: (statusInfo?.isPiperMp3 || statusInfo?.isPiperWav) ? 0.5 : 1,
                    cursor: (statusInfo?.isPiperMp3 || statusInfo?.isPiperWav) ? 'not-allowed' : 'pointer'
                  }}
                  title={(statusInfo?.isPiperMp3 || statusInfo?.isPiperWav) ? "Audio already generated. Reset to re-process." : "Run Piper on just this one chapter"}
                >
                  <Mic size={12} /> Process with Piper
                </button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button
                  onClick={async () => {
                    setShowMenu(false);
                    if (confirm(`Reset audio for ${filename}? This will delete generated WAV/MP3 files and reset status, but keep the text file.`)) {
                      try {
                        await api.resetChapter(filename);
                        onRefresh?.();
                      } catch (err) {
                        console.error('Reset failed', err);
                      }
                    }
                  }}
                  className="btn-ghost"
                  style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}
                  title="Delete generated audio files and reset chapter status"
                >
                  <Music size={12} /> Reset Audio
                </button>
                <button
                  onClick={async () => {
                    setShowMenu(false);
                    if (confirm(`DELETE CHAPTER ${filename} permanently? This deletes the text file AND all audio files.`)) {
                      try {
                        await api.deleteChapter(filename);
                        onRefresh?.();
                      } catch (err) {
                        console.error('Delete failed', err);
                      }
                    }
                  }}
                  className="btn-ghost"
                  style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)', justifyContent: 'flex-start' }}
                  title="Permanently delete the chapter text file and all generated audio"
                >
                  <Trash2 size={12} /> Delete Chapter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {status === 'running' && (
        <div style={{ marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Progress</span>
            {displayedRemaining !== null && displayedRemaining > 0 && (
              <span style={{
                fontSize: '0.65rem',
                color: 'var(--accent)',
                fontWeight: 600,
                display: 'inline-block',
                width: '60px',
                textAlign: 'right'
              }}>
                ETA: {formatTime(displayedRemaining)}
              </span>
            )}
          </div>
          <div
            data-testid="progress-bar"
            style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}
          >
            <div
              className="progress-bar-animated"
              style={{
                height: '100%',
                backgroundColor: 'var(--accent)',
                width: `${localProgress * 100}%`,
                transition: 'width 1s linear'
              }}
            />
          </div>
        </div>
      )}

      <footer style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {getAudioSrc() && (
          <div onClick={e => e.stopPropagation()}>
            <audio
              controls
              style={{ width: '100%', height: '30px' }}
              src={getAudioSrc()!}
              preload="none"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
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

