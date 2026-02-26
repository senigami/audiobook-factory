import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from '../App'
import { vi, describe, it, expect, beforeEach } from 'vitest'

describe('App', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url === '/api/home') {
        return Promise.resolve({
          json: () => Promise.resolve({
            projects: [],
            speaker_profiles: [
              { name: 'v1', speed: 1.0, wav_count: 1, is_default: true, preview_url: null },
              { name: 'v2', speed: 1.2, wav_count: 2, is_default: false, preview_url: null }
            ],
            paused: false
          })
        })
      }
      if (url === '/api/jobs') {
        return Promise.resolve({
          json: () => Promise.resolve([])
        })
      }
      if (url === '/api/processing_queue') {
        return Promise.resolve({
          json: () => Promise.resolve([])
        })
      }
      if (url === '/api/projects') {
        return Promise.resolve({
          json: () => Promise.resolve([])
        })
      }
      return Promise.resolve({ json: () => Promise.resolve({}) })
    }) as any
  })

  it('renders without crashing and fetches initials', async () => {
    render(<App />)
    
    await waitFor(() => {
      expect(screen.getByText('Audiobook')).toBeTruthy()
    })
  })

  it('switches tabs', async () => {
    render(<App />)
    await waitFor(() => {
        expect(screen.getByText('Audiobook')).toBeTruthy()
    })

    const queueTab = screen.getByText('Queue')
    fireEvent.click(queueTab)

    await waitFor(() => {
        expect(screen.getByText('The queue is currently empty.')).toBeTruthy()
    })

    const voicesTab = screen.getByText('Voices')
    fireEvent.click(voicesTab)

    await waitFor(() => {
        expect(screen.getByText('Available Narrators')).toBeTruthy()
    })
  })
})
