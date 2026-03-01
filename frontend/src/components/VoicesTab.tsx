import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Plus, Music, Trash2, Play, Loader2, Check, Info, RefreshCw, FileEdit, X, RotateCcw, ChevronUp, Sliders, Volume2, Settings2, Pause, Upload, AlertTriangle, Search } from 'lucide-react';
import { PredictiveProgressBar } from './PredictiveProgressBar';
import { VoiceDropzone } from './VoiceDropzone';
import { RecordingGuide } from './RecordingGuide';
import { ActionMenu } from './ActionMenu';
import SearchableSelect from './SearchableSelect';
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
    speaker_id?: string;
    variant_name?: string;
}

interface Speaker {
    id: string;
    name: string;
    default_profile_name: string | null;
}

interface ProfileDetailsProps {
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
    onAssignToSpeaker: (profile: SpeakerProfile) => void;
    onRemoveFromSpeaker: (name: string) => void;
    onCreateSpeakerFromProfile: (profile: SpeakerProfile) => void;
    speakers: Speaker[];
    isGrouped?: boolean;
    showControlsInline?: boolean;
}

const ProfileDetails: React.FC<ProfileDetailsProps> = ({ 
    profile, isTesting, onTest, onDelete, onSetDefault, onRefresh, 
    onEditTestText, onBuildNow, requestConfirm, testStatus,
    onAssignToSpeaker, onRemoveFromSpeaker, onCreateSpeakerFromProfile, speakers,
    isGrouped = false, showControlsInline = false
}) => {
    const [localSpeed, setLocalSpeed] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [cacheBuster, setCacheBuster] = useState(Date.now());
    const [isExpanded, setIsExpanded] = useState(showControlsInline);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isRebuildRequired, setIsRebuildRequired] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const speed = localSpeed ?? profile.speed;

    const [isDragging, setIsDragging] = useState(false);
    const [pendingSamples, setPendingSamples] = useState<File[]>([]);

    const assignedSpeaker = speakers.find(s => s.id === profile.speaker_id);

    useEffect(() => {
        if (profile.preview_url) {
            setCacheBuster(Date.now());
        }
    }, [profile.preview_url, isTesting]);

    useEffect(() => {
        if (showControlsInline && !isExpanded) setIsExpanded(true);
    }, [showControlsInline]);

    const uploadFiles = async (files: FileList | File[]) => {
        const fileList = Array.from(files);
        setPendingSamples(prev => [...prev, ...fileList]);
        setIsRebuildRequired(true);
        if (!showControlsInline) setIsExpanded(true);
    };

    const handleRebuild = async () => {
        if (pendingSamples.length > 0) {
            onBuildNow(profile.name, pendingSamples);
            setPendingSamples([]);
            setIsRebuildRequired(false);
        } else {
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
        { label: 'Manage Samples', icon: Settings2, onClick: () => setIsExpanded(!isExpanded) },
        { isDivider: true, label: '', onClick: () => {} },
        ...(assignedSpeaker ? [
            { label: 'Move to Speaker...', icon: User, onClick: () => onAssignToSpeaker(profile) },
            { label: 'Unassign from Speaker', icon: Trash2, onClick: () => onRemoveFromSpeaker(profile.name), isDestructive: true }
        ] : [
            { label: 'Assign to Speaker...', icon: User, onClick: () => onAssignToSpeaker(profile) },
            { label: 'Create Speaker from Profile', icon: Plus, onClick: () => onCreateSpeakerFromProfile(profile) }
        ]),
        { label: 'Set as Default', icon: Check, onClick: () => onSetDefault(profile.name) },
        { isDivider: true, label: '', onClick: () => {} },
        { label: 'Rebuild Voice', icon: RefreshCw, onClick: handleRebuild },
        { label: 'Delete Profile', icon: Trash2, onClick: () => onDelete(profile.name), isDestructive: true }
    ];

    const renderControls = () => (
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <Sliders size={14} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Playback Speed
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.05"
                            value={speed}
                            disabled={isSaving}
                            onChange={(e) => setLocalSpeed(parseFloat(e.target.value))}
                            onMouseUp={() => handleSpeedChange(speed)}
                            onTouchEnd={() => handleSpeedChange(speed)}
                            style={{ flex: 1, cursor: isSaving ? 'not-allowed' : 'pointer', accentColor: 'var(--accent)' }}
                        />
                        <span style={{ 
                            minWidth: '3rem', 
                            textAlign: 'right', 
                            fontFamily: 'monospace', 
                            fontSize: '0.9rem', 
                            fontWeight: 700,
                            color: isSaving ? 'var(--text-muted)' : 'var(--accent)'
                        }}>
                            {speed.toFixed(2)}x
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                        onClick={() => onEditTestText(profile)}
                        className="btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', gap: '6px', background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                        <FileEdit size={14} />
                        Edit Script
                    </button>
                    {!showControlsInline && (
                         <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
                    )}
                    <button 
                        onClick={handleRebuild}
                        className={isRebuildRequired ? "btn-primary" : "btn-ghost"}
                        style={{ fontSize: '0.75rem', padding: '8px 12px', gap: '6px', ...(isRebuildRequired ? {} : {background: 'var(--surface)', border: '1px solid var(--border)'}) }}
                    >
                        <RefreshCw size={14} className={isSaving ? "animate-spin" : ""} />
                        Rebuild
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <Music size={14} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Voice Samples ({profile.samples?.length || 0})
                        </span>
                    </div>
                    <button 
                        onClick={() => document.getElementById(`add-samples-${profile.name}`)?.click()}
                        className="btn-ghost"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', gap: '4px', color: 'var(--accent)' }}
                    >
                        <Plus size={12} />
                        Add Samples
                    </button>
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
                        </>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            No samples yet. Drag and drop samples here to start building the voice.
                        </div>
                    )}
                    
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
                </div>
            </div>
        </div>
    );

    return (
        <div className={showControlsInline ? "" : "glass-panel animate-in"} style={showControlsInline ? {} : { padding: '0', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {profile.preview_url && (
                <audio 
                    ref={audioRef}
                    src={`${profile.preview_url}?t=${cacheBuster}`}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                />
            )}

            {!showControlsInline && (
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
                                <h4 style={{ fontWeight: 600, fontSize: '1rem' }}>
                                    {assignedSpeaker ? (
                                        isGrouped ? (profile.variant_name || 'Default') : `${assignedSpeaker.name}: ${profile.variant_name || 'Default'}`
                                    ) : profile.name}
                                </h4>
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
            )}

            {isTesting && (
                <div style={{ padding: showControlsInline ? '0 0 1.25rem' : '0 1.25rem 1.25rem' }}>
                    <PredictiveProgressBar
                        progress={testStatus?.progress || 0}
                        startedAt={testStatus?.started_at}
                        etaSeconds={25}
                        label="Generating Preview..."
                    />
                </div>
            )}

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={showControlsInline ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', borderTop: showControlsInline ? 'none' : '1px solid var(--border)', background: 'var(--surface-light)' }}
                    >
                        {renderControls()}
                        {!showControlsInline && (
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="btn-ghost"
                                style={{ margin: '0 1.25rem 1.25rem', width: 'calc(100% - 2.5rem)', fontSize: '0.75rem', padding: '8px' }}
                            >
                                <ChevronUp size={14} />
                                Collapse
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


interface SpeakerGroupCardProps {
    speaker: Speaker;
    profiles: SpeakerProfile[];
    isTestingProfileId: string | null;
    testProgress: Record<string, any>;
    onTest: (name: string) => void;
    onDelete: (name: string) => void;
    onSetDefault: (name: string) => void;
    onRefresh: () => void;
    onEditTestText: (profile: SpeakerProfile) => void;
    onBuildNow: (name: string, files: File[]) => void;
    requestConfirm: (config: { title: string; message: string; onConfirm: () => void; isDestructive?: boolean }) => void;
    onAssignToSpeaker: (profile: SpeakerProfile) => void;
    onRemoveFromSpeaker: (name: string) => void;
    onCreateSpeakerFromProfile: (profile: SpeakerProfile) => void;
    speakers: Speaker[];
}

const SpeakerGroupCard: React.FC<SpeakerGroupCardProps> = ({
    speaker, profiles, isTestingProfileId, testProgress, 
    onTest, onDelete, onSetDefault, onRefresh,
    onEditTestText, onBuildNow, requestConfirm,
    onAssignToSpeaker, onRemoveFromSpeaker, onCreateSpeakerFromProfile, speakers
}) => {
    const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
    const [activeProfileId, setActiveProfileId] = useState(defaultProfile?.name || '');
    const activeProfile = profiles.find(p => p.name === activeProfileId) || defaultProfile;

    const speakerMenuItems = [
        { label: 'Rename Speaker', icon: FileEdit, onClick: () => {
             const newName = prompt("Enter new speaker name:", speaker.name);
             if (newName && newName !== speaker.name) {
                 const formData = new URLSearchParams();
                 formData.append('name', newName);
                 fetch(`/api/speakers/${speaker.id}/rename`, { method: 'POST', body: formData })
                     .then(r => { if(r.ok) { onRefresh(); } });
             }
        }},
        { label: 'Delete Speaker', icon: Trash2, isDestructive: true, onClick: () => {
             requestConfirm({
                title: 'Delete Speaker',
                message: `Are you sure you want to delete speaker "${speaker.name}"? This will not delete the associated profiles; they will become unassigned.`,
                isDestructive: true,
                onConfirm: async () => {
                    await fetch(`/api/speakers/${speaker.id}`, { method: 'DELETE' });
                    onRefresh();
                }
            });
        }}
    ];

    if (!activeProfile) return null;

    return (
        <div className="glass-panel animate-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                        width: '48px', 
                        height: '48px', 
                        borderRadius: '16px', 
                        background: 'var(--accent)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <User size={24} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{speaker.name}</h3>
                            {profiles.some(p => p.is_default) && (
                                <span style={{ 
                                    fontSize: '0.65rem', 
                                    padding: '2px 6px', 
                                    background: 'var(--accent)', 
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                }}>DEFAULT</span>
                            )}
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {profiles.length} variant{profiles.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <ActionMenu items={speakerMenuItems} />
            </div>

            <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profiles.map(p => (
                        <button
                            key={p.name}
                            onClick={() => setActiveProfileId(p.name)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '100px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                border: '1px solid',
                                borderColor: activeProfileId === p.name ? 'var(--accent)' : 'var(--border)',
                                background: activeProfileId === p.name ? 'var(--accent-glow)' : 'transparent',
                                color: activeProfileId === p.name ? 'var(--accent)' : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {activeProfileId === p.name && (
                                <motion.div
                                    layoutId={`mic-${speaker.id}`}
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                >
                                    <Volume2 size={12} />
                                </motion.div>
                            )}
                            {p.variant_name || 'Default'}
                        </button>
                    ))}
                </div>
            </div>

            <div key={activeProfileId} className="animate-in" style={{ background: 'var(--surface-light)' }}>
                <div style={{ padding: '1.25rem 1.25rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {activeProfile.variant_name || 'Default Variant'}
                        </h4>
                    </div>
                </div>
                <ProfileDetails
                    profile={activeProfile}
                    isTesting={isTestingProfileId === activeProfile.name}
                    testStatus={testProgress[activeProfile.name]}
                    onTest={onTest}
                    onDelete={onDelete}
                    onSetDefault={onSetDefault}
                    onRefresh={onRefresh}
                    onEditTestText={onEditTestText}
                    onBuildNow={onBuildNow}
                    requestConfirm={requestConfirm}
                    onAssignToSpeaker={onAssignToSpeaker}
                    onRemoveFromSpeaker={onRemoveFromSpeaker}
                    onCreateSpeakerFromProfile={onCreateSpeakerFromProfile}
                    speakers={speakers}
                    isGrouped={true}
                    showControlsInline={true}
                />
            </div>
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
    const [editedVariantName, setEditedVariantName] = useState('');
    const [buildSpeakerId, setBuildSpeakerId] = useState<'none' | 'new' | string>('none');
    const [buildVariantName, setBuildVariantName] = useState('');
    const [confirmConfig, setConfirmConfig] = useState<{ 
        title: string; 
        message: string; 
        onConfirm: () => void; 
        isDestructive?: boolean 
    } | null>(null);

    // --- Speaker Grouping State ---
    const [viewMode, setViewMode] = useState<'profiles' | 'speakers'>('profiles');
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);
    const [selectedProfileForAssign, setSelectedProfileForAssign] = useState<SpeakerProfile | null>(null);
    const [variantName, setVariantName] = useState('');
    const [profileSearch, setProfileSearch] = useState('');
    const [drawerSpeakerId, setDrawerSpeakerId] = useState<'none' | 'new' | string>('none');

    const fetchSpeakers = useCallback(async () => {
        try {
            const resp = await fetch('/api/speakers');
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data)) {
                    setSpeakers(data);
                } else {
                    console.error('Expected array of speakers, got:', data);
                    setSpeakers([]);
                }
            }
        } catch (e) {
            console.error('Failed to fetch speakers', e);
        }
    }, []);

    useEffect(() => {
        fetchSpeakers();
    }, [fetchSpeakers]);

    const handleAssignProfile = async (profileName: string, speakerId: string | null, vName: string) => {
        try {
            const formData = new URLSearchParams();
            if (speakerId) formData.append('speaker_id', speakerId);
            if (vName) formData.append('variant_name', vName);
            
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(profileName)}/assign`, {
                method: 'POST',
                body: formData
            });
            if (resp.ok) {
                setIsAssignDrawerOpen(false);
                setSelectedProfileForAssign(null);
                setVariantName('');
                onRefresh();
            }
        } catch (e) {
            console.error('Failed to assign profile', e);
        }
    };

    const handleRemoveFromSpeaker = async (profileName: string) => {
        try {
            const resp = await fetch(`/api/speaker-profiles/${encodeURIComponent(profileName)}/assign`, {
                method: 'POST' // No speaker_id or variant_name clears them
            });
            if (resp.ok) {
                onRefresh();
            }
        } catch (e) {
            console.error('Failed to remove from speaker', e);
        }
    };

    const handleCreateSpeakerFromProfile = async (profile: SpeakerProfile) => {
        try {
            const formData = new URLSearchParams();
            formData.append('name', profile.name);
            const resp = await fetch('/api/speakers', { method: 'POST', body: formData });
            if (resp.ok) {
                const newSpk = await resp.json();
                fetchSpeakers();
                await handleAssignProfile(profile.name, newSpk.id, '');
            }
        } catch (e) {
            console.error('Failed to create speaker from profile', e);
        }
    };

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

            // 3. Handle Variant Update if assigned
            if (editingProfile.speaker_id) {
                const assignData = new URLSearchParams();
                assignData.append('speaker_id', editingProfile.speaker_id);
                assignData.append('variant_name', editedVariantName.trim());
                await fetch(`/api/speaker-profiles/${encodeURIComponent(currentName)}/assign`, {
                    method: 'POST',
                    body: assignData
                });
            }

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
                
                // --- Post-build Assignment ---
                let targetSpeakerId = buildSpeakerId;
                if (buildSpeakerId === 'new') {
                    // Create new speaker with profile name
                    const spkResp = await fetch('/api/speakers', {
                        method: 'POST',
                        body: new URLSearchParams({ name: newName })
                    });
                    if (spkResp.ok) {
                        const newSpk = await spkResp.json();
                        targetSpeakerId = newSpk.id;
                        fetchSpeakers();
                    }
                }

                if (targetSpeakerId !== 'none' && targetSpeakerId !== 'new') {
                    await handleAssignProfile(newName, targetSpeakerId, buildVariantName);
                }

                setNewName('');
                setFiles([]);
                setBuildSpeakerId('none');
                setBuildVariantName('');
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
            title: 'Delete Voice Profile',
            message: `Are you sure you want to delete the voice profile "${name}"? This will permanently remove all associated voice samples and previews.`,
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

    const groupedProfiles = (speakers || []).map(speaker => ({
        speaker,
        profiles: speakerProfiles.filter(p => p.speaker_id === speaker.id)
    }));
    const unassignedProfiles = speakerProfiles.filter(p => !p.speaker_id || !speakers.some(s => s.id === p.speaker_id));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            {/* Header with View Toggle */}
            <div style={{ 
                padding: '1.25rem 2rem', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface-light)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>AI Voice Lab</h2>
                    <div className="glass-panel" style={{ padding: '4px', display: 'flex', gap: '4px' }}>
                        <button 
                            onClick={() => setViewMode('profiles')}
                            className={viewMode === 'profiles' ? 'btn-primary' : 'btn-ghost'}
                            style={{ 
                                padding: '6px 16px', 
                                fontSize: '0.8rem', 
                                borderRadius: '8px',
                                height: 'auto'
                            }}
                        >
                            Profiles
                        </button>
                        <button 
                            onClick={() => setViewMode('speakers')}
                            className={viewMode === 'speakers' ? 'btn-primary' : 'btn-ghost'}
                            style={{ 
                                padding: '6px 16px', 
                                fontSize: '0.8rem', 
                                borderRadius: '8px',
                                height: 'auto'
                            }}
                        >
                            Group by Speaker
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowGuide(true)} className="btn-ghost" style={{ gap: '8px' }}>
                        <Info size={16} />
                        Recording Guide
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ 
                    flex: '0 0 400px', 
                    borderRight: '1px solid var(--border)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    background: 'var(--surface)',
                    position: 'relative'
                }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} className="text-accent" />
                            Create Voice Profile
                        </h3>
                        <form onSubmit={handleBuild} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>PROFILE NAME</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Dark Fantasy Narrator"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>VOICE SAMPLES (WAV/MP3)</label>
                                <VoiceDropzone files={files} onFilesChange={setFiles} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SPEAKER ASSIGNMENT</label>
                                <SearchableSelect
                                    options={speakers}
                                    value={buildSpeakerId}
                                    onChange={(val) => setBuildSpeakerId(val)}
                                    placeholder="Select speaker..."
                                    noneLabel="None (Unassigned)"
                                />
                            </div>

                            {(buildSpeakerId !== 'none') && (
                                <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>VARIANT LABEL</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Angry, Whispering..."
                                        value={buildVariantName}
                                        onChange={(e) => setBuildVariantName(e.target.value)}
                                        className="form-input"
                                        style={{ background: 'var(--surface-light)' }}
                                    />
                                </div>
                            )}

                            <div style={{ 
                                position: 'sticky', 
                                bottom: -24, 
                                left: -24, 
                                right: -24, 
                                padding: '1.5rem', 
                                background: 'linear-gradient(transparent, var(--surface) 20%)',
                                marginTop: '1rem',
                                borderTop: '1px solid var(--border-light)'
                            }}>
                                <button 
                                    type="submit" 
                                    disabled={isBuilding || !newName || files.length === 0} 
                                    className={isBuilding || !newName || files.length === 0 ? "btn-ghost" : "btn-primary"}
                                    style={{ 
                                        width: '100%', 
                                        justifyContent: 'center', 
                                        gap: '10px',
                                        height: '48px',
                                        fontSize: '0.95rem',
                                        background: (!isBuilding && newName && files.length > 0) ? 'var(--accent)' : 'var(--surface-alt)',
                                        color: (!isBuilding && newName && files.length > 0) ? 'white' : 'var(--text-muted)'
                                    }}
                                >
                                    {isBuilding ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Building Voice...
                                        </>
                                    ) : (
                                        <>
                                            <Music size={18} />
                                            Build Voice Profile
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-alt)', padding: '2rem' }}>
                    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                        {/* Header Stats & Search */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: '1rem',
                            gap: '2rem'
                        }}>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px',
                                color: 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontWeight: 500
                            }}>
                                <Music size={16} />
                                <span>{speakerProfiles.length} Voice Profile{speakerProfiles.length !== 1 ? 's' : ''}</span>
                                <span style={{ opacity: 0.3 }}>•</span>
                                <User size={16} />
                                <span>{speakers.length} Speaker{speakers.length !== 1 ? 's' : ''}</span>
                            </div>

                            <div style={{ position: 'relative', flex: '0 1 350px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search by profile or variant..."
                                    value={profileSearch}
                                    onChange={(e) => setProfileSearch(e.target.value)}
                                    className="form-input"
                                    style={{ 
                                        paddingLeft: '36px', 
                                        background: 'var(--surface)', 
                                        height: '40px',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {viewMode === 'profiles' ? 
                                "Listing all individual voice profiles including their variant labels." : 
                                "Speakers group related voice profiles together (e.g. Dracula: Normal, Angry, Whispering)."}
                        </div>

                        {viewMode === 'profiles' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '1.5rem' }}>
                                {speakerProfiles.filter(p => 
                                    p.name.toLowerCase().includes(profileSearch.toLowerCase()) || 
                                    (p.variant_name || '').toLowerCase().includes(profileSearch.toLowerCase())
                                ).map((p) => (
                                    <ProfileDetails
                                        key={p.name}
                                        profile={p}
                                        isTesting={testingProfile === p.name}
                                        testStatus={testProgress[p.name]}
                                        onTest={handleTest}
                                        onDelete={handleDelete}
                                        onSetDefault={handleSetDefault}
                                        onRefresh={onRefresh}
                                        isGrouped={false}
                                        onEditTestText={(p) => {
                                            setEditingProfile(p);
                                            setTestText(p.test_text || '');
                                            setEditedName(p.name);
                                            setEditedVariantName(p.variant_name || '');
                                        }}
                                        onBuildNow={handleBuildNow}
                                        requestConfirm={handleRequestConfirm}
                                        onAssignToSpeaker={(profile) => {
                                            setSelectedProfileForAssign(profile);
                                            setVariantName(profile.variant_name || '');
                                            setDrawerSpeakerId(profile.speaker_id || 'none');
                                            setIsAssignDrawerOpen(true);
                                        }}
                                        onRemoveFromSpeaker={handleRemoveFromSpeaker}
                                        onCreateSpeakerFromProfile={handleCreateSpeakerFromProfile}
                                        speakers={speakers}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {/* Grouped Speakers */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: '2rem' }}>
                                    {groupedProfiles.filter(({speaker, profiles}) => 
                                        speaker.name.toLowerCase().includes(profileSearch.toLowerCase()) ||
                                        profiles.some(p => (p.variant_name || '').toLowerCase().includes(profileSearch.toLowerCase()))
                                    ).map(({ speaker, profiles }) => (
                                        <SpeakerGroupCard
                                            key={speaker.id}
                                            speaker={speaker}
                                            profiles={profiles}
                                            isTestingProfileId={testingProfile}
                                            testProgress={testProgress}
                                            onTest={handleTest}
                                            onDelete={handleDelete}
                                            onSetDefault={handleSetDefault}
                                            onRefresh={onRefresh}
                                            onEditTestText={(p) => {
                                                setEditingProfile(p);
                                                setTestText(p.test_text || '');
                                                setEditedName(p.name);
                                                setEditedVariantName(p.variant_name || '');
                                            }}
                                            onBuildNow={handleBuildNow}
                                            requestConfirm={handleRequestConfirm}
                                            onAssignToSpeaker={(profile) => {
                                                setSelectedProfileForAssign(profile);
                                                setVariantName(profile.variant_name || '');
                                                setDrawerSpeakerId(profile.speaker_id || 'none');
                                                setIsAssignDrawerOpen(true);
                                            }}
                                            onRemoveFromSpeaker={handleRemoveFromSpeaker}
                                            onCreateSpeakerFromProfile={handleCreateSpeakerFromProfile}
                                            speakers={speakers}
                                        />
                                    ))}
                                </div>

                                {/* Unassigned Profiles */}
                                {unassignedProfiles.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></div>
                                            Unassigned Profiles ({unassignedProfiles.length})
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '1.5rem' }}>
                                            {unassignedProfiles.filter(p => 
                                                p.name.toLowerCase().includes(profileSearch.toLowerCase()) || 
                                                (p.variant_name || '').toLowerCase().includes(profileSearch.toLowerCase())
                                            ).map((p) => (
                                                <ProfileDetails
                                                    key={p.name}
                                                    profile={p}
                                                    isTesting={testingProfile === p.name}
                                                    testStatus={testProgress[p.name]}
                                                    onTest={handleTest}
                                                    onDelete={handleDelete}
                                                    onSetDefault={handleSetDefault}
                                                    onRefresh={onRefresh}
                                                    isGrouped={false}
                                                    onEditTestText={(p) => {
                                                        setEditingProfile(p);
                                                        setTestText(p.test_text || '');
                                                        setEditedName(p.name);
                                                        setEditedVariantName(p.variant_name || '');
                                                    }}
                                                    onBuildNow={handleBuildNow}
                                                    requestConfirm={handleRequestConfirm}
                                                    onAssignToSpeaker={(profile) => {
                                                        setSelectedProfileForAssign(profile);
                                                        setVariantName(profile.variant_name || '');
                                                        setDrawerSpeakerId(profile.speaker_id || 'none');
                                                        setIsAssignDrawerOpen(true);
                                                    }}
                                                    onRemoveFromSpeaker={handleRemoveFromSpeaker}
                                                    onCreateSpeakerFromProfile={handleCreateSpeakerFromProfile}
                                                    speakers={speakers}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ 
                                        padding: '1.5rem', 
                                        textAlign: 'center', 
                                        color: 'var(--text-muted)', 
                                        fontSize: '0.85rem',
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '12px',
                                        border: '1px dashed var(--border-light)'
                                    }}>
                                        No unassigned profiles found.
                                    </div>
                                )}

                                {speakers.length === 0 && unassignedProfiles.length === 0 && speakerProfiles.length > 0 && (
                                    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                                        <p style={{ color: 'var(--text-muted)' }}>No speakers defined. Use "Assign to Speaker" to create one.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Drawer
                isOpen={!!editingProfile}
                onClose={() => setEditingProfile(null)}
                title={`Configure Voice Profile: ${editingProfile?.name}`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {!editingProfile?.speaker_id && (
                        <div className="input-group">
                            <label>Voice Profile Name</label>
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
                    )}

                    {editingProfile?.speaker_id && (
                        <div className="input-group">
                            <label>Variant Label</label>
                            <input
                                type="text"
                                value={editedVariantName}
                                onChange={(e) => setEditedVariantName(e.target.value)}
                                placeholder="e.g. Angry, Whispering, Neutral..."
                                disabled={isSavingText}
                                className="form-input"
                                style={{
                                    background: 'var(--surface-light)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '10px 14px'
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                This will rename the profile to "{speakers.find(s => s.id === editingProfile.speaker_id)?.name} - {editedVariantName || 'Default'}"
                            </p>
                        </div>
                    )}

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

            {/* Assign to Speaker Drawer */}
            <Drawer 
                isOpen={isAssignDrawerOpen} 
                onClose={() => {
                    setIsAssignDrawerOpen(false);
                    setProfileSearch('');
                    setVariantName('');
                    setDrawerSpeakerId('none');
                }}
                title={selectedProfileForAssign?.speaker_id ? `Move ${selectedProfileForAssign?.name} to Different Speaker` : `Assign ${selectedProfileForAssign?.name} to Speaker`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                            <Music size={18} />
                            <span style={{ fontWeight: 600 }}>{selectedProfileForAssign?.name}</span>
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            Group this profile under a speaker to organize your variants.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                SELECT SPEAKER
                            </label>
                            <SearchableSelect
                                options={speakers}
                                value={drawerSpeakerId}
                                onChange={(val) => setDrawerSpeakerId(val)}
                                placeholder="Select or create speaker..."
                                noneLabel="Unassigned"
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                VARIANT LABEL (OPTIONAL)
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Menacing, Whisper, Neutral"
                                value={variantName}
                                onChange={(e) => setVariantName(e.target.value)}
                            />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Label this specific variant or emotion for this speaker.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                        <button 
                            className="btn-primary" 
                            style={{ flex: 1, justifyContent: 'center' }}
                            disabled={!selectedProfileForAssign || (drawerSpeakerId === 'none' && !selectedProfileForAssign.speaker_id)}
                            onClick={() => {
                                if (selectedProfileForAssign) {
                                    handleAssignProfile(selectedProfileForAssign.name, drawerSpeakerId === 'none' ? null : drawerSpeakerId, variantName);
                                }
                            }}
                        >
                            Confirm Changes
                        </button>
                    </div>

                    {selectedProfileForAssign?.speaker_id && (
                        <button 
                            onClick={() => handleRemoveFromSpeaker(selectedProfileForAssign.name)}
                            className="btn-ghost"
                            style={{ alignSelf: 'flex-start', fontSize: '0.85rem', color: 'var(--error)' }}
                        >
                            <Trash2 size={14} />
                            Remove from Current Speaker
                        </button>
                    )}
                </div>
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
