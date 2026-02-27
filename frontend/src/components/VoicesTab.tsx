import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Plus, Music, Trash2, Play, Loader2, Check, Info, RefreshCw, FileEdit, X, RotateCcw, ChevronUp, Sliders, Volume2, Settings2, Pause, Upload, AlertTriangle } from 'lucide-react';
import { PredictiveProgressBar } from './PredictiveProgressBar';
import { VoiceDropzone } from './VoiceDropzone';
import { RecordingGuide } from './RecordingGuide';
import { ActionMenu } from './ActionMenu';
import { ConfirmModal } from './ConfirmModal';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

// --- Components ---

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
    const [width, setWidth] = useState(450);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 380 && newWidth <= window.innerWidth * 0.9) {
                setWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(15, 23, 42, 0.4)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 2000
                        }}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: `${width}px`,
                            maxWidth: '95vw',
                            background: 'var(--surface)',
                            boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
                            zIndex: 2001,
                            display: 'flex',
                            flexDirection: 'column',
                            borderLeft: '1px solid var(--border)',
                            userSelect: isResizing ? 'none' : 'auto'
                        }}
                    >
                        {/* Resize Handle */}
                        <div
                            onMouseDown={startResizing}
                            className="resize-handle"
                            style={{
                                position: 'absolute',
                                left: -6,
                                top: 0,
                                bottom: 0,
                                width: '12px',
                                cursor: 'ew-resize',
                                zIndex: 2002,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                padding: '8px 2px',
                                background: isResizing ? 'var(--accent)' : 'var(--surface-alt)',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                boxShadow: isResizing ? '0 0 10px var(--accent-glow)' : '0 2px 4px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s ease',
                                opacity: isResizing ? 1 : 0.8
                            }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        width: '2px',
                                        height: '2px',
                                        borderRadius: '50%',
                                        background: isResizing ? 'white' : 'var(--text-muted)'
                                    }} />
                                ))}
                            </div>
                        </div>

                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--surface-light)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="icon-circle" style={{ width: '32px', height: '32px' }}>
                                    <FileEdit size={16} />
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</h3>
                            </div>
                            <button onClick={onClose} className="btn-ghost" style={{ padding: '8px' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};

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
    onBuildNow: (name: string, files: File[]) => void;
    requestConfirm: (config: { title: string; message: string; onConfirm: () => void; isDestructive?: boolean }) => void;
}

const SpeakerCard: React.FC<SpeakerCardProps> = ({ profile, isTesting, onTest, onDelete, onSetDefault, onRefresh, onEditTestText, onBuildNow, requestConfirm, testStatus }) => {
    const [localSpeed, setLocalSpeed] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [cacheBuster, setCacheBuster] = useState(Date.now());
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isRebuildRequired, setIsRebuildRequired] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const speed = localSpeed ?? profile.speed;

    const [isDragging, setIsDragging] = useState(false);
    const [pendingSamples, setPendingSamples] = useState<File[]>([]);

    useEffect(() => {
        if (profile.preview_url) {
            setCacheBuster(Date.now());
        }
    }, [profile.preview_url, isTesting]);

    const uploadFiles = async (files: FileList | File[]) => {
        const fileList = Array.from(files);
        setPendingSamples(prev => [...prev, ...fileList]);
        setIsRebuildRequired(true);
        setIsExpanded(true); // Open to show samples
    };

    const handleRebuild = async () => {
        if (pendingSamples.length > 0) {
            onBuildNow(profile.name, pendingSamples);
            setPendingSamples([]);
            setIsRebuildRequired(false);
        } else {
            // Just trigger a re-build via API if no new files? 
            // The API needs samples. For now, we only rebuild if we added something 
            // OR if we just want to re-process existing ones? 
            // In the real app, we usually just re-run the build API.
            onBuildNow(profile.name, []);
            setIsRebuildRequired(false);
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
        { label: 'Edit Script', icon: FileEdit, onClick: () => onEditTestText(profile) },
        { label: 'Manage Samples', icon: Settings2, onClick: () => setIsExpanded(true) },
        { label: 'Set as Default', icon: Check, onClick: () => onSetDefault(profile.name) },
        { isDivider: true, label: '', onClick: () => {} },
        { label: 'Rebuild Voice', icon: RefreshCw, onClick: handleRebuild },
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
                                    background: 'var(--accent)', 
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>Default</span>
                            )}
                            {isRebuildRequired && (
                                <span style={{ 
                                    fontSize: '0.65rem', 
                                    padding: '2px 6px', 
                                    background: 'var(--warning-text)', 
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <AlertTriangle size={10} />
                                    REBUILD REQUIRED
                                </span>
                            )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{profile.wav_count + pendingSamples.length} samples</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {isRebuildRequired && (
                                            <button 
                                                onClick={handleRebuild}
                                                className="btn-primary"
                                                style={{ fontSize: '0.7rem', padding: '4px 10px', height: 'auto', gap: '4px' }}
                                            >
                                                <RefreshCw size={12} />
                                                Rebuild Now
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => document.getElementById(`add-samples-${profile.name}`)?.click()}
                                            className="btn-ghost"
                                            style={{ fontSize: '0.7rem', padding: '4px 8px', height: 'auto', gap: '4px', color: 'var(--accent)' }}
                                        >
                                            <Plus size={12} />
                                            Add Samples
                                        </button>
                                    </div>
                                    <input 
                                        type="file" 
                                        id={`add-samples-${profile.name}`}
                                        multiple 
                                        accept=".wav,.mp3,.m4a,.ogg,.flac,.aac"
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
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            requestConfirm({
                                                                title: 'Remove Sample',
                                                                message: `Are you sure you want to remove "${s}"? A voice rebuild will be required to apply this change.`,
                                                                isDestructive: true,
                                                                onConfirm: async () => {
                                                                    try {
                                                                        const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(profile.name)}/samples/${encodeURIComponent(s)}`, {
                                                                            method: 'DELETE'
                                                                        });
                                                                        if (resp.ok) {
                                                                            onRefresh();
                                                                            setIsRebuildRequired(true);
                                                                        }
                                                                    } catch (err) {
                                                                        console.error('Failed to remove sample', err);
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="sample-remove-btn"
                                                        style={{ padding: '4px', height: 'auto' }}
                                                        title="Remove Sample"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {/* Pending Samples */}
                                            {pendingSamples.map((file, pIdx) => (
                                                <div key={`pending-${pIdx}`} className="sample-row" style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between',
                                                    fontSize: '0.8rem',
                                                    padding: '6px 10px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(var(--accent-rgb), 0.05)',
                                                    border: '1px dashed var(--accent-glow)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                                                        <span style={{ color: 'var(--accent)', fontSize: '0.65rem', fontWeight: 700 }}>NEW</span>
                                                        <span style={{ color: 'var(--text-primary)', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => setPendingSamples(prev => prev.filter((_, i) => i !== pIdx))}
                                                        className="sample-remove-btn"
                                                        style={{ padding: '4px', height: 'auto' }}
                                                        title="Remove pending sample"
                                                    >
                                                        <X size={12} />
                                                    </button>
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
                                                Drop more .wav files here to update profile. Rebuild required to apply changes.
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
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="btn-ghost"
                                style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.75rem', padding: '8px' }}
                            >
                                <ChevronUp size={14} />
                                Collapse
                            </button>
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
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ 
        title: string; 
        message: string; 
        onConfirm: () => void; 
        isDestructive?: boolean 
    } | null>(null);

    const handleBuildNow = useCallback(async (name: string, newFiles: File[]) => {
        setIsBuilding(true);
        const formData = new FormData();
        formData.append('name', name);
        newFiles.forEach(f => formData.append('files', f));
        
        try {
            const resp = await fetch('/api/speaker-profiles/build', {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                onRefresh();
            } else {
                const err = await resp.json();
                alert(`Rebuild failed: ${err.message}`);
            }
        } catch (e) {
            console.error('Rebuild failed', e);
        } finally {
            setIsBuilding(false);
        }
    }, [onRefresh]);

    const handleRequestConfirm = (config: { title: string; message: string; onConfirm: () => void; isDestructive?: boolean }) => {
        setConfirmConfig(config);
    };

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
                const result = await resp.json();
                setNewName('');
                setFiles([]);
                if (result.errors && result.errors.length > 0) {
                    alert(`Profile built with ${result.total_files} samples.\n\nNote: Some files were skipped or failed conversion:\n- ${result.errors.join('\n- ')}`);
                }
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
        handleRequestConfirm({
            title: 'Delete Narrator',
            message: `Are you sure you want to delete the narrator "${name}"? This will permanently remove all associated voice samples and previews.`,
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(name)}`, {
                        method: 'DELETE',
                    });
                    if (resp.ok) onRefresh();
                } catch (err) {
                    console.error('Failed to delete profile', err);
                }
            }
        });
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
                <section className="glass-panel" style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    height: 'calc(100vh - 120px)',
                    position: 'sticky',
                    top: '20px'
                }}>
                    <div style={{ padding: '1.5rem 2rem 1rem 2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                            <div className="icon-circle" style={{ width: '40px', height: '40px', background: 'var(--accent-glow)' }}>
                                <Plus size={20} color="var(--accent)" />
                            </div>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Build Voice Profile</h3>
                        </div>
                    </div>
                    
                    <form onSubmit={handleBuild} style={{ 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        overflow: 'hidden' 
                    }}>
                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            padding: '0 2rem 1rem 2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.5rem'
                        }}>
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
                                        onClick={() => setShowGuide(true)}
                                        style={{ 
                                            fontSize: '0.75rem', 
                                            padding: '6px 14px', 
                                            height: 'auto',
                                            background: 'var(--accent)',
                                            color: 'white',
                                            borderRadius: '99px',
                                            fontWeight: 700,
                                            boxShadow: '0 2px 8px var(--accent-glow)'
                                        }}
                                    >
                                        Recording Guide
                                    </button>
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Ideal length is 6–10 seconds per clip.
                                    </li>
                                    <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Use 3–5 clean samples for best results.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div style={{ 
                            padding: '1.5rem 2rem', 
                            background: 'var(--surface-light)',
                            borderTop: '1px solid var(--border)',
                            zIndex: 10
                        }}>
                            <button 
                                type="submit" 
                                className={(!newName || files.length === 0) ? "btn-ghost" : "btn-primary"}
                                style={{ 
                                    height: '48px', 
                                    width: '100%',
                                    fontSize: '1rem',
                                    boxShadow: (!newName || files.length === 0) ? 'none' : '0 4px 12px var(--accent-glow)',
                                    opacity: (!newName || files.length === 0) ? 0.6 : 1
                                }} 
                                disabled={isBuilding || !newName || files.length === 0}
                            >
                                {isBuilding ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                {isBuilding ? 'Building Voice...' : 'Build Voice'}
                            </button>
                        </div>
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
                                onBuildNow={handleBuildNow}
                                onEditTestText={(profile) => {
                                    setEditingProfile(profile);
                                    setTestText(profile.test_text || '');
                                    setEditedName(profile.name);
                                }}
                                requestConfirm={handleRequestConfirm}
                            />
                        ))}
                    </div>
                </section>
            </div>

            <Drawer
                isOpen={!!editingProfile}
                onClose={() => setEditingProfile(null)}
                title={`Configure Narrator: ${editingProfile?.name}`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="input-group">
                        <label>Narrator Name</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                placeholder="Enter narrator name..."
                                disabled={isSavingText}
                                style={{
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    background: 'var(--surface-light)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    flex: 1,
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                        {editedName.trim() !== editingProfile?.name && editedName.trim() !== '' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                                Profile will be renamed on save
                            </span>
                        )}
                    </div>

                    <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label>Preview Narrative Script</label>
                            <button
                                onClick={handleResetTestText}
                                className="btn-ghost"
                                disabled={isSavingText}
                                style={{ height: 'auto', padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
                            >
                                <RotateCcw size={12} /> Reset to Default
                            </button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-8px' }}>
                            The text used when generating voice previews.
                        </p>
                        <textarea
                            value={testText}
                            onChange={(e) => setTestText(e.target.value)}
                            style={{ minHeight: '180px', lineHeight: '1.6', resize: 'vertical', fontSize: '0.9rem' }}
                            placeholder="Enter preview text..."
                            disabled={isSavingText}
                        />
                    </div>

                    <div style={{
                        background: 'var(--as-info-tint)',
                        padding: '1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--accent-glow)',
                        display: 'flex',
                        gap: '12px'
                    }}>
                        <Info size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Generate a preview after saving to audition the voice with these changes.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleSaveTestText}
                                className="btn-primary"
                                disabled={isSavingText || !editedName.trim()}
                                style={{ height: '44px', flex: 1 }}
                            >
                                {isSavingText ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                {isSavingText ? 'Saving...' : 'Save Configuration'}
                            </button>
                            <button
                                onClick={async () => {
                                    if (editingProfile) {
                                        setIsGeneratingPreview(true);
                                        await handleTest(editingProfile.name);
                                        setIsGeneratingPreview(false);
                                    }
                                }}
                                className="btn-glass"
                                disabled={isSavingText || isGeneratingPreview}
                                style={{ height: '44px', padding: '0 12px' }}
                                title="Generate Preview"
                            >
                                <RefreshCw size={18} className={isGeneratingPreview ? "animate-spin" : ""} />
                            </button>
                        </div>
                        <button onClick={() => setEditingProfile(null)} className="btn-ghost" style={{ width: '100%', height: '44px' }}>Cancel</button>
                    </div>
                </div>
            </Drawer>

            <Drawer
                isOpen={showGuide}
                onClose={() => setShowGuide(false)}
                title="Voice Recording Guide"
            >
                <RecordingGuide />
            </Drawer>

            {/* Global Confirm Modal */}
            <ConfirmModal
                isOpen={!!confirmConfig}
                title={confirmConfig?.title || ''}
                message={confirmConfig?.message || ''}
                isDestructive={confirmConfig?.isDestructive}
                onConfirm={() => {
                    confirmConfig?.onConfirm();
                    setConfirmConfig(null);
                }}
                onCancel={() => setConfirmConfig(null)}
            />
        </div>
    );
};
