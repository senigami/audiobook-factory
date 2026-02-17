import React from 'react';
import { Package, FileAudio, Trash2, Download } from 'lucide-react';
import type { Job } from '../types';

interface LibraryTabProps {
    audiobooks: string[];
    audiobookJob?: Job;
    onOpenAssembly: () => void;
    onRefresh: () => void;
    progressHelper: (job: Job) => { remaining: number | null, progress: number };
    formatSeconds: (s: number) => string;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
    audiobooks,
    audiobookJob,
    onOpenAssembly,
    onRefresh,
    progressHelper,
    formatSeconds
}) => {
    return (
        <div className="tab-content animate-in" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Audiobook Library</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage your generated works and assemble new audiobooks.</p>
                </div>
                <button onClick={onOpenAssembly} className="btn-primary">
                    <Package size={18} /> Assemble New Book
                </button>
            </header>

            {audiobookJob && (audiobookJob.status === 'running' || audiobookJob.status === 'queued') && (() => {
                const { remaining, progress } = progressHelper(audiobookJob);
                return (
                    <section className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Package className="animate-pulse" size={18} color="var(--accent)" />
                                Currently Assembling: {audiobookJob.chapter_file}
                            </h3>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                {audiobookJob.status === 'running'
                                    ? (remaining !== null ? `ETA: ${formatSeconds(remaining)}` : `ETA: ${audiobookJob.eta_seconds}s`)
                                    : 'Queued in background...'}
                            </span>
                        </div>
                        <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
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
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Preparing high-quality M4B with chapters and metadata...
                        </p>
                    </section>
                );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {audiobooks.length === 0 && !audiobookJob && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        <FileAudio size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>Your library is empty. Finish some chapters to begin assembly.</p>
                    </div>
                )}
                {audiobooks.map(b => (
                    <div key={b} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div className="icon-circle" style={{ width: '40px', height: '40px' }}>
                                <FileAudio size={20} />
                            </div>
                            <button
                                onClick={async () => {
                                    if (confirm(`Delete ${b}?`)) {
                                        await fetch(`/api/audiobook/${encodeURIComponent(b)}`, { method: 'DELETE' });
                                        onRefresh();
                                    }
                                }}
                                className="btn-ghost"
                                style={{ padding: '4px', color: 'var(--text-muted)' }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <div>
                            <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b}</h4>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>M4B Audiobook</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <a href={`/out/audiobook/${b}`} download className="btn-glass" style={{ flex: 1, textDecoration: 'none', fontSize: '0.875rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                <Download size={14} /> Download
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
