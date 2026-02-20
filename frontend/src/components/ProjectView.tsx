import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, FileText, CheckCircle, Clock, AlertTriangle, Edit3, Trash2, GripVertical, Zap, Play, Image as ImageIcon, ArrowUpDown, CheckSquare, Square } from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import { api } from '../api';
import type { Project, Chapter, Job, Audiobook } from '../types';
import { ChapterEditor } from './ChapterEditor';

interface ProjectViewProps {
  projectId: string;
  jobs: Record<string, Job>;
  onBack: () => void;
  onNavigateToQueue: () => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ projectId, jobs, onBack, onNavigateToQueue }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [availableAudiobooks, setAvailableAudiobooks] = useState<Audiobook[]>([]);
  const [isAssemblyMode, setIsAssemblyMode] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editProjectData, setEditProjectData] = useState({ name: '', series: '', author: '' });
  const [editCover, setEditCover] = useState<File | null>(null);
  const editCoverInputRef = useRef<HTMLInputElement>(null);
  const [newText, setNewText] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [projData, chapsData, audiobooksData] = await Promise.all([
        api.fetchProject(projectId),
        api.fetchChapters(projectId),
        api.fetchAudiobooks()
      ]);
      setProject(projData);
      setChapters(chapsData);
      
      // Look for assembled audiobooks matching this project's name
      if (projData) {
          const projectM4bs = audiobooksData.filter((a: Audiobook) => a.filename.includes(projData.name));
          setAvailableAudiobooks(projectM4bs);
      }
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

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
        await api.updateProject(projectId, {
            name: editProjectData.name,
            series: editProjectData.series,
            author: editProjectData.author,
            cover: editCover || undefined
        });
        setShowEditProjectModal(false);
        setEditCover(null);
        loadData();
    } catch (e) {
        console.error("Failed to update project", e);
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
    
    if (mins < 60) return `${mins}m ${secs}s`;
    
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
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

  const handleQueueChapter = async (chap: Chapter) => {
    if (chap.char_count > 50000) {
        const proceed = window.confirm(`This chapter is quite long (${chap.char_count.toLocaleString()} characters). Generating audio for very large chapters in a single job may cause memory issues or take a long time to recover if interrupted.\n\nIt is recommended to split this chapter manually into smaller parts.\n\nDo you wish to queue it anyway?`);
        if (!proceed) return;
    }
    try {
        await api.addProcessingQueue(projectId, chap.id, 0);
        loadData();
    } catch (e) {
        console.error("Failed to enqueue", e);
    }
  };

  const handleQueueAllUnprocessed = async () => {
      const unprocessed = chapters.filter(c => c.audio_status === 'unprocessed' || c.audio_status === 'error');
      if (unprocessed.length === 0) {
          alert("All chapters are already processed or queued.");
          return;
      }

      setSubmitting(true);
      try {
          for (const chap of unprocessed) {
              await api.addProcessingQueue(projectId, chap.id, 0);
          }
          loadData();
          onNavigateToQueue();
      } catch (e) {
          console.error("Failed to enqueue all", e);
          alert("Some chapters failed to queue.");
      } finally {
          setSubmitting(false);
      }
  };

  const handleStartAssemblyMode = () => {
    const defaultSelected = new Set(chapters.filter(c => c.audio_status === 'done').map(c => c.id));
    setSelectedChapters(defaultSelected);
    setIsAssemblyMode(true);
  };

  const handleConfirmAssembly = async () => {
    if (selectedChapters.size === 0) {
        alert("Please select at least one chapter to assemble.");
        return;
    }
    setSubmitting(true);
    try {
        await api.assembleProject(projectId, Array.from(selectedChapters));
        setIsAssemblyMode(false);
        loadData();
    } catch (e) {
        console.error("Assembly failed", e);
        alert("Assembly failed.");
    } finally {
        setSubmitting(false);
    }
  };

  const handleSortChapters = async () => {
      const sorted = [...chapters].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
      await handleReorder(sorted);
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading project...</div>;
  if (!project) return <div style={{ padding: '2rem' }}>Project not found.</div>;

  const activeAssemblyJob = Object.values(jobs).find(j => j.engine === 'audiobook' && j.chapter_file === project.name && j.status === 'running');
  const finishedAssemblyJob = Object.values(jobs).find(j => j.engine === 'audiobook' && j.chapter_file === project.name && j.status === 'done');

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

  // Calculate total active runtime
  const totalRuntime = chapters.reduce((acc, chap) => {
      return acc + (chap.audio_status === 'done' ? (chap.audio_length_seconds || chap.predicted_audio_length || 0) : 0);
  }, 0);
  
  const totalPredicted = chapters.reduce((acc, chap) => acc + (chap.predicted_audio_length || 0), 0);

  const bestM4b = availableAudiobooks.length > 0 ? availableAudiobooks[0] : null;

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100%', paddingBottom: '4rem' }}>
      {/* Header Overview */}
      <header style={{ 
          background: 'var(--surface)', 
          borderRadius: '16px', 
          border: '1px solid var(--border)', 
          padding: '2rem',
          display: 'flex', 
          gap: '2rem',
          alignItems: 'center'
      }}>
        {/* Project Cover Art */}
        <div 
            onClick={() => project.cover_image_path ? setShowCoverModal(true) : null}
            style={{
                width: '160px',
                height: '160px',
                flexShrink: 0,
                borderRadius: '12px',
                background: 'var(--surface-light)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: project.cover_image_path ? 'zoom-in' : 'default',
                transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => { if (project.cover_image_path) e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseOut={(e) => { if (project.cover_image_path) e.currentTarget.style.transform = 'scale(1)' }}
        >
            {project.cover_image_path ? (
                <img src={project.cover_image_path} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
                <ImageIcon size={48} style={{ opacity: 0.2 }} />
            )}
        </div>

        {/* Project Metadata */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <button onClick={onBack} className="btn-ghost" style={{ padding: '0.5rem', marginLeft: '-0.5rem' }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ background: 'var(--surface-light)', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-block' }}>
                    {project.series || 'Standalone'}
                </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.1 }}>{project.name}</h2>
                <button 
                  onClick={() => {
                      setEditProjectData({ name: project.name, series: project.series || '', author: project.author || '' });
                      setShowEditProjectModal(true);
                  }} 
                  className="btn-ghost" 
                  style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}
                  title="Edit Project Metadata"
                >
                    <Edit3 size={18} />
                </button>
            </div>
            {project.author && <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>by {project.author}</p>}
            
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} /> 
                    <span>Runtime: <strong style={{ color: 'var(--text-primary)' }}>{formatLength(totalRuntime)}</strong> {totalRuntime < totalPredicted && `(Predicted: ${formatLength(totalPredicted)})`}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={16} />
                    <span>Created: <strong style={{ color: 'var(--text-primary)' }}>{new Date(project.created_at * 1000).toLocaleDateString()}</strong></span>
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '220px' }}>
            {bestM4b ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <a href={`/out/audiobooks/${bestM4b.filename}`} download className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '1rem', width: '100%', fontSize: '1rem', textDecoration: 'none' }}>
                        <Play size={20} />
                        Play / Download
                    </a>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>{bestM4b.filename}</p>
                </div>
            ) : (
                <button className="btn-primary" disabled style={{ padding: '1rem', opacity: 0.5, cursor: 'not-allowed' }}>
                    No Assembly Yet
                </button>
            )}

            <button
                className="btn-ghost"
                onClick={handleStartAssemblyMode}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    border: '1px solid var(--border)', padding: '0.75rem'
                }}
            >   
                <CheckCircle size={16} />
                Assemble Audiobook
            </button>
            <button className="btn-ghost" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border)', padding: '0.75rem' }}>
                <Plus size={16} /> Add Chapter
            </button>
        </div>
      </header>

      {/* Assembly Progress */}
      {activeAssemblyJob && (
          <div style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontWeight: 600 }}>Assembling {project.name}...</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {Math.round(activeAssemblyJob.progress * 100)}%
                  </div>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${activeAssemblyJob.progress * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  ETA: {activeAssemblyJob.eta_seconds ? `${Math.floor(activeAssemblyJob.eta_seconds / 60)}m ${activeAssemblyJob.eta_seconds % 60}s` : 'Calculating...'}
              </div>
          </div>
      )}

      {finishedAssemblyJob && !activeAssemblyJob && (
          <div style={{ background: 'var(--success-muted)', color: '#fff', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={20} />
              <span>Audiobook assembled successfully! {finishedAssemblyJob.output_mp3}</span>
          </div>
      )}

      {/* Assembly Progress */}
      {activeAssemblyJob && (
          <div style={{ background: 'var(--surface-light)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontWeight: 600 }}>Assembling {project.name}...</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {Math.round(activeAssemblyJob.progress * 100)}%
                  </div>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${activeAssemblyJob.progress * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  ETA: {activeAssemblyJob.eta_seconds ? `${Math.floor(activeAssemblyJob.eta_seconds / 60)}m ${activeAssemblyJob.eta_seconds % 60}s` : 'Calculating...'}
              </div>
          </div>
      )}

      {finishedAssemblyJob && !activeAssemblyJob && (
          <div style={{ background: 'var(--success-muted)', color: '#fff', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={20} />
              <span>Audiobook assembled successfully! {finishedAssemblyJob.output_mp3}</span>
          </div>
      )}

      {/* Chapters List */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
              {isAssemblyMode ? 'Select Chapters for Assembly' : 'Chapters'}
          </h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {isAssemblyMode ? (
                  <>
                      <button onClick={() => setIsAssemblyMode(false)} className="btn-ghost" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                          Cancel
                      </button>
                      <button 
                          onClick={handleConfirmAssembly} 
                          disabled={submitting || selectedChapters.size === 0} 
                          className="btn-primary" 
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                          <CheckCircle size={16} /> Confirm Assembly
                      </button>
                  </>
              ) : (
                  <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.25rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project Voice:</span>
                          <select 
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', cursor: 'pointer' }}
                              defaultValue="Cozy Narrator"
                          >
                              <option>Cozy Narrator</option>
                              <option>Deep Voice</option>
                              <option>British Female</option>
                          </select>
                      </div>
                      <button 
                          onClick={handleSortChapters}
                          className="btn-ghost" 
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border)' }}
                      >
                          <ArrowUpDown size={16} /> Sort A-Z
                      </button>
                      <button 
                          onClick={handleQueueAllUnprocessed}
                          disabled={submitting || chapters.filter(c => c.audio_status === 'unprocessed' || c.audio_status === 'error').length === 0}
                          className="btn-primary" 
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                          <Zap size={16} /> Queue All Unprocessed
                      </button>
                  </>
              )}
          </div>
      </div>

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
                  padding: '0.75rem 1.25rem',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '1.5rem',
                  alignItems: 'center',
                  cursor: 'grab'
                }}
                whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 50, cursor: 'grabbing' }}
                dragListener={!isAssemblyMode}
                onClick={() => {
                    if (isAssemblyMode && chap.audio_status === 'done') {
                        const newSet = new Set(selectedChapters);
                        if (newSet.has(chap.id)) newSet.delete(chap.id);
                        else newSet.add(chap.id);
                        setSelectedChapters(newSet);
                    }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {isAssemblyMode ? (
                        <div style={{ color: chap.audio_status === 'done' ? 'var(--accent)' : 'var(--border)', cursor: chap.audio_status === 'done' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center' }}>
                            {selectedChapters.has(chap.id) && chap.audio_status === 'done' ? <CheckSquare size={24} /> : <Square size={24} />}
                        </div>
                    ) : (
                        <div style={{ cursor: 'grab', color: 'var(--text-muted)' }} title="Drag to reorder">
                            <GripVertical size={20} />
                        </div>
                    )}
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: 'var(--surface-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)'
                    }}>
                        {idx + 1}
                    </div>
                </div>
                <div 
                  onClick={() => { if (!isAssemblyMode) setEditingChapterId(chap.id); }}
                  style={{ flex: 1, opacity: isAssemblyMode && chap.audio_status !== 'done' ? 0.4 : 1, cursor: isAssemblyMode ? 'default' : 'pointer', padding: '0.5rem 0' }}
                  title={isAssemblyMode ? "" : "Click to edit chapter"}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{chap.title}</h4>
                    {chap.audio_status === 'done' && <span title="Audio Generated"><CheckCircle size={14} color="var(--success)" /></span>}
                    {chap.audio_status === 'processing' && <span title="Generating Audio..."><Clock size={14} color="var(--warning)" /></span>}
                    {chap.audio_status === 'error' && <span title="Generation Failed"><AlertTriangle size={14} color="var(--error)" /></span>}
                    {chap.text_last_modified && chap.audio_generated_at && chap.audio_generated_at > 0 && (chap.text_last_modified > chap.audio_generated_at) && (
                      <span title="Text modified since last audio generation" style={{ display: 'flex', alignItems: 'center' }}>
                        <AlertTriangle size={14} color="var(--warning)" />
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>{(chap.audio_length_seconds > 0) ? `${formatLength(chap.audio_length_seconds)} runtime` : `~${formatLength(chap.predicted_audio_length)} runtime`}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: isAssemblyMode ? 0.3 : 1, pointerEvents: isAssemblyMode ? 'none' : 'auto' }}>
                  {chap.audio_status === 'done' && chap.audio_file_path && !isAssemblyMode && (
                      <audio 
                          controls 
                          src={`/out/xtts/${chap.audio_file_path}`} 
                          style={{ height: '32px', maxWidth: '260px' }}
                          onClick={e => e.stopPropagation()}
                          onPointerDown={e => e.stopPropagation()} 
                      />
                  )}
                  
                  <div style={{ display: 'flex', gap: '0.25rem', borderLeft: chap.audio_status === 'done' ? '1px solid var(--border)' : 'none', paddingLeft: chap.audio_status === 'done' ? '1rem' : '0' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleQueueChapter(chap); }} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--accent)' }} title="Add to Generation Queue">
                        <Zap size={18} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingChapterId(chap.id); }} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--text-secondary)' }} title="Edit Text">
                        <Edit3 size={18} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chap.id); }} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--error-muted)' }} title="Delete">
                        <Trash2 size={18} />
                      </button>
                  </div>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>

      {/* Cover Image Modal */}
      {showCoverModal && project.cover_image_path && (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)'
        }} onClick={() => setShowCoverModal(false)}>
            <img 
                src={project.cover_image_path} 
                alt="Enlarged Cover" 
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} 
                onClick={e => e.stopPropagation()}
            />
        </div>
      )}

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

      {/* Edit Project Modal */}
      {showEditProjectModal && (
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit Project Details</h3>
                <form onSubmit={handleUpdateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Project Name *</label>
                        <input
                            required
                            value={editProjectData.name}
                            onChange={e => setEditProjectData({...editProjectData, name: e.target.value})}
                            style={{
                                background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                                padding: '0.75rem', borderRadius: '8px', width: '100%', outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Series (Optional)</label>
                            <input
                                value={editProjectData.series}
                                onChange={e => setEditProjectData({...editProjectData, series: e.target.value})}
                                style={{
                                    background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                                    padding: '0.75rem', borderRadius: '8px', width: '100%', outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Author (Optional)</label>
                            <input
                                value={editProjectData.author}
                                onChange={e => setEditProjectData({...editProjectData, author: e.target.value})}
                                style={{
                                    background: 'var(--surface-light)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                                    padding: '0.75rem', borderRadius: '8px', width: '100%', outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>Update Cover Art (Optional)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <input 
                                type="file" 
                                ref={editCoverInputRef} 
                                onChange={e => setEditCover(e.target.files?.[0] || null)}
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                            <button 
                                type="button" 
                                onClick={() => editCoverInputRef.current?.click()}
                                className="btn-ghost"
                                style={{ border: '1px dashed var(--border)', padding: '0.75rem 1.5rem', flex: 1 }}
                            >
                                {editCover ? editCover.name : 'Choose New Image...'}
                            </button>
                            {editCover && (
                                <button type="button" onClick={() => setEditCover(null)} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--error-muted)' }}>
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button type="button" onClick={() => setShowEditProjectModal(false)} className="btn-ghost">Cancel</button>
                        <button type="submit" disabled={submitting || !editProjectData.name} className="btn-primary" style={{ minWidth: '100px' }}>
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
      )}
    </div>
  );
};
