import React, { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { Trash2, GripVertical, CheckCircle, Clock, Layers, Play, Pause, XCircle } from 'lucide-react';
import { api } from '../api';
import type { ProcessingQueueItem, Job } from '../types';
import { PredictiveProgressBar } from './PredictiveProgressBar';

interface GlobalQueueProps {
    paused?: boolean;
    jobs?: Record<string, Job>;
    refreshTrigger?: number;
    onRefresh?: () => void;
}

export const GlobalQueue: React.FC<GlobalQueueProps> = ({ paused = false, jobs = {}, refreshTrigger = 0, onRefresh }) => {
  const [queue, setQueue] = useState<ProcessingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [localPaused, setLocalPaused] = useState(paused);

  useEffect(() => {
    setLocalPaused(paused);
  }, [paused]);

  const fetchQueue = async () => {
    try {
      const data = await api.getProcessingQueue();
      setQueue(data);
    } catch (e) {
      console.error("Failed to fetch queue", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseToggle = async () => {
    const targetState = !localPaused;
    setLocalPaused(targetState);
    try {
      const endpoint = targetState ? '/queue/pause' : '/queue/resume';
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      console.log(`Queue ${targetState ? 'paused' : 'resumed'}:`, data);
      if (onRefresh) onRefresh();
      fetchQueue();
    } catch (e) {
      console.error('Failed to toggle pause', e);
      setLocalPaused(!targetState); // Revert on failure
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [refreshTrigger]);

  // Re-fetch queue from server whenever live job data changes,
  // ensuring status sync even if a WS event was missed during tab navigation.
  useEffect(() => {
    // Also sync local state immediately from jobs prop
    setQueue(prev => {
      let changed = false;
      const updated = prev.map(q => {
        const liveJob = Object.values(jobs).find(j => j.id === q.id);
        if (liveJob && liveJob.status !== q.status) {
          changed = true;
          return { ...q, status: liveJob.status };
        }
        return q;
      });
      return changed ? updated : prev;
    });
  }, [jobs]);

  // Safety-net polling: infrequent fallback in case a WS event was missed
  useEffect(() => {
    const timer = setInterval(fetchQueue, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleReorder = async (newOrder: ProcessingQueueItem[]) => {
    // Only allow reordering of queued items
    const nonQueued = queue.filter(q => q.status !== 'queued');
    const correctlyOrdered = [...nonQueued, ...newOrder.filter(q => q.status === 'queued')];
    setQueue(correctlyOrdered);
    
    try {
        await api.reorderProcessingQueue(newOrder.filter(q => q.status === 'queued').map(q => q.id));
    } catch (e) {
        console.error(e);
        fetchQueue();
    }
  };

  const handleRemove = async (id: string) => {
    try {
        await api.removeProcessingQueue(id);
        fetchQueue();
    } catch (e) {
        console.error(e);
    }
  };

  const activeJobs = queue.filter(q => q.status === 'running');
  const pendingJobs = queue.filter(q => q.status === 'queued');
  const pastJobs = queue.filter(q => q.status === 'done' || q.status === 'failed' || q.status === 'cancelled');

  if (loading) return <div style={{ padding: '2rem' }}>Loading Queue...</div>;

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100%', paddingBottom: '4rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
             <Layers size={24} color="var(--accent)" /> Global Processing Queue
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage your batch audio generation tasks</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
                onClick={handlePauseToggle}
                className="btn-glass"
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '10px 16px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border)', 
                    color: localPaused ? 'var(--warning)' : 'var(--success)',
                    background: localPaused ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                }}
            >
                {localPaused ? <Play size={16} /> : <Pause size={16} />}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{localPaused ? 'Resume Processing' : 'Pause All Jobs'}</span>
            </button>
            <button onClick={async () => { await api.clearProcessingQueue(); fetchQueue(); }} className="btn-ghost" style={{ color: 'var(--error-muted)' }}>
              Clear Queue
            </button>
        </div>
      </header>

      {queue.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
          <p style={{ color: 'var(--text-muted)' }}>The queue is currently empty.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Active Job */}
          {activeJobs.length > 0 && (
              <div>
                  <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>Processing Now</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {activeJobs.map(job => {
                          const liveJob = Object.values(jobs).find(j => j.id === job.id);
                          const prog = liveJob?.progress ?? job.progress ?? 0;
                          const started = liveJob?.started_at ?? job.started_at;
                          const eta = liveJob?.eta_seconds ?? job.eta_seconds;

                          return (
                          <div key={job.id} style={{
                              background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--accent)',
                              borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
                              boxShadow: '0 0 20px rgba(139, 92, 246, 0.15)'
                          }}>
                              <Play size={24} color="var(--accent)" className="animate-pulse" />
                              <div style={{ flex: 1 }}>
                                  <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>{job.chapter_title}</h4>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Project: {job.project_name} • Part {job.split_part + 1}</div>
                                  <PredictiveProgressBar 
                                    progress={prog}
                                    startedAt={started}
                                    etaSeconds={eta}
                                    label="Processing..."
                                  />
                              </div>
                          </div>
                      )})}
                  </div>
              </div>
          )}

          {/* Pending Jobs */}
          {pendingJobs.length > 0 && (
              <div>
                  <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>Up Next</h3>
                  <Reorder.Group axis="y" values={pendingJobs} onReorder={handleReorder} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {pendingJobs.map(job => (
                          <Reorder.Item 
                            key={job.id} 
                            value={job}
                            style={{
                                background: 'var(--surface)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)',
                                display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'grab'
                            }}
                            whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 50, cursor: 'grabbing' }}
                          >
                            <div style={{ cursor: 'grab', color: 'var(--text-muted)' }} title="Drag to reorder"><GripVertical size={20} /></div>
                            <Clock size={20} color="var(--text-muted)" />
                            
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{job.chapter_title}</h4>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Project: {job.project_name} • Part {job.split_part + 1}</div>
                            </div>

                            <button onClick={() => handleRemove(job.id)} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--error-muted)' }}>
                                <Trash2 size={18} />
                            </button>
                          </Reorder.Item>
                      ))}
                  </Reorder.Group>
              </div>
          )}

          {/* Past Jobs */}
          {pastJobs.length > 0 && (
              <div>
                  <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>Completed / Failed</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: 0.7 }}>
                      {pastJobs.map(job => (
                          <div key={job.id} style={{
                              background: 'var(--surface)', border: '1px solid var(--border)',
                              borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
                          }}>
                              {job.status === 'done' ? <CheckCircle size={20} color="var(--success-muted)" /> : <XCircle size={20} color="var(--error-muted)" />}
                              <div style={{ flex: 1 }}>
                                  <h4 style={{ fontWeight: 600, fontSize: '1.1rem', textDecoration: job.status === 'cancelled' ? 'line-through' : 'none' }}>{job.chapter_title}</h4>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Project: {job.project_name} • Status: {job.status}</div>
                              </div>
                              <button onClick={() => handleRemove(job.id)} className="btn-ghost" style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
                                <Trash2 size={16} />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          )}

        </div>
      )}
    </div>
  );
};
