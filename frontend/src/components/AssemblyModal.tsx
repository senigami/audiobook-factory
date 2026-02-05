import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Info, Loader2 } from 'lucide-react';
import type { AssemblyChapter, AssemblyPrep } from '../types';

interface AssemblyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any) => Promise<void>;
}

export const AssemblyModal: React.FC<AssemblyModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [narrator, setNarrator] = useState('');
  const [chapters, setChapters] = useState<AssemblyChapter[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/audiobook/prepare')
        .then(res => res.json())
        .then((data: AssemblyPrep) => {
          setChapters(data.chapters);
          setSelectedFiles(new Set(data.chapters.map(c => c.filename)));
        })
        .catch(err => console.error('Failed to prepare assembly', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
    if (selectedFiles.size > 0) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(chapters.map(c => c.filename)));
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
      await onConfirm({ title, author, narrator, chapters: selectedChapters });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedData = chapters.filter(c => selectedFiles.has(c.filename));
  const totalDurationSeconds = selectedData.reduce((acc, c) => acc + (c.duration || 0), 0);
  const totalM = Math.floor(totalDurationSeconds / 60);
  const totalS = Math.round(totalDurationSeconds % 60);

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="glass-panel"
          style={{
            maxWidth: '600px',
            width: '100%',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Package color="var(--accent)" /> Assemble M4B
            </h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>
          </div>

          {loading ? (
             <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Loader2 className="animate-spin" color="var(--accent)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Preparing Metadata...</span>
             </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Book Title</label>
                <input 
                  required 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter audiobook title"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Author</label>
                  <input 
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    placeholder="Optional"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Narrator</label>
                  <input 
                    value={narrator}
                    onChange={e => setNarrator(e.target.value)}
                    placeholder="Optional"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '4px' }}>
                    <input 
                        type="checkbox" 
                        checked={selectedFiles.size === chapters.length && chapters.length > 0} 
                        onChange={handleToggleAll}
                        style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chapter Title / Filename</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Length</span>
                </div>
                {chapters.map((c, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px', alignItems: 'center', gap: '8px', padding: '4px 0', opacity: selectedFiles.has(c.filename) ? 1 : 0.5 }}>
                        <input 
                            type="checkbox" 
                            checked={selectedFiles.has(c.filename)} 
                            onChange={() => handleToggleFile(c.filename)}
                            style={{ cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <input
                                value={c.title}
                                onChange={(e) => handleTitleChange(c.filename, e.target.value)}
                                disabled={!selectedFiles.has(c.filename)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    width: '100%',
                                    outline: 'none'
                                }}
                            />
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.filename}
                            </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {Math.floor(c.duration/60)}m {Math.round(c.duration%60)}s
                        </span>
                    </div>
                ))}
              </div>

              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Info size={18} color="var(--accent)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Combining {selectedFiles.size} chapters into a single M4B.
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Total Duration: {totalM}m {totalS}s
                    </p>
                </div>
              </div>

              <footer style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button 
                  type="button" 
                  onClick={onClose}
                  className="btn-glass"
                  style={{ flex: 1, padding: '0.75rem' }}
                >
                  Cancel
                </button>
                <button 
                  disabled={submitting || selectedFiles.size === 0}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.75rem', fontWeight: 600 }}
                >
                  {submitting ? 'Queuing...' : 'Confirm & Assemble'}
                </button>
              </footer>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
