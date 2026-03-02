import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, Music, Pencil, Save, X, Trash2, MoreVertical, Play, FileText, Video, Loader2, Download } from 'lucide-react';
import type { Job, Status } from '../types';
import { api } from '../api';
import { PredictiveProgressBar } from './PredictiveProgressBar';

interface ChapterCardProps {
  job?: Job;
  filename: string;
  isActive?: boolean;
  onClick?: () => void;
  onRefresh?: () => void;
  onOpenPreview?: (filename: string) => void;
  statusInfo?: {
    isXttsMp3: boolean;
    isXttsWav: boolean;
  };
  makeMp3?: boolean;
  requestConfirm?: (config: {
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
  }) => void;
}

const getStatusConfig = (status: Status) => {
  const config = {
    queued: { icon: Clock, color: 'var(--text-muted)', label: 'Queued' },
    running: { icon: Clock, color: 'var(--accent)', label: 'Processing' },
    done: { icon: CheckCircle2, color: 'var(--success-text)', label: 'Ready' },
    failed: { icon: AlertCircle, color: 'var(--error-text)', label: 'Failed' },
    cancelled: { icon: AlertCircle, color: 'var(--text-muted)', label: 'Cancelled' },
    error: { icon: AlertCircle, color: 'var(--error-text)', label: 'Error' },
  };

  return config[status] || config.queued;
};

export const ChapterCard: React.FC<ChapterCardProps> = ({ job, filename, isActive, onClick, onRefresh, onOpenPreview, statusInfo, makeMp3, requestConfirm }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(job?.custom_title || filename);
  const [showMenu, setShowMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const status = job?.status === 'failed' ? 'error' : (job?.status || 'queued');

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [showMenu]);

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
    let prefix = '/out/xtts/';
    
    // If it's a project job, use the project-specific audio mount
    if (job?.project_id) {
        prefix = `/projects/${job.project_id}/audio/`;
    }

    if (makeMp3) {
      if (statusInfo?.isXttsMp3) return `${prefix}${stem}.mp3`;
      if (statusInfo?.isXttsWav) return `${prefix}${stem}.wav`;
    } else {
      if (statusInfo?.isXttsWav) return `${prefix}${stem}.wav`;
      if (statusInfo?.isXttsMp3) return `${prefix}${stem}.mp3`;
    }

    if (job?.status === 'done') {
      const audioFile = makeMp3 
        ? (job.output_mp3 || job.output_wav)
        : (job.output_wav || job.output_mp3);
        
      if (audioFile) {
        const itemPrefix = job.project_id ? `/projects/${job.project_id}/audio/` : prefix;
        return `${itemPrefix}${audioFile}`;
      }
    }
    return null;
  };

  const getDisplayConfig = () => {
    // Determine effective status based on job and disk state
    const isActuallyDone =
      status === 'done' ||
      statusInfo?.isXttsMp3 || statusInfo?.isXttsWav;

    const base = getStatusConfig(isActuallyDone ? 'done' : status);

    if (isActuallyDone) {
      const audioSrc = getAudioSrc();
      const isMp3 = audioSrc?.endsWith('.mp3');
      const label = isMp3 ? 'MP3' : (audioSrc?.endsWith('.wav') ? 'WAV' : 'Done');
      const icon = isMp3 ? CheckCircle2 : Music;
      return { ...base, label, icon };
    }

    if (status === 'running' && job?.progress && job.progress > 0.99) {
      return { ...base, label: 'Finishing...' };
    }
    return base;
  };

  const config = getDisplayConfig();
  const Icon = config.icon;

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
        zIndex: showMenu ? 100 : (isActive ? 10 : 1),
        overflow: 'visible',
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
                style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: '0.8rem', padding: '2px 4px', width: '100%' }}
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
                  minWidth: '180px',
                  padding: '4px',
                  marginTop: '4px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)'
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  disabled={!!(statusInfo?.isXttsMp3 || statusInfo?.isXttsWav || status === 'queued' || status === 'running')}
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
                    opacity: (statusInfo?.isXttsMp3 || statusInfo?.isXttsWav || status === 'queued' || status === 'running') ? 0.5 : 1,
                    cursor: (statusInfo?.isXttsMp3 || statusInfo?.isXttsWav || status === 'queued' || status === 'running') ? 'not-allowed' : 'pointer'
                  }}
                  title={
                    (status === 'queued' || status === 'running') ? "Already queued or processing. Please wait or cancel first." :
                    (statusInfo?.isXttsMp3 || statusInfo?.isXttsWav) ? "Audio already generated. Reset to re-process." : 
                    "Synthesize just this one chapter"
                  }
                >
                  <Play size={12} /> Process Synthesis
                </button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenPreview?.(filename);
                  }}
                  className="btn-ghost"
                  style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}
                >
                  <FileText size={12} /> Preview & Analyze
                </button>
                <button
                  disabled={isExporting || !(statusInfo?.isXttsMp3 || statusInfo?.isXttsWav)}
                  onClick={async () => {
                    setShowMenu(false);
                    setIsExporting(true);
                    try {
                      const res = await api.exportSample(filename);
                      if (res.url) {
                        window.open(res.url, '_blank');
                      } else {
                        alert(res.message || 'Export failed');
                      }
                    } catch (err) {
                      console.error('Export failed', err);
                      alert('Export failed');
                    } finally {
                      setIsExporting(false);
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
                    opacity: (isExporting || !(statusInfo?.isXttsMp3 || statusInfo?.isXttsWav)) ? 0.5 : 1
                  }}
                >
                  {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Video size={12} />}
                  {isExporting ? 'Generating Video...' : 'Export Video Sample'}
                </button>
                {getAudioSrc() && (
                  <a 
                    href={getAudioSrc()!}
                    download={getAudioSrc()!.split('/').pop()}
                    className="btn-ghost" 
                    style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start', textDecoration: 'none', color: 'inherit' }}
                    onClick={() => setShowMenu(false)}
                  >
                    <Download size={12} /> Download Audio
                  </a>
                )}
                <button
                  onClick={async () => {
                    setShowMenu(false);
                    const msg = `Reset audio for ${filename}? This will delete generated WAV/MP3 files and reset status, but keep the text file.`;
                    if (requestConfirm) {
                      requestConfirm({
                        title: 'Reset Chapter Audio',
                        message: msg,
                        isDestructive: true,
                        onConfirm: async () => {
                          try {
                            await api.resetChapter(filename);
                            onRefresh?.();
                          } catch (err) {
                            console.error('Reset failed', err);
                          }
                        }
                      });
                    } else if (confirm(msg)) {
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
                    const msg = `DELETE CHAPTER ${filename} permanently? This deletes the text file AND all audio files.`;
                    if (requestConfirm) {
                      requestConfirm({
                        title: 'Delete Chapter',
                        message: msg,
                        isDestructive: true,
                        onConfirm: async () => {
                          try {
                            await api.deleteChapter(filename);
                            onRefresh?.();
                          } catch (err) {
                            console.error('Delete failed', err);
                          }
                        }
                      });
                    } else if (confirm(msg)) {
                      try {
                        await api.deleteChapter(filename);
                        onRefresh?.();
                      } catch (err) {
                        console.error('Delete failed', err);
                      }
                    }
                  }}
                  className="btn-danger"
                  style={{ width: '100%', textAlign: 'left', padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}
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
          <PredictiveProgressBar
            progress={job?.progress || 0}
            startedAt={job?.started_at}
            etaSeconds={job?.eta_seconds}
            label="Processing"
          />
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
          <span style={{ fontSize: '0.7rem', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} /> {job.warning_count} Warnings
          </span>
        ) : null}
      </footer>
    </motion.div>
  );
};

