import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { Chapter } from '../types';

interface ChapterEditorProps {
  chapterId: string;
  projectId: string;
  onBack: () => void;
}

export const ChapterEditor: React.FC<ChapterEditorProps> = ({ chapterId, projectId, onBack }) => {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadChapter();
  }, [chapterId]);

  useEffect(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!text) {
        setAnalysis(null);
        return;
    }
    
    setAnalyzing(true);
    typingTimeoutRef.current = setTimeout(() => {
        analyzeText(text);
    }, 1000);
    
    return () => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [text]);

  const loadChapter = async () => {
    try {
      const chapters = await api.fetchChapters(projectId);
      const target = chapters.find(c => c.id === chapterId);
      if (target) {
        setChapter(target);
        setTitle(target.title);
        setText(target.text_content || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeText = async (textContent: string) => {
    try {
      const formData = new FormData();
      formData.append('text_content', textContent);
      const res = await fetch('/api/analyze_text', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
          setAnalysis(data);
      }
    } catch (e) {
      console.error("Analysis failed", e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async (manualTitle?: string, manualText?: string) => {
    setSaving(true);
    try {
      const payload = { 
        title: manualTitle !== undefined ? manualTitle : title, 
        text_content: manualText !== undefined ? manualText : text 
      };
      await api.updateChapter(chapterId, payload);
      // We don't necessarily need to reload everything, but maybe update the local chapter object
      setChapter(prev => prev ? { ...prev, ...payload } : null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save logic
  useEffect(() => {
    // Skip initial mount
    if (loading) return;

    const timer = setTimeout(() => {
        handleSave();
    }, 1500); // 1.5s debounce for auto-save

    return () => clearTimeout(timer);
  }, [title, text]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading editor...</div>;
  if (!chapter) return <div style={{ padding: '2rem' }}>Chapter not found.</div>;

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '0 0 2rem 0', margin: '-2.5rem -2.5rem 0 -2.5rem', background: 'var(--bg)', position: 'relative', zIndex: 100 }}>
      {/* Editor Header */}
      <header style={{ 
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', 
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <button onClick={onBack} className="btn-ghost" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input 
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                    fontSize: '1.25rem', fontWeight: 600, background: 'transparent', border: 'none', 
                    color: 'var(--text-primary)', outline: 'none', width: '100%', maxWidth: '400px',
                    padding: '0.25rem'
                }}
            />
            
            {chapter.audio_status === 'done' && chapter.audio_file_path && (
                <div style={{ paddingLeft: '1rem', borderLeft: '1px solid var(--border)' }}>
                    <audio 
                        controls 
                        src={`/out/xtts/${chapter.audio_file_path}`} 
                        style={{ height: '32px', maxWidth: '300px' }}
                    />
                </div>
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-light)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: saving ? 'var(--warning)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} color="var(--success-muted)" />}
                {saving ? 'Saving...' : 'Saved'}
            </span>
        </div>
      </header>

      {/* Main Layout Split */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
        {/* Left pane: Text Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto' }}>
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <button 
                        onClick={() => setEditorTab('edit')} 
                        className={editorTab === 'edit' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '8px' }}
                    >
                        Edit Text
                    </button>
                    <button 
                        onClick={() => {
                            if (!analysis?.safe_text) alert("Please wait for text to be analyzed...");
                            else {
                                setEditorTab('preview');
                                handleSave(); // Give a chance to save the displayed text
                            }
                        }} 
                        className={editorTab === 'preview' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '8px' }}
                        disabled={!analysis?.safe_text}
                    >
                        Preview Safe Text
                    </button>
                </div>

                {editorTab === 'edit' ? (
                    <textarea 
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Start typing your chapter text here..."
                        style={{
                            flex: 1,
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            fontSize: '1.05rem',
                            lineHeight: 1.6,
                            color: 'var(--text-primary)',
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                    />
                ) : (
                    <div style={{ 
                        flex: 1, 
                        background: 'var(--bg)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px', 
                        padding: '1.5rem', 
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        {(analysis?.safe_text || '').split('\n').filter(Boolean).map((line: string, i: number) => (
                            <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '0.25rem', right: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    #{i + 1}
                                </div>
                                <p style={{ 
                                    fontSize: '0.9rem', 
                                    color: 'var(--text-primary)', 
                                    lineHeight: 1.5, 
                                    margin: 0, 
                                    paddingRight: '1rem', 
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                }}>
                                    {line}|
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Right pane: Analysis & Feedback */}
        <div style={{ 
            width: '400px', borderLeft: '1px solid var(--border)', background: 'var(--surface)', 
            padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', 
            overflowY: 'auto' 
        }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Engine Feedback
                    {analyzing && <RefreshCw size={14} className="animate-spin text-muted" />}
                </span>
            </h3>

            {analysis ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="glass-panel" style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{analysis.word_count.toLocaleString()}</div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Words</div>
                        </div>
                        <div className="glass-panel" style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{analysis.char_count.toLocaleString()}</div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Chars</div>
                        </div>
                        <div className="glass-panel" style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{(analysis.sent_count || 0).toLocaleString()}</div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Sentences</div>
                        </div>
                        <div className="glass-panel" style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                                {Math.floor(analysis.predicted_seconds / 60)}m {analysis.predicted_seconds % 60}s
                            </div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Est. Audio</div>
                        </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Long Sentences</h4>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span>Raw Long Sentences</span>
                            <span style={{ fontWeight: 600 }}>{analysis.raw_long_sentences}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                            <span>Auto-Fixed (Safe Mode)</span>
                            <span style={{ color: 'var(--success-muted)', fontWeight: 600 }}>{analysis.auto_fixed}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                            <span style={{ color: analysis.uncleanable > 0 ? 'var(--error)' : 'var(--text-primary)' }}>Action Required</span>
                            <span style={{ 
                                color: analysis.uncleanable > 0 ? 'white' : 'var(--success-muted)', 
                                background: analysis.uncleanable > 0 ? 'var(--error)' : 'transparent',
                                padding: analysis.uncleanable > 0 ? '2px 8px' : '0',
                                borderRadius: '12px',
                                fontWeight: 700 
                            }}>
                                {analysis.uncleanable}
                            </span>
                        </div>
                    </div>

                    <AnimatePresence>
                        {analysis.uncleanable > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{
                                    border: '1px solid var(--error-muted)',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)' }}>
                                    <AlertTriangle size={16} />
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Uncleanable Sentences</h4>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    These sentences exceed {analysis.threshold} characters and could crash the TTS engine. Please split them manually.
                                </p>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {analysis.uncleanable_sentences.map((s: any, idx: number) => (
                                        <div key={idx} style={{ background: 'var(--surface)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--error-muted)', marginBottom: '4px', fontWeight: 600 }}>
                                                {s.length} chars
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                                "{s.text.substring(0, 100)}{s.text.length > 100 ? '...' : ''}"
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {analysis.uncleanable === 0 && text.trim().length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem',
                                    background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)',
                                    borderRadius: '12px', color: 'var(--success)'
                                }}
                            >
                                <CheckCircle size={18} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Engine safe!</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.9rem' }}>
                    Type text to see analysis...
                </div>
            )}
        </div>

      </div>
    </div>
  );
};
