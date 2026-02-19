import { render, screen, fireEvent } from '@testing-library/react'
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

  it('shows "WAV" and renders audio player if MP3 is missing but WAV exists', () => {
    const staleJob = { ...mockJob, output_mp3: 'Overview.mp3' } // Stale!
    render(
      <ChapterCard
        filename="test.txt"
        job={staleJob}
        statusInfo={{
          isXttsMp3: false, // Truth!
          isXttsWav: true
        }}
        makeMp3={false}
      />
    )

    expect(screen.getAllByText(/WAV/i).length).toBeGreaterThan(0)
    // The audio element SHOULD be in the DOM now because we allow WAV fallback/priority
    expect(document.querySelector('audio')).toBeInTheDocument()
    expect(document.querySelector('audio')?.src).toContain('.wav')
  })

  it('renders audio player only when MP3 is present', () => {
    const jobWithMp3 = { ...mockJob, output_mp3: 'test.mp3' }
    render(
      <ChapterCard
        filename="test.txt"
        job={jobWithMp3}
        statusInfo={{
          isXttsMp3: true,
          isXttsWav: true
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
    // PredictiveProgressBar structure: root -> infoDiv, containerDiv -> indicatorDiv
    const indicator = progressBar.children[1].firstChild as HTMLElement;
    expect(indicator.style.width).toBe('45%');
  });

  it('applies overflow: visible and high zIndex when menu is open', () => {
    const { container } = render(<ChapterCard filename="test.txt" job={mockJob} />);

    // Find the kebab button and click it
    const kebabBtn = screen.getByTitle('More options');
    fireEvent.click(kebabBtn);

    // The main container is the motion.div
    const card = container.firstChild as HTMLElement;
    expect(card.style.overflow).toBe('visible');
    expect(card.style.zIndex).toBe('100');
  });

  it('prioritizes MP3 when makeMp3 is true', () => {
    const { container } = render(
      <ChapterCard
        filename="test.txt"
        statusInfo={{ isXttsMp3: true, isXttsWav: true }}
        makeMp3={true}
      />
    );
    const audio = container.querySelector('audio');
    expect(audio?.src).toContain('.mp3');
  });

  it('prioritizes WAV when makeMp3 is false', () => {
    const { container } = render(
      <ChapterCard
        filename="test.txt"
        statusInfo={{ isXttsMp3: true, isXttsWav: true }}
        makeMp3={false}
      />
    );
    const audio = container.querySelector('audio');
    expect(audio?.src).toContain('.wav');
  });

  it('falls back to WAV if MP3 missing when makeMp3 is true', () => {
    const { container } = render(
      <ChapterCard
        filename="test.txt"
        statusInfo={{ isXttsMp3: false, isXttsWav: true }}
        makeMp3={true}
      />
    );
    const audio = container.querySelector('audio');
    expect(audio?.src).toContain('.wav');
  });

  it('falls back to MP3 if WAV missing when makeMp3 is false', () => {
    const { container } = render(
      <ChapterCard
        filename="test.txt"
        statusInfo={{ isXttsMp3: true, isXttsWav: false }}
        makeMp3={false}
      />
    );
    const audio = container.querySelector('audio');
    expect(audio?.src).toContain('.mp3');
  });
})
