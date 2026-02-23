import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, RefreshCw, Zap, User, Mic, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import type { Chapter, SpeakerProfile, Job, Character, ChapterSegment } from '../types';

interface ChapterEditorProps {
  chapterId: string;
  projectId: string;
  speakerProfiles: SpeakerProfile[];
  job?: Job;
  selectedVoice?: string;
  onVoiceChange?: (voice: string) => void;
  onBack: () => void;
  onNavigateToQueue: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const ChapterEditor: React.FC<ChapterEditorProps> = ({ chapterId, projectId, speakerProfiles, job, selectedVoice: externalVoice, onVoiceChange, onBack, onNavigateToQueue, onNext, onPrev }) => {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localVoice, setLocalVoice] = useState<string>('');
  
  const [segments, setSegments] = useState<ChapterSegment[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  const selectedVoice = externalVoice !== undefined ? externalVoice : localVoice;
  const handleVoiceChange = (voice: string) => {
      if (onVoiceChange) onVoiceChange(voice);
      setLocalVoice(voice);
  };

  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview' | 'production'>('edit');
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

      // Fetch segments and characters
      const [segs, chars] = await Promise.all([
        api.fetchSegments(chapterId),
        api.fetchCharacters(projectId)
      ]);
      setSegments(segs);
      setCharacters(chars);
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
    if (!chapter) return;
    
    const finalTitle = manualTitle !== undefined ? manualTitle : title;
    const finalText = manualText !== undefined ? manualText : text;
    
    // Check if anything actually changed before showing "Saving..."
    let changed = false;
    const payload: any = {};
    
    if (finalTitle !== chapter.title) {
        payload.title = finalTitle;
        changed = true;
    }
    if (finalText !== chapter.text_content) {
        payload.text_content = finalText;
        changed = true;
    }
    
    if (!changed) return;

    setSaving(true);
    try {
      await api.updateChapter(chapterId, payload);
      // We don't necessarily need to reload everything, but maybe update the local chapter object
      setChapter(prev => prev ? { ...prev, ...payload } : null);
    } catch (e) {
      console.error(e);
    } finally {
      // Add a tiny delay so the "Saving..." UI is actually visible to the user as feedback
      setTimeout(() => setSaving(false), 500);
    }
  };

  const handleAssignCharacter = async (segmentId: string, charId: string | null) => {
    try {
      await api.updateSegment(segmentId, { character_id: charId });
      // Update local state to show change immediately
      setSegments(prev => prev.map(s => s.id === segmentId ? { ...s, character_id: charId } : s));
    } catch (e) {
      console.error("Failed to assign character", e);
      alert("Failed to assign character.");
    }
  };

  const handleNavigate = async (dir: 'next' | 'prev') => {
      // Force save before navigating
      await handleSave();
      if (dir === 'next' && onNext) onNext();
      if (dir === 'prev' && onPrev) onPrev();
  };

  // Auto-save logic
  useEffect(() => {
    // Skip initial mount
    if (loading) return;

    const timer = setTimeout(() => {
        handleSave(title, text);
    }, 1500); // 1.5s debounce for auto-save

    return () => clearTimeout(timer);
  }, [title, text]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading editor...</div>;
  if (!chapter) return <div style={{ padding: '2rem' }}>Chapter not found.</div>;

  const hasUnsavedChanges = title !== chapter.title || text !== (chapter.text_content || '');

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)', margin: '-2.5rem', background: 'var(--bg)', position: 'relative', zIndex: 100 }}>
      {/* Editor Header */}
      <header style={{ 
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', 
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        flexShrink: 0
      }}>
        <button onClick={async () => { await handleSave(); onBack(); }} className="btn-ghost" style={{ padding: '0.5rem' }} title="Save & Back to Project">
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', gap: '0.25rem', borderRight: '1px solid var(--border)', paddingRight: '1rem' }}>
          <button 
            onClick={() => handleNavigate('prev')} 
            disabled={!onPrev} 
            className="btn-ghost" 
            style={{ padding: '0.4rem', opacity: !onPrev ? 0.3 : 1, cursor: !onPrev ? 'not-allowed' : 'pointer' }}
            title="Save & Previous Chapter"
          >
            ← Prev
          </button>
          <button 
            onClick={() => handleNavigate('next')} 
            disabled={!onNext} 
            className="btn-ghost" 
            style={{ padding: '0.4rem', opacity: !onNext ? 0.3 : 1, cursor: !onNext ? 'not-allowed' : 'pointer' }}
            title="Save & Next Chapter"
          >
            Next →
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
            <input 
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                    fontSize: '1.25rem', fontWeight: 600, background: 'transparent', border: 'none', 
                    color: 'var(--text-primary)', outline: 'none', width: '100%',
                    padding: '0.25rem'
                }}
            />
            
            {chapter.audio_status === 'done' && chapter.audio_file_path && (
                <div style={{ paddingLeft: '1rem', borderLeft: '1px solid var(--border)' }}>
                    <audio 
                        controls 
                        src={chapter.project_id 
                            ? `/projects/${chapter.project_id}/audio/${chapter.audio_file_path}`
                            : `/out/xtts/${chapter.audio_file_path}`} 
                        onError={(e) => {
                            const target = e.target as HTMLAudioElement;
                            if (target.src.includes('/projects/')) {
                                target.src = `/out/xtts/${chapter.audio_file_path}`;
                            }
                        }}
                        style={{ height: '32px', maxWidth: '300px' }}
                    />
                </div>
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {speakerProfiles.length > 0 && (
                <select
                    value={selectedVoice}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    style={{
                        padding: '0.4rem 2rem 0.4rem 0.8rem',
                        borderRadius: '8px', border: '1px solid var(--border)',
                        background: 'var(--surface-light)', color: 'var(--text-primary)',
                        fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center'
                    }}
                    title="Select Voice Profile for this chapter"
                >
                    <option value="">Default Voice</option>
                    {speakerProfiles.map(sp => (
                        <option key={sp.name} value={sp.name}>{sp.name}</option>
                    ))}
                </select>
            )}

            <button
                onClick={async () => {
                    if (chapter?.char_count && chapter.char_count > 50000) {
                        if (!window.confirm(`This chapter is quite long (${chapter.char_count.toLocaleString()} chars). Queue anyway?`)) return;
                    }
                    setSubmitting(true);
                    try {
                        const voiceToUse = selectedVoice || undefined;
                        await api.addProcessingQueue(projectId, chapterId, 0, voiceToUse);
                        onNavigateToQueue();
                    } catch (e) {
                        console.error("Failed to enqueue", e);
                        alert("Failed to queue chapter.");
                    } finally {
                        setSubmitting(false);
                    }
                }}
                disabled={submitting || (job?.status === 'queued' || job?.status === 'running') || chapter?.audio_status === 'processing'}
                className="btn-primary"
                style={{
                    padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    opacity: (job?.status === 'queued' || job?.status === 'running') || chapter?.audio_status === 'processing' ? 0.3 : 1,
                    cursor: (job?.status === 'queued' || job?.status === 'running') || chapter?.audio_status === 'processing' ? 'not-allowed' : 'pointer'
                }}
                title={((job?.status === 'queued' || job?.status === 'running') || chapter?.audio_status === 'processing') ? "Already processing" : "Queue Chapter"}
            >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                Queue
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface-light)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.8rem', color: saving ? 'var(--warning)' : (hasUnsavedChanges ? 'var(--accent)' : 'var(--text-muted)'), display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : (hasUnsavedChanges ? <AlertTriangle size={14} /> : <CheckCircle size={14} color="var(--success-muted)" />)}
                    {saving ? 'Saving...' : (hasUnsavedChanges ? 'Unsaved' : 'Saved')}
                </span>
            </div>
        </div>
      </header>

      {/* Main Layout Split */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
        {/* Left pane: Text Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexShrink: 0 }}>
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
                    <button 
                        onClick={() => {
                            setEditorTab('production');
                            handleSave();
                        }} 
                        className={editorTab === 'production' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '8px' }}
                    >
                        Production
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
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            overflowY: 'auto'
                        }}
                    />
                ) : editorTab === 'preview' ? (
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
                                    {line}
                                </p>
                            </div>
                        ))}
                    </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--accent)' }}>
                            <Info size={16} color="var(--accent)" />
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
                                <strong>Production Mode:</strong> Map sentences to characters. This will override the default chapter voice for those sentences.
                            </p>
                        </div>
                        
                        {segments.map((seg, idx) => {
                            const currentCharacter = characters.find(c => c.id === seg.character_id);
                            const isActive = activeSegmentId === seg.id;
                            
                            return (
                                <div 
                                    key={seg.id} 
                                    style={{ 
                                        padding: '1rem', 
                                        background: isActive ? 'rgba(139, 92, 246, 0.05)' : 'var(--surface-light)', 
                                        borderRadius: '10px', 
                                        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem',
                                        transition: 'all 0.2s ease',
                                        cursor: 'default'
                                    }}
                                    onClick={() => setActiveSegmentId(seg.id)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>#{idx + 1}</span>
                                            {currentCharacter ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <User size={12} />
                                                    {currentCharacter.name}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid var(--border)' }}>
                                                    <Mic size={12} />
                                                    Default Chapter Voice
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {seg.audio_status === 'done' && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <CheckCircle size={12} /> Generated
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                                        {seg.text_content}
                                    </p>
                                    
                                    {isActive && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            style={{ 
                                                marginTop: '0.5rem', 
                                                paddingTop: '0.75rem', 
                                                borderTop: '1px solid var(--border)',
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAssignCharacter(seg.id, null);
                                                }}
                                                className="btn-ghost"
                                                style={{ 
                                                    fontSize: '0.75rem', 
                                                    padding: '0.4rem 0.8rem', 
                                                    background: !seg.character_id ? 'var(--surface-light)' : 'transparent',
                                                    border: !seg.character_id ? '1px solid var(--accent)' : '1px solid var(--border)'
                                                }}
                                            >
                                                Default
                                            </button>
                                            {characters.map(char => (
                                                <button 
                                                    key={char.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAssignCharacter(seg.id, char.id);
                                                    }}
                                                    className="btn-ghost"
                                                    style={{ 
                                                        fontSize: '0.75rem', 
                                                        padding: '0.4rem 0.8rem', 
                                                        background: seg.character_id === char.id ? 'var(--accent)' : 'transparent',
                                                        color: seg.character_id === char.id ? 'white' : 'var(--text-primary)',
                                                        border: seg.character_id === char.id ? '1px solid var(--accent)' : '1px solid var(--border)'
                                                    }}
                                                >
                                                    {char.name}
                                                </button>
                                            ))}
                                            <div style={{ flex: 1 }} />
                                            {/* Future: Regenerate button for this segment */}
                                        </motion.div>
                                    )}
                                </div>
                            );
                        })}
                        
                        {segments.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <AlertTriangle size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                <p>No segments found. Save the chapter text to generate segments.</p>
                            </div>
                        )}
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
