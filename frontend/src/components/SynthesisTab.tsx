import React, { useState, useEffect } from 'react';
import { ChapterGrid } from './ChapterGrid';
import { Upload, Play, List, Grid, Settings as SettingsIcon, RefreshCw, Trash2, Check, X } from 'lucide-react';
import type { Job } from '../types';

interface SynthesisTabProps {
    chapters: string[];
    jobs: Record<string, Job>;
    selectedFile: string | null;
    onSelect: (filename: string | null) => void;
    statusSets: any;
    onRefresh: () => void;
    speakerProfiles: { name: string }[];
    paused: boolean;
    settings: any;
    hideFinished: boolean;
    onToggleHideFinished: () => void;
    onOpenPreview: (filename: string) => void;
}

export const SynthesisTab: React.FC<SynthesisTabProps> = ({
    chapters,
    jobs,
    selectedFile,
    onSelect,
    statusSets,
    onRefresh,
    speakerProfiles,
    paused,
    settings,
    hideFinished,
    onToggleHideFinished,
    onOpenPreview
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedProfile, setSelectedProfile] = useState(settings?.default_speaker_profile || '');
    const [isUploading, setIsUploading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!selectedProfile && settings?.default_speaker_profile) {
            setSelectedProfile(settings.default_speaker_profile);
        }
    }, [settings?.default_speaker_profile]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', e.target.files[0]);
        try {
            const response = await fetch('/upload?json=1', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.status === 'success') {
                onRefresh();
            } else {
                alert(`Upload error: ${result.message}`);
            }
        } catch (e) {
            console.error('Upload failed', e);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleStartQueue = async () => {
        const formData = new URLSearchParams();
        if (selectedProfile) {
            formData.append('speaker_profile', selectedProfile);
        }
        try {
            await fetch('/queue/start_xtts', {
                method: 'POST',
                body: formData
            });
            onRefresh();
        } catch (e) {
            console.error('Failed to start queue', e);
        }
    };

    const handleToggleSafeMode = async () => {
        setSaving(true);
        try {
            const formData = new URLSearchParams();
            formData.append('safe_mode', (!settings?.safe_mode).toString());
            await fetch('/settings', { method: 'POST', body: formData });
            onRefresh();
        } catch (e) {
            console.error('Failed to update settings', e);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleMP3 = async () => {
        setSaving(true);
        try {
            const formData = new URLSearchParams();
            formData.append('make_mp3', (!settings?.make_mp3).toString());
            await fetch('/settings', { method: 'POST', body: formData });
            onRefresh();
        } catch (e) {
            console.error('Failed to update MP3 setting', e);
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (!confirm('Are you sure you want to clear all jobs and reset factory state? This cannot be undone.')) return;
        try {
            await fetch('/queue/clear', { method: 'POST' });
            onRefresh();
        } catch (e) {
            console.error('Failed to clear history', e);
        }
    };

    const handleBackfill = async () => {
        try {
            await fetch('/queue/backfill_mp3', { method: 'POST' });
            onRefresh();
            alert('Backfill process started in background.');
        } catch (e) {
            console.error('Backfill failed', e);
        }
    };

    return (
        <div className="tab-content animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label className="btn-ghost" style={{ cursor: 'pointer', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                            <Upload size={14} /> {isUploading ? 'Uploading...' : 'Upload Text'}
                            <input type="file" accept=".txt" onChange={handleUpload} style={{ display: 'none' }} />
                        </label>
                    </div>

                    <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select
                            value={selectedProfile}
                            onChange={(e) => setSelectedProfile(e.target.value)}
                            className="select-glass"
                            style={{ fontSize: '0.875rem', minWidth: '180px' }}
                        >
                            {speakerProfiles.length === 0 ? (
                                <option value="">No narrators found</option>
                            ) : (
                                <>
                                    {!settings?.default_speaker_profile && <option value="">Select Narrator...</option>}
                                    {speakerProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                </>
                            )}
                        </select>
                        <button
                            onClick={handleStartQueue}
                            className="btn-primary"
                            disabled={paused}
                        >
                            <Play size={14} /> Start Synthesis
                        </button>
                    </div>

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`btn-ghost ${showSettings ? 'active' : ''}`}
                        title="Synthesis Settings"
                        style={{
                            padding: '0.75rem',
                            borderRadius: '10px',
                            color: showSettings ? 'var(--accent)' : 'var(--text-secondary)',
                            background: showSettings ? 'rgba(139, 92, 246, 0.1)' : 'transparent'
                        }}
                    >
                        <SettingsIcon size={20} className={showSettings ? 'animate-spin-slow' : ''} />
                    </button>
                    {saving && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', animation: 'pulse 2s infinite' }}>Saving...</span>}
                </div>

                <div className="glass-panel" style={{ display: 'flex', gap: '4px', padding: '4px' }}>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                    >
                        <Grid size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}
                        style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                    >
                        <List size={14} />
                    </button>
                </div>
            </header>

            {/* Settings Overlay Panel */}
            {showSettings && (
                <div
                    className="glass-panel animate-in"
                    style={{
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                        border: '1px solid var(--accent)',
                        background: 'rgba(10, 10, 12, 0.95)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        marginBottom: '1rem'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <SettingsIcon size={16} color="var(--accent)" />
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Synthesis Preferences</h3>
                        </div>
                        <button onClick={() => setShowSettings(false)} className="btn-ghost">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="responsive-grid" style={{ gap: '2rem' }}>
                        {/* Left Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '2px' }}>Safe Mode</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sanitize text to prevent crashes</p>
                                </div>
                                <button onClick={handleToggleSafeMode} className={settings?.safe_mode ? 'btn-primary' : 'btn-glass'} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                    {settings?.safe_mode ? <Check size={12} /> : null} {settings?.safe_mode ? 'On' : 'Off'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '2px' }}>Hide Finished</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only show active/pending chapters</p>
                                </div>
                                <button onClick={onToggleHideFinished} className={hideFinished ? 'btn-primary' : 'btn-glass'} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                    {hideFinished ? <Check size={12} /> : null} {hideFinished ? 'Active' : 'Off'}
                                </button>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="sidebar-divider-mobile" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '2px' }}>Produce MP3</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required for older browsers</p>
                                </div>
                                <button onClick={handleToggleMP3} className={settings?.make_mp3 ? 'btn-primary' : 'btn-glass'} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                    {settings?.make_mp3 ? <Check size={12} /> : null} {settings?.make_mp3 ? 'On' : 'Off'}
                                </button>
                            </div>

                            {settings?.make_mp3 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '1.5rem', opacity: 0.9 }}>
                                    <div>
                                        <h4 style={{ fontSize: '0.85rem', marginBottom: '2px' }}>Reconcile Files</h4>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sync missing output records</p>
                                    </div>
                                    <button onClick={handleBackfill} className="btn-glass" style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                        <RefreshCw size={12} /> Sync
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '2px', color: 'var(--error)' }}>Reset History</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wipe all jobs and logs</p>
                                </div>
                                <button onClick={handleClear} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '6px 12px', color: 'var(--error)' }}>
                                    <Trash2 size={12} /> Wipe
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0 }}>
                <ChapterGrid
                    chapters={chapters}
                    jobs={jobs}
                    selectedFilename={selectedFile}
                    onSelect={onSelect}
                    viewMode={viewMode}
                    onRefresh={onRefresh}
                    statusSets={statusSets}
                    onOpenPreview={onOpenPreview}
                    makeMp3={settings?.make_mp3}
                />
            </div>
        </div>
    );
};
