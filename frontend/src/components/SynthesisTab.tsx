import React, { useState } from 'react';
import { ChapterGrid } from './ChapterGrid';
import { Upload, Play, List, Grid } from 'lucide-react';
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
}

export const SynthesisTab: React.FC<SynthesisTabProps> = ({
    chapters,
    jobs,
    selectedFile,
    onSelect,
    statusSets,
    onRefresh,
    speakerProfiles,
    paused
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedProfile, setSelectedProfile] = useState('');
    const [isUploading, setIsUploading] = useState(false);

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

    return (
        <div className="tab-content animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                            <option value="">(Default Narrator)</option>
                            {speakerProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                        <button
                            onClick={handleStartQueue}
                            className="btn-primary"
                            disabled={paused}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        >
                            <Play size={14} /> Start Synthesis
                        </button>
                    </div>
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

            <div style={{ flex: 1, minHeight: 0 }}>
                <ChapterGrid
                    chapters={chapters}
                    jobs={jobs}
                    selectedFilename={selectedFile}
                    onSelect={onSelect}
                    viewMode={viewMode}
                    onRefresh={onRefresh}
                    statusSets={statusSets}
                />
            </div>
        </div>
    );
};
