import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Panel } from './components/Panel';
import { PreviewModal } from './components/PreviewModal';
import { VoicesTab } from './components/VoicesTab';
import { ProjectLibrary } from './components/ProjectLibrary';
import { ProjectView } from './components/ProjectView';
import { GlobalQueue } from './components/GlobalQueue';
import { useJobs } from './hooks/useJobs';
import { useInitialData } from './hooks/useInitialData';
import { SettingsTray } from './components/SettingsTray';
import type { Job } from './types';

function App() {
  const [queueCount, setQueueCount] = useState(0);
  const [queueRefreshTrigger, setQueueRefreshTrigger] = useState(0);

  const fetchQueueCount = async () => {
    try {
        const res = await fetch('/api/processing_queue');
        const queueData = await res.json();
        const active = queueData.filter((q: any) => q.status === 'queued' || q.status === 'running');
        setQueueCount(active.length);
    } catch(e) { console.error('Failed to get queue count', e); }
  };

  const [segmentUpdate, setSegmentUpdate] = useState<{ chapterId: string; tick: number }>({ chapterId: '', tick: 0 });
  const { data: initialData, loading: initialLoading, refetch: refetchHome } = useInitialData();
  const { jobs, refreshJobs, testProgress } = useJobs(
    () => { refetchHome(); setQueueRefreshTrigger(prev => prev + 1); }, 
    () => { fetchQueueCount(); setQueueRefreshTrigger(prev => prev + 1); }, 
    () => refetchHome(),
    (chapterId: string) => { setSegmentUpdate(prev => ({ chapterId, tick: prev.tick + 1 })); }
  );
  
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [hideFinished, setHideFinished] = useState(false);

  useEffect(() => {
     fetchQueueCount();
     const interval = setInterval(fetchQueueCount, 3000);
     return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refetchHome(), refreshJobs()]);
  };

  const runningJobs = Object.values(jobs).filter(j => j.status === 'running' || j.status === 'queued') as Job[];
  const activeJob = runningJobs.find(j => j.engine === 'audiobook') || runningJobs[0];
  const viewingJob = activeJob;


  if (initialLoading) return null;


  return (
    <div className="app-container">
      <Layout
        showLogs={showLogs}
        onToggleLogs={() => setShowLogs(!showLogs)}
        queueCount={queueCount}
        headerRight={
          <SettingsTray 
            settings={initialData?.settings}
            onRefresh={handleRefresh}
            hideFinished={hideFinished}
            onToggleHideFinished={() => setHideFinished(!hideFinished)}
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
            <Routes>
              <Route path="/" element={<ProjectLibrary />} />
              <Route path="/project/:projectId" element={
                <ProjectView 
                  jobs={jobs}
                  speakerProfiles={initialData?.speaker_profiles || []}
                  onOpenPreview={(filename: string) => setPreviewFilename(filename)}
                  refreshTrigger={queueRefreshTrigger}
                  segmentUpdate={segmentUpdate}
                />
              } />
              <Route path="/queue" element={
                <GlobalQueue 
                  paused={initialData?.paused || false} 
                  jobs={jobs}
                  refreshTrigger={queueRefreshTrigger}
                />
              } />
              <Route path="/voices" element={
                <VoicesTab
                  speakerProfiles={initialData?.speaker_profiles || []}
                  onRefresh={handleRefresh}
                  testProgress={testProgress}
                />
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {showLogs && (
            <Panel
              title={viewingJob ? `Logs: ${viewingJob.chapter_file}` : 'System Console'}
              subtitle={viewingJob?.status === 'running' ? `ETA: ${viewingJob.eta_seconds || '...'}s` : ''}
              logs={viewingJob?.log}
              filename={activeJob ? activeJob.chapter_file : null}
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
