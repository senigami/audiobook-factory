import React, { useState } from 'react';
import { Settings, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsTrayProps {
    settings: any;
    onRefresh: () => void;
    hideFinished: boolean;
    onToggleHideFinished: () => void;
}

export const SettingsTray: React.FC<SettingsTrayProps> = ({ 
    settings, 
    onRefresh, 
    hideFinished, 
    onToggleHideFinished 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleToggle = async (key: string, currentValue: boolean) => {
        setSaving(true);
        try {
            const formData = new URLSearchParams();
            formData.append(key, (!currentValue).toString());
            await fetch('/settings', { method: 'POST', body: formData });
            onRefresh();
        } catch (e) {
            console.error('Failed to update setting', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`btn-ghost ${isOpen ? 'active' : ''}`}
                style={{ 
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    color: isOpen ? 'var(--accent)' : 'var(--text-muted)',
                    background: isOpen ? 'var(--accent-glow)' : 'var(--surface)',
                    border: isOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    boxShadow: isOpen ? 'var(--shadow-sm)' : 'none'
                }}
                title="Synthesis Preferences"
            >
                <Settings size={18} className={isOpen ? 'animate-spin-slow' : ''} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div 
                            style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                            onClick={() => setIsOpen(false)} 
                        />
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="popover-panel"
                            style={{ 
                                position: 'absolute',
                                top: 'calc(100% + 12px)',
                                right: 0,
                                width: '320px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Settings size={14} color="var(--accent)" />
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Synthesis</h3>
                                </div>
                                {saving && <Loader2 size={12} className="animate-spin" color="var(--accent)" />}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Safe Mode</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Auto-recover engine</div>
                                    </div>
                                    <button 
                                        onClick={() => handleToggle('safe_mode', settings?.safe_mode)}
                                        className={settings?.safe_mode ? 'btn-primary' : 'btn-glass'} 
                                        style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '6px' }}
                                    >
                                        {settings?.safe_mode ? 'ON' : 'OFF'}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Produce MP3</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Compatible exports</div>
                                    </div>
                                    <button 
                                        onClick={() => handleToggle('make_mp3', settings?.make_mp3)}
                                        className={settings?.make_mp3 ? 'btn-primary' : 'btn-glass'} 
                                        style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '6px' }}
                                    >
                                        {settings?.make_mp3 ? 'ON' : 'OFF'}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Hide Finished</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Focus active only</div>
                                    </div>
                                    <button 
                                        onClick={onToggleHideFinished}
                                        className={hideFinished ? 'btn-primary' : 'btn-glass'} 
                                        style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '6px' }}
                                    >
                                        {hideFinished ? 'ACTIVE' : 'OFF'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={async () => {
                                        await fetch('/queue/backfill_mp3', { method: 'POST' });
                                        onRefresh();
                                        alert('Sync process started.');
                                    }}
                                    className="btn-glass" 
                                    style={{ flex: 1, fontSize: '0.7rem', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <RefreshCw size={12} /> Sync
                                </button>
                                <button 
                                    onClick={async () => {
                                        if (confirm('Wipe all jobs and logs?')) {
                                            await fetch('/queue/clear', { method: 'POST' });
                                            onRefresh();
                                        }
                                    }}
                                    className="btn-ghost" 
                                    style={{ flex: 1, fontSize: '0.7rem', padding: '8px', color: 'var(--error-text)' }}
                                >
                                    Wipe History
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
