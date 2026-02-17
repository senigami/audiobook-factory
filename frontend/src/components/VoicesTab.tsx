import React, { useState, useEffect } from 'react';
import { User, Plus, Music, Trash2, Play, Loader2, Check, Info, RefreshCw, FileEdit, X, Save } from 'lucide-react';
import { PredictiveProgressBar } from './PredictiveProgressBar';

interface SpeakerProfile {
    name: string;
    wav_count: number;
    speed: number;
    test_text?: string;
    preview_url: string | null;
}

interface SpeakerCardProps {
    profile: SpeakerProfile;
    isTesting: boolean;
    onTest: (name: string) => void;
    onDelete: (name: string) => void;
    onRefresh: () => void;
    onEditTestText: (profile: SpeakerProfile) => void;
    testStatus?: { progress: number; started_at?: number };
}

const SpeakerCard: React.FC<SpeakerCardProps> = ({ profile, isTesting, onTest, onDelete, onRefresh, onEditTestText, testStatus }) => {
    const [localSpeed, setLocalSpeed] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [cacheBuster, setCacheBuster] = useState(Date.now());
    const speed = localSpeed ?? profile.speed;

    // Update cache buster when preview_url is restored or stays stable but we want a fresh look
    useEffect(() => {
        if (profile.preview_url) {
            setCacheBuster(Date.now());
        }
    }, [profile.preview_url, isTesting]);

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

    return (
        <div className="glass-panel animate-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-circle">
                        <Music size={16} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{profile.name}</h4>
                            <button
                                onClick={() => onEditTestText(profile)}
                                className="btn-ghost"
                                style={{ padding: '4px', color: 'var(--text-muted)' }}
                                title="Edit Sample Text"
                            >
                                <FileEdit size={12} />
                            </button>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{profile.wav_count} samples</span>
                    </div>
                </div>
                <button
                    onClick={() => onDelete(profile.name)}
                    className="btn-ghost"
                    style={{ color: 'var(--error)', padding: '8px' }}
                    title="Delete Profile"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Speed</span>
                        {isSaving && <Loader2 size={10} className="animate-spin" color="var(--accent)" />}
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                        {speed.toFixed(2)}x
                    </span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setLocalSpeed(parseFloat(e.target.value))}
                    onMouseUp={() => handleSpeedChange(speed)}
                    onTouchEnd={() => handleSpeedChange(speed)}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minHeight: '40px' }}>
                {isTesting ? (
                    <PredictiveProgressBar
                        progress={testStatus?.progress || 0}
                        startedAt={testStatus?.started_at}
                        etaSeconds={25} // Average XTTS test time is ~25s
                        label="Generating Sample..."
                    />
                ) : profile.preview_url ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <audio src={`${profile.preview_url}?t=${cacheBuster}`} controls style={{ flex: 1, height: '32px' }} />
                        <button
                            onClick={() => onTest(profile.name)}
                            className="btn-glass"
                            disabled={isTesting}
                            style={{ height: '32px', whiteSpace: 'nowrap' }}
                            title="Regenerate Preview"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => onTest(profile.name)}
                        className="btn-primary"
                        disabled={isTesting}
                        style={{ width: '100%' }}
                    >
                        <Play size={16} />
                        Generate Preview
                    </button>
                )}
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
    const [files, setFiles] = useState<FileList | null>(null);
    const [isBuilding, setIsBuilding] = useState(false);
    const [testingProfile, setTestingProfile] = useState<string | null>(null);
    const [editingProfile, setEditingProfile] = useState<SpeakerProfile | null>(null);
    const [testText, setTestText] = useState('');
    const [isSavingText, setIsSavingText] = useState(false);

    const handleSaveTestText = async () => {
        if (!editingProfile) return;
        setIsSavingText(true);
        try {
            const formData = new URLSearchParams();
            formData.append('text', testText);
            await fetch(`/api/speaker-profiles/${encodeURIComponent(editingProfile.name)}/test-text`, {
                method: 'POST',
                body: formData
            });
            onRefresh();
            setEditingProfile(null);
        } catch (e) {
            console.error('Failed to save test text', e);
        } finally {
            setIsSavingText(false);
        }
    };

    const handleBuild = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !files || files.length === 0) return;

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
                setFiles(null);
                const input = document.getElementById('profile-files') as HTMLInputElement;
                if (input) input.value = '';
                onRefresh();
            } else {
                const errorData = await resp.json();
                alert(`Build failed: ${errorData.message}\n\n${errorData.traceback || ''}`);
            }
        } catch (err) {
            console.error('Failed to build profile', err);
            alert('Build failed. Check console for details.');
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

    return (
        <div className="tab-content animate-in">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Builder Section */}
                <section className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <Plus size={20} color="var(--accent)" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Create Super Voice</h3>
                    </div>
                    <form onSubmit={handleBuild} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="input-group">
                            <label>Narrator Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Victorian Gentleman"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Voice Samples (.wav)</label>
                            <input
                                id="profile-files"
                                type="file"
                                multiple
                                accept=".wav"
                                onChange={(e) => setFiles(e.target.files)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={isBuilding || !newName || !files}>
                            {isBuilding ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                            {isBuilding ? 'Building Profile...' : 'Build Speaker'}
                        </button>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
                                <Info size={14} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Voice Optimization</span>
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: 'var(--text-main)' }}>Individual Samples:</strong> 6 to 10 seconds is the ideal length.
                                </li>
                                <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: 'var(--text-main)' }}>Total Profile:</strong> 3 to 5 samples (approx. 30s total) for stability.
                                </li>
                                <li style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: 'var(--text-main)' }}>Audio Quality:</strong> Use clean recordings with no background noise or music.
                                </li>
                            </ul>
                        </div>
                    </form>
                </section>

                {/* List Section */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <User size={20} color="var(--accent)" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Available Narrators</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                        {speakerProfiles.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                                No custom speakers yet. Upload some WAVs to begin.
                            </p>
                        )}
                        {speakerProfiles.map((p) => (
                            <SpeakerCard
                                key={p.name}
                                profile={p}
                                isTesting={testingProfile === p.name}
                                testStatus={testProgress[p.name]}
                                onTest={handleTest}
                                onDelete={handleDelete}
                                onRefresh={onRefresh}
                                onEditTestText={(profile) => {
                                    setEditingProfile(profile);
                                    setTestText(profile.test_text || '');
                                }}
                            />
                        ))}
                    </div>
                </section>
            </div>

            {/* Edit Test Text Modal */}
            {editingProfile && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(8px)'
                }}>
                    <div className="glass-panel animate-in" style={{
                        width: '90%',
                        maxWidth: '600px',
                        padding: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <FileEdit color="var(--accent)" size={20} />
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit Sample Text for {editingProfile.name}</h3>
                            </div>
                            <button onClick={() => setEditingProfile(null)} className="btn-ghost">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="input-group">
                            <label>The narrative text used for voice previews</label>
                            <textarea
                                value={testText}
                                onChange={(e) => setTestText(e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '150px',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    padding: '1rem',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.5',
                                    resize: 'vertical'
                                }}
                                placeholder="Enter the text you want this narrator to speak in the preview..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setEditingProfile(null)} className="btn-ghost">Cancel</button>
                            <button
                                onClick={handleSaveTestText}
                                className="btn-primary"
                                disabled={isSavingText}
                            >
                                {isSavingText ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Save Narrative
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
