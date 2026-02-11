import React, { useEffect, useRef, useState } from 'react';
import { Terminal, FileText, Search } from 'lucide-react';

interface PanelProps {
    title: string;
    logs?: string;
    subtitle?: string;
    filename: string | null;
    progress?: number;
    status?: string;
    startedAt?: number;
    etaSeconds?: number;
}

export const Panel: React.FC<PanelProps> = ({ title, logs, subtitle, filename, progress, status, startedAt, etaSeconds }) => {
    const [activeTab, setActiveTab] = useState<'logs' | 'preview'>('logs');
    const [previewData, setPreviewData] = useState<{ text: string; error?: string } | null>(null);
    const [previewMode, setPreviewMode] = useState<'raw' | 'engine'>('raw');
    const [loading, setLoading] = useState(false);
    const [now, setNow] = useState(Date.now());
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (activeTab === 'logs' && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, activeTab]);

    useEffect(() => {
        if (activeTab === 'preview' && filename) {
            setLoading(true);
            fetch(`/api/preview/${encodeURIComponent(filename)}?processed=${previewMode === 'engine'}`)
                .then(res => res.json())
                .then(data => {
                    setPreviewData(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [activeTab, filename, previewMode]);

    const runAnalysis = async () => {
        if (!filename) return;
        window.open(`/analyze/${encodeURIComponent(filename)}`, '_blank');
    };

    const getRemainingAndProgress = () => {
        if (status !== 'running' || !startedAt || !etaSeconds) {
            return { remaining: null, localProgress: progress || 0 };
        }
        const elapsed = (now / 1000) - startedAt;
        const timeProgress = Math.min(0.99, elapsed / etaSeconds);
        const currentProgress = Math.max(progress || 0, timeProgress);

        // Weighted ETA Blend:
        // We transition from the static prediction to the real-time projection
        // as progress moves from 0% to 25%. This smooths out the 'model loading' lag.
        const blend = Math.min(1.0, currentProgress / 0.25);
        const estimatedRemaining = Math.max(0, etaSeconds - elapsed);
        const actualRemaining = (currentProgress > 0.01) ? (elapsed / currentProgress) - elapsed : estimatedRemaining;

        const refinedRemaining = (estimatedRemaining * (1 - blend)) + (actualRemaining * blend);

        return {
            remaining: Math.max(0, Math.floor(refinedRemaining)),
            localProgress: currentProgress
        };
    };

    const formatSeconds = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const { remaining, localProgress } = getRemainingAndProgress();

    return (
        <div className="glass-panel" style={{
            height: '350px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            width: '100%',
            marginTop: 'auto'
        }}>
            <div style={{
                padding: '0 1rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '45px'
            }}>
                <div style={{ display: 'flex', gap: '1.5rem', height: '100%' }}>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className="btn-ghost"
                        style={{
                            color: activeTab === 'logs' ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: '0.8rem', fontWeight: 600,
                            borderBottom: activeTab === 'logs' ? '2px solid var(--accent)' : '2px solid transparent',
                            borderRadius: 0, height: '100%', padding: '0 4px'
                        }}
                    >
                        <Terminal size={14} /> Logs
                    </button>
                    <button
                        onClick={() => setActiveTab('preview')}
                        className="btn-ghost"
                        style={{
                            color: activeTab === 'preview' ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: '0.8rem', fontWeight: 600,
                            borderBottom: activeTab === 'preview' ? '2px solid var(--accent)' : '2px solid transparent',
                            borderRadius: 0, height: '100%', padding: '0 4px'
                        }}
                    >
                        <FileText size={14} /> Preview & Analyze
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
                    {(subtitle || remaining !== null) && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {remaining !== null ? `ETA: ${formatSeconds(remaining)}` : subtitle}
                        </span>
                    )}
                </div>
            </div>

            {(status === 'running' || status === 'queued') && (
                <div style={{
                    height: '4px',
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div
                        className="progress-bar-animated"
                        style={{
                            height: '100%',
                            width: `${localProgress * 100}%`,
                            backgroundColor: 'var(--accent)',
                            transition: 'width 1s linear'
                        }}
                    />
                </div>
            )}

            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
                {activeTab === 'logs' ? (
                    <div
                        ref={scrollRef}
                        style={{
                            height: '100%',
                            padding: '1rem',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.75rem',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        {logs || 'Waiting for activity...'}
                    </div>
                ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setPreviewMode('raw')}
                                    className={previewMode === 'raw' ? 'btn-primary' : 'btn-glass'}
                                    style={{ padding: '4px 12px', fontSize: '0.7rem', height: '28px' }}
                                >
                                    Raw
                                </button>
                                <button
                                    onClick={() => setPreviewMode('engine')}
                                    className={previewMode === 'engine' ? 'btn-primary' : 'btn-glass'}
                                    style={{ padding: '4px 12px', fontSize: '0.7rem', height: '28px' }}
                                >
                                    Engine
                                </button>
                            </div>
                            <button
                                onClick={runAnalysis}
                                disabled={!filename}
                                className="btn-glass"
                                style={{ padding: '4px 12px', fontSize: '0.7rem', height: '28px' }}
                            >
                                <Search size={12} /> Run Analysis
                            </button>
                        </div>
                        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', overflowX: 'hidden', fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: 0 }}>
                            {loading ? 'Loading preview...' : (
                                previewData?.error ? <span style={{ color: 'var(--error)' }}>{previewData.error}</span> : (
                                    previewMode === 'raw' ? (
                                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                                            {previewData?.text || 'Select a chapter to see preview.'}
                                        </pre>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, overflowX: 'hidden' }}>
                                            {(previewData?.text || '').split('\n').filter(Boolean).map((chunk, idx) => (
                                                <div
                                                    key={idx}
                                                    className="engine-chunk"
                                                    data-index={`Chunk #${idx + 1}`}
                                                >
                                                    <code>
                                                        {chunk}
                                                        <span style={{
                                                            color: 'var(--accent)',
                                                            opacity: 0.8,
                                                            userSelect: 'none',
                                                            marginLeft: '2px',
                                                            fontWeight: 'bold'
                                                        }}>⎸</span>
                                                    </code>
                                                </div>
                                            ))}
                                            {!previewData?.text && 'Select a chapter to see preview.'}
                                        </div>
                                    )
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
