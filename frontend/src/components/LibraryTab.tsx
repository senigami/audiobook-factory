import React, { useState, useEffect, useRef } from 'react';
import { Package, FileAudio, Trash2, Download, Image as ImageIcon, User, Mic, GripVertical, SortAsc, Info, Loader2 } from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import type { Job, AssemblyChapter, AssemblyPrep } from '../types';

interface LibraryTabProps {
    audiobooks: string[];
    audiobookJob?: Job;
    onRefresh: () => void;
    progressHelper: (job: Job) => { remaining: number | null, progress: number };
    formatSeconds: (s: number) => string;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
    audiobooks,
    audiobookJob,
    onRefresh,
    progressHelper,
    formatSeconds
}) => {
    // Assembly State
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [narrator, setNarrator] = useState('');
    const [chapters, setChapters] = useState<AssemblyChapter[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.round(seconds % 60);
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    };

    const loadPrepData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/audiobook/prepare');
            const data: AssemblyPrep = await res.json();
            const sorted = [...data.chapters].sort((a, b) =>
                a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
            );
            setChapters(sorted);
            setSelectedFiles(new Set(sorted.map(c => c.filename)));
        } catch (err) {
            console.error('Failed to prepare assembly', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPrepData();
    }, []);

    const handleToggleFile = (filename: string) => {
        const next = new Set(selectedFiles);
        if (next.has(filename)) next.delete(filename);
        else next.add(filename);
        setSelectedFiles(next);
    };

    const handleTitleChange = (filename: string, newTitle: string) => {
        setChapters(prev => prev.map(c => c.filename === filename ? { ...c, title: newTitle } : c));
    };

    const handleToggleAll = () => {
        if (selectedFiles.size > 0) setSelectedFiles(new Set());
        else setSelectedFiles(new Set(chapters.map(c => c.filename)));
    };

    const handleSortAlphabetical = () => {
        const sorted = [...chapters].sort((a, b) =>
            a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
        );
        setChapters(sorted);
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setCoverPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedChapters = chapters.filter(c => selectedFiles.has(c.filename));
        if (selectedChapters.length === 0) {
            alert("No chapters selected to assemble.");
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            if (author) formData.append('author', author);
            if (narrator) formData.append('narrator', narrator);
            formData.append('chapters', JSON.stringify(selectedChapters.map(c => ({
                filename: c.filename,
                title: c.title
            }))));
            if (coverFile) {
                formData.append('cover', coverFile);
            }

            const res = await fetch('/create_audiobook', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                onRefresh();
                // Reset form or show success
                setTitle('');
                setCoverFile(null);
                setCoverPreview(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedData = chapters.filter(c => selectedFiles.has(c.filename));
    const totalDurationSeconds = selectedData.reduce((acc: number, c: any) => acc + (c.duration || 0), 0);

    return (
        <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', height: 'calc(100vh - 120px)', minHeight: '600px' }}>
            {/* Left Sidebar: Library */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRight: '1px solid var(--border)', paddingRight: '1.5rem', overflowY: 'auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>The Library</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{audiobooks.length} Books</span>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {audiobooks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.5 }}>
                            <FileAudio size={32} style={{ marginBottom: '0.5rem' }} />
                            <p style={{ fontSize: '0.8rem' }}>No audiobooks yet.</p>
                        </div>
                    ) : (
                        audiobooks.map(b => (
                            <motion.div
                                key={b}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-panel"
                                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="icon-circle" style={{ width: '32px', height: '32px', flexShrink: 0 }}>
                                        <FileAudio size={16} />
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b}>{b}</h4>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>M4B Audiobook</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (confirm(`Delete ${b}?`)) {
                                                await fetch(`/api/audiobook/${encodeURIComponent(b)}`, { method: 'DELETE' });
                                                onRefresh();
                                            }
                                        }}
                                        className="btn-ghost"
                                        style={{ padding: '4px', color: 'var(--error-muted)' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <a href={`/out/audiobook/${b}`} download className="btn-glass" style={{ flex: 1, textDecoration: 'none', fontSize: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '6px' }}>
                                        <Download size={14} /> Download
                                    </a>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </aside>

            {/* Main Content: Assembly Hub */}
            <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
                <header>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Audiobook Assembler</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Combine your chapters into a single high-quality M4B file with metadata and cover art.</p>
                </header>

                {audiobookJob && (audiobookJob.status === 'running' || audiobookJob.status === 'queued') && (() => {
                    const { remaining, progress } = progressHelper(audiobookJob);
                    return (
                        <section className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--accent)', background: 'var(--accent-glow)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Package className="animate-pulse" size={18} color="var(--accent)" />
                                    Processing: {audiobookJob.chapter_file}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                        {Math.round(progress * 100)}%
                                    </span>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        {audiobookJob.status === 'running'
                                            ? (remaining !== null ? `ETA: ${formatSeconds(remaining)}` : `ETA: ${audiobookJob.eta_seconds}s`)
                                            : 'Queued...'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div
                                    className="progress-bar-animated"
                                    style={{
                                        height: '100%',
                                        width: `${Math.max(progress, 0.05) * 100}%`,
                                        backgroundColor: 'var(--accent)',
                                        transition: 'width 1s linear'
                                    }}
                                />
                            </div>
                        </section>
                    );
                })()}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '2rem' }}>
                        {/* Cover Upload Area */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Cover Art</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    aspectRatio: '1/1',
                                    borderRadius: '12px',
                                    border: '2px dashed var(--border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    background: 'rgba(255,255,255,0.02)',
                                    transition: 'all 0.2s ease'
                                }}
                                className="hover-lift"
                            >
                                {coverPreview ? (
                                    <>
                                        <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Cover Preview" />
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }} className="hover-opacity-100">
                                            <ImageIcon size={24} />
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                                        <ImageIcon size={32} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to upload cover image</p>
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleCoverChange} accept="image/*" style={{ display: 'none' }} />
                            {coverFile && (
                                <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }} className="btn-ghost" style={{ fontSize: '0.7rem', color: 'var(--error)' }}>
                                    Remove Cover
                                </button>
                            )}
                        </div>

                        {/* Metadata Inputs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Book Title</label>
                                <input
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Enter audiobook title"
                                    className="glass-panel"
                                    style={{
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-primary)',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '8px',
                                        outline: 'none',
                                        fontSize: '1rem',
                                        width: '100%'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                        <User size={12} style={{ marginRight: '4px' }} /> Author
                                    </label>
                                    <input
                                        value={author}
                                        onChange={e => setAuthor(e.target.value)}
                                        placeholder="Optional"
                                        className="glass-panel"
                                        style={{
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '8px',
                                            outline: 'none',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                        <Mic size={12} style={{ marginRight: '4px' }} /> Narrator
                                    </label>
                                    <input
                                        value={narrator}
                                        onChange={e => setNarrator(e.target.value)}
                                        placeholder="Optional"
                                        className="glass-panel"
                                        style={{
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '8px',
                                            outline: 'none',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chapters List */}
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Generation List</h3>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={handleSortAlphabetical} className="btn-ghost" style={{ fontSize: '0.75rem', gap: '6px' }}>
                                    <SortAsc size={14} /> Sort Alphabetically
                                </button>
                                <button type="button" onClick={handleToggleAll} className="btn-ghost" style={{ fontSize: '12px' }}>
                                    {selectedFiles.size === chapters.length ? 'Deselect All' : 'Select All'}
                                </button>
                                <button type="button" onClick={loadPrepData} className="btn-ghost" style={{ fontSize: '12px' }}>
                                    Refresh List
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <Loader2 className="animate-spin" color="var(--accent)" />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scanning outputs...</span>
                            </div>
                        ) : chapters.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <Package size={32} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                                <p>No completed chapters found in outputs.</p>
                            </div>
                        ) : (
                            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                                <Reorder.Group axis="y" values={chapters} onReorder={setChapters} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {chapters.map((c) => (
                                        <Reorder.Item
                                            key={c.filename}
                                            value={c}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '40px 30px 1fr 100px',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '10px',
                                                background: 'rgba(255,255,255,0.02)',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border)',
                                                opacity: selectedFiles.has(c.filename) ? 1 : 0.4,
                                                cursor: 'grab'
                                            }}
                                            whileDrag={{
                                                scale: 1.02,
                                                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                                                border: '1px solid var(--accent)',
                                                background: 'rgba(255,255,255,0.06)',
                                                zIndex: 10
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                <GripVertical size={16} />
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={selectedFiles.has(c.filename)}
                                                onChange={() => handleToggleFile(c.filename)}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                                <input
                                                    value={c.title}
                                                    onChange={(e) => handleTitleChange(c.filename, e.target.value)}
                                                    disabled={!selectedFiles.has(c.filename)}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        borderBottom: '1px solid transparent',
                                                        color: 'var(--text-primary)',
                                                        padding: '2px 0',
                                                        fontSize: '0.9rem',
                                                        width: '100%',
                                                        outline: 'none',
                                                        fontWeight: 500
                                                    }}
                                                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent)'}
                                                    onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
                                                />
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {c.filename}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 600 }}>
                                                {formatDuration(c.duration)}
                                            </span>
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="icon-circle" style={{ width: '48px', height: '48px', background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
                                <Info color="var(--accent)" />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                    {selectedFiles.size} Chapters Selected
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Total Duration: {formatDuration(totalDurationSeconds)}
                                </p>
                            </div>
                        </div>
                        <button
                            disabled={submitting || selectedFiles.size === 0 || !title}
                            className="btn-primary"
                            style={{ padding: '0.85rem 2.5rem', fontWeight: 600, fontSize: '1rem' }}
                        >
                            {submitting ? (
                                <><Loader2 className="animate-spin" size={18} /> Queuing...</>
                            ) : (
                                <><Package size={18} /> Confirm & Assemble</>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
};
