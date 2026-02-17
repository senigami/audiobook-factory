import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { vi, describe, it, expect } from 'vitest'

describe('Sidebar', () => {
  const defaultProps = {
    paused: false,
    onRefresh: vi.fn(),
  }

  it('renders status and pause button correctly', () => {
    const { rerender } = render(<Sidebar {...defaultProps} />)

    expect(screen.getByText(/Monitoring Queue/i)).toBeTruthy()
    expect(screen.getByText(/Pause All Jobs/i)).toBeTruthy()

    rerender(<Sidebar {...defaultProps} paused={true} />)
    expect(screen.getByText(/System Idle/i)).toBeTruthy()
    expect(screen.getByText(/Resume Processing/i)).toBeTruthy()
  })

  it('calls the pause toggle endpoint when clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    render(<Sidebar {...defaultProps} />)

    const pauseButton = screen.getByText(/Pause All Jobs/i)
    fireEvent.click(pauseButton)

    expect(global.fetch).toHaveBeenCalledWith('/queue/pause', expect.objectContaining({
      method: 'POST'
    }))

    await waitFor(() => {
      expect(defaultProps.onRefresh).toHaveBeenCalled()
    })
  })
})
