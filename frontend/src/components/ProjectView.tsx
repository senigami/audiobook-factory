import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, FileText, CheckCircle, Clock, AlertTriangle, Edit3, Trash2, GripVertical } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { api } from '../api';
import type { Project, Chapter } from '../types';
import { ChapterEditor } from './ChapterEditor';

interface ProjectViewProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [projData, chapsData] = await Promise.all([
        api.fetchProject(projectId),
        api.fetchChapters(projectId)
      ]);
      setProject(projData);
      setChapters(chapsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    setSubmitting(true);
    try {
      await api.createChapter(projectId, {
        title: newTitle,
        text_content: newText,
        sort_order: chapters.length,
        file: newFile || undefined
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewText('');
      setNewFile(null);
      loadData();
    } catch (e) {
      console.error("Failed to create chapter", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (window.confirm("Are you sure you want to delete this chapter?")) {
      try {
        await api.deleteChapter(chapterId);
        loadData();
      } catch (e) {
        console.error("Delete failed", e);
      }
    }
  };

  const formatLength = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const handleReorder = async (reorderedChapters: Chapter[]) => {
    setChapters(reorderedChapters);
    try {
        await api.reorderChapters(projectId, reorderedChapters.map(c => c.id));
        // We do a silent save, no need to reload all data if UI is optimistic
    } catch (e) {
        console.error("Failed to save chapter order", e);
        loadData(); // revert on failure
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading project...</div>;
  if (!project) return <div style={{ padding: '2rem' }}>Project not found.</div>;

  if (editingChapterId) {
      return <ChapterEditor 
          chapterId={editingChapterId} 
          projectId={projectId} 
          onBack={() => {
              setEditingChapterId(null);
              loadData();
          }} 
      />;
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100%', paddingBottom: '4rem' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={onBack} className="btn-ghost" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>{project.name}</h2>
          {project.author && <p style={{ color: 'var(--text-muted)' }}>by {project.author}</p>}
        </div>
        <div style={{ marginLeft: 'auto' }}>
            <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} /> Add Chapter
            </button>
        </div>
      </header>

      {/* Chapters List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {chapters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)' }}>No chapters yet. Add one to get started.</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={chapters} onReorder={handleReorder} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {chapters.map((chap, idx) => (
              <Reorder.Item 
                key={chap.id}
                value={chap}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '1.5rem',
                  alignItems: 'center',
                  cursor: 'grab'
                }}
                whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 50, cursor: 'grabbing' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ cursor: 'grab', color: 'var(--text-muted)' }} title="Drag to reorder">
                        <GripVertical size={20} />
                    </div>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)'
                    }}>
                        {idx + 1}
                    </div>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{chap.title}</h4>
                    {chap.audio_status === 'done' && <CheckCircle size={14} color="var(--success-muted)" />}
                    {chap.audio_status === 'processing' && <Clock size={14} color="var(--warning)" />}
                    {chap.text_last_modified && chap.audio_generated_at && (chap.text_last_modified > chap.audio_generated_at) && (
                      <span title="Text modified since last audio generation" style={{ display: 'flex', alignItems: 'center' }}>
                        <AlertTriangle size={14} color="var(--error-muted)" />
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>{chap.word_count.toLocaleString()} words</span>
                    <span>~{formatLength(chap.predicted_audio_length)} runtime</span>
                    <span style={{ textTransform: 'capitalize' }}>Status: {chap.audio_status}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setEditingChapterId(chap.id)} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--text-secondary)' }} title="Edit Text">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => handleDeleteChapter(chap.id)} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--error-muted)' }} title="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>

      {/* Add Chapter Modal */}
      {showAddModal && (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)'
        }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel"
                style={{ width: '100%', maxWidth: '600px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--border)' }}
            >
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Add New Chapter</h3>
                <form onSubmit={handleCreateChapter} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Chapter Title *</label>
                        <input
                            required
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder="e.g. Chapter 1"
                            style={{
                                background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                                padding: '0.75rem', borderRadius: '8px', width: '100%', outline: 'none'
                            }}
                        />
                    </div>
                    
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Upload Manuscript (Optional)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={e => setNewFile(e.target.files?.[0] || null)}
                                accept=".txt"
                                style={{ display: 'none' }}
                            />
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-ghost"
                                style={{ border: '1px dashed var(--border)', padding: '0.75rem 1.5rem' }}
                            >
                                {newFile ? newFile.name : 'Choose .txt File...'}
                            </button>
                            {newFile && (
                                <button type="button" onClick={() => setNewFile(null)} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--error-muted)' }}>
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {!newFile && (
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Or Paste Text</label>
                            <textarea
                                value={newText}
                                onChange={e => setNewText(e.target.value)}
                                placeholder="Paste your chapter text here..."
                                rows={6}
                                style={{
                                    background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                                    padding: '0.75rem', borderRadius: '8px', width: '100%', outline: 'none', resize: 'vertical', fontFamily: 'monospace'
                                }}
                            />
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">Cancel</button>
                        <button type="submit" disabled={submitting || !newTitle} className="btn-primary" style={{ minWidth: '100px' }}>
                            {submitting ? 'Saving...' : 'Add Chapter'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
      )}
    </div>
  );
};
