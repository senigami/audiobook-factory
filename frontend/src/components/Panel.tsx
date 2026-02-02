import React, { useEffect, useRef, useState } from 'react';
import { Terminal, FileText, Search } from 'lucide-react';

interface PanelProps {
  title: string;
  logs?: string;
  subtitle?: string;
  filename: string | null;
}

export const Panel: React.FC<PanelProps> = ({ title, logs, subtitle, filename }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'preview'>('logs');
  const [previewData, setPreviewData] = useState<{ text: string; error?: string } | null>(null);
  const [previewMode, setPreviewMode] = useState<'raw' | 'engine'>('raw');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="glass-panel" style={{ 
      height: '350px', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
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
                style={{ 
                    background: 'none', border: 'none', color: activeTab === 'logs' ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', 
                    borderBottom: activeTab === 'logs' ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer', height: '100%', padding: '0 4px'
                }}
            >
                <Terminal size={14} /> Logs
            </button>
            <button 
                onClick={() => setActiveTab('preview')}
                style={{ 
                    background: 'none', border: 'none', color: activeTab === 'preview' ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    borderBottom: activeTab === 'preview' ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer', height: '100%', padding: '0 4px'
                }}
            >
                <FileText size={14} /> Preview & Analyze
            </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600 }}>{title}</h3>
            {subtitle && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtitle}</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#0d0d12' }}>
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
                    color: '#d1d5db'
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
                            className="glass-panel"
                            style={{ padding: '4px 10px', fontSize: '0.7rem', border: previewMode === 'raw' ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                        >
                            Raw
                        </button>
                        <button 
                            onClick={() => setPreviewMode('engine')}
                            className="glass-panel"
                            style={{ padding: '4px 10px', fontSize: '0.7rem', border: previewMode === 'engine' ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                        >
                            Engine
                        </button>
                    </div>
                    <button 
                        onClick={runAnalysis}
                        disabled={!filename}
                        className="glass-panel"
                        style={{ padding: '4px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Search size={12} /> Run Analysis
                    </button>
                </div>
                <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', fontSize: '0.85rem', color: '#94a3b8' }}>
                    {loading ? 'Loading preview...' : (
                        previewData?.error ? <span style={{ color: 'var(--error)' }}>{previewData.error}</span> : (
                            previewMode === 'raw' ? (
                                <div style={{ whiteSpace: 'pre-wrap' }}>{previewData?.text || 'Select a chapter to see preview.'}</div>
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: previewData?.text || '' }} />
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
