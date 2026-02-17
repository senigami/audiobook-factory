import React, { useState } from 'react';
import { User, Plus, Music, Trash2, Play, Loader2, Check } from 'lucide-react';

interface SpeakerProfile {
    name: string;
    wav_count: number;
}

interface VoicesTabProps {
    onRefresh: () => void;
    speakerProfiles: SpeakerProfile[];
}

export const VoicesTab: React.FC<VoicesTabProps> = ({ onRefresh, speakerProfiles }) => {
    const [newName, setNewName] = useState('');
    const [files, setFiles] = useState<FileList | null>(null);
    const [isBuilding, setIsBuilding] = useState(false);
    const [testingProfile, setTestingProfile] = useState<string | null>(null);
    const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

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
                // Reset file input
                const input = document.getElementById('profile-files') as HTMLInputElement;
                if (input) input.value = '';
                onRefresh();
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
        setTestAudioUrl(null);
        try {
            const resp = await fetch('/api/speaker-profiles/test', {
                method: 'POST',
                body: new URLSearchParams({ name }),
            });
            const result = await resp.json();
            if (result.status === 'success') {
                setTestAudioUrl(result.audio_url);
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
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Tip: Multiple clean samples result in a more stable clones.
                            </p>
                        </div>
                        <button type="submit" className="btn-primary" disabled={isBuilding || !newName || !files}>
                            {isBuilding ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                            {isBuilding ? 'Building Profile...' : 'Build Speaker'}
                        </button>
                    </form>
                </section>

                {/* List Section */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <User size={20} color="var(--accent)" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Available Narrators</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {speakerProfiles.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                                No custom speakers yet. Upload some WAVs to begin.
                            </p>
                        )}
                        {speakerProfiles.map((p) => (
                            <div key={p.name} className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="icon-circle">
                                        <Music size={16} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 600 }}>{p.name}</h4>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.wav_count} samples</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleTest(p.name)}
                                        className="btn-ghost"
                                        disabled={testingProfile === p.name}
                                        title="Test Voice"
                                    >
                                        {testingProfile === p.name ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(p.name)}
                                        className="btn-ghost"
                                        style={{ color: 'var(--error)' }}
                                        title="Delete Profile"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {testAudioUrl && (
                        <div className="glass-panel animate-in" style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(var(--accent-rgb), 0.1)' }}>
                            <p style={{ fontSize: '0.75rem', marginBottom: '0.5rem', fontWeight: 600 }}>Preview Generated:</p>
                            <audio src={testAudioUrl} controls autoPlay style={{ width: '100%', height: '32px' }} />
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
