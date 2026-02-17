import React, { useState } from 'react';
import { Settings, RefreshCw, Trash2, Shield, Info, Check } from 'lucide-react';

interface SettingsTabProps {
    settings: any;
    hideFinished: boolean;
    onToggleHideFinished: () => void;
    onRefresh: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, hideFinished, onToggleHideFinished, onRefresh }) => {
    const [saving, setSaving] = useState(false);

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
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
            <header style={{ marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
                    <Settings color="var(--accent)" size={24} />
                    <h2 style={{ fontSize: '1.8rem', margin: 0 }}>System Settings</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>Configure global preferences and perform maintenance tasks.</p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Preferences Section */}
                <section className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                        <Shield size={18} color="var(--accent)" />
                        <h3 style={{ fontSize: '1.1rem' }}>Preferences</h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem' }}>
                        <div>
                            <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Safe Mode</h4>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Sanitizes text for XTTS to prevent engine crashes. Highly recommended for complex texts.
                            </p>
                        </div>
                        <button
                            onClick={handleToggleSafeMode}
                            disabled={saving}
                            className={settings?.safe_mode ? 'btn-primary' : 'btn-glass'}
                            style={{
                                minWidth: '100px',
                                padding: '10px 20px',
                                boxShadow: settings?.safe_mode ? '0 0 20px rgba(139, 92, 246, 0.4)' : 'none'
                            }}
                        >
                            {settings?.safe_mode ? <Check size={16} /> : null}
                            {settings?.safe_mode ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>

                    <div className="divider" style={{ margin: '2rem 0', opacity: 0.3 }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem' }}>
                        <div>
                            <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Hide Finished Chapters</h4>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Only show chapters that are pending or currently processing in the Synthesis tab.
                            </p>
                        </div>
                        <button
                            onClick={onToggleHideFinished}
                            className={hideFinished ? 'btn-primary' : 'btn-glass'}
                            style={{
                                minWidth: '100px',
                                padding: '10px 20px',
                                boxShadow: hideFinished ? '0 0 20px rgba(139, 92, 246, 0.4)' : 'none'
                            }}
                        >
                            {hideFinished ? <Check size={16} /> : null}
                            {hideFinished ? 'Active' : 'Inactive'}
                        </button>
                    </div>
                </section>

                {/* Maintenance Section */}
                <section className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                        <RefreshCw size={18} color="var(--accent)" />
                        <h3 style={{ fontSize: '1.1rem' }}>Maintenance</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Reconcile Files</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Scan for missing MP3s and update job records.</p>
                            </div>
                            <button onClick={handleBackfill} className="btn-glass" style={{ padding: '10px 20px' }}>
                                <RefreshCw size={16} /> Synchronize
                            </button>
                        </div>

                        <div className="divider" style={{ opacity: 0.5 }} />

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--error)' }}>Factory Reset</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Clear all jobs, logs, and database records.</p>
                            </div>
                            <button onClick={handleClear} className="btn-ghost" style={{ color: 'var(--error)', padding: '10px 20px' }}>
                                <Trash2 size={16} /> Wipe History
                            </button>
                        </div>
                    </div>
                </section>

                {/* Info Section */}
                <section className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)' }}>
                    <Info size={32} color="var(--accent)" style={{ margin: '0 auto 1rem' }} opacity={0.5} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Audiobook Factory v2.0</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                        A high-performance text-to-speech production environment powered by XTTS v2.
                    </p>
                </section>
            </div>
        </div>
    );
};
