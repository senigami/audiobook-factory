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
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Book Title</label>
              <input 
                required 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter audiobook title"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Author</label>
                <input 
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder="Optional"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: '#fff',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Narrator</label>
                <input 
                  value={narrator}
                  onChange={e => setNarrator(e.target.value)}
                  placeholder="Optional"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: '#fff',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    outline: 'none'
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
                style={{ 
                  flex: 1, 
                  background: 'transparent', 
                  border: '1px solid var(--border)', 
                  color: '#fff', 
                  padding: '0.75rem', 
                  borderRadius: '8px' 
                }}
              >
                Cancel
              </button>
              <button 
                disabled={submitting}
                style={{ 
                  flex: 1, 
                  background: 'var(--accent)', 
                  border: 'none', 
                  color: '#fff', 
                  padding: '0.75rem', 
                  borderRadius: '8px',
                  fontWeight: 600,
                  boxShadow: '0 10px 15px -3px var(--accent-glow)'
                }}
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
