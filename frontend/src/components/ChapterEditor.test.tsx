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
    const { rerender } = render(
      <ChapterEditor 
        chapterId="chap1" 
        projectId="proj1" 
        speakerProfiles={[]} 
        onBack={() => {}} 
        onNavigateToQueue={() => {}} 
      />
    )

    // Wait for loading to finish
    expect(await screen.findByDisplayValue('Test Chapter')).toBeInTheDocument()
    
    // By default it should be "Saved"
    expect(screen.getByText('Saved')).toBeInTheDocument()

    // 2. Mock server returning CRLF version (which was the bug)
    const chapterWithCRLF = { ...mockChapter, text_content: 'Line 1.\r\nLine 2.' }
    ;(api.fetchChapters as any).mockResolvedValue([chapterWithCRLF])

    rerender(
      <ChapterEditor 
        chapterId="chap1" 
        projectId="proj1" 
        speakerProfiles={[]} 
        onBack={() => {}} 
        onNavigateToQueue={() => {}} 
      />
    )

    // Wait for state to update
    expect(await screen.findByDisplayValue('Test Chapter')).toBeInTheDocument()

    // Check if it's still "Saved" because of our fix
    // It should normalize 'Line 1.\r\nLine 2.' (from server/state) vs local state
    expect(screen.getByText('Saved')).toBeInTheDocument()
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
         onBack={() => {}} 
         onNavigateToQueue={() => {}} 
       />
     )

     expect(await screen.findByDisplayValue(/Unique Title/i)).toBeInTheDocument()
     
     // Should be "Saved" because we trim() in the comparison now
     expect(screen.getByText('Saved')).toBeInTheDocument()
  })
})
