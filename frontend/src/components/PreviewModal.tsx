import React, { useState, useEffect } from 'react';
import { X, FileText, Search, Loader2 } from 'lucide-react';

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    filename: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, filename }) => {
    const [previewData, setPreviewData] = useState<{ text: string; error?: string } | null>(null);
    const [previewMode, setPreviewMode] = useState<'raw' | 'engine'>('raw');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && filename) {
            setLoading(true);
            fetch(`/api/preview/${encodeURIComponent(filename)}?processed=${previewMode === 'engine'}`)
                .then(res => res.json())
                .then(data => {
                    setPreviewData(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [isOpen, filename, previewMode]);

    if (!isOpen) return null;

    const runAnalysis = () => {
        window.open(`/analyze/${encodeURIComponent(filename)}`, '_blank');
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '2rem'
        }} onClick={onClose}>
            <div
                className="glass-panel animate-in"
                style={{
                    width: '100%',
                    maxWidth: '1000px',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <header style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="icon-circle" style={{ width: '32px', height: '32px' }}>
                            <FileText size={16} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Preview & Analysis</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filename}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-ghost" style={{ padding: '8px' }}>
                        <X size={20} />
                    </button>
                </header>

                <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setPreviewMode('raw')}
                            className={previewMode === 'raw' ? 'btn-primary' : 'btn-glass'}
                        >
                            Raw Text
                        </button>
                        <button
                            onClick={() => setPreviewMode('engine')}
                            className={previewMode === 'engine' ? 'btn-primary' : 'btn-glass'}
                        >
                            Engine Processed
                        </button>
                    </div>
                    <button
                        onClick={runAnalysis}
                        className="btn-glass"
                    >
                        <Search size={14} /> Run Analysis
                    </button>
                </div>

                <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', background: 'var(--bg)' }}>
                    {loading ? (
                        <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                            <Loader2 className="animate-spin" size={32} />
                            <span>Crunching text...</span>
                        </div>
                    ) : (
                        previewData?.error ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--error)' }}>
                                {previewData.error}
                            </div>
                        ) : (
                            previewMode === 'raw' ? (
                                <pre style={{
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'inherit',
                                    margin: 0,
                                    fontSize: '0.95rem',
                                    lineHeight: '1.7',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {previewData?.text || 'No content found.'}
                                </pre>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                                    {!previewData?.text && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No processing required for this text.</p>}
                                </div>
                            )
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
