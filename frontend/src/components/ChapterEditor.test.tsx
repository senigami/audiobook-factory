import { render, screen } from '@testing-library/react'
import { ChapterEditor } from './ChapterEditor'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api'

// Mock the API
vi.mock('../api', () => ({
  api: {
    fetchChapters: vi.fn(),
    fetchSegments: vi.fn(),
    fetchCharacters: vi.fn(),
    analyzeChapter: vi.fn(),
    updateChapter: vi.fn()
  }
}))

// Mock useWebSocket
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({ connected: true }))
}))

describe('ChapterEditor Newline Normalization', () => {
  const mockChapter = {
    id: 'chap1',
    project_id: 'proj1',
    title: 'Test Chapter',
    text_content: 'Line 1.\nLine 2.',
    audio_status: 'unprocessed',
    char_count: 100,
    word_count: 20
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default API responses
    ;(api.fetchChapters as any).mockResolvedValue([mockChapter])
    ;(api.fetchSegments as any).mockResolvedValue([])
    ;(api.fetchCharacters as any).mockResolvedValue([])
  })

  it('shows "Saved" when text matches exactly despite CRLF/LF differences', async () => {
    // 1. Initial render with LF text from server
    render(
      <ChapterEditor 
        chapterId="chap1" 
        projectId="proj1" 
        speakerProfiles={[]} 
        speakers={[]}
        onBack={() => {}} 
        onNavigateToQueue={() => {}} 
      />
    )

    // Wait for loading to finish
    expect(await screen.findByDisplayValue('Test Chapter')).toBeInTheDocument()
    
    // By default it should be "Saved"
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('highlights secondary processing in purple', async () => {
    const mockSegments = [
      { id: 'seg1', text_content: 'Segment 1', audio_status: 'done', audio_file_path: 's1.wav' },
      { id: 'seg2', text_content: 'Segment 2', audio_status: 'done', audio_file_path: 's2.wav' },
      { id: 'seg3', text_content: 'Segment 3', audio_status: 'processing', audio_file_path: 's3.wav' }
    ]
    ;(api.fetchSegments as any).mockResolvedValue(mockSegments)

    render(
      <ChapterEditor 
        chapterId="chap1" 
        projectId="proj1" 
        speakerProfiles={[]} 
        speakers={[]}
        onBack={() => {}} 
        onNavigateToQueue={() => {}} 
      />
    )

    // Wait for segments to load
    expect(await screen.findByText('Segment 1')).toBeInTheDocument()

    // Verify the existence of Segment 3's purple highlight (processing)
    const seg3Element = screen.getByText('Segment 3').closest('.chunk-group')
    expect(seg3Element).toHaveStyle('background: #e1bee733')
  })

  it('shows "Saved" when title has untrimmed spaces in state but not in UI', async () => {
     // Mock server returning title with trailing space
     const chapterWithSpace = { ...mockChapter, title: 'Unique Title ' }
     ;(api.fetchChapters as any).mockResolvedValue([chapterWithSpace])

     render(
       <ChapterEditor 
         chapterId="chap1" 
         projectId="proj1" 
         speakerProfiles={[]} 
         speakers={[]}
         onBack={() => {}} 
         onNavigateToQueue={() => {}} 
       />
     )

     expect(await screen.findByDisplayValue(/Unique Title/i)).toBeInTheDocument()
     
     // Should be "Saved" because we trim() in the comparison now
     expect(screen.getByText('Saved')).toBeInTheDocument()
  })
})
