import React, { useState, useEffect, useRef } from 'react';
import { Book, Plus, Trash2, Clock, User, Image as ImageIcon, Loader2, Settings, Check, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Project } from '../types';
import { api } from '../api';

interface ProjectLibraryProps {
    onSelectProject: (projectId: string) => void;
    settings: any;
    onRefresh: () => void;
    hideFinished: boolean;
    onToggleHideFinished: () => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({ 
    onSelectProject, 
    settings, 
    onRefresh, 
    hideFinished, 
    onToggleHideFinished 
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [title, setTitle] = useState('');
    const [series, setSeries] = useState('');
    const [author, setAuthor] = useState('');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Settings Tray state
    const [showSettings, setShowSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const loadProjects = async () => {
        try {
            const data = await api.fetchProjects();
            setProjects(data);
        } catch (e) {
            console.error("Failed to load projects", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelection(file);
    };

    const handleFileSelection = (file: File) => {
        setCoverFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setCoverPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleFileSelection(file);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;
        setSubmitting(true);
        try {
            const res = await api.createProject({ name: title, series, author, cover: coverFile || undefined });
            if (res.status === 'success') {
                setShowModal(false);
                setTitle('');
                setSeries('');
                setAuthor('');
                setCoverFile(null);
                setCoverPreview(null);
                loadProjects();
                onSelectProject(res.project_id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteProject = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete the project '${name}' and all its chapters?`)) {
            try {
                await api.deleteProject(id);
                loadProjects();
            } catch (err) {
                console.error("Delete failed", err);
            }
        }
    };

    const handleImport = async () => {
        if (!window.confirm("This will scan for existing files in 'chapters_out' and 'xtts_audio' and create a new project for them. Continue?")) return;
        setImporting(true);
        try {
            const res = await api.importLegacyData();
            if (res.status === 'success') {
                alert(res.message);
                loadProjects();
                if (res.project_id) {
                    onSelectProject(res.project_id);
                }
            } else {
                alert("Import failed: " + res.message);
            }
        } catch (e) {
            console.error(e);
            alert("Import failed. Check console for details.");
        } finally {
            setImporting(false);
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent)" />
            </div>
        );
    }

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100%' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Library shelf</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage your audiobook projects</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`btn-ghost ${showSettings ? 'active' : ''}`}
                        style={{ 
                            padding: '0.75rem', 
                            borderRadius: '12px', 
                            border: '1px solid var(--border)',
                            color: showSettings ? 'var(--accent)' : 'var(--text-muted)',
                            background: showSettings ? 'rgba(139, 92, 246, 0.1)' : 'var(--glass)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Synthesis Preferences"
                    >
                        <Settings size={20} className={showSettings ? 'animate-spin-slow' : ''} />
                    </button>

                    <button 
                        onClick={handleImport}
                        disabled={importing}
                        className="btn-ghost" 
                        style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border)', borderRadius: '12px' }}
                    >
                        {importing ? <Loader2 size={18} className="animate-spin" /> : <Book size={18} />}
                        Import Legacy Data
                    </button>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="btn-primary" 
                        style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}
                    >
                        <Plus size={18} /> New Project
                    </button>
                </div>
            </header>

            {/* Synthesis Preferences Tray */}
            {showSettings && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="glass-panel"
                    style={{ 
                        padding: '1.5rem', 
                        border: '1px solid var(--accent)', 
                        background: 'rgba(10, 10, 12, 0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Settings size={16} color="var(--accent)" />
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Synthesis Preferences</h3>
                        </div>
                        {savingSettings && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', animation: 'pulse 2s infinite' }}>Saving...</span>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '2px' }}>Safe Mode</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prevent TTS engine crashes</p>
                                </div>
                                <button 
                                    onClick={async () => {
                                        setSavingSettings(true);
                                        try {
                                            const formData = new URLSearchParams();
                                            formData.append('safe_mode', (!settings?.safe_mode).toString());
                                            await fetch('/settings', { method: 'POST', body: formData });
                                            onRefresh();
                                        } finally { setSavingSettings(false); }
                                    }}
                                    className={settings?.safe_mode ? 'btn-primary' : 'btn-glass'} 
                                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                                >
                                    {settings?.safe_mode ? <Check size={12} /> : null} {settings?.safe_mode ? 'On' : 'Off'}
                                </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '2px' }}>Produce MP3</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Compatible with all browsers</p>
                                </div>
                                <button 
                                    onClick={async () => {
                                        setSavingSettings(true);
                                        try {
                                            const formData = new URLSearchParams();
                                            formData.append('make_mp3', (!settings?.make_mp3).toString());
                                            await fetch('/settings', { method: 'POST', body: formData });
                                            onRefresh();
                                        } finally { setSavingSettings(false); }
                                    }}
                                    className={settings?.make_mp3 ? 'btn-primary' : 'btn-glass'} 
                                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                                >
                                    {settings?.make_mp3 ? <Check size={12} /> : null} {settings?.make_mp3 ? 'On' : 'Off'}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', marginBottom: '2px' }}>Hide Finished</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filter active chapters only</p>
                                </div>
                                <button onClick={onToggleHideFinished} className={hideFinished ? 'btn-primary' : 'btn-glass'} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                    {hideFinished ? <Check size={12} /> : null} {hideFinished ? 'Active' : 'Off'}
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                                <button 
                                    onClick={async () => {
                                        try {
                                            await fetch('/queue/backfill_mp3', { method: 'POST' });
                                            onRefresh();
                                            alert('Sync process started.');
                                        } catch(e) { console.error(e); }
                                    }}
                                    className="btn-glass" 
                                    style={{ flex: 1, fontSize: '0.75rem', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <RefreshCw size={14} /> Sync Files
                                </button>
                                <button 
                                    onClick={async () => {
                                        if (confirm('Wipe all jobs and logs?')) {
                                            try {
                                                await fetch('/queue/clear', { method: 'POST' });
                                                onRefresh();
                                            } catch(e) { console.error(e); }
                                        }
                                    }}
                                    className="btn-ghost" 
                                    style={{ flex: 1, fontSize: '0.75rem', padding: '10px', color: 'var(--error-muted)', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                                >
                                    Wipe History
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                    <Book size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
                    <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No projects found</p>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Create a new project to get started translating text into audio.</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {projects.map(project => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-panel hover-lift"
                            onClick={() => onSelectProject(project.id)}
                            style={{ 
                                cursor: 'pointer',
                                display: 'flex', 
                                flexDirection: 'column',
                                overflow: 'hidden',
                                padding: 0,
                                position: 'relative'
                            }}
                        >
                            <div style={{ 
                                aspectRatio: '1/1', 
                                background: 'var(--surface)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                {project.cover_image_path ? (
                                    <img 
                                        src={project.cover_image_path} 
                                        alt={project.name} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                ) : (
                                    <Book size={48} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                                )}
                            </div>
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project.name}>
                                    {project.name}
                                </h3>
                                {project.author && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <User size={12} /> {project.author}
                                    </p>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> {formatDate(project.updated_at)}
                                    </p>
                                    <button 
                                        className="btn-ghost" 
                                        onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                                        style={{ padding: '4px', color: 'var(--error-muted)' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Create Project Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)'
                }}>
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel"
                        style={{ width: '100%', maxWidth: '500px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--border)' }}
                    >
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Create New Project</h3>
                        <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className="hover-lift"
                                    style={{
                                        width: '120px',
                                        height: '120px',
                                        flexShrink: 0,
                                        borderRadius: '8px',
                                        border: isDragging ? '2px solid var(--accent)' : '2px dashed var(--border)',
                                        background: isDragging ? 'rgba(139, 92, 246, 0.1)' : 'var(--surface)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {coverPreview ? (
                                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                            <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Cover Preview" />
                                            {isDragging && (
                                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(139, 92, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <ImageIcon size={32} color="white" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                                            <ImageIcon size={24} style={{ margin: '0 auto 0.25rem auto', opacity: isDragging ? 1 : 0.5, color: isDragging ? 'var(--accent)' : 'inherit' }} />
                                            <p style={{ fontSize: '0.65rem', color: isDragging ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                                                {isDragging ? 'Drop Image' : 'Add Cover'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleCoverChange} accept="image/*" style={{ display: 'none' }} />

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Title *</label>
                                        <input
                                            autoFocus
                                            required
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder="Enter project title"
                                            style={{
                                                background: 'var(--surface-light)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                padding: '0.6rem 0.8rem',
                                                borderRadius: '6px',
                                                outline: 'none',
                                                fontSize: '0.9rem',
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Author</label>
                                        <input
                                            value={author}
                                            onChange={e => setAuthor(e.target.value)}
                                            placeholder="Optional"
                                            style={{
                                                background: 'var(--surface-light)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                padding: '0.6rem 0.8rem',
                                                borderRadius: '6px',
                                                outline: 'none',
                                                fontSize: '0.9rem',
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Series</label>
                                        <input
                                            value={series}
                                            onChange={e => setSeries(e.target.value)}
                                            placeholder="Optional"
                                            style={{
                                                background: 'var(--surface-light)',
                                                border: '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                padding: '0.6rem 0.8rem',
                                                borderRadius: '6px',
                                                outline: 'none',
                                                fontSize: '0.9rem',
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: '0.6rem 1.25rem' }}>
                                    Cancel
                                </button>
                                <button disabled={submitting || !title} type="submit" className="btn-primary" style={{ padding: '0.6rem 1.25rem', width: '120px', display: 'flex', justifyContent: 'center' }}>
                                    {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Create'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};
