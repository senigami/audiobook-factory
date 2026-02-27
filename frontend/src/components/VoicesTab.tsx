import React, { useState, useEffect, useRef } from 'react';
import { User, Plus, Music, Trash2, Play, Loader2, Check, Info, RefreshCw, FileEdit, X, RotateCcw, Star, ChevronDown, ChevronUp, Sliders, Volume2, Settings2, Pause, Upload } from 'lucide-react';
import { PredictiveProgressBar } from './PredictiveProgressBar';
import { VoiceDropzone } from './VoiceDropzone';
import { RecordingGuide } from './RecordingGuide';
import { ActionMenu } from './ActionMenu';
import { motion, AnimatePresence } from 'framer-motion';

interface SpeakerProfile {
    name: string;
    wav_count: number;
    samples?: string[];
    speed: number;
    is_default: boolean;
    test_text?: string;
    preview_url: string | null;
}

interface SpeakerCardProps {
    profile: SpeakerProfile;
    isTesting: boolean;
    testStatus?: any;
    onTest: (name: string) => void;
    onDelete: (name: string) => void;
    onSetDefault: (name: string) => void;
    onRefresh: () => void;
    onEditTestText: (profile: SpeakerProfile) => void;
}

const SpeakerCard: React.FC<SpeakerCardProps> = ({ profile, isTesting, onTest, onDelete, onSetDefault, onRefresh, onEditTestText, testStatus }) => {
    const [localSpeed, setLocalSpeed] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [cacheBuster, setCacheBuster] = useState(Date.now());
    const [isExpanded, setIsExpanded] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false); // Local UI state for now
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const speed = localSpeed ?? profile.speed;

    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (profile.preview_url) {
            setCacheBuster(Date.now());
        }
    }, [profile.preview_url, isTesting]);

    const uploadFiles = async (files: FileList | File[]) => {
        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('files', f));
        try {
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(profile.name)}/samples`, {
                method: 'POST',
                body: formData
            });
            if (resp.ok) onRefresh();
        } catch (err) {
            console.error('Failed to add samples', err);
        }
    };

    const handlePlayClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!profile.preview_url) {
            onTest(profile.name);
            return;
        }

        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    const handleSpeedChange = async (val: number) => {
        setIsSaving(true);
        try {
            const formData = new URLSearchParams();
            formData.append('speed', val.toString());
            await fetch(`/api/speaker-profiles/${encodeURIComponent(profile.name)}/speed`, {
                method: 'POST',
                body: formData
            });
            onRefresh();
        } catch (e) {
            console.error('Failed to update profile speed', e);
        } finally {
            setIsSaving(false);
            setLocalSpeed(null);
        }
    };

    const menuItems = [
        { label: 'Rename', icon: FileEdit, onClick: () => onEditTestText(profile) },
        { label: 'Manage Samples', icon: Settings2, onClick: () => setIsExpanded(true) },
        { label: 'Set as Default', icon: Check, onClick: () => onSetDefault(profile.name) },
        { isDivider: true, label: '', onClick: () => {} },
        { label: 'Delete Profile', icon: Trash2, onClick: () => onDelete(profile.name), isDestructive: true }
    ];

    return (
        <div className="glass-panel animate-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Audio element for the icon button */}
            {profile.preview_url && (
                <audio 
                    ref={audioRef}
                    src={`${profile.preview_url}?t=${cacheBuster}`}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                />
            )}

            {/* Header / Collapsed View */}
            <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                        onClick={handlePlayClick}
                        className="btn-primary"
                        title={profile.preview_url ? (isPlaying ? "Pause Sample" : "Play Sample") : "Generate Sample"}
                        style={{ 
                            width: '40px', 
                            height: '40px', 
                            padding: 0,
                            borderRadius: '12px',
                            flexShrink: 0,
                            background: isPlaying ? 'var(--accent-active)' : 'var(--accent)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {isTesting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : isPlaying ? (
                            <Pause size={18} fill="currentColor" />
                        ) : (
                            <Play size={18} fill="currentColor" />
                        )}
                        {isPlaying && (
                            <motion.div
                                layoutId="playing-pulse"
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    border: '2px solid white',
                                    borderRadius: '12px',
                                    opacity: 0.5
                                }}
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        )}
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontWeight: 600, fontSize: '1rem' }}>{profile.name}</h4>
                            {profile.is_default && (
                                <span style={{ 
                                    fontSize: '0.65rem', 
                                    padding: '2px 6px', 
                                    background: 'var(--success-text)', 
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>Default</span>
                            )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{profile.wav_count} samples</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setIsFavorite(!isFavorite)}
                        className="btn-ghost"
                        style={{ padding: '8px', color: isFavorite ? 'var(--warning)' : 'var(--text-muted)' }}
                        title="Favorite"
                    >
                        <Star size={18} fill={isFavorite ? 'var(--warning)' : 'none'} />
                    </button>
                    
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="btn-ghost"
                        style={{ padding: '8px' }}
                        title={isExpanded ? "Show less" : "Show more"}
                    >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    <ActionMenu items={menuItems} />
                </div>
            </div>

            {/* Testing State in Header? No, keep it below header if testing */}
            {isTesting && (
                <div style={{ padding: '0 1.25rem 1.25rem' }}>
                    <PredictiveProgressBar
                        progress={testStatus?.progress || 0}
                        startedAt={testStatus?.started_at}
                        etaSeconds={25}
                        label="Generating Preview..."
                    />
                </div>
            )}

            {/* Expansion Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', borderTop: '1px solid var(--border)', background: 'var(--surface-light)' }}
                    >
                        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Sample List - As per original instructions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                                        <Music size={14} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Voice Samples
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => document.getElementById(`add-samples-${profile.name}`)?.click()}
                                        className="btn-ghost"
                                        style={{ fontSize: '0.7rem', padding: '4px 8px', height: 'auto', gap: '4px', color: 'var(--accent)' }}
                                    >
                                        <Plus size={12} />
                                        Add Samples
                                    </button>
                                    <input 
                                        type="file" 
                                        id={`add-samples-${profile.name}`}
                                        multiple 
                                        accept=".wav"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            if (!e.target.files?.length) return;
                                            uploadFiles(e.target.files);
                                        }}
                                    />
                                </div>
                                <div 
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setIsDragging(true);
                                    }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDragging(false);
                                        if (e.dataTransfer.files?.length) {
                                            uploadFiles(e.dataTransfer.files);
                                        }
                                    }}
                                    style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        gap: '2px',
                                        background: isDragging ? 'var(--accent-glow)' : 'var(--surface)',
                                        padding: '6px',
                                        borderRadius: '10px',
                                        border: isDragging ? '2px dashed var(--accent)' : '1px solid var(--border)',
                                        maxHeight: '160px',
                                        overflowY: 'auto',
                                        transition: 'all 0.2s ease',
                                        position: 'relative'
                                    }}
                                >
                                    {isDragging && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(var(--accent-rgb), 0.1)',
                                            backdropFilter: 'blur(2px)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            zIndex: 10,
                                            pointerEvents: 'none'
                                        }}>
                                            <Upload size={24} color="var(--accent)" />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>Drop to Add Samples</span>
                                        </div>
                                    )}

                                    {profile.samples && profile.samples.length > 0 ? (
                                        <>
                                            {profile.samples.map((s, idx) => (
                                                <div key={idx} className="sample-row" style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between',
                                                    fontSize: '0.8rem',
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                    transition: 'background 0.2s'
                                                }}>
                                                    <span style={{ color: 'var(--text-primary)', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                        {s}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>WAV</span>
                                                        <button 
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!confirm(`Remove sample "${s}"?`)) return;
                                                                try {
                                                                    const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(profile.name)}/samples/${encodeURIComponent(s)}`, {
                                                                        method: 'DELETE'
                                                                    });
                                                                    if (resp.ok) onRefresh();
                                                                } catch (err) {
                                                                    console.error('Failed to remove sample', err);
                                                                }
                                                            }}
                                                            className="btn-ghost"
                                                            style={{ padding: '4px', height: 'auto', color: 'var(--error)', opacity: 0.6 }}
                                                            title="Remove Sample"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ 
                                                marginTop: '4px', 
                                                padding: '8px', 
                                                textAlign: 'center', 
                                                borderTop: '1px solid var(--border-light)',
                                                fontSize: '0.65rem',
                                                color: 'var(--text-muted)',
                                                fontStyle: 'italic',
                                                opacity: 0.6
                                            }}>
                                                Drop more .wav files here to update profile
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ 
                                                width: '40px', 
                                                height: '40px', 
                                                borderRadius: '50%', 
                                                background: 'var(--surface-alt)', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                border: '1px dashed var(--border)'
                                            }}>
                                                <Upload size={18} style={{ opacity: 0.3 }} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                    No samples found
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    Drop samples here or use Add Samples
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Settings / Speed */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                                        <Sliders size={14} />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Playback Control
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                                        {speed.toFixed(2)}x
                                    </span>
                                </div>
                                <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.05"
                                        value={speed}
                                        onChange={(e) => setLocalSpeed(parseFloat(e.target.value))}
                                        onMouseUp={() => handleSpeedChange(speed)}
                                        style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
                                        disabled={isSaving}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Slower</span>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Faster</span>
                                    </div>
                                </div>
                            </div>

                            {/* Advanced / Preview Audio */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                                    <Volume2 size={14} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Preview Management
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        onClick={() => onEditTestText(profile)}
                                        className="btn-glass"
                                        style={{ flex: 1, height: '36px', gap: '8px', fontSize: '0.8rem' }}
                                    >
                                        <FileEdit size={14} />
                                        Edit Script
                                    </button>
                                    <button
                                        onClick={() => onTest(profile.name)}
                                        className="btn-ghost"
                                        disabled={isTesting}
                                        style={{ height: '36px', width: '36px', padding: '0', background: 'var(--surface)', border: '1px solid var(--border)' }}
                                        title="Regenerate Preview"
                                    >
                                        <RefreshCw size={14} className={isTesting ? "animate-spin" : ""} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface VoicesTabProps {
    onRefresh: () => void;
    speakerProfiles: SpeakerProfile[];
    testProgress: Record<string, { progress: number; started_at?: number }>;
}

export const VoicesTab: React.FC<VoicesTabProps> = ({ onRefresh, speakerProfiles, testProgress }) => {
    const [newName, setNewName] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isBuilding, setIsBuilding] = useState(false);
    const [testingProfile, setTestingProfile] = useState<string | null>(null);
    const [editingProfile, setEditingProfile] = useState<SpeakerProfile | null>(null);
    const [testText, setTestText] = useState('');
    const [editedName, setEditedName] = useState('');
    const [isSavingText, setIsSavingText] = useState(false);
    const [showGuide, setShowGuide] = useState(false);

    const handleSaveTestText = async () => {
        if (!editingProfile) return;
        setIsSavingText(true);
        try {
            // 1. Handle Rename if needed
            let currentName = editingProfile.name;
            if (editedName.trim() && editedName.trim() !== editingProfile.name) {
                const renameData = new URLSearchParams();
                renameData.append('new_name', editedName.trim());
                const renameResp = await fetch(`/api/speaker-profiles/${encodeURIComponent(editingProfile.name)}/rename`, {
                    method: 'POST',
                    body: renameData
                });
                if (!renameResp.ok) {
                    const error = await renameResp.json();
                    alert(`Rename failed: ${error.message}`);
                    setIsSavingText(false);
                    return;
                }
                currentName = editedName.trim();
            }

            // 2. Handle Text Update
            const formData = new URLSearchParams();
            formData.append('text', testText);
            await fetch(`/api/speaker-profiles/${encodeURIComponent(currentName)}/test-text`, {
                method: 'POST',
                body: formData
            });
            onRefresh();
            setEditingProfile(null);
        } catch (e) {
            console.error('Failed to save profile', e);
        } finally {
            setIsSavingText(false);
        }
    };

    const handleResetTestText = async () => {
        if (!editingProfile) return;
        setIsSavingText(true);
        try {
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(editingProfile.name)}/reset-test-text`, {
                method: 'POST'
            });
            const result = await resp.json();
            if (result.status === 'success') {
                setTestText(result.test_text);
                onRefresh();
            }
        } catch (e) {
            console.error('Failed to reset test text', e);
        } finally {
            setIsSavingText(false);
        }
    };

    const handleBuild = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || files.length === 0) return;

        setIsBuilding(true);
        const formData = new FormData();
        formData.append('name', newName);
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        try {
            const resp = await fetch('/api/speaker-profiles/build', {
                method: 'POST',
                body: formData,
            });
            if (resp.ok) {
                setNewName('');
                setFiles([]);
                onRefresh();
            } else {
                const errorData = await resp.json();
                alert(`Build failed: ${errorData.message}`);
            }
        } catch (err) {
            console.error('Failed to build profile', err);
        } finally {
            setIsBuilding(false);
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Delete speaker profile "${name}"?`)) return;
        try {
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(name)}`, {
                method: 'DELETE',
            });
            if (resp.ok) onRefresh();
        } catch (err) {
            console.error('Failed to delete profile', err);
        }
    };

    const handleTest = async (name: string) => {
        setTestingProfile(name);
        try {
            const resp = await fetch('/api/speaker-profiles/test', {
                method: 'POST',
                body: new URLSearchParams({ name }),
            });
            const result = await resp.json();
            if (result.status === 'success') {
                onRefresh();
            } else {
                alert(result.message);
            }
        } catch (err) {
            console.error('Test failed', err);
        } finally {
            setTestingProfile(null);
        }
    };

    const handleSetDefault = async (name: string) => {
        try {
            const formData = new URLSearchParams();
            formData.append('name', name);
            await fetch('/api/settings/default-speaker', {
                method: 'POST',
                body: formData
            });
            onRefresh();
        } catch (err) {
            console.error('Failed to set default speaker', err);
        }
    };

    return (
        <div className="tab-content animate-in">
            <div className="responsive-grid">
                <section className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div className="icon-circle" style={{ width: '40px', height: '40px', background: 'var(--accent-glow)' }}>
                            <Plus size={20} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Build Voice Profile</h3>
                    </div>
                    
                    <form onSubmit={handleBuild} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="input-group">
                            <label>Narrator Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Victorian Gentleman"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                disabled={isBuilding}
                                required
                            />
                        </div>

                        <VoiceDropzone onFilesChange={setFiles} />

                        <div style={{
                            background: 'var(--surface-alt)',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
                                    <Info size={14} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Voice Optimization</span>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setShowGuide(!showGuide)}
                                    className="btn-ghost" 
                                    style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto' }}
                                >
                                    {showGuide ? 'Hide Guide' : 'View Recording Guide'}
                                </button>
                            </div>

                            <AnimatePresence>
                                {showGuide && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                            <RecordingGuide />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            
                            {!showGuide && (
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Ideal sample length is 6 to 10 seconds.
                                    </li>
                                    <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Use 3 to 5 clean samples for best results.
                                    </li>
                                </ul>
                            )}
                        </div>

                        <button type="submit" className="btn-primary" style={{ height: '48px', fontSize: '1rem' }} disabled={isBuilding || !newName || files.length === 0}>
                            {isBuilding ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                            {isBuilding ? 'Building Voice...' : 'Build Voice'}
                        </button>
                    </form>
                </section>

                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div className="icon-circle" style={{ width: '40px', height: '40px' }}>
                            <User size={20} color="var(--accent)" />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Available Narrators</h3>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                        {speakerProfiles.length === 0 && (
                            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                                <Music size={48} color="var(--text-muted)" style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
                                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                                    No narrators found. Create one to begin.
                                </p>
                            </div>
                        )}
                        {speakerProfiles.map((p) => (
                            <SpeakerCard
                                key={p.name}
                                profile={p}
                                isTesting={testingProfile === p.name}
                                testStatus={testProgress[p.name]}
                                onTest={handleTest}
                                onDelete={handleDelete}
                                onSetDefault={handleSetDefault}
                                onRefresh={onRefresh}
                                onEditTestText={(profile) => {
                                    setEditingProfile(profile);
                                    setTestText(profile.test_text || '');
                                    setEditedName(profile.name);
                                }}
                            />
                        ))}
                    </div>
                </section>
            </div>

            {editingProfile && (
                <div className="overlay-blur" onClick={() => setEditingProfile(null)}>
                    <div className="popover-panel animate-in" style={{
                        width: '90%',
                        maxWidth: '600px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <FileEdit color="var(--accent)" size={20} />
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit Narrator: {editingProfile.name}</h3>
                            </div>
                            <button onClick={() => setEditingProfile(null)} className="btn-ghost" style={{ padding: '8px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="input-group">
                            <label>Narrator Name</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    placeholder="Enter narrator name..."
                                    style={{
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        background: 'var(--surface-light)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        flex: 1,
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                {editedName.trim() !== editingProfile.name && editedName.trim() !== '' && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        Name changed
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="input-group">
                            <label style={{ color: 'var(--text-muted)' }}>The narrative text used for voice previews</label>
                            <textarea
                                value={testText}
                                onChange={(e) => setTestText(e.target.value)}
                                style={{ minHeight: '150px', lineHeight: '1.5', resize: 'vertical' }}
                                placeholder="Enter preview text..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={handleResetTestText}
                                className="btn-ghost"
                                disabled={isSavingText}
                                style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <RotateCcw size={14} /> Reset Narrative
                            </button>
                            <button onClick={() => setEditingProfile(null)} className="btn-ghost" disabled={isSavingText}>Cancel</button>
                            <button
                                onClick={handleSaveTestText}
                                className="btn-primary"
                                disabled={isSavingText || !editedName.trim()}
                            >
                                {isSavingText ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                {isSavingText ? 'Saving Changes...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
