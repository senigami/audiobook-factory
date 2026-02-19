import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { Panel } from './components/Panel';
import { PreviewModal } from './components/PreviewModal';
import { VoicesTab } from './components/VoicesTab';
import { SynthesisTab } from './components/SynthesisTab';
import { LibraryTab } from './components/LibraryTab';
import { useJobs } from './hooks/useJobs';
import { useInitialData } from './hooks/useInitialData';
import type { Job } from './types';

function App() {
  const { data: initialData, loading: initialLoading, refetch: refetchHome } = useInitialData();
  const { jobs, refreshJobs, testProgress } = useJobs(refetchHome);
  const [activeTab, setActiveTab] = useState<'voices' | 'synthesis' | 'library'>('synthesis');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
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
        showLogs={showLogs}
        onToggleLogs={() => setShowLogs(!showLogs)}
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
          position: 'relative'
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
                }}
                onRefresh={handleRefresh}
                speakerProfiles={initialData?.speaker_profiles || []}
                paused={initialData?.paused || false}
                settings={initialData?.settings}
                hideFinished={hideFinished}
                onToggleHideFinished={() => setHideFinished(!hideFinished)}
                onOpenPreview={setPreviewFilename}
              />
            )}
            {activeTab === 'library' && (
              <LibraryTab
                audiobooks={initialData?.audiobooks || []}
                audiobookJob={audiobookJob}
                onRefresh={handleRefresh}
                progressHelper={getRemainingAndProgress}
                formatSeconds={formatSeconds}
              />
            )}
          </main>

          {showLogs && (
            <Panel
              title={viewingJob ? `Logs: ${viewingJob.chapter_file}` : 'System Console'}
              subtitle={viewingJob?.status === 'running' ? `ETA: ${viewingJob.eta_seconds || '...'}s` : ''}
              logs={viewingJob?.log}
              filename={selectedFile || (activeJob ? activeJob.chapter_file : null)}
              progress={viewingJob?.progress}
              status={viewingJob?.status}
              startedAt={viewingJob?.started_at}
              etaSeconds={viewingJob?.eta_seconds}
              onClose={() => setShowLogs(false)}
            />
          )}
        </div>
      </Layout>


      <PreviewModal
        isOpen={!!previewFilename}
        onClose={() => setPreviewFilename(null)}
        filename={previewFilename || ''}
      />
    </div>
  );
}

export default App;
