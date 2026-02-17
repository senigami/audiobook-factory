import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { Panel } from './components/Panel';
import { AssemblyModal } from './components/AssemblyModal';
import { VoicesTab } from './components/VoicesTab';
import { SynthesisTab } from './components/SynthesisTab';
import { LibraryTab } from './components/LibraryTab';
import { SettingsTab } from './components/SettingsTab';
import { useJobs } from './hooks/useJobs';
import { useInitialData } from './hooks/useInitialData';
import type { Job } from './types';

function App() {
  const { data: initialData, loading: initialLoading, refetch: refetchHome } = useInitialData();
  const { jobs, refreshJobs, testProgress } = useJobs(refetchHome);
  const [activeTab, setActiveTab] = useState<'voices' | 'synthesis' | 'library' | 'settings'>('synthesis');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isAssemblyOpen, setIsAssemblyOpen] = useState(false);
  const [hideFinished, setHideFinished] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refetchHome(), refreshJobs()]);
  };

  const getRemainingAndProgress = (job: Job) => {
    if (job.status !== 'running' || !job.started_at || !job.eta_seconds) {
      return { remaining: null, progress: job.progress || 0 };
    }
    const elapsed = (now / 1000) - job.started_at;
    const timeProgress = Math.min(0.99, elapsed / job.eta_seconds);
    const currentProgress = Math.max(job.progress || 0, timeProgress);

    const blend = Math.min(1.0, currentProgress / 0.25);
    const estimatedRemaining = Math.max(0, job.eta_seconds - elapsed);
    const actualRemaining = (currentProgress > 0.01) ? (elapsed / currentProgress) - elapsed : estimatedRemaining;
    const refinedRemaining = (estimatedRemaining * (1 - blend)) + (actualRemaining * blend);

    return {
      remaining: Math.max(0, Math.floor(refinedRemaining)),
      progress: currentProgress
    };
  };

  const formatSeconds = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const runningJobs = Object.values(jobs).filter(j => j.status === 'running' || j.status === 'queued');
  const activeJob = runningJobs.find(j => j.engine === 'audiobook') || runningJobs[0];
  const viewingJob = selectedFile ? jobs[selectedFile] : activeJob;

  const chaptersToShow = (initialData?.chapters || []).filter(c => {
    if (!hideFinished) return true;
    const isFinished = (initialData?.xtts_mp3 || []).includes(c) ||
      (initialData?.xtts_wav_only || []).includes(c);
    return !isFinished;
  });

  if (initialLoading) return null;

  const audiobookJob = Object.values(jobs).find(j => j.engine === 'audiobook' && (j.status === 'running' || j.status === 'queued'));

  return (
    <div className="app-container">
      <Layout
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        headerRight={
          <Sidebar
            paused={initialData?.paused || false}
            onRefresh={handleRefresh}
          />
        }
      >
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '2.5rem',
          minWidth: 0,
          overflowX: 'hidden'
        }}>
          <main style={{ flex: 1 }}>
            {activeTab === 'voices' && (
              <VoicesTab
                speakerProfiles={initialData?.speaker_profiles || []}
                onRefresh={handleRefresh}
                testProgress={testProgress}
              />
            )}
            {activeTab === 'synthesis' && (
              <SynthesisTab
                chapters={chaptersToShow}
                jobs={jobs}
                selectedFile={selectedFile}
                onSelect={setSelectedFile}
                statusSets={{
                  xttsMp3: initialData?.xtts_mp3 || [],
                  xttsWav: initialData?.xtts_wav_only || [],
                  piperMp3: [],
                  piperWav: [],
                }}
                onRefresh={handleRefresh}
                speakerProfiles={initialData?.speaker_profiles || []}
                paused={initialData?.paused || false}
              />
            )}
            {activeTab === 'library' && (
              <LibraryTab
                audiobooks={initialData?.audiobooks || []}
                audiobookJob={audiobookJob}
                onOpenAssembly={() => setIsAssemblyOpen(true)}
                onRefresh={handleRefresh}
                progressHelper={getRemainingAndProgress}
                formatSeconds={formatSeconds}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                settings={initialData?.settings}
                hideFinished={hideFinished}
                onToggleHideFinished={() => setHideFinished(!hideFinished)}
                onRefresh={handleRefresh}
              />
            )}
          </main>

          <Panel
            title={viewingJob ? `Logs: ${viewingJob.chapter_file}` : 'System Console'}
            subtitle={viewingJob?.status === 'running' ? `ETA: ${viewingJob.eta_seconds || '...'}s` : ''}
            logs={viewingJob?.log}
            filename={selectedFile || (activeJob ? activeJob.chapter_file : null)}
            progress={viewingJob?.progress}
            status={viewingJob?.status}
            startedAt={viewingJob?.started_at}
            etaSeconds={viewingJob?.eta_seconds}
          />
        </div>
      </Layout>

      <AssemblyModal
        isOpen={isAssemblyOpen}
        onClose={() => setIsAssemblyOpen(false)}
        onConfirm={async (data) => {
          const formData = new FormData();
          formData.append('title', data.title);
          formData.append('author', data.author);
          formData.append('narrator', data.narrator);
          formData.append('chapters', JSON.stringify(data.chapters));

          const resp = await fetch('/create_audiobook', {
            method: 'POST',
            body: formData
          });

          if (resp.ok) {
            setActiveTab('library');
            await Promise.all([refetchHome(), refreshJobs()]);
          } else {
            const err = await resp.json();
            alert(`Failed to start assembly: ${err.message || resp.statusText}`);
          }
        }}
      />
    </div>
  );
}

export default App;
