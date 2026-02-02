import { useState, useEffect, useCallback } from 'react';
import type { Job } from '../types';
import { api } from '../api';
import { useWebSocket } from './useWebSocket';

export const useJobs = () => {
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [loading, setLoading] = useState(true);

  const refreshJobs = useCallback(async () => {
    try {
      const data = await api.fetchJobs();
      const jobMap = data.reduce((acc, job) => {
        acc[job.chapter_file] = job;
        return acc;
      }, {} as Record<string, Job>);
      setJobs(jobMap);
    } catch (e) {
      console.error('Failed to refresh jobs', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdate = useCallback((data: any) => {
    if (data.type === 'job_updated') {
      const { job_id, updates } = data;
      setJobs(prev => {
        // Find by ID
        const filename = Object.keys(prev).find(f => prev[f].id === job_id);
        if (!filename) {
          // If not found, it might be a new job, so refresh list
          refreshJobs();
          return prev;
        }

        const newJob = { ...prev[filename], ...updates };
        return { ...prev, [filename]: newJob };
      });
    }
  }, [refreshJobs]);

  const { connected } = useWebSocket('/ws', handleUpdate);

  useEffect(() => {
    refreshJobs();
    // Fallback polling: infrequent if WS is up, frequent if down
    const timer = setInterval(refreshJobs, connected ? 60000 : 5000);
    return () => clearInterval(timer);
  }, [refreshJobs, connected]);

  return { jobs, loading, refreshJobs };
};
