import React, { useState, useEffect, useRef } from 'react';
import { Book, Plus, Trash2, Clock, User, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Project } from '../types';
import { api } from '../api';

interface ProjectLibraryProps {
    onSelectProject: (projectId: string) => void;
}

export const ProjectLibrary: React.FC<ProjectLibraryProps> = ({ onSelectProject }) => {
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
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '3rem', minHeight: '100%' }}>
            {/* Hero Section */}
            <header style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '4rem 0 2rem 0',
                borderBottom: '1px solid var(--border)'
            }}>
                <div style={{ maxWidth: '600px' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                        Create Natural-Sounding Audiobooks with AI
                    </h2>
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '2rem' }}>
                        Professional AI voice generation lab for content creators and authors.
                    </p>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="btn-primary" 
                        style={{ padding: '0.85rem 2rem', fontSize: '1rem', borderRadius: '14px' }}
                    >
                        <Plus size={20} /> New Project
                    </button>
                </div>
                <div style={{ 
                    width: '320px', 
                    height: '240px', 
                    background: 'var(--surface)', 
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--border)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        position: 'absolute', 
                        inset: 0, 
                        background: 'linear-gradient(135deg, rgba(43, 110, 255, 0.05) 0%, transparent 100%)' 
                    }} />
                    <img src="/logo.png" alt="Audiobook Studio" style={{ width: '80px', height: '80px', opacity: 0.8, position: 'relative', zIndex: 1 }} />
                </div>
            </header>


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
                            className="hover-lift"
                            onClick={() => onSelectProject(project.id)}
                            style={{ 
                                cursor: 'pointer',
                                display: 'flex', 
                                flexDirection: 'column',
                                overflow: 'hidden',
                                padding: 0,
                                position: 'relative',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: 'var(--shadow-sm)',
                                transition: 'all 0.2s ease'
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
                        style={{ 
                            width: '100%', 
                            maxWidth: '520px', 
                            padding: '2.5rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '2rem', 
                            background: 'var(--surface)',
                            borderRadius: '24px',
                            boxShadow: 'var(--shadow-lg)',
                            border: '1px solid var(--border)'
                        }}
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
