import { render } from '@testing-library/react';
import { ChapterList } from './ChapterList';
import { vi, describe, it, expect } from 'vitest';
import type { Chapter } from '../../types';

describe('ChapterList', () => {
  const mockChapters: Chapter[] = [
    {
      id: 'chap-123',
      project_id: 'proj-1',
      title: 'Chapter 1',
      audio_status: 'done',
      audio_file_path: 'chap-123_0.wav', // Suffixed path
      has_wav: true,
      has_mp3: false,
      sort_order: 1
    } as any,
    {
      id: 'chap-456',
      project_id: 'proj-1',
      title: 'Chapter 2',
      audio_status: 'done',
      audio_file_path: null, // Missing path, relying on ID fallback
      has_wav: true,
      has_mp3: false,
      sort_order: 2
    } as any
  ];

  const defaultProps = {
    chapters: mockChapters,
    projectId: 'proj-1',
    jobs: {},
    isAssemblyMode: false,
    selectedChapters: new Set<string>(),
    onSelectChapter: vi.fn(),
    onSelectAll: vi.fn(),
    onReorder: vi.fn(),
    onEditChapter: vi.fn(),
    onRenameChapter: async () => {},
    onQueueChapter: vi.fn(),
    onResetAudio: vi.fn(),
    onDeleteChapter: vi.fn(),
    onExportSample: vi.fn(),
    isExporting: null,
    formatLength: (s: number) => `${s}s`
  };

  it('renders audio player with correct suffixed source from audio_file_path', () => {
    const { container } = render(<ChapterList {...defaultProps} />);
    
    const audioTags = container.querySelectorAll('audio');
    expect(audioTags).toHaveLength(2);
    
    const sources1 = audioTags[0].querySelectorAll('source');
    // First source is .mp3, second is .wav in my mock maybe?
    // Let's check ChapterList.tsx logic:
    // src={`/projects/${projectId}/audio/${chap.audio_file_path}`}
    // Wait, the logic I added was:
    // <source src={`/projects/${projectId}/audio/${chap.audio_file_path}`} type={chap.audio_file_path.endsWith('.mp3') ? "audio/mpeg" : "audio/wav"} />
    
    expect(sources1[0].getAttribute('src')).toBe('/projects/proj-1/audio/chap-123_0.wav');
  });

  it('falls back to chap.id when audio_file_path is missing', () => {
    const { container } = render(<ChapterList {...defaultProps} />);
    
    const audioTags = container.querySelectorAll('audio');
    const sources2 = audioTags[1].querySelectorAll('source');
    
    // Fallback logic sends .mp3 then .wav
    expect(sources2[0].getAttribute('src')).toBe('/projects/proj-1/audio/chap-456.mp3');
    expect(sources2[1].getAttribute('src')).toBe('/projects/proj-1/audio/chap-456.wav');
  });

  it('renders spinner when audio_status is processing even if no activeJob', () => {
    const processingChapter: Chapter = {
      id: 'chap-789',
      project_id: 'proj-1',
      title: 'Processing Chapter',
      audio_status: 'processing',
      audio_file_path: null,
      has_wav: false,
      has_mp3: false,
      sort_order: 3
    } as any;

    const { container } = render(<ChapterList {...defaultProps} chapters={[processingChapter]} />);
    
    // The StatusOrb renders a RefreshCw icon with animate-spin class when processing
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });
});
