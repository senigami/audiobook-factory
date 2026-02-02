import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { vi, describe, it, expect } from 'vitest'

describe('Sidebar', () => {
  const defaultProps = {
    onOpenAssembly: vi.fn(),
    piperVoices: [],
    audiobooks: [],
    paused: false,
    narratorOk: true,
    hideFinished: false,
    onToggleHideFinished: vi.fn(),
    onRefresh: vi.fn(),
  }

  it('calls the correct backfill_mp3 endpoint when button is clicked', async () => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    
    render(<Sidebar {...defaultProps} />)
    
    const backfillButton = screen.getByText(/Resolve Missing MP3s/i)
    fireEvent.click(backfillButton)
    
    expect(global.fetch).toHaveBeenCalledWith('/queue/backfill_mp3', expect.objectContaining({
      method: 'POST'
    }))
  })
})
