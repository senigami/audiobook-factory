import { useState } from 'react';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { ChapterGrid } from './components/ChapterGrid';
import { Panel } from './components/Panel';
import { AssemblyModal } from './components/AssemblyModal';
import { useJobs } from './hooks/useJobs';
import { useInitialData } from './hooks/useInitialData';

function App() {
  const { data: initialData, loading: initialLoading, refetch: refetchHome } = useInitialData();
  const { jobs, refreshJobs } = useJobs();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAssemblyOpen, setIsAssemblyOpen] = useState(false);
  const [hideFinished, setHideFinished] = useState(false);

  const handleRefresh = async () => {
    await Promise.all([refetchHome(), refreshJobs()]);
  };

  const activeJob = Object.values(jobs).find(j => j.status === 'running');
  const viewingJob = selectedFile ? jobs[selectedFile] : activeJob;

  const chaptersToShow = (initialData?.chapters || []).filter(c => {
    if (!hideFinished) return true;
    const isFinished = (initialData?.xtts_mp3 || []).includes(c) || 
                       (initialData?.piper_mp3 || []).includes(c) || 
                       (initialData?.xtts_wav_only || []).includes(c) || 
                       (initialData?.piper_wav_only || []).includes(c);
    return !isFinished;
  });

  if (initialLoading) return null;

  return (
    <div className="app-container">
      <Layout sidebar={
        <Sidebar 
          onOpenAssembly={() => setIsAssemblyOpen(true)}
          settings={initialData?.settings}
          piperVoices={initialData?.piper_voices || []}
          audiobooks={initialData?.audiobooks || []}
          paused={initialData?.paused || false}
          narratorOk={initialData?.narrator_ok || false}
          hideFinished={hideFinished}
          onToggleHideFinished={() => setHideFinished(!hideFinished)}
          onRefresh={handleRefresh}
        />
      }>
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '2rem',
          gap: '2rem',
          minWidth: 0,
          overflowX: 'hidden'
        }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Chapters</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {initialData?.chapters.length || 0} files ready for processing
              </p>
            </div>
            
            <div className="glass-panel" style={{ display: 'flex', gap: '4px', padding: '4px' }}>
              <button 
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}
                style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
              >
                Grid
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}
                style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
              >
                List
              </button>
            </div>
          </header>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <ChapterGrid 
              chapters={chaptersToShow}
              jobs={jobs}
              selectedFilename={selectedFile}
              onSelect={setSelectedFile}
              viewMode={viewMode}
              onRefresh={handleRefresh}
              statusSets={{
                xttsMp3: initialData?.xtts_mp3 || [],
                xttsWav: initialData?.xtts_wav_only || [],
                piperMp3: initialData?.piper_mp3 || [],
                piperWav: initialData?.piper_wav_only || [],
              }}
            />
          </div>

            <Panel 
              title={viewingJob ? `Logs: ${viewingJob.chapter_file}` : 'System Console'}
              subtitle={viewingJob?.status === 'running' ? `ETA: ${viewingJob.eta_seconds || '...'}s` : ''}
              logs={viewingJob?.log}
              filename={selectedFile || (activeJob ? activeJob.chapter_file : null)}
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
            
            await fetch('/create_audiobook', { 
              method: 'POST', 
              body: formData 
            });
            refetchHome();
          }}
        />
      </div>
    );
  }

export default App;
