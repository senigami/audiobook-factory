import { render, screen } from '@testing-library/react'
import { ChapterCard } from './ChapterCard'
import { describe, it, expect } from 'vitest'
import type { Job } from '../types'

describe('ChapterCard', () => {
  const mockJob: Job = {
    id: '1',
    chapter_file: 'test.txt',
    status: 'done',
    make_mp3: true,
    output_wav: 'test.wav',
    output_mp3: null, // MP3 is missing!
    progress: 1,
    created_at: Date.now(),
    warning_count: 0,
    engine: 'xtts',
    safe_mode: true
  }

  it('shows "WAV ready (Needs MP3)" even if job state is stale but disk is empty', () => {
    const staleJob = { ...mockJob, output_mp3: 'Overview.mp3' } // Stale!
    render(
      <ChapterCard
        filename="test.txt"
        job={staleJob}
        statusInfo={{
          isXttsMp3: false, // Truth!
          isXttsWav: true,
          isPiperMp3: false,
          isPiperWav: false
        }}
      />
    )

    expect(screen.getAllByText(/WAV Ready/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('audio')).not.toBeInTheDocument()
    // The audio element should NOT be in the DOM
    expect(document.querySelector('audio')).not.toBeInTheDocument()
  })

  it('renders audio player only when MP3 is present', () => {
    const jobWithMp3 = { ...mockJob, output_mp3: 'test.mp3' }
    render(
      <ChapterCard
        filename="test.txt"
        job={jobWithMp3}
        statusInfo={{
          isXttsMp3: true,
          isXttsWav: true,
          isPiperMp3: false,
          isPiperWav: false
        }}
      />
    )

    // The audio element itself might not be easily found by role depending on lib, 
    // but we can check for its presence in the DOM.
    const audio = document.querySelector('audio')
    expect(audio).toBeInTheDocument()
  })

  it('renders progress bar when status is "running"', () => {
    const runningJob = { ...mockJob, status: 'running' as const, progress: 0.45 };
    render(
      <ChapterCard
        filename="test.txt"
        job={runningJob}
      />
    )

    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toBeInTheDocument();
    // Check if the inner motion.div has the correct width
    const indicator = progressBar.firstChild as HTMLElement;
    expect(indicator.style.width).toBe('45%');
  });
})
