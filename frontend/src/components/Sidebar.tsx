import React from 'react';
import { Play, Mic, Terminal, Settings, Package, Upload, Pause, Trash2, FileAudio, CheckCircle, RefreshCw, Search, Loader2 } from 'lucide-react';
import type { Settings as GlobalSettings, Job } from '../types';

interface SidebarProps {
  onOpenAssembly: () => void;
  settings?: GlobalSettings;
  piperVoices: string[];
  audiobooks: string[];
  paused: boolean;
  narratorOk: boolean;
  hideFinished: boolean;
  onToggleHideFinished: () => void;
  onRefresh: () => void;
  audiobookJob?: Job;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenAssembly,
  settings,
  piperVoices,
  audiobooks,
  paused,
  narratorOk,
  hideFinished,
  onToggleHideFinished,
  onRefresh,
  audiobookJob
}) => {
  const [selectedVoice, setSelectedVoice] = React.useState('');
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemainingAndProgress = (job: Job) => {
    if (job.status !== 'running' || !job.started_at || !job.eta_seconds) {
      return { remaining: null, progress: job.progress || 0 };
    }
    const elapsed = (now / 1000) - job.started_at;
    const remaining = Math.max(0, Math.floor(job.eta_seconds - elapsed));
    const timeProgress = Math.min(0.99, elapsed / job.eta_seconds);
    return {
      remaining,
      progress: Math.max(job.progress || 0, timeProgress)
    };
  };

  const formatSeconds = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStartQueue = async (engine: 'xtts' | 'piper') => {
    const endpoint = engine === 'xtts' ? '/queue/start_xtts' : '/queue/start_piper';
    const body = engine === 'piper' ? new URLSearchParams({ piper_voice: selectedVoice }) : undefined;
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: engine === 'piper' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
        body
      });
      onRefresh();
    } catch (e) {
      console.error('Failed to start queue', e);
    }
  };

  const handlePauseToggle = async () => {
    try {
      await fetch('/queue/pause', { method: 'POST' });
      onRefresh();
    } catch (e) {
      console.error('Failed to toggle pause', e);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all jobs and reset state?')) return;
    try {
      await fetch('/api/clear', { method: 'POST' });
      onRefresh();
    } catch (e) {
      console.error('Failed to clear', e);
    }
  };

  const handleBackfill = async () => {
    try {
      await fetch('/queue/backfill_mp3', { method: 'POST' });
      onRefresh();
    } catch (e) {
      console.error('Backfill failed', e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    try {
      const response = await fetch('/upload?json=1', { method: 'POST', body: formData });
      const result = await response.json();
      if (result.status === 'success') {
        alert(`Uploaded and split into ${result.chapters.length} chapters.`);
        onRefresh();
      } else {
        alert(`Upload error: ${result.message}`);
      }
    } catch (e) {
      console.error('Upload failed', e);
      alert('Upload failed. See console for details.');
    } finally {
      // Clear input so same file can be uploaded again
      e.target.value = '';
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '0.5rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FACTORY</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Audiobook Production
        </p>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Upload size={14} color="var(--accent)" />
            <h3 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Upload Text
            </h3>
          </div>
          <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input type="file" accept=".txt" onChange={handleUpload} style={{ fontSize: '0.75rem', width: '100%', color: 'var(--text-primary)' }} />
          </div>
        </section>

        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Terminal size={14} color="var(--accent)" />
            <h3 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Queue Controls
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => handleStartQueue('xtts')}
              className="btn-glass"
              disabled={paused}
              style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '100%', fontSize: '0.875rem' }}
            >
              <Play size={14} /> Start XTTS Queue
            </button>

            <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select
                value={selectedVoice}
                onChange={e => setSelectedVoice(e.target.value)}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: '#fff', fontSize: '0.75rem', padding: '6px', borderRadius: '4px' }}
              >
                <option value="">(Piper Voice)</option>
                {piperVoices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button
                onClick={() => handleStartQueue('piper')}
                className="btn-ghost"
                disabled={paused || !selectedVoice}
                style={{ padding: '0.5rem', textAlign: 'left', width: '100%', fontSize: '0.875rem' }}
              >
                <Mic size={14} /> Start Piper
              </button>
            </div>

            <button
              onClick={handlePauseToggle}
              className="btn-glass"
              style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '100%', fontSize: '0.875rem' }}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume Queue' : 'Pause Queue'}
            </button>
          </div>
        </section>

        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Package size={14} color="var(--accent)" />
            <h3 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Audiobook
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={onOpenAssembly}
              className="btn-primary"
              style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '100%', fontSize: '0.875rem' }}
            >
              <Package size={14} /> Assemble M4B
            </button>

            {audiobookJob && (audiobookJob.status === 'running' || audiobookJob.status === 'queued') && (() => {
              const { remaining, progress } = getRemainingAndProgress(audiobookJob);
              return (
                <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader2 size={12} className={audiobookJob.status === 'running' ? 'animate-spin' : ''} />
                      {audiobookJob.status === 'running' ? 'Assembling...' : 'Queued...'}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {audiobookJob.status === 'running'
                        ? (remaining !== null ? `ETA: ${formatSeconds(remaining)}` : `ETA: ${audiobookJob.eta_seconds}s`)
                        : 'Waiting...'}
                    </span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      className="progress-bar-animated"
                      style={{
                        height: '100%',
                        width: `${Math.max(progress, 0.05) * 100}%`,
                        backgroundColor: 'var(--accent)',
                        transition: 'width 1s linear'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {audiobookJob.chapter_file}
                  </span>
                </div>
              );
            })()}

            {audiobooks.map(b => (
              <a key={b} href={`/out/audiobook/${b}`} download className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileAudio size={12} /> {b}
              </a>
            ))}
          </div>
        </section>

        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Settings size={14} color="var(--accent)" />
            <h3 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Options
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={onToggleHideFinished}
              className="btn-glass"
              style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '100%', fontSize: '0.875rem', color: hideFinished ? 'var(--accent)' : 'inherit' }}
            >
              <CheckCircle size={14} /> {hideFinished ? 'Show Finished' : 'Hide Finished'}
            </button>
            <button
              onClick={handleBackfill}
              className="btn-glass"
              style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '100%', fontSize: '0.875rem' }}
            >
              <RefreshCw size={14} /> Resolve Missing MP3s
            </button>
            <a
              href="/analyze_batch"
              className="btn-glass"
              style={{ padding: '0.75rem 1rem', textAlign: 'left', width: '100%', fontSize: '0.875rem', textDecoration: 'none', color: 'var(--text-primary)' }}
            >
              <Search size={14} /> Run Batch Analysis
            </a>

            <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input type="checkbox" readOnly checked={!!settings?.safe_mode} /> Safe Mode
              </label>
              <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input type="checkbox" readOnly checked={!!settings?.make_mp3} /> Make MP3
              </label>
            </div>

            <button
              onClick={handleClear}
              className="btn-ghost"
              style={{ color: 'var(--error)', fontSize: '0.8rem', textAlign: 'left', padding: '0.5rem 0' }}
            >
              <Trash2 size={14} /> Reset Factory
            </button>
          </div>
        </section>
      </div>

      <div className="divider" />

      <footer>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: narratorOk ? 'var(--success)' : 'var(--error)', boxShadow: narratorOk ? '0 0 10px var(--success)' : '0 0 10px var(--error)' }}></div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Narrator Sample: {narratorOk ? 'Found' : 'Missing'}</span>
        </div>
      </footer>
    </div>
  );
};
