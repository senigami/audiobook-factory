import React, { useState, useCallback } from 'react';
import { Upload, X, FileAudio, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectedFile {
    file: File;
    id: string;
    status: 'valid' | 'warning';
    warnings: string[];
    duration?: string;
}

interface VoiceDropzoneProps {
    onFilesChange: (files: File[]) => void;
}

export const VoiceDropzone: React.FC<VoiceDropzoneProps> = ({ onFilesChange }) => {
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const validateFile = async (file: File): Promise<SelectedFile> => {
        const warnings: string[] = [];
        let durationStr = '...';

        try {
            const audio = new Audio(URL.createObjectURL(file));
            await new Promise((resolve) => {
                audio.onloadedmetadata = () => {
                    durationStr = formatDuration(audio.duration);
                    if (audio.duration < 3) warnings.push('Too short');
                    if (audio.duration > 15) warnings.push('Too long');
                    resolve(null);
                };
                audio.onerror = () => resolve(null);
            });
        } catch (e) {
            console.error('Failed to get audio duration', e);
        }

        if (file.size > 2 * 1024 * 1024) warnings.push('Large file size');
        
        return {
            file,
            id: Math.random().toString(36).substring(7),
            status: warnings.length > 0 ? 'warning' : 'valid',
            warnings,
            duration: durationStr
        };
    };

    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files) return;
        
        const wavFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.wav'));
        const newFiles = await Promise.all(wavFiles.map(validateFile));
        
        setSelectedFiles(prev => {
            const updated = [...prev, ...newFiles];
            onFilesChange(updated.map(sf => sf.file));
            return updated;
        });
    }, [onFilesChange]);

    const removeFile = (id: string) => {
        setSelectedFiles(prev => {
            const updated = prev.filter(f => f.id !== id);
            onFilesChange(updated.map(sf => sf.file));
            return updated;
        });
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    return (
        <div className="input-group">
            <label>Voice Samples (.wav)</label>
            
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('voice-upload-input')?.click()}
                style={{
                    border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-card)',
                    padding: '2rem',
                    textAlign: 'center',
                    background: isDragging ? 'var(--accent-glow)' : 'var(--surface-light)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                }}
            >
                <input
                    id="voice-upload-input"
                    type="file"
                    multiple
                    accept=".wav"
                    onChange={(e) => handleFiles(e.target.files)}
                    style={{ display: 'none' }}
                />
                <div className="icon-circle" style={{ width: '48px', height: '48px', background: 'var(--accent-glow)' }}>
                    <Upload size={24} color="var(--accent)" />
                </div>
                <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drop .wav samples here, or <span style={{ color: 'var(--accent)' }}>Browse</span></p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Only .wav format is supported</p>
                </div>
            </div>

            <AnimatePresence>
                {selectedFiles.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
                            </span>
                        </div>
                        {selectedFiles.map((sf) => (
                            <motion.div
                                key={sf.id}
                                layout
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '8px 12px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <FileAudio size={16} color="var(--accent)" />
                                <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sf.file.name}
                                </span>
                                {sf.duration && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                        {sf.duration}
                                    </span>
                                )}
                                {sf.status === 'warning' && (
                                    <div title={sf.warnings.join(', ')} style={{ color: 'var(--warning)' }}>
                                        <AlertCircle size={14} />
                                    </div>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFile(sf.id); }}
                                    className="btn-ghost"
                                    style={{ padding: '4px', borderRadius: '4px' }}
                                >
                                    <X size={14} />
                                </button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '12px',
                padding: '8px 12px',
                background: 'var(--as-info-tint)',
                borderRadius: '8px',
                border: '1px solid var(--accent-glow)'
            }}>
                <CheckCircle2 size={14} color="var(--accent)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Best results: 3–5 clean samples, 6–10 seconds each.
                </span>
            </div>
        </div>
    );
};
