import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Info } from 'lucide-react';

interface AssemblyModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: string[];
  onConfirm: (data: any) => Promise<void>;
}

export const AssemblyModal: React.FC<AssemblyModalProps> = ({ isOpen, onClose, chapters, onConfirm }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [narrator, setNarrator] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm({ title, author, narrator });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

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
            maxWidth: '500px',
            width: '100%',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
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

            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Info size={18} color="var(--accent)" />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                This will combine {chapters.length} chapters into a single M4B file with markers.
              </p>
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
                disabled={submitting}
                className="btn-primary"
                style={{ flex: 1, padding: '0.75rem', fontWeight: 600 }}
              >
                {submitting ? 'Queuing...' : 'Confirm & Assemble'}
              </button>
            </footer>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
