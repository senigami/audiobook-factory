import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, RefreshCw, Zap, User, Info, Volume2, List } from 'lucide-react';
import { ColorSwatchPicker } from './ColorSwatchPicker';

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
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  
  const selectedVoice = externalVoice !== undefined ? externalVoice : localVoice;
  const handleVoiceChange = (voice: string) => {
      if (onVoiceChange) onVoiceChange(voice);
      setLocalVoice(voice);
  };

  const [analysis, setAnalysis] = useState<any>(null);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview' | 'production' | 'performance'>('edit');
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [generatingSegmentIds, setGeneratingSegmentIds] = useState<Set<string>>(new Set());
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const playbackQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);
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
    
    
    // setAnalyzing(true);
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
      // setAnalyzing(false);
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
      setSegments(prev => prev.map(s => s.id === segmentId ? { ...s, character_id: charId } : s));
    } catch (e) {
      console.error("Failed to assign character", e);
    }
  };

  const handleUpdateCharacterColor = async (id: string, color: string) => {
    try {
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, color } : c));
      await api.updateCharacter(id, undefined, undefined, undefined, color);
    } catch (e) {
      console.error("Failed to update character color", e);
      const chars = await api.fetchCharacters(projectId);
      setCharacters(chars);
    }
  };

  const handleBulkAssign = async (segmentId: string) => {
    if (!selectedCharacterId) return;
    await handleAssignCharacter(segmentId, selectedCharacterId);
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
                    <button 
                        onClick={() => {
                            setEditorTab('performance');
                            handleSave();
                        }} 
                        className={editorTab === 'performance' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '8px' }}
                    >
                        Performance
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
                ) : editorTab === 'performance' ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', padding: '1.5rem', minHeight: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <List size={20} color="var(--accent)" />
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Performance View</h3>
                            </div>
                            <button 
                                onClick={async () => {
                                    setSubmitting(true);
                                    try {
                                        await api.bakeChapter(chapterId);
                                        onNavigateToQueue();
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setSubmitting(false);
                                    }
                                }}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', boxShadow: '0 4px 12px var(--accent-glow)' }}
                                title="Stitch all segment audios into the final chapter file"
                            >
                                <RefreshCw size={16} className={submitting ? 'animate-spin' : ''} /> Bake Final Chapter
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {(() => {
                                const groups: { characterId: string | null; segments: ChapterSegment[] }[] = [];
                                segments.forEach(seg => {
                                    const lastGroup = groups[groups.length - 1];
                                    if (lastGroup && lastGroup.characterId === seg.character_id) {
                                        lastGroup.segments.push(seg);
                                    } else {
                                        groups.push({
                                            characterId: seg.character_id,
                                            segments: [seg]
                                        });
                                    }
                                });

                                const handleGenerate = async (sids: string[]) => {
                                    setGeneratingSegmentIds(prev => {
                                        const next = new Set(prev);
                                        sids.forEach(id => next.add(id));
                                        return next;
                                    });
                                    try {
                                        await api.generateSegments(sids);
                                        // The worker will push updates via WebSocket or we poll
                                    } catch (e) {
                                        console.error(e);
                                    }
                                };

                                const stopPlayback = () => {
                                    if (audioPlayerRef.current) {
                                        audioPlayerRef.current.pause();
                                        audioPlayerRef.current = null;
                                    }
                                    setPlayingSegmentId(null);
                                    isPlayingRef.current = false;
                                    playbackQueueRef.current = [];
                                };

                                const playSegment = async (segmentId: string, fullQueue: string[]) => {
                                    stopPlayback();
                                    isPlayingRef.current = true;
                                    playbackQueueRef.current = fullQueue;
                                    
                                    const currentIndex = fullQueue.indexOf(segmentId);
                                    if (currentIndex === -1) return;

                                    const playFromIndex = async (idx: number) => {
                                        if (!isPlayingRef.current || idx >= playbackQueueRef.current.length) {
                                            stopPlayback();
                                            return;
                                        }

                                        const currentId = playbackQueueRef.current[idx];
                                        const seg = segments.find(s => s.id === currentId);
                                        if (!seg) return;

                                        setPlayingSegmentId(currentId);

                                        // Auto-generate if missing
                                        if (!seg.audio_file_path || seg.audio_status !== 'done') {
                                            if (seg.audio_status !== 'processing') {
                                                await handleGenerate([currentId]);
                                            }
                                            // Wait for it? For now, we'll try to wait or notify
                                            // Ideally we'd poll or wait for WebSocket
                                            // For this iteration, let's just skip or show "waiting"
                                            // User said: "generating if it is not generated, and automatically moving to the next"
                                            // Let's implement a simple poll/retry for auto-gen
                                            let attempts = 0;
                                            const pollForAudio = setInterval(async () => {
                                                attempts++;
                                                const updated = await api.fetchSegments(chapterId);
                                                setSegments(updated);
                                                const refreshedSeg = updated.find((s: any) => s.id === currentId);
                                                if (refreshedSeg?.audio_file_path && refreshedSeg.audio_status === 'done') {
                                                    clearInterval(pollForAudio);
                                                    setGeneratingSegmentIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(currentId);
                                                        return next;
                                                    });
                                                    startAudio(refreshedSeg, idx);
                                                } else if (attempts > 30) { // 30 sec timeout
                                                    clearInterval(pollForAudio);
                                                    setGeneratingSegmentIds(prev => {
                                                        const next = new Set(prev);
                                                        next.delete(currentId);
                                                        return next;
                                                    });
                                                    playFromIndex(idx + 1); // Skip if failed
                                                }
                                            }, 1000);
                                            return;
                                        }

                                        startAudio(seg, idx);
                                    };

                                    const startAudio = (seg: ChapterSegment, idx: number) => {
                                        const url = projectId 
                                            ? `/projects/${projectId}/audio/${seg.audio_file_path}`
                                            : `/out/xtts/${seg.audio_file_path}`;
                                        const audio = new Audio(url);
                                        audio.onended = () => playFromIndex(idx + 1);
                                        audio.onerror = () => playFromIndex(idx + 1);
                                        audio.play().catch(e => {
                                            console.error("Playback failed", e);
                                            playFromIndex(idx + 1);
                                        });
                                        audioPlayerRef.current = audio;
                                    };

                                    await playFromIndex(currentIndex);
                                };

                                const allSegmentIds = segments.map(s => s.id);

                                return groups.map((group, gidx) => {
                                    const char = characters.find(c => c.id === group.characterId);
                                    const allDone = group.segments.every(s => s.audio_status === 'done');
                                    const anyProcessing = group.segments.some(s => s.audio_status === 'processing' || generatingSegmentIds.has(s.id));
                                    
                                    return (
                                        <div key={gidx} style={{ 
                                            display: 'flex', gap: '1.5rem', 
                                            background: 'var(--surface)', padding: '1.25rem', 
                                            borderRadius: '16px', border: '1px solid var(--border)',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                            borderLeft: `4px solid ${char?.color || 'var(--text-muted)'}`
                                        }}>
                                            <div style={{ width: '130px', flexShrink: 0 }}>
                                                <div style={{ 
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                                    color: char?.color || 'var(--text-muted)', 
                                                    fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
                                                    marginBottom: '0.75rem', letterSpacing: '0.05em'
                                                }}>
                                                    {char?.name || 'Narrator'}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                    {playingSegmentId && group.segments.some(s => s.id === playingSegmentId) ? (
                                                        <button 
                                                            onClick={stopPlayback} 
                                                            className="btn-primary" 
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', fontSize: '0.8rem', padding: '0.5rem' }}
                                                        >
                                                            <Zap size={14} fill="currentColor" /> Stop
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => playSegment(group.segments[0].id, allSegmentIds)} 
                                                            className="btn-ghost" 
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)' }}
                                                        >
                                                            <Volume2 size={14} /> Listen
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleGenerate(group.segments.map(s => s.id))}
                                                        className="btn-ghost" 
                                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)' }}
                                                        disabled={anyProcessing}
                                                    >
                                                        <RefreshCw size={14} className={anyProcessing ? 'animate-spin' : ''} /> 
                                                        {anyProcessing ? 'Generating...' : (allDone ? 'Regenerate' : 'Generate')}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '1.05rem', marginTop: '0.2rem' }}>
                                                {group.segments.map(s => {
                                                    const isPlaying = playingSegmentId === s.id;
                                                    const isGenerating = generatingSegmentIds.has(s.id) || s.audio_status === 'processing';
                                                    const hasAudio = s.audio_file_path && s.audio_status === 'done';
                                                    
                                                    return (
                                                        <span 
                                                            key={s.id} 
                                                            onClick={() => playSegment(s.id, allSegmentIds)}
                                                            style={{ 
                                                                background: isPlaying ? `${char?.color || '#ffffff'}44` : 'transparent',
                                                                borderRadius: '6px', padding: '2px 4px', margin: '0 -2px',
                                                                transition: 'all 0.3s ease',
                                                                color: isPlaying ? 'var(--text-primary)' : (hasAudio ? 'var(--text-secondary)' : 'var(--text-muted)'),
                                                                cursor: 'pointer',
                                                                position: 'relative',
                                                                display: 'inline-block',
                                                                borderBottom: isGenerating ? `1px dashed ${char?.color || 'var(--accent)'}` : 'none'
                                                            }}
                                                            title={hasAudio ? 'Click to play' : (isGenerating ? 'Generating audio...' : 'Needs generation (click to play/auto-gen)')}
                                                        >
                                                            {s.text_content}{' '}
                                                            {isGenerating && (
                                                                <RefreshCw size={10} className="animate-spin" style={{ marginLeft: '4px', verticalAlign: 'middle', opacity: 0.6 }} />
                                                            )}
                                                            {!hasAudio && !isGenerating && (
                                                                <div style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)', marginLeft: '4px', verticalAlign: 'middle' }} />
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                        <div style={{ height: '2rem', flexShrink: 0 }} /> {/* Bottom padding */}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', padding: '1rem', gap: '1rem' }}>
            {/* Main Production View (Movie Sheet) */}
            <div style={{ 
              flex: 1, 
              background: 'var(--bg)', 
              border: '1px solid var(--border)', 
              borderRadius: '12px', 
              padding: '2rem', 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              {segments.map((seg) => {
                const char = characters.find(c => c.id === seg.character_id);
                const isSelectedCharLines = selectedCharacterId && seg.character_id === selectedCharacterId;
                const isHovered = hoveredSegmentId === seg.id;
                
                return (
                  <div 
                    key={seg.id}
                    onMouseEnter={() => setHoveredSegmentId(seg.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                    onClick={() => {
                        if (selectedCharacterId) {
                            handleBulkAssign(seg.id);
                        } else {
                            setActiveSegmentId(seg.id === activeSegmentId ? null : seg.id);
                        }
                    }}
                    style={{ 
                      display: 'flex',
                      padding: '0.5rem 1rem',
                      borderRadius: '4px',
                      background: isSelectedCharLines ? `${char?.color || '#8b5cf6'}10` : (isHovered ? 'var(--surface-light)' : 'transparent'),
                      borderLeft: `4px solid ${char ? char.color : 'transparent'}`,
                      cursor: selectedCharacterId ? 'copy' : 'pointer',
                      transition: 'all 0.1s ease',
                      gap: '2rem'
                    }}
                  >
                    {/* Character/Voice column */}
                    <div style={{ 
                        width: '140px', 
                        flexShrink: 0, 
                        fontSize: '0.8rem', 
                        fontWeight: 700,
                        color: char ? char.color : 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {char?.name || 'NARRATOR'}
                        <span style={{ fontSize: '0.65rem', fontWeight: 400, opacity: 0.6 }}>
                            {char?.speaker_profile_name || 'Chapter Default'}
                        </span>
                    </div>

                    {/* Text column */}
                    <div style={{ flex: 1 }}>
                        <p style={{ 
                            fontSize: '1rem', 
                            color: 'var(--text-primary)', 
                            margin: 0, 
                            lineHeight: 1.6,
                            opacity: (selectedCharacterId && !isSelectedCharLines) ? 0.5 : 1
                        }}>
                            {seg.text_content}
                        </p>
                    </div>

                    {/* Quick status/actions */}
                    <div style={{ width: '80px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {seg.audio_status === 'done' && (
                            <div title="Audio Generated" style={{ color: 'var(--success-muted)' }}>
                                <CheckCircle size={14} />
                            </div>
                        )}
                        {activeSegmentId === seg.id && !selectedCharacterId && (
                           <div style={{ display: 'flex', gap: '4px' }}>
                               <button 
                                 className="btn-ghost" 
                                 style={{ padding: '2px 4px', fontSize: '0.7rem' }}
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     handleAssignCharacter(seg.id, null);
                                 }}
                               >
                                   Reset
                               </button>
                           </div>
                        )}
                    </div>
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

            {/* Right Sidebar: Characters */}
            <div style={{ 
              width: '320px', 
              marginLeft: '1rem',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem' 
            }}>
                <div className="glass-panel" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        <User size={16} />
                        Characters
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                        <button 
                            onClick={() => setSelectedCharacterId(null)}
                            style={{ 
                                padding: '0.75rem', 
                                borderRadius: '8px', 
                                border: '1px solid var(--border)',
                                background: selectedCharacterId === null ? 'var(--surface-light)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                color: 'var(--text-primary)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>None / Default</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Stop bulk assignment</div>
                            </div>
                        </button>

                        {characters.map(char => (
                            <div 
                                key={char.id}
                                onClick={() => setSelectedCharacterId(char.id)}
                                style={{ 
                                    padding: '0.75rem', 
                                    borderRadius: '8px', 
                                    border: selectedCharacterId === char.id ? `2px solid ${char.color}` : '1px solid var(--border)',
                                    background: selectedCharacterId === char.id ? `${char.color}15` : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    color: 'var(--text-primary)',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    // Add hover effect since it's now a div
                                    outline: 'none'
                                }}
                                onMouseEnter={(e) => { if (selectedCharacterId !== char.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                onMouseLeave={(e) => { if (selectedCharacterId !== char.id) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <ColorSwatchPicker 
                                    value={char.color || '#8b5cf6'} 
                                    onChange={(color) => handleUpdateCharacterColor(char.id, color)} 
                                    size="sm" 
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{char.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{char.speaker_profile_name || 'No voice'}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Info size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        Select a character to bulk-assign lines by clicking them in the script.
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Chapter Stats</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                         <div style={{ background: 'var(--surface)', padding: '0.5rem', borderRadius: '4px', textAlign: 'center' }}>
                             <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{chapter.word_count}</div>
                             <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>WORDS</div>
                         </div>
                         <div style={{ background: 'var(--surface)', padding: '0.5rem', borderRadius: '4px', textAlign: 'center' }}>
                             <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{segments.length}</div>
                             <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>LINES</div>
                         </div>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>
);
};
