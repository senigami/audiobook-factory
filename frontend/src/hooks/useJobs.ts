import { useState, useEffect, useCallback, useRef } from 'react';
import type { Job } from '../types';
import { api } from '../api';
import { useWebSocket } from './useWebSocket';

export const useJobs = (onJobComplete?: () => void) => {
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [loading, setLoading] = useState(true);
  const prevJobsRef = useRef<Record<string, Job>>({});

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

  const [testProgress, setTestProgress] = useState<Record<string, number>>({});

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

        const oldJob = prev[filename];
        const newJob = { ...oldJob, ...updates };

        return { ...prev, [filename]: newJob };
      });
    } else if (data.type === 'test_progress') {
      const { name, progress } = data;
      setTestProgress(prev => ({ ...prev, [name]: progress }));
    }
  }, [refreshJobs]);

  const { connected } = useWebSocket('/ws', handleUpdate);

  // Monitor jobs for completions to trigger global data refresh
  useEffect(() => {
    const hasNewCompletion = Object.values(jobs).some(j => {
      // Find this job in a ref of previous jobs to see if it just finished
      const wasDone = prevJobsRef.current[j.chapter_file]?.status === 'done';
      return !wasDone && j.status === 'done';
    });

    if (hasNewCompletion) {
      onJobComplete?.();
    }
    prevJobsRef.current = jobs;
  }, [jobs, onJobComplete]);

  useEffect(() => {
    refreshJobs();
    // Fallback polling: infrequent if WS is up, frequent if down
    const timer = setInterval(refreshJobs, connected ? 60000 : 5000);
    return () => clearInterval(timer);
  }, [refreshJobs, connected]);

  return { jobs, loading, refreshJobs, testProgress };
};
