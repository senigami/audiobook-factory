import type { Job } from '../types';

export const api = {
  fetchJobs: async (): Promise<Job[]> => {
    const res = await fetch('/api/jobs');
    return res.json();
  },
  fetchActiveJob: async (): Promise<Job | null> => {
    const res = await fetch('/api/active_job');
    return res.json();
  },
  fetchJobDetails: async (filename: string): Promise<Job | null> => {
    const res = await fetch(`/api/job/${encodeURIComponent(filename)}`);
    return res.json();
  },
  fetchPreview: async (filename: string, processed: boolean = false): Promise<{ text: string; error?: string }> => {
    const res = await fetch(`/api/preview/${encodeURIComponent(filename)}?processed=${processed}`);
    return res.json();
  },
  updateTitle: async (filename: string, newTitle: string): Promise<any> => {
    const formData = new FormData();
    formData.append('chapter_file', filename);
    formData.append('new_title', newTitle);
    const res = await fetch('/api/job/update_title', { method: 'POST', body: formData });
    return res.json();
  },
  deleteAudiobook: async (filename: string): Promise<any> => {
    const res = await fetch(`/api/audiobook/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    return res.json();
  },
  resetChapter: async (filename: string): Promise<any> => {
    const formData = new FormData();
    formData.append('chapter_file', filename);
    const res = await fetch('/api/chapter/reset', { method: 'POST', body: formData });
    return res.json();
  },
  deleteChapter: async (filename: string): Promise<any> => {
    const res = await fetch(`/api/chapter/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    return res.json();
  },
  // Basic helper for home data (since the / route returns HTML, we might need a dedicated API endpoint for initial state)
  // For now, we'll mimic the SSR data by calling specific APIs.
};
